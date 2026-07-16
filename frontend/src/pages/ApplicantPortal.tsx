import React, { useState } from 'react';
import { applicationsApi, ApplicationFormData } from '../api/applications';
import DocumentUpload from '../components/DocumentUpload';
import StatusBadge from '../components/StatusBadge';

type Step = 'personal' | 'employment' | 'loan' | 'documents' | 'submitted';

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  padding: '32px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  maxWidth: '700px',
  margin: '0 auto',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  outline: 'none',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  marginBottom: '4px',
  color: '#444',
};

const btn = (variant: 'primary' | 'secondary'): React.CSSProperties => ({
  padding: '10px 24px',
  borderRadius: '6px',
  border: 'none',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  background: variant === 'primary' ? '#e94560' : '#f0f2f5',
  color: variant === 'primary' ? '#fff' : '#333',
});

const STEPS: Step[] = ['personal', 'employment', 'loan', 'documents', 'submitted'];
const STEP_LABELS = ['Personal Info', 'Employment & Income', 'Loan Details', 'Documents'];

const DOC_TYPES = [
  { key: 'GOVERNMENT_ID', label: 'Government-Issued ID', required: true },
  { key: 'INCOME_PROOF', label: 'Income Proof (W-2, pay stubs, tax return)', required: true },
  { key: 'BANK_STATEMENT', label: 'Bank Statements (last 3 months)', required: true },
  { key: 'CREDIT_REPORT', label: 'Credit Report', required: false },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const LOAN_PURPOSES = [
  'Home Improvement', 'Debt Consolidation', 'Auto Loan', 'Business Investment',
  'Education', 'Medical Expenses', 'Personal Loan', 'Other',
];

export default function ApplicantPortal() {
  const [step, setStep] = useState<Step>('personal');
  const [form, setForm] = useState<Partial<ApplicationFormData>>({
    loan_term_months: 60,
    monthly_debt_payments: 0,
  });
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [submittedApp, setSubmittedApp] = useState<{ id: string; status: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{
    status: string;
    message: string;
    missingDocuments?: string[];
    recommendation?: { recommendation: string; explanation: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = (field: keyof ApplicationFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const currentIndex = STEPS.indexOf(step);

  // ----------------------------------------------------------------
  // Step 1: Submit application
  // ----------------------------------------------------------------
  const submitApplication = async () => {
    setError(null);
    if (!form.applicant_name || !form.applicant_email || !form.loan_amount || !form.loan_purpose) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      setProcessing(true);
      const res = await applicationsApi.create(form as ApplicationFormData);
      setSubmittedApp({ id: res.data.application.id, status: res.data.application.status });
      setStep('documents');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  // ----------------------------------------------------------------
  // Step 2: Upload documents then trigger processing
  // ----------------------------------------------------------------
  const uploadAndProcess = async () => {
    if (!submittedApp) return;
    setError(null);
    setUploading(true);
    try {
      // Upload each doc type
      for (const [docType, fileList] of Object.entries(files)) {
        if (fileList.length > 0) {
          await applicationsApi.uploadDocuments(submittedApp.id, fileList, docType);
        }
      }
      // Trigger processing pipeline
      setUploading(false);
      setProcessing(true);
      const res = await applicationsApi.process(submittedApp.id);
      setProcessingResult(res.data as typeof processingResult);
      setStep('submitted');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const ProgressBar = () => (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={{ flex: 1 }}>
          <div
            style={{
              height: '4px',
              borderRadius: '2px',
              background: i <= currentIndex - 1 ? '#e94560' : i === currentIndex - 1 ? '#e94560' : '#e0e0e0',
            }}
          />
          <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', textAlign: 'center' }}>{label}</div>
        </div>
      ))}
    </div>
  );

  // ----------------------------------------------------------------
  // Render steps
  // ----------------------------------------------------------------
  if (step === 'submitted') {
    const rec = processingResult?.recommendation as { recommendation?: string; explanation?: string } | undefined;
    const missing = processingResult?.missingDocuments;

    return (
      <div style={{ padding: '32px 16px' }}>
        <div style={card}>
          <h2 style={{ marginTop: 0, color: '#1a1a2e' }}>Application Submitted</h2>
          <p style={{ color: '#555', fontSize: '14px' }}>Application ID: <strong>{submittedApp?.id}</strong></p>

          {missing && missing.length > 0 ? (
            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <strong>⚠ Missing Documents</strong>
              <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
                Processing could not proceed. Please upload the following:
              </p>
              <ul style={{ marginTop: '8px' }}>
                {missing.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
          ) : rec ? (
            <div style={{ background: '#f0f9ff', border: '1px solid #b8d9f5', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <strong>AI Recommendation:</strong>
                <StatusBadge status={rec.recommendation || ''} />
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#555', whiteSpace: 'pre-line' }}>
                Your application is now awaiting review by a licensed underwriter who will make the final decision.
              </p>
            </div>
          ) : (
            <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', padding: '16px' }}>
              <strong>✓ Application received and being processed.</strong>
            </div>
          )}

          <p style={{ fontSize: '13px', color: '#888' }}>
            You will be notified once an underwriter has reviewed your application.
          </p>
          <button style={btn('primary')} onClick={() => { setStep('personal'); setForm({ loan_term_months: 60, monthly_debt_payments: 0 }); setFiles({}); setSubmittedApp(null); setProcessingResult(null); }}>
            Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 16px' }}>
      <div style={card}>
        <h1 style={{ marginTop: 0, fontSize: '24px', color: '#1a1a2e' }}>Loan Application</h1>
        <ProgressBar />

        {error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#721c24' }}>
            {error}
          </div>
        )}

        {/* ---- Step: Personal Info ---- */}
        {step === 'personal' && (
          <div>
            <h2 style={{ fontSize: '18px', marginTop: 0 }}>Personal Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Full Name <span style={{ color: '#e74c3c' }}>*</span></label>
                <input style={input} value={form.applicant_name || ''} onChange={(e) => set('applicant_name', e.target.value)} placeholder="As it appears on your ID" />
              </div>
              <div>
                <label style={label}>Email <span style={{ color: '#e74c3c' }}>*</span></label>
                <input style={input} type="email" value={form.applicant_email || ''} onChange={(e) => set('applicant_email', e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label style={label}>Phone</label>
                <input style={input} value={form.applicant_phone || ''} onChange={(e) => set('applicant_phone', e.target.value)} placeholder="555-000-0000" />
              </div>
              <div>
                <label style={label}>Date of Birth</label>
                <input style={input} type="date" value={form.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Address</label>
                <input style={input} value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Street address" />
              </div>
              <div>
                <label style={label}>City</label>
                <input style={input} value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label style={label}>State</label>
                <input style={input} value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="IL" />
              </div>
              <div>
                <label style={label}>ZIP Code</label>
                <input style={input} value={form.zip_code || ''} onChange={(e) => set('zip_code', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button style={btn('primary')} onClick={() => setStep('employment')}>Next →</button>
            </div>
          </div>
        )}

        {/* ---- Step: Employment & Income ---- */}
        {step === 'employment' && (
          <div>
            <h2 style={{ fontSize: '18px', marginTop: 0 }}>Employment & Income</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={label}>Employment Status</label>
                <select style={input} value={form.employment_status || ''} onChange={(e) => set('employment_status', e.target.value)}>
                  <option value="">Select...</option>
                  {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Employer Name</label>
                <input style={input} value={form.employer_name || ''} onChange={(e) => set('employer_name', e.target.value)} placeholder="Company name" />
              </div>
              <div>
                <label style={label}>Annual Income ($)</label>
                <input style={input} type="number" min={0} value={form.annual_income || ''} onChange={(e) => set('annual_income', parseFloat(e.target.value))} placeholder="60000" />
              </div>
              <div>
                <label style={label}>Monthly Debt Payments ($)</label>
                <input style={input} type="number" min={0} value={form.monthly_debt_payments || ''} onChange={(e) => set('monthly_debt_payments', parseFloat(e.target.value))} placeholder="500" />
              </div>
              <div>
                <label style={label}>Years Employed</label>
                <input style={input} type="number" min={0} step={0.5} value={form.years_employed || ''} onChange={(e) => set('years_employed', parseFloat(e.target.value))} placeholder="3.5" />
              </div>
              <div>
                <label style={label}>Credit Score (optional)</label>
                <input style={input} type="number" min={300} max={850} value={form.credit_score || ''} onChange={(e) => set('credit_score', parseInt(e.target.value))} placeholder="680" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button style={btn('secondary')} onClick={() => setStep('personal')}>← Back</button>
              <button style={btn('primary')} onClick={() => setStep('loan')}>Next →</button>
            </div>
          </div>
        )}

        {/* ---- Step: Loan Details ---- */}
        {step === 'loan' && (
          <div>
            <h2 style={{ fontSize: '18px', marginTop: 0 }}>Loan Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={label}>Loan Amount ($) <span style={{ color: '#e74c3c' }}>*</span></label>
                <input style={input} type="number" min={1000} value={form.loan_amount || ''} onChange={(e) => set('loan_amount', parseFloat(e.target.value))} placeholder="25000" />
              </div>
              <div>
                <label style={label}>Loan Term (months) <span style={{ color: '#e74c3c' }}>*</span></label>
                <select style={input} value={form.loan_term_months || 60} onChange={(e) => set('loan_term_months', parseInt(e.target.value))}>
                  {[12, 24, 36, 48, 60, 72, 84, 120].map((m) => <option key={m} value={m}>{m} months ({(m / 12).toFixed(0)} yr{m / 12 !== 1 ? 's' : ''})</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Loan Purpose <span style={{ color: '#e74c3c' }}>*</span></label>
                <select style={input} value={form.loan_purpose || ''} onChange={(e) => set('loan_purpose', e.target.value)}>
                  <option value="">Select purpose...</option>
                  {LOAN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Additional Notes</label>
                <textarea
                  style={{ ...input, minHeight: '80px', resize: 'vertical' }}
                  value={form.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Any additional information relevant to your application"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button style={btn('secondary')} onClick={() => setStep('employment')}>← Back</button>
              <button
                style={{ ...btn('primary'), opacity: processing ? 0.7 : 1 }}
                onClick={submitApplication}
                disabled={processing}
              >
                {processing ? 'Submitting...' : 'Submit Application →'}
              </button>
            </div>
          </div>
        )}

        {/* ---- Step: Documents ---- */}
        {step === 'documents' && (
          <div>
            <h2 style={{ fontSize: '18px', marginTop: 0 }}>Upload Documents</h2>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              Application ID: <strong>{submittedApp?.id}</strong>. Please upload the required documents to proceed.
            </p>
            {DOC_TYPES.map((dt) => (
              <DocumentUpload
                key={dt.key}
                label={dt.label}
                required={dt.required}
                onFilesSelected={(f) => setFiles((prev) => ({ ...prev, [dt.key]: f }))}
                uploadedCount={files[dt.key]?.length || 0}
                disabled={uploading || processing}
              />
            ))}
            {error && (
              <div style={{ background: '#f8d7da', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#721c24' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                style={{ ...btn('primary'), opacity: uploading || processing ? 0.7 : 1 }}
                onClick={uploadAndProcess}
                disabled={uploading || processing}
              >
                {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Submit Documents & Process →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
