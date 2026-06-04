import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/geocode?city=Holden Beach&state_province=North Carolina&country=USA
router.get('/', asyncHandler(async (req, res) => {
  const city           = String(req.query.city           ?? '');
  const state_province = String(req.query.state_province ?? '');
  const country        = String(req.query.country        ?? '');

  const q = [city, state_province, country].filter(Boolean).join(', ');
  if (!q) {
    res.status(400).json({ error: 'city is required' });
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
