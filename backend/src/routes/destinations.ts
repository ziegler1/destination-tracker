import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import { deleteFile } from '../lib/r2';
import { normalizeState } from '../lib/normalizeState';

const router = Router();

const PHOTO_AGG = `
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', dp.id, 'destination_id', dp.destination_id, 'r2_key', dp.r2_key,
    'url', dp.url, 'caption', dp.caption, 'is_primary', dp.is_primary,
    'uploaded_at', dp.uploaded_at
  )) FILTER (WHERE dp.id IS NOT NULL), '[]') AS photos`;

const POI_AGG = `
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', poi.id, 'destination_id', poi.destination_id, 'name', poi.name,
    'poi_type', poi.poi_type, 'latitude', poi.latitude, 'longitude', poi.longitude,
    'description', poi.description, 'notes', poi.notes, 'created_at', poi.created_at
  )) FILTER (WHERE poi.id IS NOT NULL), '[]') AS pois`;

// GET /api/destinations
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT d.*, ${PHOTO_AGG}, ${POI_AGG}
    FROM destinations d
    LEFT JOIN destination_photos dp ON dp.destination_id = d.id
    LEFT JOIN points_of_interest poi ON poi.destination_id = d.id
    GROUP BY d.id
    ORDER BY d.name
  `);
  res.json(rows);
}));

// GET /api/destinations/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT d.*, ${PHOTO_AGG}, ${POI_AGG}
    FROM destinations d
    LEFT JOIN destination_photos dp ON dp.destination_id = d.id
    LEFT JOIN points_of_interest poi ON poi.destination_id = d.id
    WHERE d.id = $1
    GROUP BY d.id
  `, [req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Destination not found' });
  res.json(rows[0]);
}));

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/destinations
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, region, description,
    latitude, longitude, status, best_months, visited_at,
    rating, notes, image_url,
  } = req.body;
  const normalizedState = state_province ? normalizeState(state_province) : state_province;

  if (req.query.force !== 'true') {
    const { rows: existing } = await pool.query(
      `SELECT id, name, city, state_province FROM destinations
       WHERE LOWER(TRIM(city)) = LOWER(TRIM($1))
         AND LOWER(TRIM(state_province)) = LOWER(TRIM($2))
       LIMIT 1`,
      [city, normalizedState],
    );
    if (existing[0]) {
      return void res.status(409).json({ duplicate: true, existing: existing[0] });
    }

    if (latitude != null && longitude != null) {
      const { rows: settings } = await pool.query(
        `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
        [['home_lat', 'home_lng']],
      );
      const homeLat = parseFloat(settings.find((r: { key: string }) => r.key === 'home_lat')?.value ?? '');
      const homeLng = parseFloat(settings.find((r: { key: string }) => r.key === 'home_lng')?.value ?? '');
      if (!Number.isNaN(homeLat) && !Number.isNaN(homeLng)) {
        const dist = haversineMiles(homeLat, homeLng, Number(latitude), Number(longitude));
        if (dist < 25) {
          return void res.status(409).json({ home_address: true });
        }
      }
    }
  }

  const { rows } = await pool.query(`
    INSERT INTO destinations
      (name, city, state_province, country, region, description,
       latitude, longitude, status, best_months, visited_at, rating, notes, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *
  `, [name, city, normalizedState, country, region, description,
      latitude, longitude, status ?? 'want_to_visit', best_months ?? null,
      visited_at, rating, notes, image_url]);
  res.status(201).json(rows[0]);
}));

// PUT /api/destinations/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, region, description,
    latitude, longitude, status, best_months, visited_at,
    rating, notes, image_url, travel_tips,
  } = req.body;
  const normalizedState = state_province ? normalizeState(state_province) : state_province;
  const { rows } = await pool.query(`
    UPDATE destinations SET
      name=$1, city=$2, state_province=$3, country=$4, region=$5,
      description=$6, latitude=$7, longitude=$8, status=$9,
      best_months=$10, visited_at=$11, rating=$12, notes=$13, image_url=$14,
      travel_tips=$15, updated_at=NOW()
    WHERE id=$16
    RETURNING *
  `, [name, city, normalizedState, country, region, description,
      latitude, longitude, status, best_months ?? null, visited_at,
      rating, notes, image_url, travel_tips ?? null, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Destination not found' });
  res.json(rows[0]);
}));

// PATCH /api/destinations/:id/visit
router.patch('/:id/visit', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE destinations SET visit_count = visit_count + 1, updated_at=NOW() WHERE id=$1 RETURNING *',
    [req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Destination not found' });
  res.json(rows[0]);
}));

// PATCH /api/destinations/:id/status
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { rows } = await pool.query(`
    UPDATE destinations SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *
  `, [status, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Destination not found' });
  res.json(rows[0]);
}));

// DELETE /api/destinations/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM destinations WHERE id=$1', [req.params.id]);
  if (!rowCount) return void res.status(404).json({ error: 'Destination not found' });
  res.json({ deleted: true, id: +req.params.id });
}));

// ── Photo management ──────────────────────────────────────────────────────────

// POST /api/destinations/:id/photos
router.post('/:id/photos', asyncHandler(async (req, res) => {
  const { r2_key, url, caption, is_primary } = req.body;
  if (is_primary) {
    await pool.query('UPDATE destination_photos SET is_primary=false WHERE destination_id=$1', [req.params.id]);
  }
  const { rows } = await pool.query(
    `INSERT INTO destination_photos (destination_id, r2_key, url, caption, is_primary)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, r2_key, url, caption ?? null, is_primary ?? false],
  );
  res.status(201).json(rows[0]);
}));

// DELETE /api/destinations/:id/photos/:photoId
router.delete('/:id/photos/:photoId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM destination_photos WHERE id=$1 AND destination_id=$2 RETURNING r2_key',
    [req.params.photoId, req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Photo not found' });
  try { await deleteFile(rows[0].r2_key); } catch { /* R2 key may not exist */ }
  res.status(204).send();
}));

// PATCH /api/destinations/:id/photos/:photoId/primary
router.patch('/:id/photos/:photoId/primary', asyncHandler(async (req, res) => {
  await pool.query('UPDATE destination_photos SET is_primary=false WHERE destination_id=$1', [req.params.id]);
  const { rows } = await pool.query(
    'UPDATE destination_photos SET is_primary=true WHERE id=$1 AND destination_id=$2 RETURNING *',
    [req.params.photoId, req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Photo not found' });
  res.json(rows[0]);
}));

router.patch('/:id/photos/:photoId/caption', asyncHandler(async (req, res) => {
  const { caption } = req.body;
  const { rows } = await pool.query(
    'UPDATE destination_photos SET caption=$1 WHERE id=$2 AND destination_id=$3 RETURNING *',
    [caption ?? null, req.params.photoId, req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Photo not found' });
  res.json(rows[0]);
}));

export default router;
