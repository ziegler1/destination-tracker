import { Router } from 'express';
import pool from '../db';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

// GET /api/settings — returns all settings as { key: value } object
router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM app_settings ORDER BY key');
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}));

// PUT /api/settings — body: { key: value, ... } — upserts each entry
router.put('/', asyncHandler(async (req, res) => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== 'object') {
    return void res.status(400).json({ error: 'Body must be a key/value object' });
  }
  const entries = Object.entries(updates);
  if (entries.length === 0) return void res.json({});

  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, String(value)],
    );
  }

  const { rows } = await pool.query('SELECT key, value FROM app_settings ORDER BY key');
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}));

export default router;
