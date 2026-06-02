import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// GET /api/trips/:tripId/stops
router.get('/', asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { rows } = await pool.query(`
    SELECT
      ts.*,
      CASE WHEN ts.destination_id IS NOT NULL THEN jsonb_build_object(
        'id', d.id, 'name', d.name, 'city', d.city,
        'state_province', d.state_province, 'country', d.country,
        'latitude', d.latitude, 'longitude', d.longitude, 'status', d.status
      ) ELSE NULL END AS destination,
      CASE WHEN ts.lodging_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id, 'name', l.name, 'city', l.city,
        'lodging_type', l.lodging_type, 'price_per_night', l.price_per_night
      ) ELSE NULL END AS lodging,
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'id', tr.id, 'restaurant_id', tr.restaurant_id,
        'visited_at', tr.visited_at, 'notes', tr.notes,
        'restaurant', CASE WHEN r.id IS NOT NULL THEN jsonb_build_object(
          'id', r.id, 'name', r.name, 'city', r.city,
          'cuisine_type', r.cuisine_type, 'price_range', r.price_range, 'rating', r.rating
        ) ELSE NULL END
      )) FILTER (WHERE tr.id IS NOT NULL), '[]') AS restaurants
    FROM trip_stops ts
    LEFT JOIN destinations  d  ON d.id  = ts.destination_id
    LEFT JOIN lodging        l  ON l.id  = ts.lodging_id
    LEFT JOIN trip_restaurants tr ON tr.trip_stop_id = ts.id
    LEFT JOIN restaurants    r  ON r.id  = tr.restaurant_id
    WHERE ts.trip_id = $1
    GROUP BY ts.id, d.id, l.id
    ORDER BY ts.stop_order
  `, [tripId]);
  res.json(rows);
}));

// GET /api/trips/:tripId/stops/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { rows } = await pool.query(`
    SELECT ts.*,
      CASE WHEN ts.destination_id IS NOT NULL THEN jsonb_build_object(
        'id', d.id, 'name', d.name, 'city', d.city,
        'state_province', d.state_province, 'country', d.country,
        'latitude', d.latitude, 'longitude', d.longitude, 'status', d.status
      ) ELSE NULL END AS destination,
      CASE WHEN ts.lodging_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id, 'name', l.name, 'city', l.city,
        'lodging_type', l.lodging_type, 'price_per_night', l.price_per_night
      ) ELSE NULL END AS lodging
    FROM trip_stops ts
    LEFT JOIN destinations d ON d.id = ts.destination_id
    LEFT JOIN lodging      l ON l.id = ts.lodging_id
    WHERE ts.id = $1 AND ts.trip_id = $2
  `, [id, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Stop not found' });
  res.json(rows[0]);
}));

// POST /api/trips/:tripId/stops
router.post('/', asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { destination_id, stop_order, arrival_date, departure_date, status, lodging_id, notes } =
    req.body;
  const { rows } = await pool.query(`
    INSERT INTO trip_stops
      (trip_id, destination_id, stop_order, arrival_date, departure_date, status, lodging_id, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `, [tripId, destination_id, stop_order, arrival_date, departure_date,
      status ?? 'upcoming', lodging_id, notes]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:tripId/stops/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { destination_id, stop_order, arrival_date, departure_date, status, lodging_id, notes } =
    req.body;
  const { rows } = await pool.query(`
    UPDATE trip_stops SET
      destination_id=$1, stop_order=$2, arrival_date=$3, departure_date=$4,
      status=$5, lodging_id=$6, notes=$7
    WHERE id=$8 AND trip_id=$9
    RETURNING *
  `, [destination_id, stop_order, arrival_date, departure_date,
      status, lodging_id, notes, id, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Stop not found' });
  res.json(rows[0]);
}));

// PATCH /api/trips/:tripId/stops/:id/status
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { status } = req.body;
  const { rows } = await pool.query(`
    UPDATE trip_stops SET status=$1 WHERE id=$2 AND trip_id=$3 RETURNING *
  `, [status, id, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Stop not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:tripId/stops/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM trip_stops WHERE id=$1 AND trip_id=$2',
    [id, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Stop not found' });
  res.status(204).send();
}));

export default router;
