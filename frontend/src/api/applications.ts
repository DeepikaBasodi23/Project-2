import api from './client';

export interface ApplicationFormData {
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
}

export interface Application extends ApplicationFormData {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  recommendation?: string;
  human_decision?: string;
  fairness_passed?: boolean;
}

export interface PaginatedApplications {
  data: Application[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const applicationsApi = {
  create: (data: ApplicationFormData) =>
    api.post<{ application: Application; message: string; warning?: string }>('/applications', data),

  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) => api.get<PaginatedApplications>('/applications', { params }),

  getById: (id: string) =>
    api.get<{
      application: Application;
      documents: unknown[];
      validationResult: unknown;
      policyScore: unknown;
      recommendation: unknown;
      fairnessCheck: unknown;
      humanDecisions: unknown[];
      auditLogs: unknown[];
      policyVersion: unknown;
    }>(`/applications/${id}`),

  getStatus: (id: string) =>
    api.get<{ status: string; updated_at: string }>(`/applications/${id}/status`),

  process: (id: string) =>
    api.post<{
      status: string;
      message: string;
      missingDocuments?: string[];
      validationResult?: unknown;
      policyScore?: unknown;
      recommendation?: unknown;
      fairnessCheck?: unknown;
    }>(`/applications/${id}/process`),

  uploadDocuments: (applicationId: string, files: File[], documentType: string) => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    files.forEach((file) => formData.append('files', file));
    return api.post<{ message: string; documents: unknown[] }>(
      `/applications/${applicationId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  getDocuments: (applicationId: string) =>
    api.get<{ documents: unknown[]; count: number }>(`/applications/${applicationId}/documents`),

  submitDecision: (
    applicationId: string,
    data: {
      underwriter_id: string;
      underwriter_name?: string;
      decision: 'APPROVED' | 'DECLINED' | 'REQUEST_MORE_DOCS';
      comments?: string;
      requested_documents?: string[];
    }
  ) =>
    api.post<{ message: string; decision: unknown; applicationStatus: string }>(
      `/applications/${applicationId}/decisions`,
      data
    ),
};

export const auditApi = {
  getHistory: (params?: {
    search?: string;
    status?: string;
    recommendation?: string;
    humanDecision?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<{ data: unknown[]; total: number; page: number; pageSize: number; totalPages: number }>('/audit', { params }),

  getRecord: (applicationId: string) =>
    api.get<unknown>(`/audit/${applicationId}`),
};
