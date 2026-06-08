import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import { deleteFile } from '../lib/r2';
import { normalizeState } from '../lib/normalizeState';

const router = Router();

const PHOTO_AGG = `
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', sip.id, 'special_interest_id', sip.special_interest_id, 'r2_key', sip.r2_key,
    'url', sip.url, 'caption', sip.caption, 'is_primary', sip.is_primary,
    'uploaded_at', sip.uploaded_at
  )) FILTER (WHERE sip.id IS NOT NULL), '[]') AS photos`;

// GET /api/special-interests
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT s.*, ${PHOTO_AGG}
    FROM special_interest_places s
    LEFT JOIN special_interest_photos sip ON sip.special_interest_id = s.id
    GROUP BY s.id
    ORDER BY s.name
  `);
  res.json(rows);
}));

// GET /api/special-interests/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT s.*, ${PHOTO_AGG}
    FROM special_interest_places s
    LEFT JOIN special_interest_photos sip ON sip.special_interest_id = s.id
    WHERE s.id = $1
    GROUP BY s.id
  `, [req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

// POST /api/special-interests
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, category, address,
    latitude, longitude, website, phone,
    rating, would_return, highlights, notes, image_url,
  } = req.body;
  const normalizedState = state_province ? normalizeState(state_province) : state_province;
  const { rows } = await pool.query(`
    INSERT INTO special_interest_places
      (name, city, state_province, country, category, address,
       latitude, longitude, website, phone,
       rating, would_return, highlights, notes, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *
  `, [name, city, normalizedState, country ?? 'USA', category, address,
      latitude, longitude, website, phone,
      rating, would_return, highlights, notes, image_url]);
  res.status(201).json(rows[0]);
}));

// PUT /api/special-interests/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const {
    name, city, state_province, country, category, address,
    latitude, longitude, website, phone,
    rating, would_return, highlights, notes, image_url,
  } = req.body;
  const normalizedState = state_province ? normalizeState(state_province) : state_province;
  const { rows } = await pool.query(`
    UPDATE special_interest_places SET
      name=$1, city=$2, state_province=$3, country=$4, category=$5, address=$6,
      latitude=$7, longitude=$8, website=$9, phone=$10,
      rating=$11, would_return=$12, highlights=$13, notes=$14, image_url=$15,
      updated_at=NOW()
    WHERE id=$16
    RETURNING *
  `, [name, city, normalizedState, country ?? 'USA', category, address,
      latitude, longitude, website, phone,
      rating, would_return, highlights, notes, image_url, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

// DELETE /api/special-interests/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rows: photos } = await pool.query(
    'SELECT r2_key FROM special_interest_photos WHERE special_interest_id = $1',
    [req.params.id],
  );
  const { rowCount } = await pool.query('DELETE FROM special_interest_places WHERE id = $1', [req.params.id]);
  if (!rowCount) return void res.status(404).json({ error: 'Place not found' });
  await Promise.all(photos.map((p: { r2_key: string }) => deleteFile(p.r2_key).catch(() => {})));
  res.json({ deleted: true, id: +req.params.id });
}));

// GET /api/special-interests/:id/photos
router.get('/:id/photos', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM special_interest_photos WHERE special_interest_id = $1 ORDER BY is_primary DESC, uploaded_at DESC',
    [req.params.id],
  );
  res.json(rows);
}));

// POST /api/special-interests/:id/photos
router.post('/:id/photos', asyncHandler(async (req, res) => {
  const { r2_key, url, caption, is_primary } = req.body;
  if (is_primary) {
    await pool.query(
      'UPDATE special_interest_photos SET is_primary=FALSE WHERE special_interest_id=$1',
      [req.params.id],
    );
  }
  const { rows } = await pool.query(`
    INSERT INTO special_interest_photos (special_interest_id, r2_key, url, caption, is_primary)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [req.params.id, r2_key, url, caption, is_primary ?? false]);
  res.status(201).json(rows[0]);
}));

// DELETE /api/special-interests/:id/photos/:photoId
router.delete('/:id/photos/:photoId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM special_interest_photos WHERE id=$1 AND special_interest_id=$2 RETURNING r2_key',
    [req.params.photoId, req.params.id],
  );
  if (rows[0]) await deleteFile(rows[0].r2_key);
  res.status(204).send();
}));

export default router;
