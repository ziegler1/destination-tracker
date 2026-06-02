import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { fetchWeather } from '../lib/weather';

const router = Router();

// GET /api/weather?lat=...&lon=...
router.get('/', asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  if (isNaN(lat) || isNaN(lon)) {
    return void res.status(400).json({ error: 'lat and lon query params required' });
  }
  const data = await fetchWeather(lat, lon);
  res.json(data);
}));

export default router;
