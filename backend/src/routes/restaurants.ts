import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import { deleteFile } from '../lib/r2';

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
    notes, website, phone, pet_friendly, image_url, menu_url,
  } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO restaurants
      (name, city, state_province, country, address, latitude, longitude,
       cuisine_type, price_range, rating, would_return, highlights,
       notes, website, phone, pet_friendly, image_url, menu_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING *
  `, [name, city, state_province, country, address, latitude, longitude,
      cuisine_type, price_range, rating, would_return, highlights,
      notes, website, phone, pet_friendly ?? false, image_url, menu_url ?? null]);
  res.status(201).json(rows[0]);
}));

// PUT /api/restaurants/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, address, latitude, longitude,
    cuisine_type, price_range, rating, would_return, highlights,
    notes, website, phone, pet_friendly, image_url, menu_url,
  } = req.body;
  const { rows } = await pool.query(`
    UPDATE restaurants SET
      name=$1, city=$2, state_province=$3, country=$4, address=$5,
      latitude=$6, longitude=$7, cuisine_type=$8, price_range=$9,
      rating=$10, would_return=$11, highlights=$12, notes=$13,
      website=$14, phone=$15, pet_friendly=$16, image_url=$17, menu_url=$18,
      updated_at=NOW()
    WHERE id=$19
    RETURNING *
  `, [name, city, state_province, country, address, latitude, longitude,
      cuisine_type, price_range, rating, would_return, highlights,
      notes, website, phone, pet_friendly ?? false, image_url, menu_url ?? null, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Restaurant not found' });
  res.json(rows[0]);
}));

// PATCH /api/restaurants/:id/visit
router.patch('/:id/visit', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE restaurants SET visit_count = visit_count + 1, updated_at=NOW() WHERE id=$1 RETURNING *',
    [req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Restaurant not found' });
  res.json(rows[0]);
}));

// DELETE /api/restaurants/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM restaurants WHERE id=$1', [req.params.id]);
  if (!rowCount) return void res.status(404).json({ error: 'Restaurant not found' });
  res.status(204).send();
}));

// ── Photo management ──────────────────────────────────────────────────────────

router.post('/:id/photos', asyncHandler(async (req, res) => {
  const { r2_key, url, caption, is_primary } = req.body;
  if (is_primary) {
    await pool.query('UPDATE restaurant_photos SET is_primary=false WHERE restaurant_id=$1', [req.params.id]);
  }
  const { rows } = await pool.query(
    `INSERT INTO restaurant_photos (restaurant_id, r2_key, url, caption, is_primary)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, r2_key, url, caption ?? null, is_primary ?? false],
  );
  res.status(201).json(rows[0]);
}));

router.delete('/:id/photos/:photoId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM restaurant_photos WHERE id=$1 AND restaurant_id=$2 RETURNING r2_key',
    [req.params.photoId, req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Photo not found' });
  try { await deleteFile(rows[0].r2_key); } catch { /* ignore */ }
  res.status(204).send();
}));

router.patch('/:id/photos/:photoId/primary', asyncHandler(async (req, res) => {
  await pool.query('UPDATE restaurant_photos SET is_primary=false WHERE restaurant_id=$1', [req.params.id]);
  const { rows } = await pool.query(
    'UPDATE restaurant_photos SET is_primary=true WHERE id=$1 AND restaurant_id=$2 RETURNING *',
    [req.params.photoId, req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Photo not found' });
  res.json(rows[0]);
}));

router.patch('/:id/photos/:photoId/caption', asyncHandler(async (req, res) => {
  const { caption } = req.body;
  const { rows } = await pool.query(
    'UPDATE restaurant_photos SET caption=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING *',
    [caption ?? null, req.params.photoId, req.params.id],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Photo not found' });
  res.json(rows[0]);
}));

export default router;
