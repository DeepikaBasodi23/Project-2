import React, { useEffect, useState, useCallback } from 'react';
import { applicationsApi, Application, PaginatedApplications } from '../api/applications';
import ScoreBar from '../components/ScoreBar';
import StatusBadge from '../components/StatusBadge';

/* ── Types ─────────────────────────────────────────────────────── */
interface FullRecord {
  application: Application;
  documents: Array<{ id: string; document_type: string; original_filename: string; uploaded_at: string }>;
  validationResult?: {
    validation_passed: boolean;
    is_complete: boolean;
    missing_documents: string[];
    inconsistencies: Array<{ field: string; severity: string; value1: string; value2: string; document1: string; document2: string }>;
    notes?: string;
  };
  policyScore?: {
    overall_score: number;
    dti_score: number;
    dti_ratio: number;
    credit_history_score: number;
    income_stability_score: number;
    employment_stability_score: number;
    score_breakdown: { details: Record<string, string>; weights: Record<string, number> };
  };
  recommendation?: {
    recommendation: string;
    explanation: string;
    policy_citations: Array<{ ruleId: string; clause: string; description: string; outcome: string }>;
    confidence_level: string;
    created_at: string;
  };
  fairnessCheck?: {
    passed: boolean;
    original_recommendation: string;
    anonymized_recommendation: string;
    original_score: number;
    anonymized_score: number;
    flag_reason?: string;
    stripped_fields: string[];
  };
  humanDecisions: Array<{ decision: string; underwriter_name: string; comments?: string; decided_at: string }>;
  policyVersion?: { version: string; description: string };
}

/* ── Shared style helpers ──────────────────────────────────────── */
const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  marginBottom: '14px',
  border: '1px solid #e2e8f0',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
  transition: 'all 0.18s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const decisionBtn = (variant: 'approve' | 'decline' | 'refer' | 'neutral', active: boolean): React.CSSProperties => {
  const map = {
    approve: { active: 'linear-gradient(135deg,#10b981,#34d399)', border: '#6ee7b7', text: '#fff', bg: '#ecfdf5', bc: '#a7f3d0' },
    decline: { active: 'linear-gradient(135deg,#ef4444,#f87171)', border: '#fca5a5', text: '#fff', bg: '#fef2f2', bc: '#fecaca' },
    refer:   { active: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: '#fde68a', text: '#fff', bg: '#fffbeb', bc: '#fde68a' },
    neutral: { active: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: '#a5b4fc', text: '#fff', bg: '#eef2ff', bc: '#c7d2fe' },
  };
  const c = map[variant];
  return {
    flex: 1, padding: '10px 8px',
    border: `2px solid ${active ? c.border : 'var(--gray-200)'}`,
    borderRadius: 'var(--radius)',
    background: active ? c.active : c.bg,
    color: active ? c.text : 'var(--gray-600)',
    cursor: 'pointer', fontWeight: 600, fontSize: '12px',
    transition: 'var(--transition)',
    boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };
};


