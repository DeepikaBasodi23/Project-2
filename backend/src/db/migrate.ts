import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runRawSql, testConnection, DB_FILE } from './client';
import { logger } from '../utils/logger';

async function migrate(): Promise<void> {
  logger.info('Starting SQLite migration...', { db: DB_FILE });
  await testConnection();

  const schemaPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');

  // node:sqlite exec() handles the full multi-statement SQL in one shot
  runRawSql(sql);

  logger.info('Migration completed successfully');
  console.log(`✓ SQLite database ready at: ${DB_FILE}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Migration error:', err); process.exit(1); });
