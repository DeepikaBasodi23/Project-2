import React, { useEffect, useState, useCallback } from 'react';
import { auditApi } from '../api/applications';
import StatusBadge from '../components/StatusBadge';

interface AuditRow {
  id: string;
  applicant_name: string;
  applicant_email: string;
  loan_amount: number;
  loan_purpose: string;
  status: string;
  created_at: string;
  recommendation?: string;
  human_decision?: string;
  underwriter_name?: string;
  decided_at?: string;
  fairness_passed?: boolean;
}

interface FullAuditRecord {
  application: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
  validationResult?: Record<string, unknown>;
  policyScore?: Record<string, unknown>;
  recommendation?: {
    recommendation: string;
    explanation: string;
    policy_citations: Array<{ ruleId: string; clause: string; description: string; outcome: string }>;
    confidence_level: string;
  };
  fairnessCheck?: Record<string, unknown>;
  humanDecisions: Array<Record<string, unknown>>;
  auditLogs: Array<{ id: string; event_type: string; actor: string; details: Record<string, unknown>; created_at: string }>;
  policyVersion?: { version: string; description: string };
}

/* ── Shared styles ─────────────────────────────────────────────── */
const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  marginBottom: '16px',
  border: '1px solid #e2e8f0',
};

const filterInput: React.CSSProperties = {
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

const thStyle: React.CSSProperties = {
  padding: '11px 14px',
  color: '#7c3aed',
  fontWeight: 700,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
  borderBottom: '2px solid #c4b5fd',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--gray-100)',
};

