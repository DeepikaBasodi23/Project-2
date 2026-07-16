-- SQLite schema for Loan Processing Agent
-- All UUIDs generated in application code (uuid package)
-- JSONB → TEXT (stored as JSON strings)
-- TIMESTAMPTZ → DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))

CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  description TEXT,
  rules TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  date_of_birth TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  loan_amount REAL NOT NULL,
  loan_purpose TEXT NOT NULL,
  loan_term_months INTEGER NOT NULL,
  employment_status TEXT,
  employer_name TEXT,
  annual_income REAL,
  monthly_debt_payments REAL DEFAULT 0,
  credit_score INTEGER,
  years_employed REAL,
  notes TEXT,
  status TEXT DEFAULT 'SUBMITTED',
  policy_version_id TEXT REFERENCES policy_versions(id),
  created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  is_valid INTEGER,
  validation_notes TEXT,
  extracted_data TEXT,
  uploaded_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS document_validation_results (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  is_complete INTEGER NOT NULL DEFAULT 0,
  missing_documents TEXT DEFAULT '[]',
  inconsistencies TEXT DEFAULT '[]',
  extracted_name TEXT,
  extracted_address TEXT,
  extracted_income REAL,
  extracted_employer TEXT,
  name_match INTEGER,
  address_match INTEGER,
  validation_passed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS policy_scores (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  dti_score REAL,
  dti_ratio REAL,
  credit_history_score REAL,
  income_stability_score REAL,
  employment_stability_score REAL,
  overall_score REAL,
  score_breakdown TEXT NOT NULL DEFAULT '{}',
  policy_version_id TEXT REFERENCES policy_versions(id),
  scored_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('APPROVE','REFER','DECLINE')),
  explanation TEXT NOT NULL,
  policy_citations TEXT NOT NULL DEFAULT '[]',
  confidence_level TEXT,
  policy_version_id TEXT REFERENCES policy_versions(id),
  created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS fairness_checks (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  original_recommendation TEXT NOT NULL,
  anonymized_recommendation TEXT NOT NULL,
  passed INTEGER NOT NULL,
  flag_reason TEXT,
  stripped_fields TEXT DEFAULT '[]',
  original_score REAL,
  anonymized_score REAL,
  checked_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS human_decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  underwriter_id TEXT NOT NULL,
  underwriter_name TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','DECLINED','REQUEST_MORE_DOCS')),
  comments TEXT,
  requested_documents TEXT DEFAULT '[]',
  decided_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT,
  details TEXT DEFAULT '{}',
  ip_address TEXT,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_validation_application_id ON document_validation_results(application_id);
CREATE INDEX IF NOT EXISTS idx_scores_application_id ON policy_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_application_id ON recommendations(application_id);
CREATE INDEX IF NOT EXISTS idx_fairness_application_id ON fairness_checks(application_id);
CREATE INDEX IF NOT EXISTS idx_decisions_application_id ON human_decisions(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_application_id ON audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
