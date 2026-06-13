/**
 * Google Places API helpers for Trip Wizard enrichment.
 *
 * All functions return null when GOOGLE_PLACES_API_KEY is unset or the
 * API call fails — callers treat null as "not enriched" and set
 * google_verified: false on the suggestion.
 */

const API_KEY  = process.env.GOOGLE_PLACES_API_KEY ?? '';
const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface PlaceEnrichment {
  place_id:           string;
  formatted_address:  string;
  google_rating:      number | null;
  user_ratings_total: number | null;
  price_level:        number | null;
  photo_url:          string | null;
  website:            string | null;
  phone:              string | null;
  lat:                number | null;
  lng:                number | null;
}

interface TextSearchResult {
  place_id:           string;
  name?:              string;
  formatted_address:  string;
  rating?:            number;
  user_ratings_total?: number;
  price_level?:       number;
  types?:             string[];
  geometry?:          { location: { lat: number; lng: number } };
  photos?:            Array<{ photo_reference: string }>;
}

interface TextSearchResponse {
  status:  string;
  results: TextSearchResult[];
}

interface PlaceDetailsResponse {
  status: string;
  result: {
    website?:                string;
    formatted_phone_number?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a Places photo URL (key is embedded — scope your API key to Places only).
 */
export function buildPhotoUrl(photoReference: string, maxWidth = 800): string {
  return `${BASE_URL}/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${API_KEY}`;
}

/**
 * Follow the Places photo redirect and return the permanent CDN URL.
 * The Places /photo endpoint redirects to a CDN; storing the redirect URL
 * rather than the API URL means the stored URL doesn't expose the API key
 * and doesn't require a re-fetch at display time.
 */
export async function resolvePhotoUrl(
  photoReference: string,
  maxWidth = 800,
): Promise<string | null> {
  try {
    const directUrl = buildPhotoUrl(photoReference, maxWidth);
    const res = await fetch(directUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.url;
  } catch (err) {
    console.error('[Places] resolvePhotoUrl failed:', err);
    return null;
  }
}

/**
 * Text Search: find a place by name + city + state.
 * Returns the first match or null.
 */
async function textSearch(name: string, city: string, state: string): Promise<TextSearchResult | null> {
  const query = `${name} ${city} ${state}`;
  const url   = `${BASE_URL}/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;

  const res  = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json() as TextSearchResponse;

  if (data.status !== 'OK' || !data.results.length) return null;
  return data.results[0];
}

/**
 * Place Details: retrieve website and phone for a place_id.
 */
async function placeDetails(placeId: string): Promise<PlaceDetailsResponse['result'] | null> {
  const fields = 'website,formatted_phone_number';
  const url    = `${BASE_URL}/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${API_KEY}`;

  const res  = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json() as PlaceDetailsResponse;

  if (data.status !== 'OK') return null;
  return data.result;
}

// ── Generic category search (e.g. "hotels in Charleston, WV") ─────────────────

export interface PlaceSearchResult {
  place_id:           string;
  name:               string;
  formatted_address:  string;
  rating:             number | null;
  user_ratings_total: number | null;
  price_level:        number | null;
  photo_url:          string | null;
  types:              string[];
  lat:                number | null;
  lng:                number | null;
}

/**
 * Text Search for a free-form query (e.g. "BBQ restaurants in Charleston, WV").
 * Returns up to `limit` results, each enriched with a resolved photo URL.
 */
export async function searchPlaces(query: string, limit = 5): Promise<PlaceSearchResult[]> {
  if (!API_KEY) return [];

  try {
    const url = `${BASE_URL}/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json() as TextSearchResponse;

    if (data.status !== 'OK' || !data.results.length) return [];

    const top = data.results.slice(0, limit);
    return await Promise.all(top.map(async (r) => ({
      place_id:           r.place_id,
      name:               r.name ?? '',
      formatted_address:  r.formatted_address,
      rating:             r.rating             ?? null,
      user_ratings_total: r.user_ratings_total ?? null,
      price_level:        r.price_level        ?? null,
      photo_url:          r.photos?.[0]?.photo_reference ? await resolvePhotoUrl(r.photos[0].photo_reference) : null,
      types:              r.types ?? [],
      lat:  r.geometry?.location.lat ?? null,
      lng:  r.geometry?.location.lng ?? null,
    })));
  } catch {
    return [];
  }
}

/**
 * Main enrichment entry point.
 *
 * Searches for `name` in `city, state`, then optionally fetches website/phone.
 * Returns null when the API key is absent or no match is found.
 */
export async function enrichPlace(
  name:  string,
  city:  string,
  state: string,
  fetchDetails = true,
): Promise<PlaceEnrichment | null> {
  if (!API_KEY) return null;

  try {
    const match = await textSearch(name, city, state);
    if (!match) return null;

    const photoRef = match.photos?.[0]?.photo_reference ?? null;
    let website: string | null = null;
    let phone:   string | null = null;

    if (fetchDetails) {
      const details = await placeDetails(match.place_id).catch(() => null);
      website = details?.website              ?? null;
      phone   = details?.formatted_phone_number ?? null;
    }

    return {
      place_id:           match.place_id,
      formatted_address:  match.formatted_address,
      google_rating:      match.rating             ?? null,
      user_ratings_total: match.user_ratings_total ?? null,
      price_level:        match.price_level        ?? null,
      photo_url:          photoRef ? await resolvePhotoUrl(photoRef) : null,
      website,
      phone,
      lat:  match.geometry?.location.lat ?? null,
      lng:  match.geometry?.location.lng ?? null,
    };
  } catch {
    // Network error, quota exceeded, etc. — degrade gracefully.
    return null;
  }
}

// ── Directions & fuel estimates ─────────────────────────────────────────────

export const MILES_PER_GALLON       = 25;
export const FUEL_PRICE_PER_GALLON  = 3.50;
export const GAS_STOP_THRESHOLD_MILES = 250;

export interface DriveLeg {
  minutes: number;
  miles:   number;
}

interface DirectionsResponse {
  status: string;
  routes: Array<{
    legs: Array<{
      duration: { value: number };
      distance: { value: number };
    }>;
  }>;
}

/**
 * Drive time + distance between two addresses via the Directions API.
 * Returns null when the API key is unset, the request fails, or no route is found.
 */
export async function getDriveLeg(origin: string, destination: string): Promise<DriveLeg | null> {
  if (!API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json`
      + `?origin=${encodeURIComponent(origin)}`
      + `&destination=${encodeURIComponent(destination)}`
      + `&key=${API_KEY}`;
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json() as DirectionsResponse;

    if (data.status !== 'OK' || !data.routes.length) return null;
    const leg = data.routes[0].legs[0];
    return {
      minutes: Math.round(leg.duration.value / 60),
      miles:   Math.round(leg.distance.value / 1609.34),
    };
  } catch {
    return null;
  }
}

/** Rough fuel cost for a leg, given the app-wide MPG/price assumptions. */
export function estimateFuelCost(miles: number): number {
  return Math.round((miles / MILES_PER_GALLON) * FUEL_PRICE_PER_GALLON);
}

/**
 * Enrich multiple suggestions in parallel (capped to avoid quota burst).
 * Each item must have a `name` field; `city` and `state` apply to all.
 */
export async function enrichBatch<T extends { name: string }>(
  items:       T[],
  city:        string,
  state:       string,
  fetchDetails = false, // false = faster; set true only for lodging
): Promise<(PlaceEnrichment | null)[]> {
  if (!API_KEY) return items.map(() => null);

  // Process in groups of 3 to stay well inside the 10 QPS free-tier limit.
  const results: (PlaceEnrichment | null)[] = [];
  const CHUNK = 3;

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const batch = await Promise.all(
      chunk.map((item) => enrichPlace(item.name, city, state, fetchDetails)),
    );
    results.push(...batch);
    // Brief pause between chunks to respect QPS limits.
    if (i + CHUNK < items.length) await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}
