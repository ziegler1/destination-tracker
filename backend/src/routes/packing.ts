import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// GET /api/trips/:tripId/packing
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      pl.*,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', pi.id, 'list_id', pi.list_id, 'category', pi.category,
          'item_name', pi.item_name, 'quantity', pi.quantity,
          'is_packed', pi.is_packed, 'notes', pi.notes
        )
        ORDER BY pi.category, pi.item_name
      ) FILTER (WHERE pi.id IS NOT NULL), '[]') AS items
    FROM packing_lists pl
    LEFT JOIN packing_items pi ON pi.list_id = pl.id
    WHERE pl.trip_id = $1
    GROUP BY pl.id
    ORDER BY pl.created_at
  `, [req.params.tripId]);
  res.json(rows);
}));

// POST /api/trips/:tripId/packing
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO packing_lists (trip_id, name) VALUES ($1,$2) RETURNING *
  `, [req.params.tripId, name ?? 'Packing List']);
  res.status(201).json({ ...rows[0], items: [] });
}));

// PUT /api/trips/:tripId/packing/:listId
router.put('/:listId', asyncHandler(async (req, res) => {
  const { tripId, listId } = req.params;
  const { name } = req.body;
  const { rows } = await pool.query(`
    UPDATE packing_lists SET name=$1 WHERE id=$2 AND trip_id=$3 RETURNING *
  `, [name, listId, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Packing list not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:tripId/packing/:listId
router.delete('/:listId', asyncHandler(async (req, res) => {
  const { tripId, listId } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM packing_lists WHERE id=$1 AND trip_id=$2',
    [listId, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Packing list not found' });
  res.status(204).send();
}));

// POST /api/trips/:tripId/packing/:listId/items
router.post('/:listId/items', asyncHandler(async (req, res) => {
  const { listId } = req.params;
  const { category, item_name, quantity, notes } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO packing_items (list_id, category, item_name, quantity, notes)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
  `, [listId, category ?? 'General', item_name, quantity ?? 1, notes]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:tripId/packing/:listId/items/:itemId
router.put('/:listId/items/:itemId', asyncHandler(async (req, res) => {
  const { listId, itemId } = req.params;
  const { category, item_name, quantity, is_packed, notes } = req.body;
  const { rows } = await pool.query(`
    UPDATE packing_items SET
      category=$1, item_name=$2, quantity=$3, is_packed=$4, notes=$5
    WHERE id=$6 AND list_id=$7
    RETURNING *
  `, [category, item_name, quantity, is_packed, notes, itemId, listId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
}));

// PATCH /api/trips/:tripId/packing/:listId/items/:itemId/toggle
router.patch('/:listId/items/:itemId/toggle', asyncHandler(async (req, res) => {
  const { listId, itemId } = req.params;
  const { rows } = await pool.query(`
    UPDATE packing_items SET is_packed = NOT is_packed
    WHERE id=$1 AND list_id=$2
    RETURNING *
  `, [itemId, listId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Item not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:tripId/packing/:listId/items/:itemId
router.delete('/:listId/items/:itemId', asyncHandler(async (req, res) => {
  const { listId, itemId } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM packing_items WHERE id=$1 AND list_id=$2',
    [itemId, listId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Item not found' });
  res.status(204).send();
}));

export default router;
