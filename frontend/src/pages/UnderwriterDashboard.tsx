import React, { useEffect, useState, useCallback } from 'react';
import { applicationsApi, Application, PaginatedApplications } from '../api/applications';
import ScoreBar from '../components/ScoreBar';
import StatusBadge from '../components/StatusBadge';

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
  marginBottom: '16px',
};

const btn = (variant: 'approve' | 'decline' | 'refer' | 'default'): React.CSSProperties => {
  const colors = {
    approve:  { bg: '#27ae60', color: '#fff' },
    decline:  { bg: '#e74c3c', color: '#fff' },
    refer:    { bg: '#f39c12', color: '#fff' },
    default:  { bg: '#6c757d', color: '#fff' },
  };
  const c = colors[variant];
  return { padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', background: c.bg, color: c.color };
};

interface FullRecord {
  application: Application;
  documents: Array<{ id: string; document_type: string; original_filename: string; uploaded_at: string }>;
  validationResult?: {
    validation_passed: boolean;
    is_complete: boolean;
    missing_documents: string[];
    inconsistencies: Array<{ field: string; severity: string; value1: string; value2: string; document1: string; document2: string }>;
    extracted_name?: string;
    extracted_income?: number;
    extracted_employer?: string;
    name_match?: boolean;
    notes?: string;
  };
  policyScore?: {
    overall_score: number;
    dti_score: number;
    dti_ratio: number;
    credit_history_score: number;
    income_stability_score: number;
    employment_stability_score: number;
    score_breakdown: {
      details: Record<string, string>;
      weights: Record<string, number>;
    };
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

export default function UnderwriterDashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [record, setRecord] = useState<FullRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [decision, setDecision] = useState<'APPROVED' | 'DECLINED' | 'REQUEST_MORE_DOCS' | ''>('');
  const [comments, setComments] = useState('');
  const [underwriterId, setUnderwriterId] = useState('UW-001');
  const [underwriterName, setUnderwriterName] = useState('Senior Underwriter');
  const [submitting, setSubmitting] = useState(false);
  const [decisionMsg, setDecisionMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await applicationsApi.list({ page, pageSize: 15, status: statusFilter || undefined, search: search || undefined });
      const data = res.data as PaginatedApplications;
      setApps(data.data);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const selectApp = async (id: string) => {
    setSelectedId(id);
    setRecord(null);
    setDecision('');
    setComments('');
    setDecisionMsg(null);
    setLoadingRecord(true);
    try {
      const res = await applicationsApi.getById(id);
      setRecord(res.data as unknown as FullRecord);
    } catch {
      // ignore
    } finally {
      setLoadingRecord(false);
    }
  };

  const processApp = async (id: string) => {
    setProcessing(true);
    try {
      await applicationsApi.process(id);
      await selectApp(id);
      fetchApps();
    } catch {
      // ignore
    } finally {
      setProcessing(false);
    }
  };

  const submitDecision = async () => {
    if (!selectedId || !decision) return;
    setSubmitting(true);
    setDecisionMsg(null);
    try {
      const res = await applicationsApi.submitDecision(selectedId, {
        underwriter_id: underwriterId,
        underwriter_name: underwriterName,
        decision,
        comments,
      });
      setDecisionMsg(`Decision recorded: ${res.data.applicationStatus}`);
      fetchApps();
      await selectApp(selectedId);
    } catch (e: unknown) {
      setDecisionMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const recColor = (rec: string) => rec === 'APPROVE' ? '#27ae60' : rec === 'REFER' ? '#f39c12' : '#e74c3c';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* ---- Left Panel: Application List ---- */}
      <div style={{ width: '360px', minWidth: '360px', borderRight: '1px solid #e8e8e8', overflow: 'auto', background: '#f8f9fa', padding: '16px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '16px' }}>Applications</h2>

        {/* Filters */}
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', marginBottom: '8px' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}
        >
          <option value="">All Statuses</option>
          {['SUBMITTED', 'PROCESSING', 'AWAITING_DECISION', 'DOCUMENTS_PENDING', 'APPROVED', 'DECLINED'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Loading...</div>
        ) : (
          <>
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => selectApp(app.id)}
                style={{
                  background: selectedId === app.id ? '#1a1a2e' : '#fff',
                  color: selectedId === app.id ? '#fff' : '#222',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  border: selectedId === app.id ? '2px solid #e94560' : '1px solid #e8e8e8',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{app.applicant_name}</div>
                <div style={{ fontSize: '12px', opacity: 0.75, marginBottom: '6px' }}>${Number(app.loan_amount).toLocaleString()} — {app.loan_purpose}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatusBadge status={app.status} size="sm" />
                  {app.recommendation && <StatusBadge status={app.recommendation} size="sm" />}
                  {app.fairness_passed === false && <StatusBadge status="FLAGGED" size="sm" />}
                </div>
              </div>
            ))}
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '8px' }}>
              {total} total — Page {page}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ flex: 1, padding: '6px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>← Prev</button>
              <button disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)} style={{ flex: 1, padding: '6px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Next →</button>
            </div>
          </>
        )}
      </div>

      {/* ---- Right Panel: Application Detail ---- */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#f0f2f5' }}>
        {!selectedId && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '80px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <p>Select an application from the list to review</p>
          </div>
        )}

        {selectedId && loadingRecord && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '80px' }}>Loading application details...</div>
        )}

        {record && (
          <div>
            {/* Header */}
            <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{record.application.applicant_name}</h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{record.application.applicant_email} • {record.application.applicant_phone}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#999' }}>ID: {record.application.id}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StatusBadge status={record.application.status} />
                {record.policyVersion && (
                  <span style={{ fontSize: '11px', background: '#e8e8e8', padding: '3px 8px', borderRadius: '4px', color: '#555' }}>
                    Policy {record.policyVersion.version}
                  </span>
                )}
              </div>
            </div>

            {/* Process button if not yet processed */}
            {['SUBMITTED', 'DOCUMENTS_PENDING'].includes(record.application.status) && !record.recommendation && (
              <div style={{ ...card, background: '#fff8f0', border: '1px solid #ffc107' }}>
                <strong>Ready to Process</strong>
                <p style={{ margin: '8px 0', fontSize: '13px', color: '#666' }}>Run the AI processing pipeline to generate a recommendation.</p>
                <button
                  style={{ ...btn('default'), background: '#1a1a2e' }}
                  onClick={() => processApp(record.application.id)}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : '▶ Run AI Processing Pipeline'}
                </button>
              </div>
            )}

            {/* Loan details */}
            <div style={card}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Loan Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '13px' }}>
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
                  <div key={String(k)}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontWeight: 500 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div style={card}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Documents ({record.documents.length})</h3>
              {record.documents.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px' }}>No documents uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {record.documents.map((doc) => (
                    <div key={doc.id} style={{ background: '#f0f9ff', border: '1px solid #bee3f8', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{doc.document_type}</div>
                      <div style={{ color: '#555' }}>{doc.original_filename}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Result */}
            {record.validationResult && (
              <div style={{ ...card, border: `1px solid ${record.validationResult.validation_passed ? '#c3e6cb' : '#f5c6cb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Document Validation</h3>
                  <StatusBadge status={record.validationResult.validation_passed ? 'PASSED' : 'FLAGGED'} />
                </div>
                {record.validationResult.missing_documents.length > 0 && (
                  <div style={{ background: '#fff3cd', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px', fontSize: '13px' }}>
                    <strong>Missing:</strong> {record.validationResult.missing_documents.join(', ')}
                  </div>
                )}
                {record.validationResult.inconsistencies.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '13px' }}>Inconsistencies Found:</strong>
                    {record.validationResult.inconsistencies.map((inc, i) => (
                      <div key={i} style={{ background: inc.severity === 'HIGH' ? '#f8d7da' : '#fff3cd', borderRadius: '6px', padding: '8px', marginTop: '6px', fontSize: '12px' }}>
                        <strong>[{inc.severity}]</strong> {inc.field}: "{inc.value1}" ({inc.document1}) vs "{inc.value2}" ({inc.document2})
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>{record.validationResult.notes}</div>
              </div>
            )}

            {/* Score Breakdown */}
            {record.policyScore && (
              <div style={card}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>Policy Scores</h3>
                <ScoreBar score={record.policyScore.overall_score} label="Overall Weighted Score" />
                <div style={{ marginTop: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                  <ScoreBar score={record.policyScore.dti_score} label={`DTI Score (ratio: ${(record.policyScore.dti_ratio * 100).toFixed(1)}%) — weight 35%`} />
                  <ScoreBar score={record.policyScore.credit_history_score} label="Credit History Score — weight 30%" />
                  <ScoreBar score={record.policyScore.income_stability_score} label="Income Stability Score — weight 20%" />
                  <ScoreBar score={record.policyScore.employment_stability_score} label="Employment Stability Score — weight 15%" />
                </div>
                {record.policyScore.score_breakdown?.details && (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#888' }}>
                    {Object.entries(record.policyScore.score_breakdown.details).map(([k, v]) => (
                      <div key={k}><strong>{k}:</strong> {v}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Recommendation */}
            {record.recommendation && (
              <div style={{ ...card, border: `2px solid ${recColor(record.recommendation.recommendation)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>AI Recommendation</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>Confidence: {record.recommendation.confidence_level}</span>
                    <StatusBadge status={record.recommendation.recommendation} />
                  </div>
                </div>

                {/* Disclaimer */}
                <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: '#856404' }}>
                  ⚠ <strong>AI Recommendation Only.</strong> A licensed human underwriter must make the final decision.
                </div>

                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#333', background: '#f8f9fa', padding: '12px', borderRadius: '6px', margin: '0 0 12px' }}>
                  {record.recommendation.explanation}
                </pre>

                {/* Policy Citations */}
                <h4 style={{ fontSize: '13px', margin: '0 0 8px' }}>Policy Citations</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {record.recommendation.policy_citations.map((c) => (
                    <div
                      key={c.ruleId}
                      style={{
                        background: c.outcome === 'PASS' ? '#d4edda' : c.outcome === 'FAIL' ? '#f8d7da' : '#fff3cd',
                        color: c.outcome === 'PASS' ? '#155724' : c.outcome === 'FAIL' ? '#721c24' : '#856404',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                    >
                      [{c.clause}] {c.ruleId} — {c.outcome}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fairness Check */}
            {record.fairnessCheck && (
              <div style={{ ...card, border: `1px solid ${record.fairnessCheck.passed ? '#c3e6cb' : '#f5c6cb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Fairness Check</h3>
                  <StatusBadge status={record.fairnessCheck.passed ? 'PASSED' : 'FLAGGED'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div><div style={{ color: '#888' }}>Original Rec.</div><StatusBadge status={record.fairnessCheck.original_recommendation} size="sm" /></div>
                  <div><div style={{ color: '#888' }}>Anonymized Rec.</div><StatusBadge status={record.fairnessCheck.anonymized_recommendation} size="sm" /></div>
                  <div><div style={{ color: '#888' }}>Original Score</div><strong>{record.fairnessCheck.original_score?.toFixed(1)}</strong></div>
                  <div><div style={{ color: '#888' }}>Anon. Score</div><strong>{record.fairnessCheck.anonymized_score?.toFixed(1)}</strong></div>
                </div>
                {!record.fairnessCheck.passed && record.fairnessCheck.flag_reason && (
                  <div style={{ background: '#f8d7da', borderRadius: '6px', padding: '10px', marginTop: '10px', fontSize: '12px', color: '#721c24' }}>
                    <strong>⚠ Fairness Flag:</strong> {record.fairnessCheck.flag_reason}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                  Stripped fields: {record.fairnessCheck.stripped_fields?.join(', ')}
                </div>
              </div>
            )}

            {/* Previous Decisions */}
            {record.humanDecisions.length > 0 && (
              <div style={card}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Previous Decisions</h3>
                {record.humanDecisions.map((d, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #e94560', paddingLeft: '12px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <StatusBadge status={d.decision} size="sm" />
                      <span style={{ fontSize: '12px', color: '#888' }}>{d.underwriter_name} — {new Date(d.decided_at).toLocaleString()}</span>
                    </div>
                    {d.comments && <p style={{ margin: 0, fontSize: '13px', color: '#444' }}>{d.comments}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Decision Panel */}
            {record.application.status === 'AWAITING_DECISION' && (
              <div style={{ ...card, border: '2px solid #1a1a2e' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>Underwriter Decision</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Underwriter ID</label>
                    <input value={underwriterId} onChange={(e) => setUnderwriterId(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Underwriter Name</label>
                    <input value={underwriterName} onChange={(e) => setUnderwriterName(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Decision</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['APPROVED', 'DECLINED', 'REQUEST_MORE_DOCS'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDecision(d)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: `2px solid ${decision === d ? (d === 'APPROVED' ? '#27ae60' : d === 'DECLINED' ? '#e74c3c' : '#6c757d') : '#ddd'}`,
                          borderRadius: '6px',
                          background: decision === d ? (d === 'APPROVED' ? '#d4edda' : d === 'DECLINED' ? '#f8d7da' : '#e2e3e5') : '#fff',
                          cursor: 'pointer',
                          fontWeight: decision === d ? 700 : 400,
                          fontSize: '12px',
                        }}
                      >
                        {d === 'APPROVED' ? '✓ Approve' : d === 'DECLINED' ? '✗ Decline' : '📋 Request More Docs'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add your decision rationale or comments..."
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', minHeight: '80px', resize: 'vertical' }}
                  />
                </div>

                {decisionMsg && (
                  <div style={{ padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', background: decisionMsg.startsWith('Error') ? '#f8d7da' : '#d4edda', color: decisionMsg.startsWith('Error') ? '#721c24' : '#155724' }}>
                    {decisionMsg}
                  </div>
                )}

                <button
                  style={{ ...btn('default'), background: '#1a1a2e', opacity: submitting || !decision ? 0.6 : 1 }}
                  onClick={submitDecision}
                  disabled={submitting || !decision}
                >
                  {submitting ? 'Submitting...' : 'Submit Final Decision'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
