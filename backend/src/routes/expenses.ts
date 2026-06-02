import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// GET /api/trips/:tripId/expenses
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT * FROM trip_expenses
    WHERE trip_id = $1
    ORDER BY expense_date NULLS LAST, created_at
  `, [req.params.tripId]);
  res.json(rows);
}));

// GET /api/trips/:tripId/expenses/summary
router.get('/summary', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      category,
      COUNT(*)::int       AS count,
      SUM(amount)::float  AS total
    FROM trip_expenses
    WHERE trip_id = $1
    GROUP BY category
  `, [req.params.tripId]);

  const byCategory: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of rows) {
    byCategory[row.category] = Number(row.total);
    grandTotal += Number(row.total);
  }

  res.json({ total: grandTotal, by_category: byCategory, rows });
}));

// POST /api/trips/:tripId/expenses
router.post('/', asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { trip_stop_id, category, description, amount, expense_date } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO trip_expenses (trip_id, trip_stop_id, category, description, amount, expense_date)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `, [tripId, trip_stop_id, category, description, amount, expense_date]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:tripId/expenses/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { trip_stop_id, category, description, amount, expense_date } = req.body;
  const { rows } = await pool.query(`
    UPDATE trip_expenses SET
      trip_stop_id=$1, category=$2, description=$3, amount=$4, expense_date=$5
    WHERE id=$6 AND trip_id=$7
    RETURNING *
  `, [trip_stop_id, category, description, amount, expense_date, id, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Expense not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:tripId/expenses/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM trip_expenses WHERE id=$1 AND trip_id=$2',
    [id, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Expense not found' });
  res.status(204).send();
}));

export default router;
