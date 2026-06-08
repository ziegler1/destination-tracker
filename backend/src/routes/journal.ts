import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// GET /api/trips/:tripId/journal
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT * FROM trip_journal_entries
    WHERE trip_id = $1
    ORDER BY entry_date DESC, created_at DESC
  `, [req.params.tripId]);
  res.json(rows);
}));

// GET /api/trips/:tripId/journal/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM trip_journal_entries WHERE id=$1 AND trip_id=$2',
    [id, tripId],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Journal entry not found' });
  res.json(rows[0]);
}));

// POST /api/trips/:tripId/journal
router.post('/', asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { trip_stop_id, entry_date, title, body } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO trip_journal_entries (trip_id, trip_stop_id, entry_date, title, body)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
  `, [tripId, trip_stop_id, entry_date, title, body]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:tripId/journal/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { trip_stop_id, entry_date, title, body } = req.body;
  const { rows } = await pool.query(`
    UPDATE trip_journal_entries SET
      trip_stop_id=$1, entry_date=$2, title=$3, body=$4, updated_at=NOW()
    WHERE id=$5 AND trip_id=$6
    RETURNING *
  `, [trip_stop_id, entry_date, title, body, id, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Journal entry not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:tripId/journal/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM trip_journal_entries WHERE id=$1 AND trip_id=$2',
    [id, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Journal entry not found' });
  res.json({ deleted: true, id: +req.params.id });
}));

export default router;
