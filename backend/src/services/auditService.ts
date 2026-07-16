import { query, queryOne } from '../db/client';
import { normalizeRow, normalizeRows } from '../db/normalize';
import { AuditLog, FullAuditRecord, PaginatedResult } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class AuditService {
  async logEvent(
    applicationId: string,
    eventType: string,
    actor: string,
    details: Record<string, unknown>,
    ipAddress?: string
  ): Promise<AuditLog> {
    const id = uuidv4();
    await query(
      `INSERT INTO audit_logs (id, application_id, event_type, actor, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, applicationId, eventType, actor, JSON.stringify(details), ipAddress || null]
    );
    logger.info('Audit event logged', { applicationId, eventType, actor });
    const row = await queryOne('SELECT * FROM audit_logs WHERE id = $1', [id]);
    return normalizeRow<AuditLog>(row as Record<string, unknown>);
  }

  async getFullAuditRecord(applicationId: string): Promise<FullAuditRecord | null> {
    const appRow = await queryOne('SELECT * FROM applications WHERE id = $1', [applicationId]);
    if (!appRow) return null;
    const application = normalizeRow(appRow as Record<string, unknown>);

    const [
      docRows, valRows, scoreRows, recRows, fairRows, decisionRows, logRows, pvRows,
    ] = await Promise.all([
      query('SELECT * FROM documents WHERE application_id = $1 ORDER BY uploaded_at', [applicationId]),
      query('SELECT * FROM document_validation_results WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1', [applicationId]),
      query('SELECT * FROM policy_scores WHERE application_id = $1 ORDER BY scored_at DESC LIMIT 1', [applicationId]),
      query('SELECT * FROM recommendations WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1', [applicationId]),
      query('SELECT * FROM fairness_checks WHERE application_id = $1 ORDER BY checked_at DESC LIMIT 1', [applicationId]),
      query('SELECT * FROM human_decisions WHERE application_id = $1 ORDER BY decided_at', [applicationId]),
      query('SELECT * FROM audit_logs WHERE application_id = $1 ORDER BY created_at', [applicationId]),
      query('SELECT * FROM policy_versions WHERE id = $1', [(application as Record<string, unknown>).policy_version_id]),
    ]);

    return {
      application: application as never,
      documents: normalizeRows(docRows as Record<string, unknown>[]) as never,
      validationResult: valRows[0] ? normalizeRow(valRows[0] as Record<string, unknown>) as never : undefined,
      policyScore: scoreRows[0] ? normalizeRow(scoreRows[0] as Record<string, unknown>) as never : undefined,
      recommendation: recRows[0] ? normalizeRow(recRows[0] as Record<string, unknown>) as never : undefined,
      fairnessCheck: fairRows[0] ? normalizeRow(fairRows[0] as Record<string, unknown>) as never : undefined,
      humanDecisions: normalizeRows(decisionRows as Record<string, unknown>[]) as never,
      auditLogs: normalizeRows(logRows as Record<string, unknown>[]) as never,
      policyVersion: pvRows[0] ? normalizeRow(pvRows[0] as Record<string, unknown>) as never : undefined,
    };
  }

  async getAuditHistory(filters: {
    search?: string;
    status?: string;
    recommendation?: string;
    humanDecision?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page = 1, pageSize = 20 } = filters;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      conditions.push(`(a.applicant_name LIKE ? OR a.applicant_email LIKE ? OR a.id LIKE ?)`);
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.status) { conditions.push(`a.status = ?`); params.push(filters.status); }
    if (filters.recommendation) { conditions.push(`r.recommendation = ?`); params.push(filters.recommendation); }
    if (filters.humanDecision) { conditions.push(`hd.decision = ?`); params.push(filters.humanDecision); }
    if (filters.startDate) { conditions.push(`a.created_at >= ?`); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push(`a.created_at <= ?`); params.push(filters.endDate); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseQuery = `
      FROM applications a
      LEFT JOIN recommendations r ON r.application_id = a.id
        AND r.created_at = (SELECT MAX(r2.created_at) FROM recommendations r2 WHERE r2.application_id = a.id)
      LEFT JOIN human_decisions hd ON hd.application_id = a.id
        AND hd.decided_at = (SELECT MAX(hd2.decided_at) FROM human_decisions hd2 WHERE hd2.application_id = a.id)
      LEFT JOIN fairness_checks fc ON fc.application_id = a.id
        AND fc.checked_at = (SELECT MAX(fc2.checked_at) FROM fairness_checks fc2 WHERE fc2.application_id = a.id)
      ${where}
    `;

    const countRows = await query<{ count: number }>(
      `SELECT COUNT(*) as count ${baseQuery}`, params
    );
    const total = Number(countRows[0]?.count || 0);

    const data = await query<Record<string, unknown>>(
      `SELECT a.id, a.applicant_name, a.applicant_email, a.loan_amount, a.loan_purpose,
              a.status, a.created_at, a.updated_at,
              r.recommendation, hd.decision as human_decision,
              hd.underwriter_name, hd.decided_at,
              fc.passed as fairness_passed
       ${baseQuery}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return {
      data: data.map((r) => normalizeRow(r as Record<string, unknown>)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const auditService = new AuditService();
export default auditService;
