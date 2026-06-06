import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import { enrichBatch } from '../lib/googlePlaces';

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

// ── POST /api/trips/wizard/generate ─────────────────────────────────────────

router.post('/generate', asyncHandler(async (req, res) => {
  const {
    origin, destination, start_date, end_date, budget,
    trip_type = 'one_way',
    drive_hours_per_day = 6,
    stop_timing = 'flexible',
    base_nights = 4,
    include_return = true,
    preferences = {},
  } = req.body as {
    origin: string;
    destination: string;
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
  };

  if (!origin || !destination || !start_date || !end_date) {
    res.status(400).json({ error: 'origin, destination, start_date, and end_date are required' });
    return;
  }

  const prefStr = `Lodging type: ${preferences.lodging_type ?? 'any'} | Cuisine: ${preferences.cuisine_preferences?.join(', ') ?? 'any'} | Pet friendly: ${preferences.pet_friendly ? 'yes' : 'no'} | Interests: ${preferences.interests?.join(', ') ?? 'general sightseeing'}`;

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

  if (trip_type === 'based_at_destination') {
    userPrompt = `Plan a "Based at Destination" road trip:
Origin: ${origin}
Base/Destination: ${destination} (the travelers will stay here ${base_nights} nights in their OWN accommodation — no lodging needed at the base)
Start date: ${start_date}
End date: ${end_date}
Total budget: $${budget ?? 'flexible'}
Max drive hours per day: ${drive_hours_per_day} hours
Stop timing preference: ${stop_timing}
Include return leg home: ${include_return ? 'yes' : 'no'}
Preferences: ${prefStr}

IMPORTANT STRUCTURE — the stops array must follow this pattern:
1. LEG 1 (driving to base): One or more overnight transit stops if the drive from origin to base exceeds ${drive_hours_per_day} hours. Mark each with stop_type: "transit". Include lodging + restaurants + POIs for each.
2. BASE STAY: The base location itself. Mark with stop_type: "base". NO lodging_suggestions (set to []). Include 5-6 local restaurants and 4-5 local activities/POIs for the stay.
3. LEG 2 (return, only if include_return is true): Overnight stops from base back to origin. Mark each with stop_type: "return_transit". Include lodging + restaurants + POIs.

For transit stops: 2-3 lodging suggestions, 3-4 restaurants, 2-3 POIs.
For the base stop: 0 lodging suggestions, 5-6 restaurants, 4-5 POIs/activities near the base.
For return_transit stops: 2-3 lodging suggestions, 2-3 restaurants, 1-2 POIs.

Return a JSON object with this exact shape:
{
  "trip": ${tripShape},
  "stops": [ ${stopShape} ]
}`;

  } else if (trip_type === 'round_trip') {
    userPrompt = `Plan a ROUND TRIP road trip:
Origin (depart from and return to): ${origin}
Destination: ${destination}
Start date: ${start_date}
End date: ${end_date}
Total budget: $${budget ?? 'flexible'}
Max drive hours per day: ${drive_hours_per_day} hours
Preferences: ${prefStr}

Structure:
1. OUTBOUND: overnight transit stops from origin to destination (stop_type: "transit"), then the destination stay itself (stop_type: "transit" — it is still a transit stop, just the main one).
2. RETURN: overnight stops from destination back to origin (stop_type: "return_transit"). These can be different cities from the outbound route.

Include 2-3 lodging suggestions, 3-4 restaurants, 2-3 POIs per stop.

Return a JSON object:
{
  "trip": ${tripShape},
  "stops": [ ${stopShape} ]
}`;

  } else {
    // one_way (default)
    userPrompt = `Plan a one-way road trip:
Origin: ${origin}
Destination: ${destination}
Start date: ${start_date}
End date: ${end_date}
Total budget: $${budget ?? 'flexible'}
Max drive hours per day: ${drive_hours_per_day} hours
Preferences: ${prefStr}

Set stop_type: "transit" on all stops.
Include 2-3 lodging suggestions, 3-4 restaurants, 2-3 POIs per stop.

Return a JSON object:
{
  "trip": ${tripShape},
  "stops": [ ${stopShape} ]
}
Include 2–3 lodging suggestions, 3–4 restaurant suggestions, and 2–3 POI suggestions per stop.`;
  }

  const claudeMsg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [WIZARD_SYSTEM],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = claudeMsg.content[0].type === 'text' ? claudeMsg.content[0].text : '';

  // Strip markdown code fences that Claude sometimes adds despite instructions
  let jsonText = rawText.trim();
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

  let plan: WizardPlan;
  try {
    plan = JSON.parse(jsonText) as WizardPlan;
  } catch {
    console.error('Claude JSON parse failed. Raw (first 800 chars):', rawText.slice(0, 800));
    res.status(502).json({ error: 'Claude returned invalid JSON', raw: rawText.slice(0, 800) });
    return;
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
    }),
  );

  // ── STEP 3: Return enriched plan (nothing saved yet) ──────────────────────
  res.json(plan);
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
      `INSERT INTO trips (name, description, status, start_date, end_date, total_budget, notes)
       VALUES ($1, $2, 'planning', $3, $4, $5, $6)
       RETURNING id`,
      [
        trip.name,
        trip.travel_notes ?? null,
        trip.start_date,
        trip.end_date,
        trip.budget ?? null,
        `AI-generated trip from ${trip.origin} to ${trip.destination}`,
      ],
    );
    const tripId = savedTrip.id;

    // 2. Process each stop
    const savedStopIds: number[] = [];

    for (const stop of stops.sort((a, b) => a.stop_order - b.stop_order)) {

      // 2a. Ensure a destination record exists for this city
      // Geocode the stop city so map pins work
      const coords = await geocodeCity(stop.city, stop.state_province);

      const { rows: existingDest } = await client.query<{ id: number; latitude: number | null }>(
        `SELECT id, latitude FROM destinations
         WHERE city = $1 AND state_province = $2
         LIMIT 1`,
        [stop.city, stop.state_province],
      );
      let destinationId: number;
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
          `INSERT INTO destinations (name, city, state_province, country, status, latitude, longitude)
           VALUES ($1, $2, $3, $4, 'want_to_visit', $5, $6)
           RETURNING id`,
          [
            stop.city, stop.city, stop.state_province, normalizeCountry(stop.country),
            coords?.lat ?? null, coords?.lon ?? null,
          ],
        );
        destinationId = newDest.id;
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
              suggested_by_ai, google_place_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
          ],
        );
        lodgingId = savedLodging.id;
      }

      // 2c. Create trip_stop
      const { rows: [savedStop] } = await client.query<{ id: number }>(
        `INSERT INTO trip_stops
           (trip_id, destination_id, stop_order, arrival_date, departure_date,
            status, lodging_id, notes)
         VALUES ($1,$2,$3,$4,$5,'upcoming',$6,$7)
         RETURNING id`,
        [
          tripId,
          destinationId,
          stop.stop_order,
          stop.arrive_date,
          stop.depart_date,
          lodgingId,
          stop.gas_stop_before ? '⛽ Gas stop recommended before this stop' : null,
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
              website, pet_friendly, suggested_by_ai, google_place_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
             (destination_id, name, poi_type, description, suggested_by_ai, google_place_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            destinationId,
            p.name,
            normalizePoiType(p.poi_type),
            p.why_recommended ?? null,
            true,
            p.place_id ?? null,
          ],
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
