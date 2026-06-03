import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import { deleteFile } from '../lib/r2';

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

// POST /api/destinations
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, region, description,
    latitude, longitude, status, best_months, visited_at,
    rating, notes, image_url,
  } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO destinations
      (name, city, state_province, country, region, description,
       latitude, longitude, status, best_months, visited_at, rating, notes, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *
  `, [name, city, state_province, country, region, description,
      latitude, longitude, status ?? 'want_to_visit', best_months ?? null,
      visited_at, rating, notes, image_url]);
  res.status(201).json(rows[0]);
}));

// PUT /api/destinations/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, region, description,
    latitude, longitude, status, best_months, visited_at,
    rating, notes, image_url,
  } = req.body;
  const { rows } = await pool.query(`
    UPDATE destinations SET
      name=$1, city=$2, state_province=$3, country=$4, region=$5,
      description=$6, latitude=$7, longitude=$8, status=$9,
      best_months=$10, visited_at=$11, rating=$12, notes=$13, image_url=$14,
      updated_at=NOW()
    WHERE id=$15
    RETURNING *
  `, [name, city, state_province, country, region, description,
      latitude, longitude, status, best_months ?? null, visited_at,
      rating, notes, image_url, req.params.id]);
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
  res.status(204).send();
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

export default router;
