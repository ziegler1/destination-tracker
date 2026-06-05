import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/geocode?city=Denver&state_province=CO&country=USA&address=1234+Main+St
// When 'address' is provided it is prepended for street-level precision.
router.get('/', asyncHandler(async (req, res) => {
  const address        = String(req.query.address        ?? '').trim();
  const city           = String(req.query.city           ?? '').trim();
  const state_province = String(req.query.state_province ?? '').trim();
  const country        = String(req.query.country        ?? '').trim();

  // Full address query is much more accurate than city-only
  const parts = address
    ? [address, city, state_province, country]
    : [city, state_province, country];
  const q = parts.filter(Boolean).join(', ');

  if (!q) {
    res.status(400).json({ error: 'city or address is required' });
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Waypoint Travel App (https://github.com/ziegler1/destination-tracker)',
      'Accept-Language': 'en',
      'Referer': 'https://nominatim.openstreetmap.org',
    },
  });

  if (!response.ok) {
    res.status(502).json({ error: 'Nominatim request failed' });
    return;
  }

  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;

  if (!results.length) {
    res.json(null);
    return;
  }

  res.json({
    lat:         parseFloat(results[0].lat),
    lon:         parseFloat(results[0].lon),
    displayName: results[0].display_name,
  });
}));

export default router;
