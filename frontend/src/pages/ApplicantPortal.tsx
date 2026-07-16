import React, { useState } from 'react';
import { applicationsApi, ApplicationFormData } from '../api/applications';
import DocumentUpload from '../components/DocumentUpload';
import StatusBadge from '../components/StatusBadge';

type Step = 'personal' | 'employment' | 'loan' | 'documents' | 'submitted';

const STEPS: Step[]  = ['personal', 'employment', 'loan', 'documents', 'submitted'];
const STEP_LABELS    = ['Personal Info', 'Employment & Income', 'Loan Details', 'Documents'];
const STEP_ICONS     = ['👤', '💼', '💰', '📄'];
const STEP_COLORS    = [
  { from: '#06b6d4', to: '#0891b2' },   // cyan
  { from: '#8b5cf6', to: '#7c3aed' },   // violet
  { from: '#f59e0b', to: '#d97706' },   // amber
  { from: '#10b981', to: '#059669' },   // emerald
];

const DOC_TYPES = [
  { key: 'GOVERNMENT_ID',  label: 'Government-Issued ID',                   required: true  },
  { key: 'INCOME_PROOF',   label: 'Income Proof (W-2, pay stubs, tax return)', required: true  },
  { key: 'BANK_STATEMENT', label: 'Bank Statements (last 3 months)',         required: true  },
  { key: 'CREDIT_REPORT',  label: 'Credit Report',                           required: false },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'FULL_TIME',     label: 'Full-time'    },
  { value: 'PART_TIME',    label: 'Part-time'    },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'CONTRACT',     label: 'Contract'     },
  { value: 'UNEMPLOYED',   label: 'Unemployed'   },
];

const LOAN_PURPOSES = [
  'Home Improvement','Debt Consolidation','Auto Loan','Business Investment',
  'Education','Medical Expenses','Personal Loan','Other',
];

/* ── Step color config ─────────────────────────────────────────── */
const stepConfig: Record<string, { bg: string; accent: string; light: string; border: string }> = {
  personal:   { bg: 'linear-gradient(135deg,#ecfeff 0%,#cffafe 100%)', accent: '#0891b2', light: '#e0f7fa', border: '#a5f3fc' },
  employment: { bg: 'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)', accent: '#7c3aed', light: '#ede9fe', border: '#c4b5fd' },
  loan:       { bg: 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)', accent: '#d97706', light: '#fef3c7', border: '#fde68a' },
  documents:  { bg: 'linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)', accent: '#059669', light: '#d1fae5', border: '#6ee7b7' },
};

/* ── Shared helpers ────────────────────────────────────────────── */
function getInput(accent: string): React.CSSProperties {
  return {
    width: '100%', padding: '11px 14px',
    border: `1.5px solid #e2e8f0`,
    borderRadius: '8px', fontSize: '14px',
    color: '#1e293b', background: '#fff',
    outline: 'none', transition: 'all 0.18s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '12px 28px', borderRadius: '8px', border: 'none',
        fontWeight: 700, fontSize: '14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled
          ? '#cbd5e1'
          : hover
          ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
          : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        color: '#fff',
        boxShadow: disabled ? 'none' : hover
          ? '0 6px 20px rgba(99,102,241,0.5)'
          : '0 4px 14px rgba(99,102,241,0.35)',
        transition: 'all 0.18s', opacity: disabled ? 0.65 : 1,
      }}
    >{children}</button>
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

