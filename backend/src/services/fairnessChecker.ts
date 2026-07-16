import { FairnessCheck, RecommendationType, PolicyRules } from '../types';
import { execute, query } from '../db/client';
import { normalizeRow } from '../db/normalize';
import { scoringEngine } from './scoringEngine';
import { policyEngine } from './policyEngine';
import { recommendationEngine } from './recommendationEngine';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const IDENTITY_FIELDS = [
  'applicant_name', 'address', 'city', 'state', 'zip_code',
  'date_of_birth', 'applicant_phone', 'applicant_email',
];

export class FairnessChecker {
  async performFairnessCheck(
    applicationId: string,
    applicationData: Record<string, unknown>,
    originalRecommendation: RecommendationType,
    originalScore: number,
    rules: PolicyRules,
    policyVersionId: string
  ): Promise<FairnessCheck> {
    logger.info('Fairness check starting', { applicationId });

    // Strip identity fields
    const anon: Record<string, unknown> = { ...applicationData };
    for (const f of IDENTITY_FIELDS) delete anon[f];

    // Re-score anonymised application
    const anonScores = scoringEngine.calculateOverallScoreFromApplication(
      {
        annualIncome:        Number(anon.annual_income)          || 0,
        monthlyDebtPayments: Number(anon.monthly_debt_payments)  || 0,
        loanAmount:          Number(anon.loan_amount),
        loanTermMonths:      Number(anon.loan_term_months),
        creditScore:         Number(anon.credit_score)           || 0,
        employmentStatus:    (anon.employment_status as string)  || '',
        yearsEmployed:       Number(anon.years_employed)         || 0,
      },
      rules
    );

    // Re-run rule evaluations
    const anonEvals = policyEngine.evaluateRules(
      {
        creditScore:      Number(anon.credit_score),
        annualIncome:     Number(anon.annual_income),
        yearsEmployed:    Number(anon.years_employed),
        employmentStatus: anon.employment_status as string,
      },
      { dtiRatio: anonScores.dtiRatio },
      rules
    );

    // Re-run recommendation
    const { recommendation: anonRec } = recommendationEngine.generateRecommendation(
      anonScores.overallScore,
      {
        dtiScore: anonScores.dtiScore, dtiRatio: anonScores.dtiRatio,
        creditHistoryScore: anonScores.creditHistoryScore,
        incomeStabilityScore: anonScores.incomeStabilityScore,
        employmentStabilityScore: anonScores.employmentStabilityScore,
        overallScore: anonScores.overallScore,
        weights: rules.weights, details: {},
      },
      anonEvals, rules, policyVersionId, applicationId
    );

    const passed = anonRec === originalRecommendation;
    const flagReason = passed ? null :
      `Recommendation changed from ${originalRecommendation} to ${anonRec} after removing identity fields. Potential fairness issue — manual review required.`;

    if (!passed) {
      logger.warn('Fairness check FAILED', { applicationId, originalRecommendation, anonRec });
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO fairness_checks (id, application_id, original_recommendation, anonymized_recommendation,
         passed, flag_reason, stripped_fields, original_score, anonymized_score)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, applicationId, originalRecommendation, anonRec,
       passed ? 1 : 0, flagReason, JSON.stringify(IDENTITY_FIELDS),
       originalScore, anonScores.overallScore]
    );

    logger.info('Fairness check complete', { applicationId, passed });
    const rows = await query('SELECT * FROM fairness_checks WHERE id = ?', [id]);
    return normalizeRow<FairnessCheck>(rows[0] as Record<string, unknown>);
  }
}

export const fairnessChecker = new FairnessChecker();
export default fairnessChecker;
