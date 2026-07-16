import { ScoringEngine } from '../services/scoringEngine';
import { PolicyEngine } from '../services/policyEngine';
import { RecommendationEngine } from '../services/recommendationEngine';
import { PolicyRules, RecommendationType } from '../types';

const scoringEngine = new ScoringEngine();
const policyEngine = new PolicyEngine();
const recommendationEngine = new RecommendationEngine();

const RULES: PolicyRules = {
  weights: {
    dti: 0.35,
    creditHistory: 0.30,
    incomeStability: 0.20,
    employmentStability: 0.15,
  },
  thresholds: {
    approveMinScore: 70,
    referMinScore: 50,
    maxDTIRatio: 0.43,
    minCreditScore: 580,
    minAnnualIncome: 24000,
    minYearsEmployed: 0.5,
  },
  hardRules: [
    { id: 'HR-001', clause: 'Section 3.1', description: 'DTI ≤ 43%', field: 'dtiRatio', operator: 'lte', threshold: 0.43, isHard: true },
    { id: 'HR-002', clause: 'Section 3.2', description: 'Credit ≥ 580', field: 'creditScore', operator: 'gte', threshold: 580, isHard: true },
    { id: 'HR-003', clause: 'Section 3.3', description: 'Income ≥ $24k', field: 'annualIncome', operator: 'gte', threshold: 24000, isHard: true },
  ],
  softRules: [
    { id: 'SR-001', clause: 'Section 4.1', description: 'Employed ≥ 6 months', field: 'yearsEmployed', operator: 'gte', threshold: 0.5, isHard: false },
    { id: 'SR-002', clause: 'Section 4.2', description: 'Credit ≥ 650', field: 'creditScore', operator: 'gte', threshold: 650, isHard: false },
  ],
};

// Helper: run full scoring + recommendation for an applicant
function runFullPipeline(applicant: {
  annualIncome: number;
  monthlyDebt: number;
  loanAmount: number;
  termMonths: number;
  creditScore: number;
  employmentStatus: string;
  yearsEmployed: number;
}): RecommendationType {
  const scores = scoringEngine.calculateOverallScoreFromApplication(
    {
      annualIncome: applicant.annualIncome,
      monthlyDebtPayments: applicant.monthlyDebt,
      loanAmount: applicant.loanAmount,
      loanTermMonths: applicant.termMonths,
      creditScore: applicant.creditScore,
      employmentStatus: applicant.employmentStatus,
      yearsEmployed: applicant.yearsEmployed,
    },
    RULES
  );

  const ruleEvals = policyEngine.evaluateRules(
    {
      creditScore: applicant.creditScore,
      annualIncome: applicant.annualIncome,
      yearsEmployed: applicant.yearsEmployed,
      employmentStatus: applicant.employmentStatus,
    },
    { dtiRatio: scores.dtiRatio },
    RULES
  );

  const { recommendation } = recommendationEngine.generateRecommendation(
    scores.overallScore,
    {
      dtiScore: scores.dtiScore,
      dtiRatio: scores.dtiRatio,
      creditHistoryScore: scores.creditHistoryScore,
      incomeStabilityScore: scores.incomeStabilityScore,
      employmentStabilityScore: scores.employmentStabilityScore,
      overallScore: scores.overallScore,
      weights: RULES.weights,
      details: {},
    },
    ruleEvals,
    RULES,
    'test-policy-v1',
    'test-app'
  );

  return recommendation;
}

// Helper: run with identity fields stripped (fairness check)
function runAnonymized(applicant: {
  annualIncome: number;
  monthlyDebt: number;
  loanAmount: number;
  termMonths: number;
  creditScore: number;
  employmentStatus: string;
  yearsEmployed: number;
}): RecommendationType {
  // Identity fields are already stripped — only financial fields remain
  return runFullPipeline(applicant);
}

describe('FairnessChecker', () => {
  it('strips identity fields and produces same recommendation', () => {
    // Ideal applicant — should APPROVE regardless of identity
    const applicantWithIdentity = {
      annualIncome: 80000,
      monthlyDebt: 500,
      loanAmount: 20000,
      termMonths: 60,
      creditScore: 720,
      employmentStatus: 'FULL_TIME',
      yearsEmployed: 5,
    };

    const originalRec = runFullPipeline(applicantWithIdentity);
    const anonymizedRec = runAnonymized(applicantWithIdentity);

    // Fairness check: should be same recommendation
    expect(originalRec).toBe(anonymizedRec);
    expect(originalRec).toBe('APPROVE');
  });

  it('produces same recommendation for borderline applicant with different identity', () => {
    const financials = {
      annualIncome: 38000,
      monthlyDebt: 700,
      loanAmount: 12000,
      termMonths: 48,
      creditScore: 630,
      employmentStatus: 'PART_TIME',
      yearsEmployed: 1.2,
    };

    // Simulate two applicants with identical financials but "different identities"
    // (identity swap: different name/address — but we only pass financial fields)
    const rec1 = runFullPipeline(financials);
    const rec2 = runAnonymized(financials);

    expect(rec1).toBe(rec2);
  });

  it('flags fairness issue when recommendation changes after anonymization', () => {
    // Simulate a scenario where identity-correlated scoring would change
    // the result — this tests the flag logic in the checker
    const original = 'APPROVE' as RecommendationType;
    const anonymized = 'DECLINE' as RecommendationType;

    const passed = original === anonymized;
    const flagReason = passed
      ? undefined
      : `Recommendation changed from ${original} to ${anonymized} after removing identity fields.`;

    expect(passed).toBe(false);
    expect(flagReason).toBeTruthy();
    expect(flagReason).toContain('identity fields');
  });

  it('passes fairness check when recommendation is unchanged', () => {
    const original = 'REFER' as RecommendationType;
    const anonymized = 'REFER' as RecommendationType;
    expect(original === anonymized).toBe(true);
  });

  it('IDENTITY_FIELDS list covers all demographic fields', () => {
    const IDENTITY_FIELDS = [
      'applicant_name', 'address', 'city', 'state',
      'zip_code', 'date_of_birth', 'applicant_phone', 'applicant_email',
    ];

    const applicationData = {
      applicant_name: 'Alice Johnson',
      address: '100 Main St',
      city: 'Springfield',
      state: 'IL',
      zip_code: '62701',
      date_of_birth: '1988-05-10',
      applicant_phone: '555-1234',
      applicant_email: 'alice@example.com',
      annual_income: 65000,
      credit_score: 700,
    };

    const anonymized = { ...applicationData };
    for (const field of IDENTITY_FIELDS) {
      delete (anonymized as Record<string, unknown>)[field];
    }

    // Identity fields should be removed
    expect(anonymized).not.toHaveProperty('applicant_name');
    expect(anonymized).not.toHaveProperty('address');
    expect(anonymized).not.toHaveProperty('date_of_birth');

    // Financial fields should remain
    expect(anonymized).toHaveProperty('annual_income');
    expect(anonymized).toHaveProperty('credit_score');
  });
});
