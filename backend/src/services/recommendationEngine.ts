import { Recommendation, RecommendationType, PolicyCitation, RuleEvaluation, ScoreBreakdown, PolicyRules } from '../types';
import { execute, query } from '../db/client';
import { normalizeRow } from '../db/normalize';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class RecommendationEngine {
  generateRecommendation(
    overallScore: number,
    breakdown: ScoreBreakdown,
    ruleEvaluations: RuleEvaluation[],
    rules: PolicyRules,
    policyVersionId: string,
    applicationId: string
  ): { recommendation: RecommendationType; explanation: string; citations: PolicyCitation[]; confidenceLevel: string } {
    const hardFails = ruleEvaluations.filter((r) => r.isHard && !r.passed);
    const softFails = ruleEvaluations.filter((r) => !r.isHard && !r.passed);
    const { approveMinScore, referMinScore } = rules.thresholds;
    const lines: string[] = [];
    const citations: PolicyCitation[] = ruleEvaluations.map((ev) => ({
      ruleId: ev.ruleId, clause: ev.clause, description: ev.description,
      outcome: ev.passed ? 'PASS' : ev.isHard ? 'FAIL' : 'WARN',
    }));

    let recommendation: RecommendationType;

    if (hardFails.length > 0) {
      recommendation = 'DECLINE';
      lines.push(`DECLINE recommended: ${hardFails.length} mandatory policy rule(s) failed.`);
      hardFails.forEach((f) => lines.push(`  • [${f.clause}] ${f.message}`));
      lines.push(`Overall score: ${overallScore.toFixed(1)} (approval threshold: ${approveMinScore}).`);
    } else if (overallScore >= approveMinScore && softFails.length === 0) {
      recommendation = 'APPROVE';
      lines.push(`APPROVE recommended: Score ${overallScore.toFixed(1)} meets approval threshold ${approveMinScore}. All rules passed.`);
    } else if (overallScore >= approveMinScore && softFails.length > 0) {
      recommendation = 'REFER';
      lines.push(`REFER recommended: Score ${overallScore.toFixed(1)} meets threshold but ${softFails.length} preferred rule(s) raised concerns.`);
      softFails.forEach((f) => lines.push(`  • [${f.clause}] ${f.message}`));
    } else if (overallScore >= referMinScore) {
      recommendation = 'REFER';
      lines.push(`REFER recommended: Score ${overallScore.toFixed(1)} is in the refer band (${referMinScore}–${approveMinScore - 1}). Manual review required.`);
    } else {
      recommendation = 'DECLINE';
      lines.push(`DECLINE recommended: Score ${overallScore.toFixed(1)} is below refer threshold ${referMinScore}.`);
    }

    lines.push('');
    lines.push('Score breakdown:');
    lines.push(`  DTI Score:         ${breakdown.dtiScore.toFixed(1)}/100  (DTI ratio: ${(breakdown.dtiRatio * 100).toFixed(1)}%)  weight: ${(breakdown.weights.dti * 100).toFixed(0)}%`);
    lines.push(`  Credit History:    ${breakdown.creditHistoryScore.toFixed(1)}/100  weight: ${(breakdown.weights.creditHistory * 100).toFixed(0)}%`);
    lines.push(`  Income Stability:  ${breakdown.incomeStabilityScore.toFixed(1)}/100  weight: ${(breakdown.weights.incomeStability * 100).toFixed(0)}%`);
    lines.push(`  Employment Stab.:  ${breakdown.employmentStabilityScore.toFixed(1)}/100  weight: ${(breakdown.weights.employmentStability * 100).toFixed(0)}%`);
    lines.push(`  Weighted Overall:  ${overallScore.toFixed(1)}/100`);
    lines.push('');
    lines.push('⚠ This is an AI-generated recommendation only. A licensed human underwriter must make the final decision.');

    const confidenceLevel =
      hardFails.length > 1 || overallScore < referMinScore - 10 ? 'HIGH' :
      overallScore >= approveMinScore + 10 ? 'HIGH' : 'MEDIUM';

    return { recommendation, explanation: lines.join('\n'), citations, confidenceLevel };
  }

  async saveRecommendation(
    applicationId: string,
    recommendation: RecommendationType,
    explanation: string,
    citations: PolicyCitation[],
    confidenceLevel: string,
    policyVersionId: string
  ): Promise<Recommendation> {
    const id = uuidv4();
    await execute(
      `INSERT INTO recommendations (id, application_id, recommendation, explanation, policy_citations, confidence_level, policy_version_id)
       VALUES (?,?,?,?,?,?,?)`,
      [id, applicationId, recommendation, explanation, JSON.stringify(citations), confidenceLevel, policyVersionId]
    );
    logger.info('Recommendation saved', { applicationId, recommendation, confidenceLevel });
    const rows = await query('SELECT * FROM recommendations WHERE id = ?', [id]);
    return normalizeRow<Recommendation>(rows[0] as Record<string, unknown>);
  }
}

export const recommendationEngine = new RecommendationEngine();
export default recommendationEngine;
