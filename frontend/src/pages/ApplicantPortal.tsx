import React, { useState } from 'react';
import { applicationsApi, ApplicationFormData } from '../api/applications';
import DocumentUpload from '../components/DocumentUpload';
import StatusBadge from '../components/StatusBadge';

type Step = 'personal' | 'employment' | 'loan' | 'documents' | 'submitted';

const STEPS: Step[]  = ['personal', 'employment', 'loan', 'documents', 'submitted'];
const STEP_LABELS    = ['Personal Info', 'Employment & Income', 'Loan Details', 'Documents'];
const STEP_ICONS     = ['👤', '💼', '💰', '📄'];

const DOC_TYPES = [
  { key: 'GOVERNMENT_ID',  label: 'Government-Issued ID',                      required: true  },
  { key: 'INCOME_PROOF',   label: 'Income Proof (W-2, pay stubs, tax return)', required: true  },
  { key: 'BANK_STATEMENT', label: 'Bank Statements (last 3 months)',            required: true  },
  { key: 'CREDIT_REPORT',  label: 'Credit Report',                             required: false },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'FULL_TIME',     label: 'Full-time'     },
  { value: 'PART_TIME',    label: 'Part-time'     },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'CONTRACT',     label: 'Contract'      },
  { value: 'UNEMPLOYED',   label: 'Unemployed'    },
];

const LOAN_PURPOSES = [
  'Home Improvement','Debt Consolidation','Auto Loan','Business Investment',
  'Education','Medical Expenses','Personal Loan','Other',
];

/* ── Shared input style ─────────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px', fontSize: '14px',
  color: '#1e293b', background: '#fff',
  outline: 'none', transition: 'all 0.18s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

/* ── Section panel — clean light grey ──────────────────────────── */
const sectionPanel: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '24px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};

/* ── Buttons ────────────────────────────────────────────────────── */
function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '12px 28px', borderRadius: '8px', border: 'none',
      fontWeight: 700, fontSize: '14px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? '#cbd5e1' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      color: '#fff',
      boxShadow: disabled ? 'none' : '0 4px 14px rgba(99,102,241,0.3)',
      transition: 'all 0.18s', opacity: disabled ? 0.65 : 1,
    }}>{children}</button>
  );
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '12px 24px', borderRadius: '8px',
      border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: '14px',
      cursor: 'pointer', background: '#fff', color: '#64748b',
      transition: 'all 0.18s',
    }}>{children}</button>
  );
}

