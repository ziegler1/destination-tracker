import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const PHOTO_AGG = `
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', lp.id, 'lodging_id', lp.lodging_id, 'r2_key', lp.r2_key,
    'url', lp.url, 'caption', lp.caption, 'is_primary', lp.is_primary,
    'uploaded_at', lp.uploaded_at
  )) FILTER (WHERE lp.id IS NOT NULL), '[]') AS photos`;

// GET /api/lodging
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT l.*, ${PHOTO_AGG}
    FROM lodging l
    LEFT JOIN lodging_photos lp ON lp.lodging_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `);
  res.json(rows);
}));

// GET /api/lodging/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT l.*, ${PHOTO_AGG}
    FROM lodging l
    LEFT JOIN lodging_photos lp ON lp.lodging_id = l.id
    WHERE l.id = $1
    GROUP BY l.id
  `, [req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Lodging not found' });
  res.json(rows[0]);
}));

// POST /api/lodging
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, address, latitude, longitude,
    lodging_type, price_per_night, room_quality, cleanliness, amenities,
    would_return, highlights, notes, website, phone, pet_friendly, image_url,
  } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO lodging
      (name, city, state_province, country, address, latitude, longitude,
       lodging_type, price_per_night, room_quality, cleanliness, amenities,
       would_return, highlights, notes, website, phone, pet_friendly, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *
  `, [name, city, state_province, country, address, latitude, longitude,
      lodging_type ?? 'hotel', price_per_night, room_quality, cleanliness,
      amenities ?? null, would_return, highlights, notes, website, phone,
      pet_friendly ?? false, image_url]);
  res.status(201).json(rows[0]);
}));

// PUT /api/lodging/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, address, latitude, longitude,
    lodging_type, price_per_night, room_quality, cleanliness, amenities,
    would_return, highlights, notes, website, phone, pet_friendly, image_url,
  } = req.body;
  const { rows } = await pool.query(`
    UPDATE lodging SET
      name=$1, city=$2, state_province=$3, country=$4, address=$5,
      latitude=$6, longitude=$7, lodging_type=$8, price_per_night=$9,
      room_quality=$10, cleanliness=$11, amenities=$12, would_return=$13,
      highlights=$14, notes=$15, website=$16, phone=$17, pet_friendly=$18,
      image_url=$19, updated_at=NOW()
    WHERE id=$20
    RETURNING *
  `, [name, city, state_province, country, address, latitude, longitude,
      lodging_type, price_per_night, room_quality, cleanliness,
      amenities ?? null, would_return, highlights, notes, website, phone,
      pet_friendly ?? false, image_url, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Lodging not found' });
  res.json(rows[0]);
}));

// DELETE /api/lodging/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM lodging WHERE id=$1', [req.params.id]);
  if (!rowCount) return void res.status(404).json({ error: 'Lodging not found' });
  res.status(204).send();
}));

export default router;
