/**
 * SQLite client using Node.js built-in node:sqlite (Node 22+).
 * Zero external dependencies. Database persists to a local file.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// Absolute path: backend/loan_agent.db
// __dirname at ts-node runtime = backend/src/db
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '..', '..', 'loan_agent.db');

// Ensure parent dir exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Singleton — one connection for the whole process
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    // Performance pragmas
    _db.exec('PRAGMA journal_mode=WAL;');
    _db.exec('PRAGMA foreign_keys=ON;');
    logger.info('SQLite database opened', { path: DB_PATH });
  }
  return _db;
}

/**
 * Execute a SELECT and return all rows.
 * Accepts positional $1/$2 params (converted to ?) or plain ? params.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = getDb();
  const normalised = sql.replace(/\$\d+/g, '?');
  try {
    const stmt = db.prepare(normalised);
    const rows = stmt.all(...params);
    return (rows as Record<string, unknown>[]).map(normaliseRow) as T[];
  } catch (err) {
    logger.error('DB query error', { sql: sql.substring(0, 100), error: (err as Error).message });
    throw err;
  }
}

/**
 * Execute a SELECT and return the first row or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Execute an INSERT/UPDATE/DELETE statement.
 */
export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const db = getDb();
  const normalised = sql.replace(/\$\d+/g, '?');
  try {
    const stmt = db.prepare(normalised);
    stmt.run(...params);
  } catch (err) {
    logger.error('DB execute error', { sql: sql.substring(0, 100), error: (err as Error).message });
    throw err;
  }
}

/**
 * Run raw SQL (for migrations — multi-statement DDL).
 */
export function runRawSql(sql: string): void {
  getDb().exec(sql);
}

/**
 * Run a set of DML statements in a single transaction.
 */
export async function runTransaction(fn: () => void | Promise<void>): Promise<void> {
  const db = getDb();
  db.exec('BEGIN');
  try {
    await fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT 1 as ok');
    logger.info('SQLite ready', { path: DB_PATH });
    return true;
  } catch (err) {
    logger.error('SQLite error', { error: (err as Error).message });
    return false;
  }
}

// Used by policyEngine activate (needs a write-transaction)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClient(): any {
  return {
    transaction: (_mode: string) => ({
      execute: async (stmt: { sql: string; args: unknown[] }) => execute(stmt.sql, stmt.args),
      commit:   async () => { /* auto-committed via execute */ },
      rollback: async () => { /* no-op */ },
    }),
  };
}

export const DB_FILE = DB_PATH;

// Inline normalise (avoids circular import)
function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  return row; // node:sqlite returns plain objects; JSON parsing done in normalize.ts
}
