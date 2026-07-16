// All domain types for the Loan Processing Agent

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'DOCUMENTS_PENDING'
  | 'PROCESSING'
  | 'AWAITING_DECISION'
  | 'APPROVED'
  | 'DECLINED'
  | 'REFERRED';

export type DocumentType =
  | 'GOVERNMENT_ID'
  | 'INCOME_PROOF'
  | 'BANK_STATEMENT'
  | 'CREDIT_REPORT'
  | 'OTHER';

export type RecommendationType = 'APPROVE' | 'REFER' | 'DECLINE';

export type HumanDecisionType = 'APPROVED' | 'DECLINED' | 'REQUEST_MORE_DOCS';

export type RuleOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq';

export interface Application {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  loan_amount: number;
  loan_purpose: string;
  loan_term_months: number;
  employment_status?: string;
  employer_name?: string;
  annual_income?: number;
  monthly_debt_payments?: number;
  credit_score?: number;
  years_employed?: number;
  notes?: string;
  status: ApplicationStatus;
  policy_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  application_id: string;
  document_type: DocumentType;
  original_filename: string;
  stored_filename: string;
  file_size_bytes?: number;
  mime_type?: string;
  is_valid?: boolean;
  validation_notes?: string;
  extracted_data?: ExtractedDocumentData;
  uploaded_at: string;
}

export interface ExtractedDocumentData {
  name?: string;
  address?: string;
  income?: number;
  employer?: string;
  dateOfBirth?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  accountNumber?: string;
  averageBalance?: number;
  suspiciousInstructions?: string[];
  extractionNotes?: string;
}

export interface DocumentValidationResult {
  id: string;
  application_id: string;
  is_complete: boolean;
  missing_documents: string[];
  inconsistencies: Inconsistency[];
  extracted_name?: string;
  extracted_address?: string;
  extracted_income?: number;
  extracted_employer?: string;
  name_match?: boolean;
  address_match?: boolean;
  validation_passed: boolean;
  notes?: string;
  created_at: string;
}

export interface Inconsistency {
  field: string;
  document1: string;
  document2: string;
  value1: string;
  value2: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PolicyRule {
  id: string;
  clause: string;
  description: string;
  field: string;
  operator: RuleOperator;
  threshold: number;
  isHard: boolean;
}

export interface PolicyRules {
  weights: {
    dti: number;
    creditHistory: number;
    incomeStability: number;
    employmentStability: number;
  };
  thresholds: {
    approveMinScore: number;
    referMinScore: number;
    maxDTIRatio: number;
    minCreditScore: number;
    minAnnualIncome: number;
    minYearsEmployed: number;
  };
  hardRules: PolicyRule[];
  softRules: PolicyRule[];
}

export interface PolicyVersion {
  id: string;
  version: string;
  description?: string;
  rules: PolicyRules;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleEvaluation {
  ruleId: string;
  clause: string;
  description: string;
  passed: boolean;
  isHard: boolean;
  actualValue: number | string;
  threshold: number;
  operator: RuleOperator;
  message: string;
}

export interface ScoreBreakdown {
  dtiScore: number;
  dtiRatio: number;
  creditHistoryScore: number;
  incomeStabilityScore: number;
  employmentStabilityScore: number;
  overallScore: number;
  weights: PolicyRules['weights'];
  details: Record<string, string>;
}

export interface PolicyScore {
  id: string;
  application_id: string;
  dti_score: number;
  dti_ratio: number;
  credit_history_score: number;
  income_stability_score: number;
  employment_stability_score: number;
  overall_score: number;
  score_breakdown: ScoreBreakdown;
  policy_version_id?: string;
  scored_at: string;
}

export interface PolicyCitation {
  ruleId: string;
  clause: string;
  description: string;
  outcome: 'PASS' | 'FAIL' | 'WARN';
}

export interface Recommendation {
  id: string;
  application_id: string;
  recommendation: RecommendationType;
  explanation: string;
  policy_citations: PolicyCitation[];
  confidence_level?: string;
  policy_version_id?: string;
  created_at: string;
}

export interface FairnessCheck {
  id: string;
  application_id: string;
  original_recommendation: RecommendationType;
  anonymized_recommendation: RecommendationType;
  passed: boolean;
  flag_reason?: string;
  stripped_fields: string[];
  original_score: number;
  anonymized_score: number;
  checked_at: string;
}

export interface HumanDecision {
  id: string;
  application_id: string;
  underwriter_id: string;
  underwriter_name?: string;
  decision: HumanDecisionType;
  comments?: string;
  requested_documents?: string[];
  decided_at: string;
}

export interface AuditLog {
  id: string;
  application_id: string;
  event_type: string;
  actor?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface FullAuditRecord {
  application: Application;
  documents: Document[];
  validationResult?: DocumentValidationResult;
  policyScore?: PolicyScore;
  recommendation?: Recommendation;
  fairnessCheck?: FairnessCheck;
  humanDecisions: HumanDecision[];
  auditLogs: AuditLog[];
  policyVersion?: PolicyVersion;
}

export interface ProcessingResult {
  applicationId: string;
  status: 'COMPLETE' | 'INCOMPLETE_DOCUMENTS' | 'ERROR';
  missingDocuments?: string[];
  validationResult?: DocumentValidationResult;
  policyScore?: PolicyScore;
  recommendation?: Recommendation;
  fairnessCheck?: FairnessCheck;
  message: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
  statusCode: number;
}