/* ── Field wrapper ─────────────────────────────────────────────── */
function Field({ label, required, children, span }: { label: string; required?: boolean; children: React.ReactNode; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Section header ────────────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle, color }: { icon: string; title: string; subtitle?: string; color: string }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: `linear-gradient(135deg,${color}cc,${color})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', boxShadow: `0 4px 14px ${color}55`,
        }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{title}</h2>
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
  const [step, setStep]             = useState<Step>('personal');
  const [form, setForm]             = useState<Partial<ApplicationFormData>>({ loan_term_months: 60, monthly_debt_payments: 0 });
  const [files, setFiles]           = useState<Record<string, File[]>>({});
  const [submittedApp, setSubmittedApp] = useState<{ id: string; status: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{
    status: string; message: string;
    missingDocuments?: string[];
    recommendation?: { recommendation: string; explanation: string };
  } | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = (field: keyof ApplicationFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const cfg = stepConfig[step] || stepConfig.personal;

  /* handlers */
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
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '36px' }}>
        {STEP_LABELS.map((lbl, i) => {
          const si = i + 1;
          const done   = si < activeIdx;
          const active = si === activeIdx;
          const c = STEP_COLORS[i];
          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: done ? '18px' : '20px', fontWeight: 800,
                  background: done
                    ? `linear-gradient(135deg,${c.from},${c.to})`
                    : active
                    ? `linear-gradient(135deg,${c.from},${c.to})`
                    : '#f1f5f9',
                  color: done || active ? '#fff' : '#94a3b8',
                  border: active ? `3px solid ${c.from}88` : 'none',
                  boxShadow: active ? `0 0 0 5px ${c.from}22, 0 4px 12px ${c.from}44` : done ? `0 4px 10px ${c.from}44` : 'none',
                  transition: 'all 0.3s',
                }}>
                  {done ? '✓' : STEP_ICONS[i]}
                </div>
                <div style={{
                  fontSize: '11px', fontWeight: active ? 700 : 400, marginTop: '7px',
                  color: active ? c.from : done ? c.from : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}>{lbl}</div>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{
                  flex: 1, height: '3px', marginTop: '-20px',
                  background: si < activeIdx
                    ? `linear-gradient(90deg,${STEP_COLORS[i].from},${STEP_COLORS[i+1].from})`
                    : '#e2e8f0',
                  borderRadius: '2px', transition: 'background 0.4s',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /* ── Submitted screen ── */
  if (step === 'submitted') {
    const rec = processingResult?.recommendation as { recommendation?: unknown } | undefined;
    const recommendationValue = typeof rec?.recommendation === 'string' ? rec.recommendation : '';
    const missing = processingResult?.missingDocuments;
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5,#d1fae5)', padding: '48px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '48px', maxWidth: '560px', width: '100%', boxShadow: '0 20px 60px rgba(16,185,129,0.15)', border: '1px solid #a7f3d0', textAlign: 'center' }} className="fade-in">
          <div style={{ width: '88px', height: '88px', borderRadius: '50%', margin: '0 auto 24px', background: missing?.length ? 'linear-gradient(135deg,#fef3c7,#fde68a)' : 'linear-gradient(135deg,#10b981,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', boxShadow: missing?.length ? '0 0 0 10px #fef9c3' : '0 0 0 10px #d1fae5' }}>
            {missing?.length ? '⚠️' : '🎉'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            {missing?.length ? 'Documents Needed' : 'Application Submitted!'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            ID: <code style={{ background: '#f1f5f9', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, color: '#6366f1', fontSize: '13px' }}>{submittedApp?.id}</code>
          </p>
          {missing?.length ? (
            <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fbbf24', borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ fontWeight: 700, color: '#92400e', marginBottom: '10px' }}>⚠ Please upload these missing documents:</p>
              {missing.map((d) => <div key={d} style={{ fontSize: '14px', color: '#78350f', padding: '4px 0' }}>• {d}</div>)}
            </div>
          ) : rec?.recommendation ? (
            <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#065f46' }}>AI Recommendation:</span>
                <StatusBadge status={recommendationValue} size="lg" />
              </div>
              <p style={{ color: '#047857', fontSize: '13px', margin: 0 }}>Awaiting final review by a licensed underwriter.</p>
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <p style={{ color: '#065f46', fontWeight: 600, margin: 0 }}>✓ Application received and being processed.</p>
            </div>
          )}
          <button onClick={() => { setStep('personal'); setForm({ loan_term_months: 60, monthly_debt_payments: 0 }); setFiles({}); setSubmittedApp(null); setProcessingResult(null); }}
            style={{ padding: '13px 32px', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}>
            ＋ Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  const inp = getInput(cfg.accent);

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: cfg.bg, padding: '40px 16px', transition: 'background 0.4s' }}>
      {/* Page-level hero strip */}
      <div style={{ maxWidth: '720px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Loan Application
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Complete all steps to submit your application for review.
          </p>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '20px', padding: '36px', maxWidth: '720px', margin: '0 auto', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: `1px solid ${cfg.border}` }} className="fade-in">
        <Stepper />

        {/* Error */}
        {error && (
          <div style={{ background: 'linear-gradient(135deg,#fee2e2,#fecaca)', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#7f1d1d', display: 'flex', gap: '8px' }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Personal ── */}
        {step === 'personal' && (
          <div className="fade-in">
            <SectionHeader icon="👤" title="Personal Information" subtitle="As it appears on your government-issued ID" color="#06b6d4" />
            <div style={{ background: 'linear-gradient(135deg,#ecfeff,#e0f2fe)', border: '1px solid #a5f3fc', borderRadius: '14px', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Full Name" required span><input style={inp} value={form.applicant_name || ''} onChange={(e) => set('applicant_name', e.target.value)} placeholder="As it appears on your ID" /></Field>
              <Field label="Email" required><input style={inp} type="email" value={form.applicant_email || ''} onChange={(e) => set('applicant_email', e.target.value)} placeholder="you@example.com" /></Field>
              <Field label="Phone"><input style={inp} value={form.applicant_phone || ''} onChange={(e) => set('applicant_phone', e.target.value)} placeholder="555-000-0000" /></Field>
              <Field label="Date of Birth"><input style={inp} type="date" value={form.date_of_birth || ''} onChange={(e) => set('date_of_birth', e.target.value)} /></Field>
              <Field label="Street Address" span><input style={inp} value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="123 Main Street" /></Field>
              <Field label="City"><input style={inp} value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
              <Field label="State"><input style={inp} value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="IL" /></Field>
              <Field label="ZIP Code"><input style={inp} value={form.zip_code || ''} onChange={(e) => set('zip_code', e.target.value)} /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <PrimaryBtn onClick={() => setStep('employment')}>Next →</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Employment ── */}
        {step === 'employment' && (
          <div className="fade-in">
            <SectionHeader icon="💼" title="Employment & Income" subtitle="Help us understand your financial situation" color="#8b5cf6" />
            <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #c4b5fd', borderRadius: '14px', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <SecondaryBtn onClick={() => setStep('personal')}>← Back</SecondaryBtn>
              <PrimaryBtn onClick={() => setStep('loan')}>Next →</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Loan ── */}
        {step === 'loan' && (
          <div className="fade-in">
            <SectionHeader icon="💰" title="Loan Details" subtitle="Tell us about your loan request" color="#f59e0b" />
            <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fde68a', borderRadius: '14px', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <SecondaryBtn onClick={() => setStep('employment')}>← Back</SecondaryBtn>
              <PrimaryBtn onClick={submitApplication} disabled={processing}>{processing ? '⏳ Submitting...' : 'Submit Application →'}</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {step === 'documents' && (
          <div className="fade-in">
            <SectionHeader icon="📄" title="Upload Documents" subtitle={`Application ${submittedApp?.id}`} color="#10b981" />
            <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7', borderRadius: '14px', padding: '20px', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#065f46', fontWeight: 500, marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                ℹ Upload all required documents, then click Process.
              </div>
              {DOC_TYPES.map((dt) => (
                <DocumentUpload key={dt.key} label={dt.label} required={dt.required}
                  onFilesSelected={(f) => setFiles((prev) => ({ ...prev, [dt.key]: f }))}
                  uploadedCount={files[dt.key]?.length || 0} disabled={uploading || processing} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
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
