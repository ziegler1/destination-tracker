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
      COALESCE(ts.place_name, d.name, 'Stop ' || ts.stop_order) AS display_name,
      CASE WHEN ts.destination_id IS NOT NULL THEN jsonb_build_object(
        'id', d.id, 'name', d.name, 'city', d.city,
        'state_province', d.state_province, 'country', d.country,
        'latitude', d.latitude, 'longitude', d.longitude, 'status', d.status
      ) ELSE NULL END AS destination,
      CASE WHEN ts.lodging_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id, 'name', l.name, 'city', l.city,
        'lodging_type', l.lodging_type, 'price_per_night', l.price_per_night,
        'address', l.address, 'latitude', l.latitude, 'longitude', l.longitude,
        'website', l.website, 'phone', l.phone
      ) ELSE NULL END AS lodging,
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'id', tr.id, 'restaurant_id', tr.restaurant_id,
        'visited_at', tr.visited_at, 'notes', tr.notes,
        'restaurant', CASE WHEN r.id IS NOT NULL THEN jsonb_build_object(
          'id', r.id, 'name', r.name, 'city', r.city,
          'cuisine_type', r.cuisine_type, 'price_range', r.price_range, 'rating', r.rating
        ) ELSE NULL END
      )) FILTER (WHERE tr.id IS NOT NULL), '[]') AS restaurants,
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'id', tsi.id, 'special_interest_id', tsi.special_interest_id,
        'special_interest', CASE WHEN sip.id IS NOT NULL THEN jsonb_build_object(
          'id', sip.id, 'name', sip.name, 'city', sip.city,
          'category', sip.category, 'rating', sip.rating
        ) ELSE NULL END
      )) FILTER (WHERE tsi.id IS NOT NULL), '[]') AS special_interests
    FROM trip_stops ts
    LEFT JOIN destinations  d  ON d.id  = ts.destination_id
    LEFT JOIN lodging        l  ON l.id  = ts.lodging_id
    LEFT JOIN trip_restaurants tr ON tr.trip_stop_id = ts.id
    LEFT JOIN restaurants    r  ON r.id  = tr.restaurant_id
    LEFT JOIN trip_special_interests tsi ON tsi.trip_stop_id = ts.id
    LEFT JOIN special_interest_places sip ON sip.id = tsi.special_interest_id
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
      COALESCE(ts.place_name, d.name, 'Stop ' || ts.stop_order) AS display_name,
      CASE WHEN ts.destination_id IS NOT NULL THEN jsonb_build_object(
        'id', d.id, 'name', d.name, 'city', d.city,
        'state_province', d.state_province, 'country', d.country,
        'latitude', d.latitude, 'longitude', d.longitude, 'status', d.status
      ) ELSE NULL END AS destination,
      CASE WHEN ts.lodging_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id, 'name', l.name, 'city', l.city,
        'lodging_type', l.lodging_type, 'price_per_night', l.price_per_night,
        'address', l.address, 'latitude', l.latitude, 'longitude', l.longitude,
        'website', l.website, 'phone', l.phone
      ) ELSE NULL END AS lodging,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', tr.id, 'restaurant_id', tr.restaurant_id,
          'visited_at', tr.visited_at, 'notes', tr.notes,
          'restaurant', jsonb_build_object(
            'id', r.id, 'name', r.name, 'city', r.city,
            'cuisine_type', r.cuisine_type, 'price_range', r.price_range, 'rating', r.rating
          )
        ))
        FROM trip_restaurants tr
        JOIN restaurants r ON r.id = tr.restaurant_id
        WHERE tr.trip_stop_id = ts.id
      ), '[]') AS restaurants,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', tsi.id, 'special_interest_id', tsi.special_interest_id,
          'special_interest', jsonb_build_object(
            'id', sip.id, 'name', sip.name, 'city', sip.city,
            'category', sip.category, 'rating', sip.rating
          )
        ))
        FROM trip_special_interests tsi
        JOIN special_interest_places sip ON sip.id = tsi.special_interest_id
        WHERE tsi.trip_stop_id = ts.id
      ), '[]') AS special_interests
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
  const {
    destination_id, stop_order, arrival_date, departure_date, status, lodging_id, notes,
    place_name, place_address, place_type, place_lat, place_lng, place_google_id, is_home_base,
  } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO trip_stops
      (trip_id, destination_id, stop_order, arrival_date, departure_date, status, lodging_id, notes,
       place_name, place_address, place_type, place_lat, place_lng, place_google_id, is_home_base)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'city'),$12,$13,$14,COALESCE($15,false))
    RETURNING *
  `, [tripId, destination_id ?? null, stop_order, arrival_date, departure_date,
      status ?? 'upcoming', lodging_id ?? null, notes,
      place_name ?? null, place_address ?? null, place_type ?? null,
      place_lat ?? null, place_lng ?? null, place_google_id ?? null, is_home_base ?? null]);
  res.status(201).json(rows[0]);
}));

// PUT /api/trips/:tripId/stops/reorder — bulk-persist a new stop_order sequence
router.put('/reorder', asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { order } = req.body as { order: number[] };
  if (!Array.isArray(order) || order.length === 0) {
    return void res.status(400).json({ error: 'order must be a non-empty array of stop IDs' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < order.length; i++) {
      await client.query(
        'UPDATE trip_stops SET stop_order=$1 WHERE id=$2 AND trip_id=$3',
        [i + 1, order[i], tripId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const { rows } = await pool.query(
    'SELECT * FROM trip_stops WHERE trip_id=$1 ORDER BY stop_order', [tripId],
  );
  res.json(rows);
}));

// PUT /api/trips/:tripId/stops/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const {
    destination_id, stop_order, arrival_date, departure_date, status, lodging_id, notes,
    place_name, place_address, place_type, place_lat, place_lng, place_google_id, is_home_base,
  } = req.body;
  const { rows } = await pool.query(`
    UPDATE trip_stops SET
      destination_id=$1, stop_order=$2, arrival_date=$3, departure_date=$4,
      status=$5, lodging_id=$6, notes=$7,
      place_name=$8, place_address=$9, place_type=COALESCE($10,'city'),
      place_lat=$11, place_lng=$12, place_google_id=$13, is_home_base=COALESCE($14,false)
    WHERE id=$15 AND trip_id=$16
    RETURNING *
  `, [destination_id ?? null, stop_order, arrival_date, departure_date,
      status, lodging_id ?? null, notes,
      place_name ?? null, place_address ?? null, place_type ?? null,
      place_lat ?? null, place_lng ?? null, place_google_id ?? null, is_home_base ?? null,
      id, tripId]);
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
  res.json({ deleted: true, id: +req.params.id });
}));

// POST /api/trips/:tripId/stops/:id/restaurants — link a restaurant to a stop
router.post('/:id/restaurants', asyncHandler(async (req, res) => {
  const { tripId, id: stopId } = req.params;
  const { restaurant_id } = req.body;
  // Verify stop belongs to trip
  const { rows: [stop] } = await pool.query(
    'SELECT id FROM trip_stops WHERE id=$1 AND trip_id=$2',
    [stopId, tripId],
  );
  if (!stop) return void res.status(404).json({ error: 'Stop not found' });
  const { rows } = await pool.query(
    `INSERT INTO trip_restaurants (trip_id, trip_stop_id, restaurant_id)
     VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [tripId, stopId, restaurant_id],
  );
  res.status(201).json(rows[0] ?? { trip_id: tripId, trip_stop_id: stopId, restaurant_id });
}));