/* ── Component ─────────────────────────────────────────────────── */
export default function UnderwriterDashboard() {
  const [apps, setApps]               = useState<Application[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [record, setRecord]           = useState<FullRecord | null>(null);
  const [loading, setLoading]         = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [decision, setDecision]       = useState<'APPROVED' | 'DECLINED' | 'REQUEST_MORE_DOCS' | ''>('');
  const [comments, setComments]       = useState('');
  const [underwriterId, setUnderwriterId]     = useState('UW-001');
  const [underwriterName, setUnderwriterName] = useState('Senior Underwriter');
  const [submitting, setSubmitting]   = useState(false);
  const [decisionMsg, setDecisionMsg] = useState<string | null>(null);
  const [processing, setProcessing]   = useState(false);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await applicationsApi.list({ page, pageSize: 15, status: statusFilter || undefined, search: search || undefined });
      const data = res.data as PaginatedApplications;
      setApps(data.data);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const selectApp = async (id: string) => {
    setSelectedId(id); setRecord(null);
    setDecision(''); setComments(''); setDecisionMsg(null);
    setLoadingRecord(true);
    try {
      const res = await applicationsApi.getById(id);
      setRecord(res.data as unknown as FullRecord);
    } catch { /* ignore */ }
    finally { setLoadingRecord(false); }
  };

  const processApp = async (id: string) => {
    setProcessing(true);
    try { await applicationsApi.process(id); await selectApp(id); fetchApps(); }
    catch { /* ignore */ }
    finally { setProcessing(false); }
  };

  const submitDecision = async () => {
    if (!selectedId || !decision) return;
    setSubmitting(true); setDecisionMsg(null);
    try {
      const res = await applicationsApi.submitDecision(selectedId, {
        underwriter_id: underwriterId, underwriter_name: underwriterName, decision, comments,
      });
      setDecisionMsg(`Decision recorded: ${res.data.applicationStatus}`);
      fetchApps(); await selectApp(selectedId);
    } catch (e: unknown) {
      setDecisionMsg(`Error: ${(e as Error).message}`);
    } finally { setSubmitting(false); }
  };

  const recColor = (r: string) =>
    r === 'APPROVE' ? '#10b981' : r === 'REFER' ? '#f59e0b' : '#ef4444';

  /* ── LEFT PANEL ───────────────────────────────────────────────── */
  const LeftPanel = () => (
    <div style={{
      width: '320px', minWidth: '320px',
      borderRight: '1px solid var(--gray-200)',
      overflow: 'auto', background: 'var(--gray-50)',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-900)' }}>Applications</h2>
        <span style={{
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: '#fff', fontSize: '11px', fontWeight: 700,
          padding: '2px 8px', borderRadius: '20px',
        }}>{total}</span>
      </div>

      {/* Search */}
      <input
        placeholder="🔍 Search name or email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        style={inputStyle}
      />

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        style={inputStyle}
      >
        <option value="">All Statuses</option>
        {['SUBMITTED','PROCESSING','AWAITING_DECISION','DOCUMENTS_PENDING','APPROVED','DECLINED'].map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px', fontSize: '13px' }}>Loading...</div>
      ) : (
        <>
          {apps.map((app) => {
            const active = selectedId === app.id;
            return (
              <div
                key={app.id}
                onClick={() => selectApp(app.id)}
                style={{
                  background: active
                    ? 'linear-gradient(135deg,#1e1b4b,#312e81)'
                    : '#fff',
                  color: active ? '#fff' : 'var(--gray-800)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  border: active ? '1px solid #6366f1' : '1px solid var(--gray-200)',
                  boxShadow: active ? '0 4px 14px rgba(99,102,241,0.25)' : 'var(--shadow-sm)',
                  transition: 'var(--transition)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>
                  {app.applicant_name}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>
                  ${Number(app.loan_amount).toLocaleString()} — {app.loan_purpose}
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <StatusBadge status={app.status} size="sm" />
                  {app.recommendation && <StatusBadge status={app.recommendation} size="sm" />}
                  {app.fairness_passed === false && <StatusBadge status="FLAGGED" size="sm" />}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          <div style={{ fontSize: '12px', color: 'var(--gray-400)', textAlign: 'center' }}>
            Page {page} of {Math.ceil(total / 15)}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              style={{ flex: 1, padding: '7px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', background: '#fff' }}>
              ← Prev
            </button>
            <button disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)}
              style={{ flex: 1, padding: '7px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', background: '#fff' }}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );


  /* ── RIGHT PANEL ──────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <LeftPanel />

      {/* Right */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: 'var(--bg)' }}>

        {/* Empty state */}
        {!selectedId && (
          <div style={{ textAlign: 'center', color: 'var(--gray-400)', marginTop: '100px' }} className="fade-in">
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontSize: '15px', fontWeight: 500 }}>Select an application to review</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Choose from the list on the left</p>
          </div>
        )}

        {selectedId && loadingRecord && (
          <div style={{ textAlign: 'center', color: 'var(--gray-400)', marginTop: '100px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <p>Loading application details...</p>
          </div>
        )}

        {record && (
          <div className="fade-in">

            {/* ── Header card ── */}
            <div style={{ ...card, background: 'linear-gradient(135deg,#1e1b4b,#312e81)', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>
                    {record.application.applicant_name}
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#a5b4fc' }}>
                    {record.application.applicant_email}
                    {record.application.applicant_phone && ` • ${record.application.applicant_phone}`}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6366f1' }}>
                    ID: {record.application.id}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <StatusBadge status={record.application.status} />
                  {record.policyVersion && (
                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', color: '#c7d2fe', padding: '3px 8px', borderRadius: '6px' }}>
                      Policy {record.policyVersion.version}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Process button ── */}
            {['SUBMITTED','DOCUMENTS_PENDING'].includes(record.application.status) && !record.recommendation && (
              <div style={{ ...card, background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>⚡ Ready to Process</p>
                    <p style={{ fontSize: '13px', color: '#b45309', margin: 0 }}>Run the AI pipeline to generate a recommendation.</p>
                  </div>
                  <button
                    onClick={() => processApp(record.application.id)}
                    disabled={processing}
                    style={{
                      padding: '10px 20px', border: 'none', borderRadius: 'var(--radius)',
                      background: processing ? 'var(--gray-300)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color: '#fff', fontWeight: 600, fontSize: '13px', cursor: processing ? 'not-allowed' : 'pointer',
                      boxShadow: processing ? 'none' : '0 4px 12px rgba(99,102,241,0.35)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {processing ? '⏳ Processing...' : '▶ Run AI Pipeline'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Loan details ── */}
            <div style={{ ...card, background: '#fff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                💳 Loan Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', fontSize: '13px' }}>
                {[
                  ['Loan Amount', `$${Number(record.application.loan_amount).toLocaleString()}`],
                  ['Purpose', record.application.loan_purpose],
                  ['Term', `${record.application.loan_term_months} months`],
                  ['Annual Income', record.application.annual_income ? `$${Number(record.application.annual_income).toLocaleString()}` : 'N/A'],
                  ['Monthly Debt', record.application.monthly_debt_payments ? `$${Number(record.application.monthly_debt_payments).toLocaleString()}` : '$0'],
                  ['Credit Score', record.application.credit_score || 'N/A'],
                  ['Employment', record.application.employment_status || 'N/A'],
                  ['Employer', record.application.employer_name || 'N/A'],
                  ['Years Employed', record.application.years_employed || 'N/A'],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{k}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Documents ── */}
            <div style={{ ...card, background: '#fff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📁 Documents ({record.documents.length})
              </h3>
              {record.documents.length === 0 ? (
                <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>No documents uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {record.documents.map((doc) => (
                    <div key={doc.id} style={{
                      background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                      border: '1px solid #93c5fd',
                      borderRadius: 'var(--radius)',
                      padding: '8px 14px', fontSize: '12px',
                    }}>
                      <div style={{ fontWeight: 700, color: '#1e40af' }}>{doc.document_type}</div>
                      <div style={{ color: '#3b82f6', marginTop: '2px' }}>{doc.original_filename}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Validation ── */}
            {record.validationResult && (
              <div style={{ ...card, border: `1px solid ${record.validationResult.validation_passed ? '#6ee7b7' : '#fca5a5'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔎 Document Validation
                  </h3>
                  <StatusBadge status={record.validationResult.validation_passed ? 'PASSED' : 'FLAGGED'} />
                </div>
                {record.validationResult.missing_documents.length > 0 && (
                  <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fbbf24', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '8px', fontSize: '13px', color: '#92400e' }}>
                    <strong>Missing:</strong> {record.validationResult.missing_documents.join(', ')}
                  </div>
                )}
                {record.validationResult.inconsistencies.length > 0 && record.validationResult.inconsistencies.map((inc, i) => (
                  <div key={i} style={{
                    background: inc.severity === 'HIGH' ? 'linear-gradient(135deg,#fee2e2,#fecaca)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                    borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: '6px', fontSize: '12px',
                    color: inc.severity === 'HIGH' ? '#7f1d1d' : '#78350f',
                  }}>
                    <strong>[{inc.severity}]</strong> {inc.field}: "{inc.value1}" vs "{inc.value2}"
                  </div>
                ))}
                {record.validationResult.notes && (
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '8px' }}>{record.validationResult.notes}</div>
                )}
              </div>
            )}

            {/* ── Scores ── */}
            {record.policyScore && (
              <div style={{ ...card, background: '#fff', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📊 Policy Scores
                </h3>
                <ScoreBar score={record.policyScore.overall_score} label="Overall Weighted Score" />
                <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '12px', marginTop: '4px' }}>
                  <ScoreBar score={record.policyScore.dti_score}                label={`DTI Score (ratio: ${(record.policyScore.dti_ratio * 100).toFixed(1)}%) — 35%`} />
                  <ScoreBar score={record.policyScore.credit_history_score}     label="Credit History Score — 30%" />
                  <ScoreBar score={record.policyScore.income_stability_score}   label="Income Stability Score — 20%" />
                  <ScoreBar score={record.policyScore.employment_stability_score} label="Employment Stability Score — 15%" />
                </div>
              </div>
            )}

            {/* ── AI Recommendation ── */}
            {record.recommendation && (
              <div style={{ ...card, border: `2px solid ${recColor(record.recommendation.recommendation)}`, background: 'linear-gradient(135deg,#fafafa,#fff)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🤖 AI Recommendation
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Confidence: {record.recommendation.confidence_level}</span>
                    <StatusBadge status={record.recommendation.recommendation} />
                  </div>
                </div>
                {/* Disclaimer */}
                <div style={{
                  background: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                  border: '1px solid #fbbf24', borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#92400e',
                }}>
                  ⚠ <strong>AI Recommendation Only.</strong> A licensed human underwriter must make the final decision.
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--gray-700)', background: 'var(--gray-50)', padding: '12px', borderRadius: 'var(--radius-sm)', margin: '0 0 14px', lineHeight: 1.6 }}>
                  {record.recommendation.explanation}
                </pre>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {record.recommendation.policy_citations.map((c) => (
                    <span key={c.ruleId} style={{
                      background: c.outcome === 'PASS' ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : c.outcome === 'FAIL' ? 'linear-gradient(135deg,#fee2e2,#fecaca)' : 'linear-gradient(135deg,#fef3c7,#fde68a)',
                      color: c.outcome === 'PASS' ? '#065f46' : c.outcome === 'FAIL' ? '#7f1d1d' : '#78350f',
                      padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                    }}>
                      [{c.clause}] {c.ruleId} — {c.outcome}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Fairness ── */}
            {record.fairnessCheck && (
              <div style={{ ...card, border: `1px solid ${record.fairnessCheck.passed ? '#6ee7b7' : '#fca5a5'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚖ Fairness Check
                  </h3>
                  <StatusBadge status={record.fairnessCheck.passed ? 'PASSED' : 'FLAGGED'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', fontSize: '12px' }}>
                  {[
                    ['Original Rec.', <StatusBadge key="or" status={record.fairnessCheck.original_recommendation} size="sm" />],
                    ['Anonymized Rec.', <StatusBadge key="ar" status={record.fairnessCheck.anonymized_recommendation} size="sm" />],
                    ['Original Score', <strong key="os">{record.fairnessCheck.original_score?.toFixed(1)}</strong>],
                    ['Anon. Score', <strong key="as">{record.fairnessCheck.anonymized_score?.toFixed(1)}</strong>],
                  ].map(([label, val]) => (
                    <div key={String(label)} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                      <div style={{ color: 'var(--gray-400)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
                      {val}
                    </div>
                  ))}
                </div>
                {!record.fairnessCheck.passed && record.fairnessCheck.flag_reason && (
                  <div style={{ background: 'linear-gradient(135deg,#fee2e2,#fecaca)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginTop: '10px', fontSize: '12px', color: '#7f1d1d' }}>
                    <strong>⚠ Fairness Flag:</strong> {record.fairnessCheck.flag_reason}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '8px' }}>
                  Stripped fields: {record.fairnessCheck.stripped_fields?.join(', ')}
                </div>
              </div>
            )}

            {/* ── Previous decisions ── */}
            {record.humanDecisions.length > 0 && (
              <div style={card}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📝 Previous Decisions
                </h3>
                {record.humanDecisions.map((d, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #6366f1', paddingLeft: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <StatusBadge status={d.decision} size="sm" />
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{d.underwriter_name} — {new Date(d.decided_at).toLocaleString()}</span>
                    </div>
                    {d.comments && <p style={{ margin: 0, fontSize: '13px', color: 'var(--gray-600)' }}>{d.comments}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* ── Decision panel ── */}
            {record.application.status === 'AWAITING_DECISION' && (
              <div style={{ ...card, border: '2px solid #6366f1', background: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#4338ca', marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ✍ Underwriter Decision
                </h3>

                {/* Underwriter info */}
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Underwriter ID</label>
                    <input
                      value={underwriterId}
                      onChange={(e) => setUnderwriterId(e.target.value)}
                      style={{ ...inputStyle, background: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Underwriter Name</label>
                    <input
                      value={underwriterName}
                      onChange={(e) => setUnderwriterName(e.target.value)}
                      style={{ ...inputStyle, background: '#fff' }}
                    />
                  </div>
                </div>

                {/* Decision buttons */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '8px' }}>Decision</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setDecision('APPROVED')} style={decisionBtn('approve', decision === 'APPROVED')}>✓ Approve</button>
                    <button onClick={() => setDecision('DECLINED')} style={decisionBtn('decline', decision === 'DECLINED')}>✕ Decline</button>
                    <button onClick={() => setDecision('REQUEST_MORE_DOCS')} style={decisionBtn('neutral', decision === 'REQUEST_MORE_DOCS')}>📋 More Docs</button>
                  </div>
                </div>

                {/* Comments */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '5px' }}>Comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add your decision rationale..."
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  />
                </div>

                {/* Feedback */}
                {decisionMsg && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '13px',
                    background: decisionMsg.startsWith('Error') ? 'linear-gradient(135deg,#fee2e2,#fecaca)' : 'linear-gradient(135deg,#d1fae5,#a7f3d0)',
                    color: decisionMsg.startsWith('Error') ? '#7f1d1d' : '#065f46',
                  }}>
                    {decisionMsg}
                  </div>
                )}

                <button
                  onClick={submitDecision}
                  disabled={submitting || !decision}
                  style={{
                    padding: '12px 28px', border: 'none', borderRadius: 'var(--radius)',
                    background: submitting || !decision ? 'var(--gray-300)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', fontWeight: 700, fontSize: '14px',
                    cursor: submitting || !decision ? 'not-allowed' : 'pointer',
                    boxShadow: submitting || !decision ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                    transition: 'var(--transition)',
                  }}
                >
                  {submitting ? '⏳ Submitting...' : 'Submit Final Decision'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
