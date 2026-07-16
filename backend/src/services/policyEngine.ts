import { query, queryOne, execute, getDb } from '../db/client';
import { normalizeRow, normalizeRows } from '../db/normalize';
import { PolicyRules, PolicyVersion, RuleEvaluation, RuleOperator } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class PolicyEngine {
  async getActivePolicy(): Promise<PolicyVersion> {
    const row = await queryOne(
      'SELECT * FROM policy_versions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
    );
    if (!row) throw new Error('No active policy version found. Run: npm run seed');
    return normalizeRow<PolicyVersion>(row as Record<string, unknown>);
  }

  async getPolicyById(id: string): Promise<PolicyVersion | null> {
    const row = await queryOne('SELECT * FROM policy_versions WHERE id = $1', [id]);
    return row ? normalizeRow<PolicyVersion>(row as Record<string, unknown>) : null;
  }

  evaluateRules(
    applicationData: {
      creditScore?: number;
      annualIncome?: number;
      yearsEmployed?: number;
      employmentStatus?: string;
    },
    calculatedData: { dtiRatio: number },
    rules: PolicyRules
  ): RuleEvaluation[] {
    const evals: RuleEvaluation[] = [];
    const fieldValues: Record<string, number | string | undefined> = {
      dtiRatio:         calculatedData.dtiRatio,
      creditScore:      applicationData.creditScore,
      annualIncome:     applicationData.annualIncome,
      yearsEmployed:    applicationData.yearsEmployed,
      employmentStatus: applicationData.employmentStatus,
    };

    for (const rule of rules.hardRules) {
      evals.push(this._evalRule(rule, fieldValues, true));
    }
    for (const rule of rules.softRules) {
      evals.push(this._evalRule(rule, fieldValues, false));
    }
    return evals;
  }

  private _evalRule(
    rule: { id: string; clause: string; description: string; field: string; operator: RuleOperator; threshold: number },
    fieldValues: Record<string, number | string | undefined>,
    isHard: boolean
  ): RuleEvaluation {
    const raw = fieldValues[rule.field];
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? 0));
    const passed = this._applyOp(num, rule.operator, rule.threshold);
    const opLabel: Record<RuleOperator, string> = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' };
    const message = passed
      ? `${rule.description}: ${num} ${opLabel[rule.operator]} ${rule.threshold} ✓`
      : `${rule.description}: ${num} does not satisfy ${opLabel[rule.operator]} ${rule.threshold} ✗`;

    if (!passed && isHard) {
      logger.info('Hard rule failed', { ruleId: rule.id, clause: rule.clause, actualValue: num, threshold: rule.threshold });
    }

    return {
      ruleId: rule.id, clause: rule.clause, description: rule.description,
      passed, isHard,
      actualValue: isNaN(num) ? (raw ?? 'N/A') : num,
      threshold: rule.threshold, operator: rule.operator, message,
    };
  }

  private _applyOp(v: number, op: RuleOperator, t: number): boolean {
    switch (op) {
      case 'gte': return v >= t;
      case 'lte': return v <= t;
      case 'gt':  return v > t;
      case 'lt':  return v < t;
      case 'eq':  return v === t;
    }
  }

  async listVersions(): Promise<PolicyVersion[]> {
    const rows = await query('SELECT * FROM policy_versions ORDER BY created_at DESC');
    return normalizeRows<PolicyVersion>(rows as Record<string, unknown>[]);
  }

  async createVersion(version: string, description: string, rules: PolicyRules): Promise<PolicyVersion> {
    const id = uuidv4();
    await execute(
      `INSERT INTO policy_versions (id, version, description, rules, is_active) VALUES (?,?,?,?,0)`,
      [id, version, description, JSON.stringify(rules)]
    );
    const row = await queryOne('SELECT * FROM policy_versions WHERE id = ?', [id]);
    return normalizeRow<PolicyVersion>(row as Record<string, unknown>);
  }

  async activateVersion(id: string): Promise<PolicyVersion> {
    const db = getDb();
    // Use node:sqlite's exec for atomic DDL-free transaction
    db.exec('BEGIN');
    try {
      db.exec('UPDATE policy_versions SET is_active = 0');
      db.prepare('UPDATE policy_versions SET is_active = 1, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    const row = await queryOne('SELECT * FROM policy_versions WHERE id = ?', [id]);
    if (!row) throw new Error('Policy version not found');
    return normalizeRow<PolicyVersion>(row as Record<string, unknown>);
  }
}

export const policyEngine = new PolicyEngine();
export default policyEngine;
