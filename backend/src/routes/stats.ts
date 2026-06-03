import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/stats — single call returns all aggregated stats
router.get('/', asyncHandler(async (_req, res) => {
  const [destStats, topStates, tripStats, tripsByYear, expenseStats, fuelStats] =
    await Promise.all([

      // Destination counts by status
      pool.query(`
        SELECT
          COUNT(*)::int                                               AS total,
          COUNT(*) FILTER (WHERE status='want_to_visit')::int        AS want_to_visit,
          COUNT(*) FILTER (WHERE status='planned')::int              AS planned,
          COUNT(*) FILTER (WHERE status='visited')::int              AS visited
        FROM destinations
      `),

      // Top 5 states by destination count
      pool.query(`
        SELECT state_province, COUNT(*)::int AS count
        FROM destinations
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
    ]);

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
  });
}));

export default router;
