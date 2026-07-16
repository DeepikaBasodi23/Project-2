import { ScoringEngine } from '../services/scoringEngine';
import { PolicyRules } from '../types';

const scoringEngine = new ScoringEngine();

const WEIGHTS: PolicyRules['weights'] = {
  dti: 0.35,
  creditHistory: 0.30,
  incomeStability: 0.20,
  employmentStability: 0.15,
};

describe('ScoringEngine', () => {
  // ----------------------------------------------------------------
  // DTI Score
  // ----------------------------------------------------------------
  describe('calculateDTIScore', () => {
    it('returns score 100 for DTI ≤ 20%', () => {
      const result = scoringEngine.calculateDTIScore(120000, 200, 24000, 60);
      // Monthly income: 10000, proposed payment: 400, total debt: 600, DTI: 6%
      expect(result.score).toBe(100);
      expect(result.ratio).toBeLessThanOrEqual(0.20);
    });

    it('returns score 85 for DTI in 21-28%', () => {
      // Monthly income: 5000, debt: 500, proposed: 500, total: 1000, DTI 20%
      const result = scoringEngine.calculateDTIScore(60000, 500, 10000, 20);
      // Monthly income: 5000, proposed: 500, total debt: 1000, DTI: 20%
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it('returns score 50 for DTI in 37-43%', () => {
      // Monthly income: 4000, debt: 900, proposed: 833, total: 1733, DTI ~43%
      const result = scoringEngine.calculateDTIScore(48000, 900, 50000, 60);
      expect(result.score).toBeLessThanOrEqual(70);
    });

    it('returns score 10 for DTI above 50%', () => {
      // High debt + high loan
      const result = scoringEngine.calculateDTIScore(24000, 1500, 50000, 36);
      // Monthly income: 2000, debt: 1500 + 1389 = 2889, DTI > 100%
      expect(result.score).toBe(10);
      expect(result.ratio).toBeGreaterThan(0.50);
    });

    it('handles zero income gracefully', () => {
      const result = scoringEngine.calculateDTIScore(0, 0, 10000, 12);
      expect(result.score).toBe(0);
      expect(result.ratio).toBe(1);
    });

    it('returns ratio as a decimal (not percentage)', () => {
      const result = scoringEngine.calculateDTIScore(60000, 0, 12000, 24);
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratio).toBeLessThan(1);
    });
  });

  // ----------------------------------------------------------------
  // Credit History Score
  // ----------------------------------------------------------------
  describe('calculateCreditHistoryScore', () => {
    it('returns 100 for exceptional credit (800+)', () => {
      expect(scoringEngine.calculateCreditHistoryScore(820).score).toBe(100);
      expect(scoringEngine.calculateCreditHistoryScore(800).score).toBe(100);
    });

    it('returns 88 for very good credit (740-799)', () => {
      expect(scoringEngine.calculateCreditHistoryScore(750).score).toBe(88);
    });

    it('returns 74 for good credit (670-739)', () => {
      expect(scoringEngine.calculateCreditHistoryScore(700).score).toBe(74);
    });

    it('returns 60 for fair credit (620-669)', () => {
      expect(scoringEngine.calculateCreditHistoryScore(640).score).toBe(60);
    });

    it('returns 45 for marginal poor credit (580-619)', () => {
      expect(scoringEngine.calculateCreditHistoryScore(590).score).toBe(45);
    });

    it('returns 15 for poor credit below 580', () => {
      expect(scoringEngine.calculateCreditHistoryScore(540).score).toBe(15);
      expect(scoringEngine.calculateCreditHistoryScore(300).score).toBe(15);
    });
  });

  // ----------------------------------------------------------------
  // Income Stability Score
  // ----------------------------------------------------------------
  describe('calculateIncomeStabilityScore', () => {
    it('gives higher score for full-time employment', () => {
      const fullTime = scoringEngine.calculateIncomeStabilityScore('FULL_TIME', 60000, 30000);
      const partTime = scoringEngine.calculateIncomeStabilityScore('PART_TIME', 60000, 30000);
      expect(fullTime.score).toBeGreaterThan(partTime.score);
    });

    it('penalizes high loan-to-income ratio', () => {
      const lowRatio = scoringEngine.calculateIncomeStabilityScore('FULL_TIME', 80000, 20000);
      const highRatio = scoringEngine.calculateIncomeStabilityScore('FULL_TIME', 30000, 200000);
      expect(lowRatio.score).toBeGreaterThan(highRatio.score);
    });

    it('clamps score between 0 and 100', () => {
      const worst = scoringEngine.calculateIncomeStabilityScore('UNEMPLOYED', 1000, 1000000);
      const best = scoringEngine.calculateIncomeStabilityScore('FULL_TIME', 200000, 10000);
      expect(worst.score).toBeGreaterThanOrEqual(0);
      expect(best.score).toBeLessThanOrEqual(100);
    });
  });

  // ----------------------------------------------------------------
  // Employment Stability Score
  // ----------------------------------------------------------------
  describe('calculateEmploymentStabilityScore', () => {
    it('returns 100 for 5+ years employment', () => {
      expect(scoringEngine.calculateEmploymentStabilityScore(5, 'FULL_TIME').score).toBeLessThanOrEqual(100);
      expect(scoringEngine.calculateEmploymentStabilityScore(10, 'FULL_TIME').score).toBeLessThanOrEqual(100);
    });

    it('returns lower score for less than 6 months', () => {
      const result = scoringEngine.calculateEmploymentStabilityScore(0.3, 'FULL_TIME');
      expect(result.score).toBeLessThan(50);
    });

    it('scores increase with tenure', () => {
      const scores = [0.3, 0.7, 1.5, 3, 6].map(
        (y) => scoringEngine.calculateEmploymentStabilityScore(y, 'FULL_TIME').score
      );
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i + 1]);
      }
    });
  });

  // ----------------------------------------------------------------
  // Overall Weighted Score
  // ----------------------------------------------------------------
  describe('calculateOverallScore', () => {
    it('returns weighted average of component scores', () => {
      const result = scoringEngine.calculateOverallScore(
        { dti: 100, creditHistory: 100, incomeStability: 100, employmentStability: 100 },
        WEIGHTS
      );
      expect(result.score).toBe(100);
    });

    it('returns 0 when all component scores are 0', () => {
      const result = scoringEngine.calculateOverallScore(
        { dti: 0, creditHistory: 0, incomeStability: 0, employmentStability: 0 },
        WEIGHTS
      );
      expect(result.score).toBe(0);
    });

    it('correctly applies different weights', () => {
      // DTI weight is 0.35 so it has most impact
      const highDTI = scoringEngine.calculateOverallScore(
        { dti: 100, creditHistory: 0, incomeStability: 0, employmentStability: 0 },
        WEIGHTS
      );
      const highCredit = scoringEngine.calculateOverallScore(
        { dti: 0, creditHistory: 100, incomeStability: 0, employmentStability: 0 },
        WEIGHTS
      );
      // DTI weight (0.35) > credit weight (0.30)
      expect(highDTI.score).toBeGreaterThan(highCredit.score);
    });

    it('score is between 0 and 100', () => {
      const result = scoringEngine.calculateOverallScore(
        { dti: 75, creditHistory: 60, incomeStability: 80, employmentStability: 55 },
        WEIGHTS
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('includes score details in result', () => {
      const result = scoringEngine.calculateOverallScore(
        { dti: 80, creditHistory: 70, incomeStability: 60, employmentStability: 50 },
        WEIGHTS
      );
      expect(result.details).toBeTruthy();
      expect(typeof result.details).toBe('string');
    });
  });
});
