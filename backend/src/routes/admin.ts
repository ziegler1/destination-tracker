import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';
import { enrichPlace } from '../lib/googlePlaces';

const router = Router();

interface BackfillCount {
  updated: number;
  skipped: number;
  failed:  number;
}

interface BackfillResults {
  destinations:      BackfillCount;
  restaurants:       BackfillCount;
  lodging:           BackfillCount;
  special_interests: BackfillCount;
}

const TABLES: Array<{ table: string; key: keyof BackfillResults }> = [
  { table: 'destinations',           key: 'destinations' },
  { table: 'restaurants',            key: 'restaurants' },
  { table: 'lodging',                key: 'lodging' },
  { table: 'special_interest_places', key: 'special_interests' },
];

router.post('/backfill-photos', asyncHandler(async (_req, res) => {
  const results: BackfillResults = {
    destinations:      { updated: 0, skipped: 0, failed: 0 },
    restaurants:       { updated: 0, skipped: 0, failed: 0 },
    lodging:           { updated: 0, skipped: 0, failed: 0 },
    special_interests: { updated: 0, skipped: 0, failed: 0 },
  };

  for (const { table, key } of TABLES) {
    const { rows } = await pool.query<{
      id: number; name: string; city: string; state_province: string;
    }>(
      `SELECT id, name, city, state_province
       FROM ${table}
       WHERE (image_url IS NULL OR image_url = '')
         AND city IS NOT NULL
         AND name IS NOT NULL`,
    );

    console.log(`[Backfill] ${table}: ${rows.length} records need photos`);

    for (const record of rows) {
      // 200 ms between calls to stay inside Places free-tier QPS
      await new Promise((r) => setTimeout(r, 200));

      try {
        const place = await enrichPlace(
          record.name, record.city, record.state_province, false,
        );

        if (!place?.photo_url) {
          results[key].skipped++;
          continue;
        }

        await pool.query(
          `UPDATE ${table} SET image_url = $1 WHERE id = $2`,
          [place.photo_url, record.id],
        );

        // Backfill google_place_id where missing; ignore if column absent
        try {
          await pool.query(
            `UPDATE ${table}
             SET google_place_id = $1
             WHERE id = $2
               AND (google_place_id IS NULL OR google_place_id = '')`,
            [place.place_id, record.id],
          );
        } catch { /* column may not exist on this table */ }

        console.log(`[Backfill] ✓ ${record.name} → ${place.photo_url}`);
        results[key].updated++;
      } catch (err) {
        console.error(`[Backfill] ✗ ${record.name}:`, err);
        results[key].failed++;
      }
    }
  }

  const total_updated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);
  console.log('[Backfill] Complete:', results);
  res.json({ success: true, total_updated, results });
}));

export default router;
