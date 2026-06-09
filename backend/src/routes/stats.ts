import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/stats — single call returns all aggregated stats
router.get('/', asyncHandler(async (_req, res) => {
  const [destStats, topStates, tripStats, tripsByYear, expenseStats, fuelStats, records, mostExpensive, cuisineBreakdown] =
    await Promise.all([

      // Destination counts by status
      pool.query(`
        SELECT
          COUNT(*)::int                                                              AS total,
          COUNT(*) FILTER (WHERE status='want_to_visit')::int                       AS want_to_visit,
          COUNT(*) FILTER (WHERE status='planned')::int                             AS planned,
          COUNT(*) FILTER (WHERE status='visited')::int                             AS visited,
          COUNT(DISTINCT state_province) FILTER (WHERE status='visited')::int       AS visited_states_count
        FROM destinations
      `),

      // Top 5 visited states by destination count
      pool.query(`
        SELECT state_province, COUNT(*)::int AS count
        FROM destinations
        WHERE status = 'visited'
        GROUP BY state_province
        ORDER BY count DESC
        LIMIT 5
      `),

      // Trip summary (non-cancelled, with both dates set)
      pool.query(`
        SELECT
          COUNT(*)::int                                                       AS total,
          COALESCE(ROUND(AVG((end_date - start_date)::int)), 0)::int         AS avg_duration_days,
          COALESCE(SUM((end_date - start_date)::int), 0)::int                AS total_days
        FROM trips
        WHERE status NOT IN ('cancelled')
          AND start_date IS NOT NULL
          AND end_date   IS NOT NULL
      `),

      // Trips per calendar year
      pool.query(`
        SELECT EXTRACT(YEAR FROM start_date)::int AS year, COUNT(*)::int AS count
        FROM trips
        WHERE start_date IS NOT NULL AND status != 'cancelled'
        GROUP BY year
        ORDER BY year
      `),

      // Expense totals by category
      pool.query(`
        SELECT
          COALESCE(SUM(amount), 0)::float                                     AS total,
          COALESCE(SUM(amount) FILTER (WHERE category='lodging'),    0)::float AS lodging,
          COALESCE(SUM(amount) FILTER (WHERE category='food'),       0)::float AS food,
          COALESCE(SUM(amount) FILTER (WHERE category='fuel'),       0)::float AS fuel,
          COALESCE(SUM(amount) FILTER (WHERE category='activities'), 0)::float AS activities,
          COALESCE(SUM(amount) FILTER (WHERE category='shopping'),   0)::float AS shopping,
          COALESCE(SUM(amount) FILTER (WHERE category='other'),      0)::float AS other
        FROM trip_expenses
      `),

      // Fuel totals + miles derived from odometer deltas per trip
      pool.query(`
        SELECT
          COALESCE(SUM(gallons), 0)::float                    AS total_gallons,
          COALESCE(SUM(gallons * price_per_gallon), 0)::float AS total_cost,
          COALESCE((
            SELECT SUM(miles)::float
            FROM (
              SELECT MAX(odometer) - MIN(odometer) AS miles
              FROM fuel_stops
              WHERE odometer IS NOT NULL
              GROUP BY trip_id
              HAVING MAX(odometer) > MIN(odometer)
            ) t
          ), 0)                                               AS total_miles
        FROM fuel_stops
        WHERE gallons IS NOT NULL
      `),

      // Personal records
      pool.query(`
        SELECT
          (SELECT name  FROM trips WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND status != 'cancelled'
           ORDER BY (end_date - start_date) DESC LIMIT 1)                           AS longest_trip_name,
          (SELECT (end_date - start_date)::int FROM trips WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND status != 'cancelled'
           ORDER BY (end_date - start_date) DESC LIMIT 1)                           AS longest_trip_days,
          (SELECT id   FROM trips WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND status != 'cancelled'
           ORDER BY (end_date - start_date) DESC LIMIT 1)                           AS longest_trip_id,
          (SELECT state_province FROM destinations WHERE status = 'visited'
           GROUP BY state_province ORDER BY COUNT(*) DESC LIMIT 1)                  AS most_visited_state,
          (SELECT id     FROM restaurants WHERE rating IS NOT NULL ORDER BY rating DESC, created_at DESC LIMIT 1) AS top_restaurant_id,
          (SELECT name   FROM restaurants WHERE rating IS NOT NULL ORDER BY rating DESC, created_at DESC LIMIT 1) AS top_restaurant_name,
          (SELECT city   FROM restaurants WHERE rating IS NOT NULL ORDER BY rating DESC, created_at DESC LIMIT 1) AS top_restaurant_city,
          (SELECT rating FROM restaurants WHERE rating IS NOT NULL ORDER BY rating DESC, created_at DESC LIMIT 1) AS top_restaurant_rating,
          (SELECT id           FROM lodging WHERE room_quality IS NOT NULL ORDER BY room_quality DESC, created_at DESC LIMIT 1) AS top_lodging_id,
          (SELECT name         FROM lodging WHERE room_quality IS NOT NULL ORDER BY room_quality DESC, created_at DESC LIMIT 1) AS top_lodging_name,
          (SELECT city         FROM lodging WHERE room_quality IS NOT NULL ORDER BY room_quality DESC, created_at DESC LIMIT 1) AS top_lodging_city,
          (SELECT room_quality FROM lodging WHERE room_quality IS NOT NULL ORDER BY room_quality DESC, created_at DESC LIMIT 1) AS top_lodging_quality
      `),

      // Most expensive trip
      pool.query(`
        SELECT t.id, t.name, SUM(e.amount)::float AS total_spent
        FROM trips t
        JOIN trip_expenses e ON e.trip_id = t.id
        GROUP BY t.id, t.name
        ORDER BY total_spent DESC
        LIMIT 1
      `),

      // Cuisine breakdown for diversity donut
      pool.query(`
        SELECT cuisine_type, COUNT(*)::int AS count
        FROM restaurants
        WHERE cuisine_type IS NOT NULL AND cuisine_type != ''
        GROUP BY cuisine_type
        ORDER BY count DESC
        LIMIT 8
      `),
    ]);

  const rec = records.rows[0] ?? {};
  const exp = mostExpensive.rows[0] ?? null;

  res.json({
    destinations: {
      ...destStats.rows[0],
      top_states: topStates.rows,
    },
    trips: {
      ...tripStats.rows[0],
      by_year: tripsByYear.rows,
    },
    expenses: expenseStats.rows[0],
    fuel:     fuelStats.rows[0],
    records: {
      longest_trip_name:        rec.longest_trip_name   ?? null,
      longest_trip_days:        rec.longest_trip_days   ?? null,
      longest_trip_id:          rec.longest_trip_id     ?? null,
      most_visited_state:       rec.most_visited_state  ?? null,
      top_restaurant_id:        rec.top_restaurant_id   ?? null,
      top_restaurant_name:      rec.top_restaurant_name ?? null,
      top_restaurant_city:      rec.top_restaurant_city ?? null,
      top_restaurant_rating:    rec.top_restaurant_rating ? Number(rec.top_restaurant_rating) : null,
      top_lodging_id:           rec.top_lodging_id      ?? null,
      top_lodging_name:         rec.top_lodging_name    ?? null,
      top_lodging_city:         rec.top_lodging_city    ?? null,
      top_lodging_quality:      rec.top_lodging_quality ? Number(rec.top_lodging_quality) : null,
      most_expensive_trip_id:   exp?.id                 ?? null,
      most_expensive_trip_name: exp?.name               ?? null,
      most_expensive_trip_total:exp?.total_spent         ?? null,
    },
    cuisine_breakdown: cuisineBreakdown.rows,
  });
}));

export default router;
