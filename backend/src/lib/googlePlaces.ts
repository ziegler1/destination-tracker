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
  formatted_address:  string;
  rating?:            number;
  user_ratings_total?: number;
  price_level?:       number;
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
      photo_url:          photoRef ? buildPhotoUrl(photoRef) : null,
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
