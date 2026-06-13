import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import {
  enrichBatch, searchPlaces, PlaceSearchResult,
  getDriveLeg, estimateFuelCost, GAS_STOP_THRESHOLD_MILES,
} from '../lib/googlePlaces';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

// ── Value normalizers (guard against Claude returning values outside CHECK constraints) ──

const VALID_COUNTRIES    = new Set(['USA', 'Canada']);
const VALID_LODGING_TYPES = new Set(['hotel','motel','airbnb','resort','campground','other']);
const VALID_POI_TYPES    = new Set(['scenic_overlook','roadside_attraction','state_park','national_park','historic_site','other']);
const VALID_PRICE_RANGES = new Set(['$','$$','$$$','$$$$']);

function normalizeCountry(c: string | undefined): 'USA' | 'Canada' {
  if (!c) return 'USA';
  const u = c.toUpperCase();
  if (u.includes('CANADA') || u === 'CA' || u === 'CAN') return 'Canada';
  return 'USA';
}

function normalizeLodgingType(t: string | undefined): string {
  if (!t) return 'hotel';
  const l = t.toLowerCase().replace(/\s+/g, '_');
  if (VALID_LODGING_TYPES.has(l)) return l;
  // Map common variants
  if (l.includes('motel') || l.includes('motor'))  return 'motel';
  if (l.includes('airbnb') || l.includes('vrbo') || l.includes('vacation')) return 'airbnb';
  if (l.includes('resort') || l.includes('spa'))   return 'resort';
  if (l.includes('camp') || l.includes('rv'))      return 'campground';
  if (l.includes('hotel') || l.includes('inn') || l.includes('lodge')) return 'hotel';
  return 'other';
}

function normalizePriceRange(p: string | undefined): string | null {
  if (!p) return null;
  const trimmed = p.trim();
  if (VALID_PRICE_RANGES.has(trimmed)) return trimmed;
  // Count $ signs as a fallback
  const count = (trimmed.match(/\$/g) ?? []).length;
  if (count >= 4) return '$$$$';
  if (count === 3) return '$$$';
  if (count === 2) return '$$';
  if (count === 1) return '$';
  return null;
}

function normalizePoiType(t: string | undefined): string {
  if (!t) return 'other';
  const l = t.toLowerCase().replace(/\s+/g, '_');
  if (VALID_POI_TYPES.has(l)) return l;
  if (l.includes('overlook') || l.includes('scenic') || l.includes('viewpoint')) return 'scenic_overlook';
  if (l.includes('roadside') || l.includes('attraction') || l.includes('quirky')) return 'roadside_attraction';
  if (l.includes('state_park') || l.includes('state park')) return 'state_park';
  if (l.includes('national') || l.includes('nat_park'))     return 'national_park';
  if (l.includes('historic') || l.includes('history') || l.includes('museum') || l.includes('monument')) return 'historic_site';
  return 'other';
}

