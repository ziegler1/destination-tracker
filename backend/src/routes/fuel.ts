import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// GET /api/trips/:tripId/fuel
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT * FROM fuel_stops
    WHERE trip_id = $1
    ORDER BY logged_at DESC
  `, [req.params.tripId]);
  res.json(rows);
}));

// POST /api/trips/:tripId/fuel
router.post('/', asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { trip_stop_id, station_name, city, state_province, price_per_gallon, gallons, odometer } =
    req.body;
  const { rows } = await pool.query(`
    INSERT INTO fuel_stops
      (trip_id, trip_stop_id, station_name, city, state_province,
       price_per_gallon, gallons, odometer)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `, [tripId, trip_stop_id, station_name, city, state_province,
      price_per_gallon, gallons, odometer]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:tripId/fuel/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { trip_stop_id, station_name, city, state_province, price_per_gallon, gallons, odometer } =
    req.body;
  const { rows } = await pool.query(`
    UPDATE fuel_stops SET
      trip_stop_id=$1, station_name=$2, city=$3, state_province=$4,
      price_per_gallon=$5, gallons=$6, odometer=$7
    WHERE id=$8 AND trip_id=$9
    RETURNING *
  `, [trip_stop_id, station_name, city, state_province,
      price_per_gallon, gallons, odometer, id, tripId]);
  if (!rows[0]) return void res.status(404).json({ error: 'Fuel stop not found' });
  res.json(rows[0]);
}));

// DELETE /api/trips/:tripId/fuel/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM fuel_stops WHERE id=$1 AND trip_id=$2',
    [id, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Fuel stop not found' });
  res.status(204).send();
}));

export default router;