// PATCH /api/trips/:tripId/stops/:id/lodging — set lodging on a stop
router.patch('/:id/lodging', asyncHandler(async (req, res) => {
  const { tripId, id } = req.params;
  const { lodging_id } = req.body;
  const { rows } = await pool.query(
    'UPDATE trip_stops SET lodging_id=$1 WHERE id=$2 AND trip_id=$3 RETURNING *',
    [lodging_id, id, tripId],
  );
  if (!rows[0]) return void res.status(404).json({ error: 'Stop not found' });
  res.json(rows[0]);
}));

// POST /api/trips/:tripId/stops/:id/special-interests — link a special interest place to a stop
router.post('/:id/special-interests', asyncHandler(async (req, res) => {
  const { tripId, id: stopId } = req.params;
  const { special_interest_id } = req.body;
  const { rows: [stop] } = await pool.query(
    'SELECT id FROM trip_stops WHERE id=$1 AND trip_id=$2',
    [stopId, tripId],
  );
  if (!stop) return void res.status(404).json({ error: 'Stop not found' });
  const { rows } = await pool.query(
    `INSERT INTO trip_special_interests (trip_id, trip_stop_id, special_interest_id)
     VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [tripId, stopId, special_interest_id],
  );
  res.status(201).json(rows[0] ?? { trip_id: tripId, trip_stop_id: stopId, special_interest_id });
}));

// DELETE /api/trips/:tripId/stops/:id/restaurants/:linkId — unlink a restaurant from a stop
router.delete('/:id/restaurants/:linkId', asyncHandler(async (req, res) => {
  const { tripId, id: stopId, linkId } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM trip_restaurants WHERE id=$1 AND trip_stop_id=$2 AND trip_id=$3',
    [linkId, stopId, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Link not found' });
  res.json({ deleted: true, id: +linkId });
}));

// DELETE /api/trips/:tripId/stops/:id/special-interests/:linkId — unlink a special interest from a stop
router.delete('/:id/special-interests/:linkId', asyncHandler(async (req, res) => {
  const { tripId, id: stopId, linkId } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM trip_special_interests WHERE id=$1 AND trip_stop_id=$2 AND trip_id=$3',
    [linkId, stopId, tripId],
  );
  if (!rowCount) return void res.status(404).json({ error: 'Link not found' });
  res.json({ deleted: true, id: +linkId });
}));

export default router;
