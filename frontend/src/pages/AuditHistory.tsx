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

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
  marginBottom: '16px',
};

export default function AuditHistory() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail pane
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditRecord, setAuditRecord] = useState<FullAuditRecord | null>(null);
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
        page,
        pageSize: 20,
      });
      const d = res.data;
      setRows(d.data as AuditRow[]);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, recFilter, decisionFilter, startDate, endDate, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setAuditRecord(null);
      return;
    }
    setExpandedId(id);
    setAuditRecord(null);
    setLoadingRecord(true);
    try {
      const res = await auditApi.getRecord(id);
      setAuditRecord(res.data as FullAuditRecord);
    } catch {
      // ignore
    } finally {
      setLoadingRecord(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '13px',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', margin: '0 0 20px', color: '#1a1a2e' }}>Audit History</h1>

      {/* Filters */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Search</div>
          <input style={{ ...inputStyle, width: '200px' }} placeholder="Name, email, or ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Status</div>
          <select style={inputStyle} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['SUBMITTED', 'PROCESSING', 'AWAITING_DECISION', 'DOCUMENTS_PENDING', 'APPROVED', 'DECLINED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>AI Recommendation</div>
          <select style={inputStyle} value={recFilter} onChange={(e) => { setRecFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REFER">REFER</option>
            <option value="DECLINE">DECLINE</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Human Decision</div>
          <select style={inputStyle} value={decisionFilter} onChange={(e) => { setDecisionFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="APPROVED">APPROVED</option>
            <option value="DECLINED">DECLINED</option>
            <option value="REQUEST_MORE_DOCS">REQUEST MORE DOCS</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Start Date</div>
          <input style={inputStyle} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>End Date</div>
          <input style={inputStyle} type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>
        <button
          onClick={() => { setSearch(''); setStatusFilter(''); setRecFilter(''); setDecisionFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
          style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: '#f8f9fa' }}
        >
          Clear
        </button>
      </div>

      {/* Results Count */}
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
        {loading ? 'Loading...' : `${total} record(s) found`}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e8e8', textAlign: 'left' }}>
                {['Applicant', 'Loan Amount', 'Purpose', 'Submitted', 'Status', 'AI Rec.', 'Human Decision', 'Fairness', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', color: '#888', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: expandedId === row.id ? '#f0f4ff' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => toggleExpand(row.id)}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{row.applicant_name}</div>
                      <div style={{ color: '#888', fontSize: '11px' }}>{row.applicant_email}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>${Number(row.loan_amount).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{row.loan_purpose}</td>
                    <td style={{ padding: '10px 12px', color: '#888', fontSize: '12px' }}>
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={row.status} size="sm" />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.recommendation ? <StatusBadge status={row.recommendation} size="sm" /> : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.human_decision ? <StatusBadge status={row.human_decision} size="sm" /> : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.fairness_passed === null || row.fairness_passed === undefined
                        ? <span style={{ color: '#ccc' }}>—</span>
                        : <StatusBadge status={row.fairness_passed ? 'PASSED' : 'FLAGGED'} size="sm" />
                      }
                    </td>
                    <td style={{ padding: '10px 12px', color: '#888', fontSize: '12px' }}>
                      {expandedId === row.id ? '▲' : '▼'}
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={9} style={{ padding: '0 12px 16px', background: '#f8faff' }}>
                        {loadingRecord ? (
                          <div style={{ padding: '16px', color: '#888' }}>Loading audit record...</div>
                        ) : auditRecord ? (
                          <div style={{ paddingTop: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              {/* Recommendation */}
                              {auditRecord.recommendation && (
                                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: 600 }}>AI RECOMMENDATION</div>
                                  <StatusBadge status={auditRecord.recommendation.recommendation} />
                                  <div style={{ fontSize: '11px', color: '#555', marginTop: '8px', lineHeight: '1.5', maxHeight: '120px', overflow: 'auto' }}>
                                    {auditRecord.recommendation.explanation}
                                  </div>
                                </div>
                              )}

                              {/* Fairness */}
                              {auditRecord.fairnessCheck && (
                                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px' }}>
                                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: 600 }}>FAIRNESS CHECK</div>
                                  <StatusBadge status={(auditRecord.fairnessCheck as { passed: boolean }).passed ? 'PASSED' : 'FLAGGED'} />
                                  {!(auditRecord.fairnessCheck as { passed: boolean }).passed && (
                                    <div style={{ fontSize: '11px', color: '#721c24', marginTop: '6px' }}>
                                      {(auditRecord.fairnessCheck as { flag_reason?: string }).flag_reason}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Audit Log Timeline */}
                            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px' }}>
                              <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', fontWeight: 600 }}>AUDIT TRAIL</div>
                              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                                {auditRecord.auditLogs.map((log) => (
                                  <div key={log.id} style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '11px' }}>
                                    <span style={{ color: '#888', minWidth: '130px' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                                    <span style={{ background: '#e8e8e8', padding: '1px 6px', borderRadius: '3px', fontWeight: 600, whiteSpace: 'nowrap' }}>{log.event_type}</span>
                                    <span style={{ color: '#555' }}>{log.actor}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Application ID */}
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                              Application ID: {row.id} — Policy: {auditRecord.policyVersion?.version || 'N/A'}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                    No records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Page {page} of {totalPages} ({total} records)</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={page <= 1} onClick={() => setPage(1)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>«</button>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>‹ Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Next ›</button>
            <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>»</button>
          </div>
        </div>
      </div>
    </div>
  );
}
