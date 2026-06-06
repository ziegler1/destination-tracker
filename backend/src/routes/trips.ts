import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/trips
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      t.*,
      COUNT(DISTINCT ts.id)::int AS stop_count,
      MIN(ts.arrival_date)      AS first_arrival,
      MAX(ts.departure_date)    AS last_departure
    FROM trips t
    LEFT JOIN trip_stops ts ON ts.trip_id = t.id
    GROUP BY t.id
    ORDER BY
      CASE t.status
        WHEN 'active'    THEN 0
        WHEN 'planning'  THEN 1
        WHEN 'completed' THEN 2
        ELSE 3
      END,
      t.start_date DESC NULLS LAST,
      t.created_at DESC
  `);
  res.json(rows);
}));

// GET /api/trips/:id  — single CTE query returning full trip
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    WITH stop_agg AS (
      SELECT
        ts.trip_id,
        jsonb_agg(
          jsonb_build_object(
            'id',             ts.id,
            'trip_id',        ts.trip_id,
            'destination_id', ts.destination_id,
            'stop_order',     ts.stop_order,
            'arrival_date',   ts.arrival_date,
            'departure_date', ts.departure_date,
            'status',         ts.status,
            'lodging_id',     ts.lodging_id,
            'notes',          ts.notes,
            'created_at',     ts.created_at,
            'destination', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object(
              'id', d.id, 'name', d.name, 'city', d.city,
              'state_province', d.state_province, 'country', d.country,
              'latitude', d.latitude, 'longitude', d.longitude, 'status', d.status
            ) ELSE NULL END,
            'lodging', CASE WHEN l.id IS NOT NULL THEN jsonb_build_object(
              'id', l.id, 'name', l.name, 'city', l.city,
              'lodging_type', l.lodging_type, 'price_per_night', l.price_per_night,
              'address', l.address, 'latitude', l.latitude, 'longitude', l.longitude,
              'website', l.website, 'phone', l.phone
            ) ELSE NULL END,
            'restaurants', (
              SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                  'id', tr.id, 'trip_id', tr.trip_id, 'trip_stop_id', tr.trip_stop_id,
                  'restaurant_id', tr.restaurant_id,
                  'restaurant', jsonb_build_object(
                    'id', r.id, 'name', r.name, 'city', r.city,
                    'cuisine_type', r.cuisine_type, 'price_range', r.price_range,
                    'rating', r.rating, 'would_return', r.would_return,
                    'website', r.website, 'address', r.address,
                    'google_place_id', r.google_place_id
                  )
                )
                ORDER BY r.name
              ), '[]')
              FROM trip_restaurants tr
              JOIN restaurants r ON r.id = tr.restaurant_id
              WHERE tr.trip_stop_id = ts.id
            )
          )
          ORDER BY ts.stop_order
        ) AS stops
      FROM trip_stops ts
      LEFT JOIN destinations d ON d.id = ts.destination_id
      LEFT JOIN lodging      l ON l.id = ts.lodging_id
      WHERE ts.trip_id = $1
      GROUP BY ts.trip_id
    ),
    expense_agg AS (
      SELECT
        trip_id,
        jsonb_agg(
          jsonb_build_object(
            'id', te.id, 'trip_id', te.trip_id, 'trip_stop_id', te.trip_stop_id,
            'category', te.category, 'description', te.description,
            'amount', te.amount, 'expense_date', te.expense_date, 'created_at', te.created_at
          )
          ORDER BY te.expense_date NULLS LAST, te.created_at
        ) AS expenses
      FROM trip_expenses te
      WHERE trip_id = $1
      GROUP BY trip_id
    ),
    packing_agg AS (
      SELECT
        pl.trip_id,
        jsonb_agg(
          jsonb_build_object(
            'id', pl.id, 'trip_id', pl.trip_id, 'name', pl.name, 'created_at', pl.created_at,
            'items', (
              SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                  'id', pi.id, 'list_id', pi.list_id, 'category', pi.category,
                  'item_name', pi.item_name, 'quantity', pi.quantity,
                  'is_packed', pi.is_packed, 'notes', pi.notes
                )
                ORDER BY pi.category, pi.item_name
              ), '[]')
              FROM packing_items pi
              WHERE pi.list_id = pl.id
            )
          )
        ) AS packing_lists
      FROM packing_lists pl
      WHERE pl.trip_id = $1
      GROUP BY pl.trip_id
    ),
    journal_agg AS (
      SELECT
        trip_id,
        jsonb_agg(
          jsonb_build_object(
            'id', je.id, 'trip_id', je.trip_id, 'trip_stop_id', je.trip_stop_id,
            'entry_date', je.entry_date, 'title', je.title,
            'body', je.body, 'created_at', je.created_at, 'updated_at', je.updated_at
          )
          ORDER BY je.entry_date DESC, je.created_at DESC
        ) AS journal_entries
      FROM trip_journal_entries je
      WHERE trip_id = $1
      GROUP BY trip_id
    )
    SELECT
      t.*,
      COALESCE(sa.stops,          '[]') AS stops,
      COALESCE(ea.expenses,       '[]') AS expenses,
      COALESCE(pa.packing_lists,  '[]') AS packing_lists,
      COALESCE(ja.journal_entries,'[]') AS journal_entries
    FROM trips t
    LEFT JOIN stop_agg    sa ON sa.trip_id = t.id
    LEFT JOIN expense_agg ea ON ea.trip_id = t.id
    LEFT JOIN packing_agg pa ON pa.trip_id = t.id
    LEFT JOIN journal_agg ja ON ja.trip_id = t.id
    WHERE t.id = $1
  `, [req.params.id]);

  if (!rows[0]) return void res.status(404).json({ error: 'Trip not found' });
  res.json(rows[0]);
}));

// POST /api/trips
router.post('/', asyncHandler(async (req, res) => {
  const { name, description, status, start_date, end_date, total_budget, notes } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO trips (name, description, status, start_date, end_date, total_budget, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [name, description, status ?? 'planning', start_date, end_date, total_budget, notes]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { name, description, status, start_date, end_date, total_budget, notes, origin_address } = req.body;
  const { rows } = await pool.query(`
    UPDATE trips SET
      name=$1, description=$2, status=$3, start_date=$4,
      end_date=$5, total_budget=$6, notes=$7, origin_address=$8, updated_at=NOW()
    WHERE id=$9
    RETURNING *
  `, [name, description, status, start_date, end_date, total_budget, notes, origin_address ?? null, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Trip not found' });
  res.json(rows[0]);
}));

// PATCH /api/trips/:id/status
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { rows } = await pool.query(`
    UPDATE trips SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *
  `, [status, req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: 'Trip not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM trips WHERE id=$1', [req.params.id]);
  if (!rowCount) return void res.status(404).json({ error: 'Trip not found' });
  res.status(204).send();
}));

export default router;
