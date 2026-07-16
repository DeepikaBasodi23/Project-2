import { RecommendationEngine } from '../services/recommendationEngine';
import { PolicyEngine } from '../services/policyEngine';
import { ScoringEngine } from '../services/scoringEngine';
import { PolicyRules, RuleEvaluation, ScoreBreakdown } from '../types';

const recommendationEngine = new RecommendationEngine();
const policyEngine = new PolicyEngine();
const scoringEngine = new ScoringEngine();

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
    {
      id: 'HR-001',
      clause: 'Section 3.1',
      description: 'DTI ratio must not exceed 43%',
      field: 'dtiRatio',
      operator: 'lte',
      threshold: 0.43,
      isHard: true,
    },
    {
      id: 'HR-002',
      clause: 'Section 3.2',
      description: 'Credit score must be at least 580',
      field: 'creditScore',
      operator: 'gte',
      threshold: 580,
      isHard: true,
    },
    {
      id: 'HR-003',
      clause: 'Section 3.3',
      description: 'Annual income must be at least $24,000',
      field: 'annualIncome',
      operator: 'gte',
      threshold: 24000,
      isHard: true,
    },
  ],
  softRules: [
    {
      id: 'SR-001',
      clause: 'Section 4.1',
      description: 'Employment duration of at least 6 months preferred',
      field: 'yearsEmployed',
      operator: 'gte',
      threshold: 0.5,
      isHard: false,
    },
    {
      id: 'SR-002',
      clause: 'Section 4.2',
      description: 'Preferred credit score above 650',
      field: 'creditScore',
      operator: 'gte',
      threshold: 650,
      isHard: false,
    },
  ],
};

function makePassingRuleEvals(): RuleEvaluation[] {
  return [
    ...RULES.hardRules.map((r) => ({
      ruleId: r.id, clause: r.clause, description: r.description,
      passed: true, isHard: true, actualValue: r.threshold, threshold: r.threshold,
      operator: r.operator, message: 'Passed',
    })),
    ...RULES.softRules.map((r) => ({
      ruleId: r.id, clause: r.clause, description: r.description,
      passed: true, isHard: false, actualValue: r.threshold, threshold: r.threshold,
      operator: r.operator, message: 'Passed',
    })),
  ];
}

function makeBreakdown(overallScore: number): ScoreBreakdown {
  return {
    dtiScore: overallScore,
    dtiRatio: 0.25,
    creditHistoryScore: overallScore,
    incomeStabilityScore: overallScore,
    employmentStabilityScore: overallScore,
    overallScore,
    weights: RULES.weights,
    details: {},
  };
}

// ----------------------------------------------------------------
// Recommendation Engine Tests
// ----------------------------------------------------------------
describe('RecommendationEngine', () => {
  describe('generateRecommendation', () => {
    it('returns APPROVE when score >= 70 and all hard rules pass and no soft failures', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        75, makeBreakdown(75), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.recommendation).toBe('APPROVE');
    });

    it('returns REFER when score is in 50-69 range and all hard rules pass', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        60, makeBreakdown(60), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.recommendation).toBe('REFER');
    });

    it('returns DECLINE when score is below 50', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        40, makeBreakdown(40), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.recommendation).toBe('DECLINE');
    });

    it('returns DECLINE when a hard rule fails regardless of score', () => {
      const evals = makePassingRuleEvals();
      // Make HR-002 fail (credit score too low)
      evals[1] = { ...evals[1], passed: false, actualValue: 500, message: 'Failed' };

      const result = recommendationEngine.generateRecommendation(
        85, makeBreakdown(85), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.recommendation).toBe('DECLINE');
    });

    it('returns REFER when score >= 70 but soft rules fail', () => {
      const evals = makePassingRuleEvals();
      // Make SR-001 fail
      evals[evals.length - 2] = { ...evals[evals.length - 2], passed: false, message: 'Failed' };

      const result = recommendationEngine.generateRecommendation(
        72, makeBreakdown(72), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.recommendation).toBe('REFER');
    });

    it('includes policy citations in result', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        80, makeBreakdown(80), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations[0].clause).toBeTruthy();
      expect(result.citations[0].ruleId).toBeTruthy();
    });

    it('includes explanation text', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        78, makeBreakdown(78), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.explanation.length).toBeGreaterThan(50);
    });

    it('explanation always includes human underwriter disclaimer', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        80, makeBreakdown(80), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(result.explanation).toContain('human underwriter must make the final decision');
    });

    it('provides confidence level', () => {
      const evals = makePassingRuleEvals();
      const result = recommendationEngine.generateRecommendation(
        80, makeBreakdown(80), evals, RULES, 'policy-v1', 'app-1'
      );
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.confidenceLevel);
    });
  });
});

// ----------------------------------------------------------------
// Policy Engine (rule evaluation) Tests
// ----------------------------------------------------------------
describe('PolicyEngine.evaluateRules', () => {
  it('passes all hard rules for ideal applicant', () => {
    const evals = policyEngine.evaluateRules(
      { creditScore: 750, annualIncome: 80000, yearsEmployed: 5, employmentStatus: 'FULL_TIME' },
      { dtiRatio: 0.25 },
      RULES
    );
    const hardResults = evals.filter((e) => e.isHard);
    expect(hardResults.every((r) => r.passed)).toBe(true);
  });

  it('fails HR-001 when DTI exceeds 43%', () => {
    const evals = policyEngine.evaluateRules(
      { creditScore: 700, annualIncome: 50000, yearsEmployed: 3 },
      { dtiRatio: 0.50 },
      RULES
    );
    const hr001 = evals.find((e) => e.ruleId === 'HR-001');
    expect(hr001?.passed).toBe(false);
  });

  it('fails HR-002 when credit score below 580', () => {
    const evals = policyEngine.evaluateRules(
      { creditScore: 540, annualIncome: 50000, yearsEmployed: 3 },
      { dtiRatio: 0.30 },
      RULES
    );
    const hr002 = evals.find((e) => e.ruleId === 'HR-002');
    expect(hr002?.passed).toBe(false);
  });

  it('fails HR-003 when annual income below $24,000', () => {
    const evals = policyEngine.evaluateRules(
      { creditScore: 650, annualIncome: 18000, yearsEmployed: 3 },
      { dtiRatio: 0.30 },
      RULES
    );
    const hr003 = evals.find((e) => e.ruleId === 'HR-003');
    expect(hr003?.passed).toBe(false);
  });

  it('passes SR-002 when credit score >= 650', () => {
    const evals = policyEngine.evaluateRules(
      { creditScore: 700, annualIncome: 50000, yearsEmployed: 2 },
      { dtiRatio: 0.30 },
      RULES
    );
    const sr002 = evals.find((e) => e.ruleId === 'SR-002');
    expect(sr002?.passed).toBe(true);
  });

  it('each evaluation includes a clause citation', () => {
    const evals = policyEngine.evaluateRules(
      { creditScore: 700, annualIncome: 50000, yearsEmployed: 2 },
      { dtiRatio: 0.30 },
      RULES
    );
    evals.forEach((e) => {
      expect(e.clause).toBeTruthy();
    });
  });
});
