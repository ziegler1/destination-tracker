import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const PHOTO_AGG = `
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', rp.id, 'restaurant_id', rp.restaurant_id, 'r2_key', rp.r2_key,
    'url', rp.url, 'caption', rp.caption, 'is_primary', rp.is_primary,
    'uploaded_at', rp.uploaded_at
  )) FILTER (WHERE rp.id IS NOT NULL), '[]') AS photos`;

// GET /api/restaurants
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT r.*, ${PHOTO_AGG}
    FROM restaurants r
    LEFT JOIN restaurant_photos rp ON rp.restaurant_id = r.id
    GROUP BY r.id
    ORDER BY r.name
  `);
  res.json(rows);
}));

// GET /api/restaurants/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.*, ${PHOTO_AGG}
    FROM restaurants r
    LEFT JOIN restaurant_photos rp ON rp.restaurant_id = r.id
    WHERE r.id = $1
    GROUP BY r.id
  `, [req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Restaurant not found' });
  res.json(rows[0]);
}));

// POST /api/restaurants
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, address, latitude, longitude,
    cuisine_type, price_range, rating, would_return, highlights,
    notes, website, phone, pet_friendly, image_url,
  } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO restaurants
      (name, city, state_province, country, address, latitude, longitude,
       cuisine_type, price_range, rating, would_return, highlights,
       notes, website, phone, pet_friendly, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *
  `, [name, city, state_province, country, address, latitude, longitude,
      cuisine_type, price_range, rating, would_return, highlights,
      notes, website, phone, pet_friendly ?? false, image_url]);
  res.status(201).json(rows[0]);
}));

// PUT /api/restaurants/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, address, latitude, longitude,
    cuisine_type, price_range, rating, would_return, highlights,
    notes, website, phone, pet_friendly, image_url,
  } = req.body;
  const { rows } = await pool.query(`
    UPDATE restaurants SET
      name=$1, city=$2, state_province=$3, country=$4, address=$5,
      latitude=$6, longitude=$7, cuisine_type=$8, price_range=$9,
      rating=$10, would_return=$11, highlights=$12, notes=$13,
      website=$14, phone=$15, pet_friendly=$16, image_url=$17,
      updated_at=NOW()
    WHERE id=$18
    RETURNING *
  `, [name, city, state_province, country, address, latitude, longitude,
      cuisine_type, price_range, rating, would_return, highlights,
      notes, website, phone, pet_friendly ?? false, image_url, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Restaurant not found' });
  res.json(rows[0]);
}));

// DELETE /api/restaurants/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM restaurants WHERE id=$1', [req.params.id]);
  if (!rowCount) return void res.status(404).json({ error: 'Restaurant not found' });
  res.status(204).send();
}));

export default router;
