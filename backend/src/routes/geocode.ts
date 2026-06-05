import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';

interface GeoResult { lat: number; lon: number; displayName: string; }

// ── Google Geocoding API (precise street-level) ───────────────────────────
async function geocodeWithGoogle(q: string): Promise<GeoResult | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`;
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json() as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (data.status !== 'OK' || !data.results.length) return null;
    const r = data.results[0];
    return {
      lat:         r.geometry.location.lat,
      lon:         r.geometry.location.lng,
      displayName: r.formatted_address,
    };
  } catch {
    return null;
  }
}

// ── Nominatim fallback (city-level, free, no key) ─────────────────────────
async function geocodeWithNominatim(q: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
    const res  = await fetch(url, {
      headers: {
        'User-Agent':      'Waypoint Travel App (https://github.com/ziegler1/destination-tracker)',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) return null;
    const results = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!results.length) return null;
    return {
      lat:         parseFloat(results[0].lat),
      lon:         parseFloat(results[0].lon),
      displayName: results[0].display_name,
    };
  } catch {
    return null;
  }
}

// ── GET /api/geocode ──────────────────────────────────────────────────────
// Params: city, state_province, country, address (optional)
// When address is provided → tries Google first (precise), falls back to Nominatim.
// When only city is provided → Nominatim is sufficient.
router.get('/', asyncHandler(async (req, res) => {
  const address        = String(req.query.address        ?? '').trim();
  const city           = String(req.query.city           ?? '').trim();
  const state_province = String(req.query.state_province ?? '').trim();
  const country        = String(req.query.country        ?? '').trim();

  if (!city && !address) {
    res.status(400).json({ error: 'city or address is required' });
    return;
  }

  const fullQuery = [address, city, state_province, country].filter(Boolean).join(', ');
  const cityQuery = [city, state_province, country].filter(Boolean).join(', ');

  let result: GeoResult | null = null;

  if (address && GOOGLE_KEY) {
    // Street address + Google key → precise result
    result = await geocodeWithGoogle(fullQuery);
  }

  if (!result) {
    // Fallback: Nominatim with full query first, then city only
    result = await geocodeWithNominatim(fullQuery);
  }

  if (!result && address) {
    // Last resort: city-only Nominatim
    result = await geocodeWithNominatim(cityQuery);
  }

  res.json(result);
}));

export default router;