/* ── Field wrapper ──────────────────────────────────────────────── */
function Field({ label, required, children, span }: { label: string; required?: boolean; children: React.ReactNode; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: '#f1f5f9', border: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
        }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function ApplicantPortal() {
  const [step, setStep]   = useState<Step>('personal');
  const [form, setForm]   = useState<Partial<ApplicationFormData>>({ loan_term_months: 60, monthly_debt_payments: 0 });
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [submittedApp, setSubmittedApp]     = useState<{ id: string; status: string } | null>(null);
  const [processing, setProcessing]         = useState(false);
  const [processingResult, setProcessingResult] = useState<{
    status: string; message: string;
    missingDocuments?: string[];
    recommendation?: { recommendation: string; explanation: string };
  } | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = (field: keyof ApplicationFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submitApplication = async () => {
    setError(null);
    if (!form.applicant_name || !form.applicant_email || !form.loan_amount || !form.loan_purpose) {
      setError('Please fill in all required fields.'); return;
    }
    try {
      setProcessing(true);
      const res = await applicationsApi.create(form as ApplicationFormData);
      setSubmittedApp({ id: res.data.application.id, status: res.data.application.status });
      setStep('documents');
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setProcessing(false); }
  };

  const uploadAndProcess = async () => {
    if (!submittedApp) return;
    setError(null); setUploading(true);
    try {
      for (const [docType, fileList] of Object.entries(files)) {
        if (fileList.length > 0) await applicationsApi.uploadDocuments(submittedApp.id, fileList, docType);
      }
      setUploading(false); setProcessing(true);
      const res = await applicationsApi.process(submittedApp.id);
      setProcessingResult(res.data as typeof processingResult);
      setStep('submitted');
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setUploading(false); setProcessing(false); }
  };

  /* ── Stepper ── */
  const Stepper = () => {
    const activeIdx = STEPS.indexOf(step);
    const colors = ['#6366f1','#8b5cf6','#f59e0b','#10b981'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        {STEP_LABELS.map((lbl, i) => {
          const si     = i + 1;
          const done   = si < activeIdx;
          const active = si === activeIdx;
          const c      = colors[i];
          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: done ? '16px' : '18px', fontWeight: 800,
                  background: done || active ? c : '#f1f5f9',
                  color: done || active ? '#fff' : '#94a3b8',
                  boxShadow: active ? `0 0 0 4px ${c}22` : 'none',
                  transition: 'all 0.3s',
                }}>
                  {done ? '✓' : STEP_ICONS[i]}
                </div>
                <div style={{ fontSize: '11px', fontWeight: active ? 700 : 400, marginTop: '6px', color: active ? c : done ? c : '#94a3b8', whiteSpace: 'nowrap' }}>
                  {lbl}
                </div>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{ flex: 1, height: '2px', marginTop: '-18px', background: si < activeIdx ? c : '#e2e8f0', borderRadius: '2px', transition: 'background 0.4s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /* ── Submitted screen ── */
  if (step === 'submitted') {
    const rec     = processingResult?.recommendation as { recommendation?: string } | undefined;
    const missing = processingResult?.missingDocuments;
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', background: '#f8fafc', padding: '48px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '48px', maxWidth: '520px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', textAlign: 'center' }} className="fade-in">
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 20px', background: missing?.length ? '#fff3cd' : '#ecfdf5', border: `2px solid ${missing?.length ? '#fbbf24' : '#6ee7b7'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
            {missing?.length ? '⚠️' : '🎉'}
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            {missing?.length ? 'Documents Needed' : 'Application Submitted!'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            ID: <code style={{ background: '#f1f5f9', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, color: '#6366f1', fontSize: '13px' }}>{submittedApp?.id}</code>
          </p>
          {missing?.length ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '10px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>⚠ Please upload these missing documents:</p>
              {missing.map((d) => <div key={d} style={{ fontSize: '14px', color: '#78350f', padding: '3px 0' }}>• {d}</div>)}
            </div>
          ) : rec?.recommendation ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#166534' }}>AI Recommendation:</span>
                <StatusBadge status={rec.recommendation || ''} size="lg" />
              </div>
              <p style={{ color: '#15803d', fontSize: '13px', margin: 0 }}>Awaiting final review by a licensed underwriter.</p>
            </div>
          ) : (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ color: '#166534', fontWeight: 600, margin: 0 }}>✓ Application received and being processed.</p>
            </div>
          )}
          <button onClick={() => { setStep('personal'); setForm({ loan_term_months: 60, monthly_debt_payments: 0 }); setFiles({}); setSubmittedApp(null); setProcessingResult(null); }}
            style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            ＋ Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: '#f8fafc', padding: '40px 16px' }}>
      {/* Hero */}
      <div style={{ maxWidth: '720px', margin: '0 auto 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Loan Application</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Complete all steps to submit your application for review.</p>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: '20px', padding: '36px', maxWidth: '720px', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }} className="fade-in">
        <Stepper />

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#7f1d1d' }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Personal ── */}
        {step === 'personal' && (
          <div className="fade-in">
            <SectionHeader icon="👤" title="Personal Information" subtitle="As it appears on your government-issued ID" />
            <div style={sectionPanel}>
              <Field label="Full Name" required span><input style={inp} value={form.applicant_name || ''} onChange={(e) => set('applicant_name', e.target.value)} placeholder="As it appears on your ID" /></Field>
              <Field label="Email" required><input style={inp} type="email" value={form.applicant_email || ''} onChange={(e) => set('applicant_email', e.target.value)} placeholder="you@example.com" /></Field>
              <Field label="Phone"><input style={inp} value={form.applicant_phone || ''} onChange={(e) => set('applicant_phone', e.target.value)} placeholder="555-000-0000" /></Field>
              <Field label="Date of Birth"><input style={inp} type="date" value={form.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} /></Field>
              <Field label="Street Address" span><input style={inp} value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="123 Main Street" /></Field>
              <Field label="City"><input style={inp} value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
              <Field label="State"><input style={inp} value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="IL" /></Field>
              <Field label="ZIP Code"><input style={inp} value={form.zip_code || ''} onChange={(e) => set('zip_code', e.target.value)} /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <PrimaryBtn onClick={() => setStep('employment')}>Next →</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Employment ── */}
        {step === 'employment' && (
          <div className="fade-in">
            <SectionHeader icon="💼" title="Employment & Income" subtitle="Help us understand your financial situation" />
            <div style={sectionPanel}>
              <Field label="Employment Status">
                <select style={inp} value={form.employment_status || ''} onChange={(e) => set('employment_status', e.target.value)}>
                  <option value="">Select...</option>
                  {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Employer Name"><input style={inp} value={form.employer_name || ''} onChange={(e) => set('employer_name', e.target.value)} placeholder="Company name" /></Field>
              <Field label="Annual Income ($)"><input style={inp} type="number" min={0} value={form.annual_income || ''} onChange={(e) => set('annual_income', parseFloat(e.target.value))} placeholder="60,000" /></Field>
              <Field label="Monthly Debt Payments ($)"><input style={inp} type="number" min={0} value={form.monthly_debt_payments || ''} onChange={(e) => set('monthly_debt_payments', parseFloat(e.target.value))} placeholder="500" /></Field>
              <Field label="Years Employed"><input style={inp} type="number" min={0} step={0.5} value={form.years_employed || ''} onChange={(e) => set('years_employed', parseFloat(e.target.value))} placeholder="3.5" /></Field>
              <Field label="Credit Score (optional)"><input style={inp} type="number" min={300} max={850} value={form.credit_score || ''} onChange={(e) => set('credit_score', parseInt(e.target.value))} placeholder="680" /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <SecondaryBtn onClick={() => setStep('personal')}>← Back</SecondaryBtn>
              <PrimaryBtn onClick={() => setStep('loan')}>Next →</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Loan ── */}
        {step === 'loan' && (
          <div className="fade-in">
            <SectionHeader icon="💰" title="Loan Details" subtitle="Tell us about your loan request" />
            <div style={sectionPanel}>
              <Field label="Loan Amount ($)" required><input style={inp} type="number" min={1000} value={form.loan_amount || ''} onChange={(e) => set('loan_amount', parseFloat(e.target.value))} placeholder="25,000" /></Field>
              <Field label="Loan Term" required>
                <select style={inp} value={form.loan_term_months || 60} onChange={(e) => set('loan_term_months', parseInt(e.target.value))}>
                  {[12,24,36,48,60,72,84,120].map((m) => <option key={m} value={m}>{m} months ({(m/12).toFixed(0)} yr{m/12!==1?'s':''})</option>)}
                </select>
              </Field>
              <Field label="Loan Purpose" required span>
                <select style={inp} value={form.loan_purpose || ''} onChange={(e) => set('loan_purpose', e.target.value)}>
                  <option value="">Select purpose...</option>
                  {LOAN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Additional Notes" span>
                <textarea style={{ ...inp, minHeight: '90px', resize: 'vertical' }} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Any additional information..." />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <SecondaryBtn onClick={() => setStep('employment')}>← Back</SecondaryBtn>
              <PrimaryBtn onClick={submitApplication} disabled={processing}>{processing ? '⏳ Submitting...' : 'Submit Application →'}</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {step === 'documents' && (
          <div className="fade-in">
            <SectionHeader icon="📄" title="Upload Documents" subtitle={`Application ${submittedApp?.id}`} />
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '8px' }}>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>ℹ Upload all required documents, then click Process.</p>
              {DOC_TYPES.map((dt) => (
                <DocumentUpload key={dt.key} label={dt.label} required={dt.required}
                  onFilesSelected={(f) => setFiles((prev) => ({ ...prev, [dt.key]: f }))}
                  uploadedCount={files[dt.key]?.length || 0} disabled={uploading || processing} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <PrimaryBtn onClick={uploadAndProcess} disabled={uploading || processing}>
                {uploading ? '⏫ Uploading...' : processing ? '⚙ Processing...' : '🚀 Submit & Process →'}
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
