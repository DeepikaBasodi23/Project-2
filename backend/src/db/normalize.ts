/**
 * SQLite result normalizer.
 *
 * SQLite stores:
 *   - Booleans as INTEGER 0/1
 *   - JSON objects/arrays as TEXT
 *   - DATETIME as TEXT ISO strings
 *
 * This module post-processes query results so the rest of the
 * application receives properly typed objects (same shape as the
 * original PostgreSQL schema).
 */

// Fields that are stored as JSON TEXT and need to be parsed back
const JSON_FIELDS = new Set([
  'rules', 'extracted_data', 'inconsistencies', 'missing_documents',
  'score_breakdown', 'policy_citations', 'stripped_fields',
  'requested_documents', 'details',
]);

// Fields stored as INTEGER 0/1 that should be booleans
const BOOL_FIELDS = new Set([
  'is_active', 'is_complete', 'validation_passed', 'passed',
  'name_match', 'address_match', 'is_valid',
]);

export function normalizeRow<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (BOOL_FIELDS.has(key)) {
      out[key] = value === 1 || value === true;
    } else if (JSON_FIELDS.has(key) && typeof value === 'string') {
      try { out[key] = JSON.parse(value); }
      catch { out[key] = value; }
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function normalizeRows<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => normalizeRow<T>(r));
}
