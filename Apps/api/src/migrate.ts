import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())');
  const migrationsDir = path.join(__dirname, '../db/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rows } = await client.query('SELECT filename FROM schema_migrations WHERE filename = $1', [file]);
    if (rows.length > 0) { console.log('[migrate] skipped: ' + file); continue; }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('[migrate] applied: ' + file);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[migrate] failed: ' + file, err);
      await client.end();
      process.exit(1);
    }
  }
  console.log('[migrate] done');
  await client.end();
}

migrate();