/* ── Component ─────────────────────────────────────────────────── */
export default function AuditHistory() {
  const [rows, setRows]               = useState<AuditRow[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(false);

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [recFilter, setRecFilter]       = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');

  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [auditRecord, setAuditRecord]   = useState<FullAuditRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.getHistory({
        search: search || undefined,
        status: statusFilter || undefined,
        recommendation: recFilter || undefined,
        humanDecision: decisionFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page, pageSize: 20,
      });
      const d = res.data;
      setRows(d.data as AuditRow[]);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, statusFilter, recFilter, decisionFilter, startDate, endDate, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setAuditRecord(null); return; }
    setExpandedId(id); setAuditRecord(null); setLoadingRecord(true);
    try {
      const res = await auditApi.getRecord(id);
      setAuditRecord(res.data as FullAuditRecord);
    } catch { /* ignore */ }
    finally { setLoadingRecord(false); }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setRecFilter('');
    setDecisionFilter(''); setStartDate(''); setEndDate(''); setPage(1);
  };


  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px', maxWidth: '1300px', margin: '0 auto' }} className="fade-in">

      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800,
          background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: '4px',
        }}>Audit History</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Full audit trail — {total} record{total !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* ── Filters ── */}
      <div style={{ ...card, background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #c4b5fd', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        {/* Search */}
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Search</div>
          <input style={{ ...filterInput, width: '100%' }} placeholder="Name, email or ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>

        {/* Status */}
        <div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</div>
          <select style={filterInput} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['SUBMITTED','PROCESSING','AWAITING_DECISION','DOCUMENTS_PENDING','APPROVED','DECLINED'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
            ))}
          </select>
        </div>

        {/* AI Rec */}
        <div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>AI Rec.</div>
          <select style={filterInput} value={recFilter} onChange={(e) => { setRecFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REFER">REFER</option>
            <option value="DECLINE">DECLINE</option>
          </select>
        </div>

        {/* Human decision */}
        <div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Human Decision</div>
          <select style={filterInput} value={decisionFilter} onChange={(e) => { setDecisionFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="APPROVED">APPROVED</option>
            <option value="DECLINED">DECLINED</option>
            <option value="REQUEST_MORE_DOCS">REQUEST MORE DOCS</option>
          </select>
        </div>

        {/* Date range */}
        <div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>From</div>
          <input style={filterInput} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>To</div>
          <input style={filterInput} type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>

        {/* Clear */}
        <button onClick={clearFilters} style={{
          padding: '9px 16px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)',
          cursor: 'pointer', fontSize: '13px', background: '#fff', color: 'var(--gray-600)',
          fontWeight: 600, transition: 'var(--transition)',
        }}>
          ✕ Clear
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--gray-400)', fontSize: '13px' }}>
          Loading records...
        </div>
      )}

      {/* ── Table ── */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Applicant', 'Loan Amount', 'Purpose', 'Submitted', 'Status', 'AI Rec.', 'Human Decision', 'Fairness', ''].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isExpanded = expandedId === row.id;
                return (
                  <React.Fragment key={row.id}>
                    {/* Main row */}
                    <tr
                      onClick={() => toggleExpand(row.id)}
                      style={{
                        cursor: 'pointer',
                        background: isExpanded
                          ? 'linear-gradient(135deg,#eef2ff,#f5f3ff)'
                          : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'; }}
                      onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{row.applicant_name}</div>
                        <div style={{ color: 'var(--gray-400)', fontSize: '11px', marginTop: '2px' }}>{row.applicant_email}</div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#6366f1' }}>
                        ${Number(row.loan_amount).toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--gray-600)' }}>{row.loan_purpose}</td>
                      <td style={{ ...tdStyle, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td style={tdStyle}><StatusBadge status={row.status} size="sm" /></td>
                      <td style={tdStyle}>
                        {row.recommendation
                          ? <StatusBadge status={row.recommendation} size="sm" />
                          : <span style={{ color: 'var(--gray-300)', fontSize: '16px' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {row.human_decision
                          ? <StatusBadge status={row.human_decision} size="sm" />
                          : <span style={{ color: 'var(--gray-300)', fontSize: '16px' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        {row.fairness_passed === null || row.fairness_passed === undefined
                          ? <span style={{ color: 'var(--gray-300)', fontSize: '16px' }}>—</span>
                          : <StatusBadge status={row.fairness_passed ? 'PASSED' : 'FLAGGED'} size="sm" />}
                      </td>
                      <td style={{ ...tdStyle, color: isExpanded ? '#6366f1' : 'var(--gray-400)', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}>
                        {isExpanded ? '▲' : '▼'}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} style={{ padding: '0', background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)' }}>
                          <div style={{ padding: '16px 20px', borderTop: '2px solid #a78bfa', borderBottom: '1px solid #e2e8f0' }}>
                            {loadingRecord ? (
                              <div style={{ padding: '20px', color: 'var(--gray-400)', textAlign: 'center', fontSize: '13px' }}>
                                ⏳ Loading audit record...
                              </div>
                            ) : auditRecord ? (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                                {/* AI Recommendation */}
                                {auditRecord.recommendation && (
                                  <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                      🤖 AI Recommendation
                                    </div>
                                    <StatusBadge status={auditRecord.recommendation.recommendation} />
                                    <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '10px', lineHeight: 1.6, maxHeight: '120px', overflow: 'auto' }}>
                                      {auditRecord.recommendation.explanation}
                                    </div>
                                    {/* Policy citations */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                                      {auditRecord.recommendation.policy_citations.map((c) => (
                                        <span key={c.ruleId} style={{
                                          background: c.outcome === 'PASS' ? '#d1fae5' : c.outcome === 'FAIL' ? '#fee2e2' : '#fef3c7',
                                          color: c.outcome === 'PASS' ? '#065f46' : c.outcome === 'FAIL' ? '#7f1d1d' : '#78350f',
                                          padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                                        }}>
                                          {c.ruleId} {c.outcome}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Fairness check */}
                                {auditRecord.fairnessCheck && (
                                  <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                      ⚖ Fairness Check
                                    </div>
                                    <StatusBadge status={(auditRecord.fairnessCheck as { passed: boolean }).passed ? 'PASSED' : 'FLAGGED'} />
                                    {!(auditRecord.fairnessCheck as { passed: boolean }).passed && (
                                      <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '8px', background: '#fee2e2', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                                        {(auditRecord.fairnessCheck as { flag_reason?: string }).flag_reason}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Audit trail - full width */}
                                <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                    📋 Audit Trail
                                  </div>
                                  <div style={{ maxHeight: '180px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {auditRecord.auditLogs.map((log) => (
                                      <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--gray-400)', minWidth: '80px', whiteSpace: 'nowrap' }}>
                                          {new Date(log.created_at).toLocaleTimeString()}
                                        </span>
                                        <span style={{
                                          background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
                                          color: '#4c1d95',
                                          padding: '2px 8px', borderRadius: '20px',
                                          fontWeight: 700, fontSize: '10px',
                                          whiteSpace: 'nowrap',
                                        }}>{log.event_type}</span>
                                        <span style={{ color: 'var(--gray-500)' }}>{log.actor}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--gray-100)' }}>
                                    ID: {row.id} — Policy: {auditRecord.policyVersion?.version || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Empty state */}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: 'var(--gray-400)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No records found</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--gray-100)' }}>
          <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> &nbsp;·&nbsp; {total} records
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { label: '«', action: () => setPage(1),             disabled: page <= 1 },
              { label: '‹', action: () => setPage((p) => p - 1), disabled: page <= 1 },
              { label: '›', action: () => setPage((p) => p + 1), disabled: page >= totalPages },
              { label: '»', action: () => setPage(totalPages),    disabled: page >= totalPages },
            ].map(({ label, action, disabled }) => (
              <button key={label} disabled={disabled} onClick={action} style={{
                padding: '6px 12px', border: '1.5px solid var(--gray-200)',
                borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '13px', background: disabled ? 'var(--gray-50)' : '#fff',
                color: disabled ? 'var(--gray-300)' : 'var(--gray-700)',
                fontWeight: 600, transition: 'var(--transition)',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
