import fs from 'fs';
import path from 'path';
import pool from './db';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const sqlDir = path.join(__dirname, '..', 'db');
    const files = fs
      .readdirSync(sqlDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [filename]
      );
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(sqlDir, filename), 'utf8');
      console.log(`Applying migration: ${filename}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`Migration applied: ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
