import { PolicyScore, PolicyRules, ScoreBreakdown } from '../types';
import { query, execute } from '../db/client';
import { normalizeRow } from '../db/normalize';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ScoringEngine {
  calculateDTIScore(
    annualIncome: number,
    monthlyDebt: number,
    loanAmount: number,
    termMonths: number
  ): { score: number; ratio: number; details: string } {
    if (annualIncome <= 0) return { score: 0, ratio: 1, details: 'Annual income is zero or negative' };
    const monthlyIncome = annualIncome / 12;
    const proposedMonthlyPayment = loanAmount / termMonths;
    const totalMonthlyDebt = monthlyDebt + proposedMonthlyPayment;
    const dtiRatio = totalMonthlyDebt / monthlyIncome;

    let score: number;
    if      (dtiRatio <= 0.20) score = 100;
    else if (dtiRatio <= 0.28) score = 85;
    else if (dtiRatio <= 0.36) score = 70;
    else if (dtiRatio <= 0.43) score = 50;
    else if (dtiRatio <= 0.50) score = 30;
    else                        score = 10;

    return {
      score,
      ratio: parseFloat(dtiRatio.toFixed(4)),
      details: `Monthly income: $${monthlyIncome.toFixed(0)}, total monthly debt: $${totalMonthlyDebt.toFixed(0)}, DTI: ${(dtiRatio * 100).toFixed(1)}%`,
    };
  }

  calculateCreditHistoryScore(creditScore: number): { score: number; details: string } {
    let score: number; let category: string;
    if      (creditScore >= 800) { score = 100; category = 'Exceptional'; }
    else if (creditScore >= 740) { score = 88;  category = 'Very Good'; }
    else if (creditScore >= 670) { score = 74;  category = 'Good'; }
    else if (creditScore >= 620) { score = 60;  category = 'Fair'; }
    else if (creditScore >= 580) { score = 45;  category = 'Poor - Marginal'; }
    else                          { score = 15;  category = 'Poor'; }
    return { score, details: `Credit score ${creditScore} (${category})` };
  }

  calculateIncomeStabilityScore(
    employmentStatus: string,
    annualIncome: number,
    loanAmount: number
  ): { score: number; details: string } {
    let score = 50;
    const notes: string[] = [];
    switch ((employmentStatus || '').toUpperCase()) {
      case 'FULL_TIME':  case 'FULLTIME':   score += 30; notes.push('Full-time (+30)'); break;
      case 'SELF_EMPLOYED':                  score += 15; notes.push('Self-employed (+15)'); break;
      case 'CONTRACT':                       score += 12; notes.push('Contract (+12)'); break;
      case 'PART_TIME':  case 'PARTTIME':   score += 10; notes.push('Part-time (+10)'); break;
      default:                               score -= 10; notes.push('Other employment (-10)');
    }
    const lti = loanAmount / (annualIncome || 1);
    if      (lti <= 1.0) { score += 20; notes.push('Loan ≤ 1× income (+20)'); }
    else if (lti <= 2.5) { score += 10; notes.push('Loan ≤ 2.5× income (+10)'); }
    else if (lti > 4.0)  { score -= 15; notes.push('Loan > 4× income (-15)'); }
    return { score: Math.max(0, Math.min(100, score)), details: notes.join('; ') };
  }

  calculateEmploymentStabilityScore(
    yearsEmployed: number,
    employmentStatus: string
  ): { score: number; details: string } {
    let score: number; let details: string;
    if      (yearsEmployed >= 5)   { score = 100; details = `${yearsEmployed}y (5+: excellent)`; }
    else if (yearsEmployed >= 3)   { score = 85;  details = `${yearsEmployed}y (3-5: very good)`; }
    else if (yearsEmployed >= 2)   { score = 70;  details = `${yearsEmployed}y (2-3: good)`; }
    else if (yearsEmployed >= 1)   { score = 55;  details = `${yearsEmployed}y (1-2: fair)`; }
    else if (yearsEmployed >= 0.5) { score = 40;  details = `${yearsEmployed}y (6-12mo: marginal)`; }
    else                            { score = 15;  details = `${yearsEmployed}y (<6mo: low)`; }
    if ((employmentStatus || '').toUpperCase() === 'FULL_TIME') score = Math.min(100, score + 5);
    return { score, details };
  }

  calculateOverallScore(
    scores: { dti: number; creditHistory: number; incomeStability: number; employmentStability: number },
    weights: PolicyRules['weights']
  ): { score: number; details: string } {
    const total = weights.dti + weights.creditHistory + weights.incomeStability + weights.employmentStability;
    const weighted = (
      scores.dti * weights.dti +
      scores.creditHistory * weights.creditHistory +
      scores.incomeStability * weights.incomeStability +
      scores.employmentStability * weights.employmentStability
    ) / total;
    const score = parseFloat(weighted.toFixed(2));
    const details =
      `DTI:${scores.dti}×${weights.dti} + Credit:${scores.creditHistory}×${weights.creditHistory} + ` +
      `Income:${scores.incomeStability}×${weights.incomeStability} + Emp:${scores.employmentStability}×${weights.employmentStability} = ${score}`;
    return { score, details };
  }

  /** Re-score without persisting — used by the fairness checker */
  calculateOverallScoreFromApplication(
    app: { annualIncome: number; monthlyDebtPayments: number; loanAmount: number; loanTermMonths: number; creditScore: number; employmentStatus: string; yearsEmployed: number },
    rules: PolicyRules
  ): { overallScore: number; dtiRatio: number; dtiScore: number; creditHistoryScore: number; incomeStabilityScore: number; employmentStabilityScore: number } {
    const dti  = this.calculateDTIScore(app.annualIncome || 1, app.monthlyDebtPayments || 0, app.loanAmount, app.loanTermMonths);
    const cred = this.calculateCreditHistoryScore(app.creditScore || 0);
    const inc  = this.calculateIncomeStabilityScore(app.employmentStatus || '', app.annualIncome || 0, app.loanAmount);
    const emp  = this.calculateEmploymentStabilityScore(app.yearsEmployed || 0, app.employmentStatus || '');
    const ov   = this.calculateOverallScore({ dti: dti.score, creditHistory: cred.score, incomeStability: inc.score, employmentStability: emp.score }, rules.weights);
    return { overallScore: ov.score, dtiRatio: dti.ratio, dtiScore: dti.score, creditHistoryScore: cred.score, incomeStabilityScore: inc.score, employmentStabilityScore: emp.score };
  }

  async scoreApplication(
    applicationId: string,
    appData: { annualIncome: number; monthlyDebtPayments: number; loanAmount: number; loanTermMonths: number; creditScore: number; employmentStatus: string; yearsEmployed: number },
    rules: PolicyRules,
    policyVersionId: string
  ): Promise<PolicyScore> {
    logger.info('Scoring application', { applicationId });
    const dti  = this.calculateDTIScore(appData.annualIncome, appData.monthlyDebtPayments, appData.loanAmount, appData.loanTermMonths);
    const cred = this.calculateCreditHistoryScore(appData.creditScore);
    const inc  = this.calculateIncomeStabilityScore(appData.employmentStatus, appData.annualIncome, appData.loanAmount);
    const emp  = this.calculateEmploymentStabilityScore(appData.yearsEmployed, appData.employmentStatus);
    const ov   = this.calculateOverallScore({ dti: dti.score, creditHistory: cred.score, incomeStability: inc.score, employmentStability: emp.score }, rules.weights);

    const breakdown: ScoreBreakdown = {
      dtiScore: dti.score, dtiRatio: dti.ratio, creditHistoryScore: cred.score,
      incomeStabilityScore: inc.score, employmentStabilityScore: emp.score, overallScore: ov.score,
      weights: rules.weights,
      details: { dti: dti.details, creditHistory: cred.details, incomeStability: inc.details, employmentStability: emp.details, overall: ov.details },
    };

    const id = uuidv4();
    await execute(
      `INSERT INTO policy_scores (id, application_id, dti_score, dti_ratio, credit_history_score,
         income_stability_score, employment_stability_score, overall_score, score_breakdown, policy_version_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, applicationId, dti.score, dti.ratio, cred.score, inc.score, emp.score, ov.score, JSON.stringify(breakdown), policyVersionId]
    );

    const row = await query('SELECT * FROM policy_scores WHERE id = ?', [id]);
    logger.info('Scored', { applicationId, overall: ov.score });
    return normalizeRow<PolicyScore>(row[0] as Record<string, unknown>);
  }
}

export const scoringEngine = new ScoringEngine();
export default scoringEngine;