// ── City geocoding via Nominatim (server-side, no CORS) ─────────────────────
async function geocodeCity(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const q = `${city}, ${state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Waypoint/1.0 (road trip planning app)' },
    });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ── Shared Claude system prompt (cached) ────────────────────────────────────
const WIZARD_SYSTEM: Anthropic.Messages.TextBlockParam = {
  type: 'text',
  text: `You are Waypoint, a US and Canada road trip planning assistant. \
You build detailed, practical trip plans for real travelers. \
Always respond with valid JSON only — no markdown fences, no explanation outside the JSON. \
Suggest real cities, real neighborhoods, and realistic price ranges. \
Flag gas stop intervals every 250–300 miles (set gas_stop_before: true for those stops). \
All date strings use ISO format YYYY-MM-DD.`,
  // @ts-expect-error cache_control is a valid Anthropic extension
  cache_control: { type: 'ephemeral' },
};

// ── Types for the wizard plan ────────────────────────────────────────────────

interface LodgingSuggestion {
  name: string;
  area: string;
  lodging_type: string;
  estimated_price_per_night: number;
  why_recommended: string;
  google_verified?: boolean;
  place_id?: string | null;
  formatted_address?: string | null;
  google_rating?: number | null;
  photo_url?: string | null;
  website?: string | null;
  approved?: boolean;
}

interface RestaurantSuggestion {
  name: string;
  cuisine_type: string;
  price_range: string;
  why_recommended: string;
  google_verified?: boolean;
  place_id?: string | null;
  formatted_address?: string | null;
  google_rating?: number | null;
  photo_url?: string | null;
  website?: string | null;
  approved?: boolean;
}

interface PoiSuggestion {
  name: string;
  poi_type: string;
  why_recommended: string;
  google_verified?: boolean;
  place_id?: string | null;
  formatted_address?: string | null;
  photo_url?: string | null;
  approved?: boolean;
}

interface SpecialInterestMatch {
  id: number;
  name: string;
  city: string;
  state_province: string;
  category?: string;
  rating?: number | null;
  image_url?: string | null;
  highlights?: string | null;
  approved?: boolean;
}

interface WizardStop {
  stop_order: number;
  stop_type?: 'transit' | 'base' | 'return_transit';
  city: string;
  state_province: string;
  country: string;
  arrive_date: string;
  depart_date: string;
  drive_minutes_from_prev: number;
  gas_stop_before: boolean;
  estimated_fuel_cost: number;
  lodging_suggestions:    LodgingSuggestion[];
  restaurant_suggestions: RestaurantSuggestion[];
  poi_suggestions:        PoiSuggestion[];
  special_interest_matches?: SpecialInterestMatch[];
  city_photo_url?: string | null;
  place_name?:    string | null;
  place_address?: string | null;
  place_lat?:     number | null;
  place_lng?:     number | null;
  place_id?:      string | null;
  place_type?:    string;
}

// ── User-defined stops (Step 1 itinerary builder) ────────────────────────────
// When the traveler builds out more than one stop in the wizard, that itinerary
// is authoritative — the plan is constructed directly from these rather than
// asking Claude to invent a route.
type StopPlaceType = 'city' | 'hotel' | 'rental' | 'campsite' | 'residence' | 'other';

interface UserStopInput {
  city: string;
  state_province: string;
  country: string;
  arrive_date: string;
  depart_date: string;
  place_type: StopPlaceType;
  place_name?:    string | null;
  place_address?: string | null;
  place_lat?:     number | null;
  place_lng?:     number | null;
  place_id?:      string | null;
}

interface WizardTrip {
  name: string;
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  estimated_costs: {
    lodging: number; food: number; fuel: number; activities: number; total: number;
  };
  travel_notes: string;
  packing_suggestions: Array<{ category: string; items: string[] }>;
}

interface WizardPlan {
  trip:  WizardTrip;
  stops: WizardStop[];
}

// ── Claude JSON response parsing (shared by Mode A & Mode B) ────────────────

class ClaudeParseError extends Error {
  constructor(public raw: string) {
    super('Claude returned invalid JSON');
  }
}

function parseClaudeJson<T>(rawText: string): T {
  let jsonText = rawText.trim();

  // Strip markdown code fences that Claude sometimes adds despite instructions
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  // If still not starting with { try to find the first { ... } block
  if (!jsonText.startsWith('{')) {
    const braceStart = jsonText.indexOf('{');
    const braceEnd   = jsonText.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonText = jsonText.slice(braceStart, braceEnd + 1);
    }
  }

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    console.error('Claude JSON parse failed. Raw (first 800 chars):', rawText.slice(0, 800));
    throw new ClaudeParseError(rawText.slice(0, 800));
  }
}

// ── Mode B: single destination — Claude plans the whole route ──────────────

async function buildModeBPlan(params: {
  origin: string;
  destination: string;
  destination_place?: {
    name: string; formatted_address: string; lat: number; lng: number; place_id: string;
  } | null;
  start_date: string;
  end_date: string;
  budget: number;
  trip_type: 'round_trip' | 'one_way' | 'based_at_destination';
  drive_hours_per_day: number;
  stop_timing: string;
  base_nights: number;
  include_return: boolean;
  prefStr: string;
}): Promise<WizardPlan> {
  const {
    origin, destination, destination_place, start_date, end_date, budget,
    trip_type, drive_hours_per_day, stop_timing, base_nights, include_return, prefStr,
  } = params;

  const stopShape = `{
      "stop_order": 1,
      "stop_type": "transit",
      "city": "string",
      "state_province": "string",
      "country": "USA",
      "arrive_date": "YYYY-MM-DD",
      "depart_date": "YYYY-MM-DD",
      "drive_minutes_from_prev": 0,
      "gas_stop_before": false,
      "estimated_fuel_cost": 0,
      "lodging_suggestions": [
        { "name": "string", "area": "string", "lodging_type": "hotel", "estimated_price_per_night": 0, "why_recommended": "string" }
      ],
      "restaurant_suggestions": [
        { "name": "string", "cuisine_type": "string", "price_range": "$$", "why_recommended": "string" }
      ],
      "poi_suggestions": [
        { "name": "string", "poi_type": "historic_site", "why_recommended": "string" }
      ]
    }`;

  const tripShape = `{
    "name": "<catchy trip name>",
    "origin": "${origin}",
    "destination": "${destination}",
    "start_date": "${start_date}",
    "end_date": "${end_date}",
    "budget": ${budget ?? 0},
    "estimated_costs": { "lodging": 0, "food": 0, "fuel": 0, "activities": 0, "total": 0 },
    "travel_notes": "<best aspects of this route>",
    "packing_suggestions": [{ "category": "string", "items": ["string"] }]
  }`;

  let userPrompt: string;

  const originNote = `CRITICAL: The trip departs from this EXACT home address: "${origin}". Do NOT create any stop at or near the origin — the first stop in the array is the first overnight stop away from home. The origin address is only the departure point, never a destination stop.`;

  if (trip_type === 'based_at_destination') {
    userPrompt = `Plan a "Based at Destination" road trip.
${originNote}
Base/Destination: ${destination} (travelers stay here ${base_nights} nights in their OWN accommodation — no lodging needed at the base)
Start date: ${start_date} | End date: ${end_date}
Budget: $${budget ?? 'flexible'} | Max drive: ${drive_hours_per_day}h/day | Stop timing: ${stop_timing}
Include return leg home: ${include_return ? 'yes' : 'no'}
Preferences: ${prefStr}

STOPS STRUCTURE:
1. LEG 1 — transit stops driving from "${origin}" to base. Only include if the drive exceeds ${drive_hours_per_day} hours. stop_type: "transit". Include lodging + restaurants + POIs.
2. BASE — the base city itself. stop_type: "base". lodging_suggestions: []. Include 5-6 restaurants and 4-5 POIs near the base.
3. LEG 2 — ONLY if include_return is yes: return overnight stops from base back toward "${origin}". stop_type: "return_transit". Do NOT include a stop at the origin address itself.

Return JSON:
{
  "trip": ${tripShape},
  "stops": [ ${stopShape} ]
}`;

  } else if (trip_type === 'round_trip') {
    userPrompt = `Plan a ROUND TRIP road trip.
${originNote}
The return leg ends back at this EXACT address: "${origin}" — do NOT include a final stop at the origin.
Destination: ${destination}
Start date: ${start_date} | End date: ${end_date}
Budget: $${budget ?? 'flexible'} | Max drive: ${drive_hours_per_day}h/day
Preferences: ${prefStr}

STOPS STRUCTURE:
1. OUTBOUND: transit stops from "${origin}" to destination, including the destination itself. stop_type: "transit".
2. RETURN: stops from destination back toward "${origin}". stop_type: "return_transit". These may be different cities than the outbound. Do NOT include the origin as a stop.

Include 2-3 lodging, 3-4 restaurants, 2-3 POIs per stop.

Return JSON:
{
  "trip": ${tripShape},
  "stops": [ ${stopShape} ]
}`;

  } else {
    // one_way
    userPrompt = `Plan a one-way road trip.
${originNote}
Destination: ${destination}
Start date: ${start_date} | End date: ${end_date}
Budget: $${budget ?? 'flexible'} | Max drive: ${drive_hours_per_day}h/day
Preferences: ${prefStr}

All stops: stop_type "transit". First stop is first overnight away from "${origin}". Last stop is the destination.
Include 2-3 lodging, 3-4 restaurants, 2-3 POIs per stop.

Return JSON:
{
  "trip": ${tripShape},
  "stops": [ ${stopShape} ]
}`;
  }

  const claudeMsg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [WIZARD_SYSTEM],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = claudeMsg.content[0].type === 'text' ? claudeMsg.content[0].text : '';
  const plan = parseClaudeJson<WizardPlan>(rawText);

  // If the user picked a specific place (restaurant/lodging/special interest/etc.) as their
  // destination, attach its precise name/address/coordinates to the stop that represents it,
  // so /confirm can preserve the exact location instead of falling back to city-center.
  if (destination_place) {
    const sorted = [...plan.stops].sort((a, b) => a.stop_order - b.stop_order);
    let destStop: WizardStop | undefined;
    if (trip_type === 'based_at_destination') {
      destStop = sorted.find((s) => s.stop_type === 'base');
    } else if (trip_type === 'round_trip') {
      const outbound = sorted.filter((s) => s.stop_type !== 'return_transit');
      destStop = outbound[outbound.length - 1];
    } else {
      destStop = sorted[sorted.length - 1];
    }
    if (destStop) {
      destStop.place_name    = destination_place.name;
      destStop.place_address = destination_place.formatted_address;
      destStop.place_lat     = destination_place.lat;
      destStop.place_lng     = destination_place.lng;
      destStop.place_id      = destination_place.place_id;
    }
  }

  return plan;
}

// ── Mode A: direct plan construction from a pre-built itinerary ────────────

/** Best address for Directions API calls: a specific place address, falling back to "City, State". */
function addressForUserStop(s: UserStopInput): string {
  return s.place_address || `${s.city}, ${s.state_province}`;
}

async function buildModeAPlan(params: {
  origin: string;
  userStops: UserStopInput[];
  start_date: string;
  end_date: string;
  budget: number;
  trip_type: 'round_trip' | 'one_way' | 'based_at_destination';
  prefStr: string;
}): Promise<WizardPlan> {
  const { origin, userStops, start_date, end_date, budget, trip_type, prefStr } = params;

  // 1. Drive time/distance for each leg: origin → stop1 → stop2 → ... → stopN
  const addresses = [origin, ...userStops.map(addressForUserStop)];
  const legs = await Promise.all(
    userStops.map((_, i) => getDriveLeg(addresses[i], addresses[i + 1])),
  );

  // 2. Build the plan's stops directly from the traveler's itinerary —
  // cities, order, and dates are authoritative and never altered by Claude.
  const stops: WizardStop[] = userStops.map((s, i) => {
    const leg   = legs[i];
    const miles = leg?.miles ?? 0;
    const isSpecificPlace = s.place_type !== 'city';
    const isLast = i === userStops.length - 1;

    return {
      stop_order:              i + 1,
      stop_type:               trip_type === 'based_at_destination' && isLast ? 'base' : 'transit',
      city:                    s.city,
      state_province:          s.state_province,
      country:                 normalizeCountry(s.country),
      arrive_date:             s.arrive_date,
      depart_date:             s.depart_date,
      drive_minutes_from_prev: leg?.minutes ?? 0,
      gas_stop_before:         miles > GAS_STOP_THRESHOLD_MILES,
      estimated_fuel_cost:     estimateFuelCost(miles),
      lodging_suggestions:     [],
      restaurant_suggestions:  [],
      poi_suggestions:         [],
      place_name:    isSpecificPlace ? (s.place_name    ?? null) : null,
      place_address: isSpecificPlace ? (s.place_address ?? null) : null,
      place_lat:     isSpecificPlace ? (s.place_lat     ?? null) : null,
      place_lng:     isSpecificPlace ? (s.place_lng     ?? null) : null,
      place_id:      isSpecificPlace ? (s.place_id      ?? null) : null,
      place_type:    s.place_type,
    };
  });

  // 3. Ask Claude only for budget/narrative/packing + per-stop dining/lodging/
  // activity suggestions — the itinerary itself is fixed.
  const stopList = stops.map((s) => {
    const lodgingNote = (s.place_type === 'city' && s.stop_type !== 'base')
      ? 'needs 2-3 lodging suggestions'
      : `traveler already has lodging${s.place_name ? ` (${s.place_name})` : ''} — return an empty lodging_suggestions array`;
    return `${s.stop_order}. ${s.city}, ${s.state_province} — ${s.arrive_date} to ${s.depart_date} (${lodgingNote})`;
  }).join('\n');

  const stopSuggestionShape = `{
      "stop_order": 1,
      "lodging_suggestions": [
        { "name": "string", "area": "string", "lodging_type": "hotel", "estimated_price_per_night": 0, "why_recommended": "string" }
      ],
      "restaurant_suggestions": [
        { "name": "string", "cuisine_type": "string", "price_range": "$$", "why_recommended": "string" }
      ],
      "poi_suggestions": [
        { "name": "string", "poi_type": "historic_site", "why_recommended": "string" }
      ]
    }`;

  const lastStop = stops[stops.length - 1];
  const tripShape = `{
    "name": "<catchy trip name>",
    "origin": "${origin}",
    "destination": "${lastStop.city}, ${lastStop.state_province}",
    "start_date": "${start_date}",
    "end_date": "${end_date}",
    "budget": ${budget ?? 0},
    "estimated_costs": { "lodging": 0, "food": 0, "fuel": 0, "activities": 0, "total": 0 },
    "travel_notes": "<best aspects of this route>",
    "packing_suggestions": [{ "category": "string", "items": ["string"] }]
  }`;

  const userPrompt = `This road trip's itinerary is already finalized — do NOT add, remove, reorder, or rename any stops. Plan the budget, travel notes, packing list, and per-stop dining/lodging/activity suggestions for it.

Trip type: ${trip_type}
Origin: ${origin}
Preferences: ${prefStr}
Budget: $${budget ?? 'flexible'}

Stops (in order, fixed):
${stopList}

For each stop, suggest 3-4 restaurants and 2-3 points of interest. Follow the lodging instruction for each stop exactly.

Return JSON:
{
  "trip": ${tripShape},
  "stops": [ ${stopSuggestionShape} ]
}`;

  const claudeMsg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [WIZARD_SYSTEM],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = claudeMsg.content[0].type === 'text' ? claudeMsg.content[0].text : '';
  const enrichment = parseClaudeJson<{
    trip: WizardTrip;
    stops: Array<{
      stop_order: number;
      lodging_suggestions?:    LodgingSuggestion[];
      restaurant_suggestions?: RestaurantSuggestion[];
      poi_suggestions?:        PoiSuggestion[];
    }>;
  }>(rawText);

  // 4. Merge Claude's per-stop suggestions into the directly-constructed stops
  for (const stop of stops) {
    const match = enrichment.stops?.find((s) => s.stop_order === stop.stop_order);
    if (match) {
      stop.lodging_suggestions    = match.lodging_suggestions    ?? [];
      stop.restaurant_suggestions = match.restaurant_suggestions ?? [];
      stop.poi_suggestions        = match.poi_suggestions        ?? [];
    }
  }

  // 5. Fuel cost comes from real drive distances, not Claude's guess
  const totalFuel = stops.reduce((sum, s) => sum + (s.estimated_fuel_cost ?? 0), 0);
  const costs = enrichment.trip.estimated_costs ?? { lodging: 0, food: 0, fuel: 0, activities: 0, total: 0 };
  costs.fuel  = totalFuel;
  costs.total = (costs.lodging ?? 0) + (costs.food ?? 0) + costs.fuel + (costs.activities ?? 0);

  return {
    trip: { ...enrichment.trip, estimated_costs: costs },
    stops,
  };
}

// ── POST /api/trips/wizard/generate ─────────────────────────────────────────

router.post('/generate', asyncHandler(async (req, res) => {
  const {
    origin, destination, destination_place, start_date, end_date, budget,
    trip_type = 'one_way',
    drive_hours_per_day = 6,
    stop_timing = 'flexible',
    base_nights = 4,
    include_return = true,
    preferences = {},
    stops: userStops,
  } = req.body as {
    origin: string;
    destination: string;
    destination_place?: {
      name: string; formatted_address: string; lat: number; lng: number; place_id: string;
    } | null;
    start_date: string;
    end_date: string;
    budget: number;
    trip_type?: 'round_trip' | 'one_way' | 'based_at_destination';
    drive_hours_per_day?: number;
    stop_timing?: string;
    base_nights?: number;
    include_return?: boolean;
    preferences?: {
      lodging_type?: string;
      cuisine_preferences?: string[];
      pet_friendly?: boolean;
      interests?: string[];
    };
    stops?: UserStopInput[];
  };

  if (!origin || !destination || !start_date || !end_date) {
    res.status(400).json({ error: 'origin, destination, start_date, and end_date are required' });
    return;
  }

  const minRating = (preferences as any).min_rating ?? 0;
  const ratingNote = minRating > 0 ? `Minimum Google rating: ${minRating} stars (only suggest places rated ${minRating}+ on Google)` : 'No minimum rating requirement';
  const prefStr = `Lodging type: ${preferences.lodging_type ?? 'any'} | Cuisine: ${preferences.cuisine_preferences?.join(', ') ?? 'any'} | Pet friendly: ${preferences.pet_friendly ? 'yes' : 'no'} | Interests: ${preferences.interests?.join(', ') ?? 'general sightseeing'} | ${ratingNote}`;

  let plan: WizardPlan;
  try {
    if (Array.isArray(userStops) && userStops.length > 1) {
      // ── Mode A: the traveler already built this itinerary stop-by-stop in
      // Step 1 — construct the plan directly from those stops (preserving
      // order, dates, and any specific places chosen) and only ask Claude to
      // fill in budget/narrative/packing/per-stop suggestions. ─────────────
      plan = await buildModeAPlan({ origin, userStops, start_date, end_date, budget, trip_type, prefStr });
    } else {
      // ── Mode B: single destination — let Claude plan the whole route ────
      plan = await buildModeBPlan({
        origin, destination, destination_place, start_date, end_date, budget,
        trip_type, drive_hours_per_day, stop_timing, base_nights, include_return, prefStr,
      });
    }
  } catch (err) {
    if (err instanceof ClaudeParseError) {
      res.status(502).json({ error: 'Claude returned invalid JSON', raw: err.raw });
      return;
    }
    throw err;
  }

  // ── STEP 2: Google Places enrichment ─────────────────────────────────────
  await Promise.all(
    plan.stops.map(async (stop) => {
      const city  = stop.city;
      const state = stop.state_province;

      // Enrich lodging (with website/phone details — fetchDetails=true)
      const lodgingEnrichments = await enrichBatch(stop.lodging_suggestions, city, state, true);
      stop.lodging_suggestions = stop.lodging_suggestions.map((s, i) => {
        const e = lodgingEnrichments[i];
        return e
          ? { ...s, google_verified: true,  place_id: e.place_id, formatted_address: e.formatted_address, google_rating: e.google_rating, photo_url: e.photo_url, website: e.website, lat: e.lat, lng: e.lng }
          : { ...s, google_verified: false, place_id: null, formatted_address: null, google_rating: null, photo_url: null, website: null, lat: null, lng: null };
      });

      // Enrich restaurants (no details call — faster)
      const restEnrichments = await enrichBatch(stop.restaurant_suggestions, city, state, false);
      stop.restaurant_suggestions = stop.restaurant_suggestions.map((s, i) => {
        const e = restEnrichments[i];
        return e
          ? { ...s, google_verified: true,  place_id: e.place_id, formatted_address: e.formatted_address, google_rating: e.google_rating, photo_url: e.photo_url, website: e.website, lat: e.lat, lng: e.lng }
          : { ...s, google_verified: false, place_id: null, formatted_address: null, google_rating: null, photo_url: null, website: null, lat: null, lng: null };
      });

      // Enrich POIs
      const poiEnrichments = await enrichBatch(stop.poi_suggestions, city, state, false);
      stop.poi_suggestions = stop.poi_suggestions.map((s, i) => {
        const e = poiEnrichments[i];
        return e
          ? { ...s, google_verified: true,  place_id: e.place_id, formatted_address: e.formatted_address, photo_url: e.photo_url, lat: e.lat, lng: e.lng }
          : { ...s, google_verified: false, place_id: null, formatted_address: null, photo_url: null, lat: null, lng: null };
      });

      // Use the first available enriched photo as the city-level destination image
      stop.city_photo_url =
        stop.lodging_suggestions.find((s) => s.photo_url)?.photo_url ??
        stop.restaurant_suggestions.find((s) => s.photo_url)?.photo_url ??
        stop.poi_suggestions.find((s) => s.photo_url)?.photo_url ??
        null;

      // Surface the user's own saved special interest places that fall along this stop's city
      const { rows: siMatches } = await pool.query<SpecialInterestMatch>(
        `SELECT id, name, city, state_province, category, rating, image_url, highlights
         FROM special_interest_places
         WHERE city ILIKE $1 AND state_province ILIKE $2
         ORDER BY name`,
        [city, state],
      );
      stop.special_interest_matches = siMatches;
    }),
  );

  // ── STEP 3: Filter by min_rating then return enriched plan ───────────────
  if (minRating > 0) {
    for (const stop of plan.stops) {
      stop.lodging_suggestions    = stop.lodging_suggestions.filter(s => !s.google_verified || (s.google_rating ?? 0) >= minRating);
      stop.restaurant_suggestions = stop.restaurant_suggestions.filter(s => !s.google_verified || (s.google_rating ?? 0) >= minRating);
    }
  }
  res.json(plan);
}));

// ── POST /api/trips/wizard/enrich-stop ───────────────────────────────────────
// Returns lodging/restaurant/POI suggestions for a single city, sourced
// directly from Google Places (no Claude call) — used when the user adds a
// new stop during route review.

function priceLevelToEstimate(level: number | null): number {
  switch (level) {
    case 0: return 60;
    case 1: return 90;
    case 2: return 140;
    case 3: return 220;
    case 4: return 320;
    default: return 130;
  }
}

function priceLevelToRange(level: number | null): string {
  switch (level) {
    case 0:
    case 1: return '$';
    case 2: return '$$';
    case 3: return '$$$';
    case 4: return '$$$$';
    default: return '$$';
  }
}

function describeWhy(r: PlaceSearchResult, fallback: string): string {
  if (r.rating) {
    const reviews = r.user_ratings_total ? ` (${r.user_ratings_total.toLocaleString()} reviews)` : '';
    return `Rated ${r.rating}★ on Google${reviews}`;
  }
  return fallback;
}

router.post('/enrich-stop', asyncHandler(async (req, res) => {
  const { city, state, preferences = {} } = req.body as {
    city?: string;
    state?: string;
    preferences?: {
      cuisine?:      string[];
      interests?:    string[];
      lodging_type?: string;
      min_rating?:   number;
    };
  };

  if (!city || !state) {
    res.status(400).json({ error: 'city and state are required' });
    return;
  }

  const minRating = preferences.min_rating ?? 0;

  const lodgingQueryTerm = preferences.lodging_type
    ? `${preferences.lodging_type}s`
    : 'hotels';
  const cuisineQueryTerm = preferences.cuisine?.length
    ? `${preferences.cuisine[0]} restaurants`
    : 'restaurants';
  const interestQueryTerm = preferences.interests?.length
    ? preferences.interests[0]
    : 'tourist attractions';

  const [lodgingResults, restResults, poiResults] = await Promise.all([
    searchPlaces(`${lodgingQueryTerm} in ${city}, ${state}`, 5),
    searchPlaces(`${cuisineQueryTerm} in ${city}, ${state}`, 6),
    searchPlaces(`${interestQueryTerm} in ${city}, ${state}`, 5),
  ]);

  const filterByRating = (r: PlaceSearchResult) => !minRating || (r.rating ?? 0) >= minRating;

  const lodging_suggestions: LodgingSuggestion[] = lodgingResults
    .filter(filterByRating)
    .slice(0, 2)
    .map((r) => ({
      name:                      r.name,
      area:                      city,
      lodging_type:              normalizeLodgingType(preferences.lodging_type),
      estimated_price_per_night: priceLevelToEstimate(r.price_level),
      why_recommended:           describeWhy(r, 'Convenient option in the area'),
      google_verified:           true,
      place_id:                  r.place_id,
      formatted_address:         r.formatted_address,
      google_rating:             r.rating,
      photo_url:                 r.photo_url,
      website:                   null,
      lat:                       r.lat,
      lng:                       r.lng,
    } as LodgingSuggestion));

  const restaurant_suggestions: RestaurantSuggestion[] = restResults
    .filter(filterByRating)
    .slice(0, 3)
    .map((r) => ({
      name:              r.name,
      cuisine_type:      preferences.cuisine?.[0] ?? 'American',
      price_range:       priceLevelToRange(r.price_level),
      why_recommended:   describeWhy(r, 'Popular nearby spot'),
      google_verified:   true,
      place_id:          r.place_id,
      formatted_address: r.formatted_address,
      google_rating:     r.rating,
      photo_url:         r.photo_url,
      website:           null,
      lat:               r.lat,
      lng:               r.lng,
    } as RestaurantSuggestion));

  const poi_suggestions: PoiSuggestion[] = poiResults
    .slice(0, 3)
    .map((r) => ({
      name:              r.name,
      poi_type:          normalizePoiType(r.types?.join(' ')),
      why_recommended:   describeWhy(r, 'Worth a look while you\'re in town'),
      google_verified:   true,
      place_id:          r.place_id,
      formatted_address: r.formatted_address,
      photo_url:         r.photo_url,
      lat:               r.lat,
      lng:               r.lng,
    } as PoiSuggestion));

  res.json({ lodging_suggestions, restaurant_suggestions, poi_suggestions });
}));

// ── POST /api/trips/wizard/confirm ───────────────────────────────────────────

router.post('/confirm', asyncHandler(async (req, res) => {
  const plan = req.body as WizardPlan;
  const { trip, stops } = plan;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create trip record
    const { rows: [savedTrip] } = await client.query<{ id: number }>(
      `INSERT INTO trips (name, description, status, start_date, end_date, total_budget, notes, origin_address)
       VALUES ($1, $2, 'planning', $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        trip.name,
        trip.travel_notes ?? null,
        trip.start_date,
        trip.end_date,
        trip.budget ?? null,
        `AI-generated trip from ${trip.origin} to ${trip.destination}`,
        trip.origin ?? null,
      ],
    );
    const tripId = savedTrip.id;

    // 2. Process each stop
    const savedStopIds: number[] = [];

    for (const stop of stops.sort((a, b) => a.stop_order - b.stop_order)) {

      // 2a. Ensure a destination record exists for this stop
      let destinationId: number;
      if (stop.place_id) {
        // The user picked a specific place (restaurant/lodging/special interest/landmark) as
        // their destination — preserve its precise name/address/coordinates rather than
        // collapsing to the city center.
        const { rows: existingByPlace } = await client.query<{ id: number }>(
          `SELECT id FROM destinations WHERE google_place_id = $1 LIMIT 1`,
          [stop.place_id],
        );
        if (existingByPlace.length > 0) {
          destinationId = existingByPlace[0].id;
        } else {
          const { rows: [newDest] } = await client.query<{ id: number }>(
            `INSERT INTO destinations
               (name, city, state_province, country, status, latitude, longitude, image_url, address, google_place_id)
             VALUES ($1, $2, $3, $4, 'want_to_visit', $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              stop.place_name || stop.city, stop.city, stop.state_province, normalizeCountry(stop.country),
              stop.place_lat ?? null, stop.place_lng ?? null,
              stop.city_photo_url ?? null,
              stop.place_address ?? null,
              stop.place_id,
            ],
          );
          destinationId = newDest.id;
        }
      } else {
        // Geocode the stop city so map pins work
        const coords = await geocodeCity(stop.city, stop.state_province);

        const { rows: existingDest } = await client.query<{ id: number; latitude: number | null }>(
          `SELECT id, latitude FROM destinations
           WHERE city = $1 AND state_province = $2
           LIMIT 1`,
          [stop.city, stop.state_province],
        );
        if (existingDest.length > 0) {
          destinationId = existingDest[0].id;
          // Backfill coordinates if missing
          if (!existingDest[0].latitude && coords) {
            await client.query(
              'UPDATE destinations SET latitude=$1, longitude=$2 WHERE id=$3',
              [coords.lat, coords.lon, destinationId],
            );
          }
        } else {
          const { rows: [newDest] } = await client.query<{ id: number }>(
            `INSERT INTO destinations (name, city, state_province, country, status, latitude, longitude, image_url)
             VALUES ($1, $2, $3, $4, 'want_to_visit', $5, $6, $7)
             RETURNING id`,
            [
              stop.city, stop.city, stop.state_province, normalizeCountry(stop.country),
              coords?.lat ?? null, coords?.lon ?? null,
              stop.city_photo_url ?? null,
            ],
          );
          destinationId = newDest.id;
        }
      }

      // 2b. Resolve lodging — pick the approved suggestion (first approved wins)
      const approvedLodging = stop.lodging_suggestions?.find((s) => s.approved);
      let lodgingId: number | null = null;

      if (approvedLodging) {
        const { rows: [savedLodging] } = await client.query<{ id: number }>(
          `INSERT INTO lodging
             (name, city, state_province, country, lodging_type,
              address, latitude, longitude,
              price_per_night, website, pet_friendly,
              suggested_by_ai, google_place_id, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING id`,
          [
            approvedLodging.name,
            stop.city,
            stop.state_province,
            normalizeCountry(stop.country),
            normalizeLodgingType(approvedLodging.lodging_type),
            (approvedLodging as any).formatted_address ?? null,
            (approvedLodging as any).lat ?? null,
            (approvedLodging as any).lng ?? null,
            approvedLodging.estimated_price_per_night ?? null,
            approvedLodging.website ?? null,
            false,
            true,
            approvedLodging.place_id ?? null,
            approvedLodging.photo_url ?? null,
          ],
        );
        lodgingId = savedLodging.id;
      }

      // 2c. Create trip_stop
      const { rows: [savedStop] } = await client.query<{ id: number }>(
        `INSERT INTO trip_stops
           (trip_id, destination_id, stop_order, arrival_date, departure_date,
            status, lodging_id, notes,
            drive_minutes_from_prev, gas_stop_before, estimated_fuel_cost)
         VALUES ($1,$2,$3,$4,$5,'upcoming',$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          tripId,
          destinationId,
          stop.stop_order,
          stop.arrive_date,
          stop.depart_date,
          lodgingId,
          null,
          stop.drive_minutes_from_prev ?? null,
          stop.gas_stop_before ?? false,
          stop.estimated_fuel_cost ?? null,
        ],
      );
      savedStopIds.push(savedStop.id);
      const stopId = savedStop.id;

      // 2d. Approved restaurants → restaurant records + trip_restaurants link
      for (const r of (stop.restaurant_suggestions ?? []).filter((s) => s.approved)) {
        const { rows: [savedRest] } = await client.query<{ id: number }>(
          `INSERT INTO restaurants
             (name, city, state_province, country, cuisine_type, price_range,
              address, latitude, longitude,
              website, pet_friendly, suggested_by_ai, google_place_id, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING id`,
          [
            r.name,
            stop.city,
            stop.state_province,
            normalizeCountry(stop.country),
            r.cuisine_type ?? null,
            normalizePriceRange(r.price_range),
            (r as any).formatted_address ?? null,
            (r as any).lat ?? null,
            (r as any).lng ?? null,
            r.website ?? null,
            false,
            true,
            r.place_id ?? null,
            r.photo_url ?? null,
          ],
        );
        await client.query(
          `INSERT INTO trip_restaurants (trip_id, trip_stop_id, restaurant_id)
           VALUES ($1,$2,$3)`,
          [tripId, stopId, savedRest.id],
        );
      }

      // 2e. Approved POIs → points_of_interest records linked to destination
      for (const p of (stop.poi_suggestions ?? []).filter((s) => s.approved)) {
        await client.query(
          `INSERT INTO points_of_interest
             (destination_id, name, poi_type, description, suggested_by_ai, google_place_id, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            destinationId,
            p.name,
            normalizePoiType(p.poi_type),
            p.why_recommended ?? null,
            true,
            p.place_id ?? null,
            p.photo_url ?? null,
          ],
        );
      }

      // 2f. Approved special-interest matches → link to this stop
      for (const si of (stop.special_interest_matches ?? []).filter((s) => s.approved)) {
        await client.query(
          `INSERT INTO trip_special_interests (trip_id, trip_stop_id, special_interest_id)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [tripId, stopId, si.id],
        );
      }
    }

    // 3. Create packing list with approved items
    if (trip.packing_suggestions?.length) {
      const { rows: [list] } = await client.query<{ id: number }>(
        `INSERT INTO packing_lists (trip_id, name) VALUES ($1, 'AI Packing List') RETURNING id`,
        [tripId],
      );
      for (const cat of trip.packing_suggestions) {
        for (const itemName of (cat.items ?? [])) {
          await client.query(
            `INSERT INTO packing_items (list_id, category, item_name, quantity)
             VALUES ($1,$2,$3,1)`,
            [list.id, cat.category, itemName],
          );
        }
      }
    }

    await client.query('COMMIT');

    // Return the saved trip with full nested data
    const { rows: [fullTrip] } = await client.query(
      `SELECT t.*,
         COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
           'id',ts.id,'stop_order',ts.stop_order,'arrival_date',ts.arrival_date,
           'departure_date',ts.departure_date,'status',ts.status,'lodging_id',ts.lodging_id,
           'destination', jsonb_build_object('id',d.id,'name',d.name,'city',d.city,
             'state_province',d.state_province,'country',d.country),
           'lodging', CASE WHEN l.id IS NOT NULL THEN jsonb_build_object(
             'id',l.id,'name',l.name,'lodging_type',l.lodging_type,'price_per_night',l.price_per_night
           ) ELSE NULL END
         )) FILTER (WHERE ts.id IS NOT NULL), '[]') AS stops
       FROM trips t
       LEFT JOIN trip_stops ts ON ts.trip_id = t.id
       LEFT JOIN destinations d ON d.id = ts.destination_id
       LEFT JOIN lodging l ON l.id = ts.lodging_id
       WHERE t.id = $1
       GROUP BY t.id`,
      [tripId],
    );

    res.status(201).json(fullTrip);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

export default router;
