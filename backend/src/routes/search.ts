import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/search?q=term
router.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return void res.json({ trips: [], destinations: [], restaurants: [], lodging: [], journal: [] });

  const term = `%${q}%`;

  const [trips, destinations, restaurants, lodging, journal] = await Promise.all([

    pool.query(`
      SELECT id, name, status, start_date, end_date
      FROM trips
      WHERE status != 'cancelled'
        AND (name ILIKE $1 OR notes ILIKE $1)
      ORDER BY start_date DESC NULLS LAST
      LIMIT 5
    `, [term]),

    pool.query(`
      SELECT id, name, city, state_province, status
      FROM destinations
      WHERE name ILIKE $1 OR city ILIKE $1 OR state_province ILIKE $1 OR notes ILIKE $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [term]),

    pool.query(`
      SELECT id, name, city, state_province, cuisine_type, rating
      FROM restaurants
      WHERE name ILIKE $1 OR city ILIKE $1 OR cuisine_type ILIKE $1 OR highlights ILIKE $1
      ORDER BY rating DESC NULLS LAST
      LIMIT 5
    `, [term]),

    pool.query(`
      SELECT id, name, city, state_province, lodging_type, room_quality
      FROM lodging
      WHERE name ILIKE $1 OR city ILIKE $1 OR highlights ILIKE $1
      ORDER BY room_quality DESC NULLS LAST
      LIMIT 5
    `, [term]),

    pool.query(`
      SELECT je.id, je.title, je.body, je.entry_date, je.trip_id, t.name AS trip_name
      FROM trip_journal_entries je
      JOIN trips t ON t.id = je.trip_id
      WHERE je.title ILIKE $1 OR je.body ILIKE $1
      ORDER BY je.entry_date DESC
      LIMIT 5
    `, [term]),
  ]);

  res.json({
    trips:        trips.rows,
    destinations: destinations.rows,
    restaurants:  restaurants.rows,
    lodging:      lodging.rows,
    journal:      journal.rows,
  });
}));

export default router;
