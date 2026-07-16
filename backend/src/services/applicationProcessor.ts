import { queryOne, execute } from '../db/client';
import { normalizeRow } from '../db/normalize';
import { Application, ProcessingResult } from '../types';
import { documentValidationService } from './documentValidationService';
import { scoringEngine } from './scoringEngine';
import { policyEngine } from './policyEngine';
import { recommendationEngine } from './recommendationEngine';
import { fairnessChecker } from './fairnessChecker';
import { auditService } from './auditService';
import { sanitizeApplicationFields } from '../utils/sanitize';
import { logger } from '../utils/logger';

export class ApplicationProcessor {
  async processApplication(
    applicationId: string,
    ipAddress?: string
  ): Promise<ProcessingResult> {
    logger.info('Processing application', { applicationId });

    // 1. Load application
    const appRow = await queryOne('SELECT * FROM applications WHERE id = ?', [applicationId]);
    if (!appRow) return { applicationId, status: 'ERROR', message: 'Application not found' };
    const application = normalizeRow<Application>(appRow as Record<string, unknown>);

    await execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?',
      ['PROCESSING', new Date().toISOString(), applicationId]);

    await auditService.logEvent(applicationId, 'PROCESSING_STARTED', 'SYSTEM',
      { previousStatus: application.status }, ipAddress);

    // 2. Sanitize (prompt injection defence)
    const appData = application as unknown as Record<string, unknown>;
    const { injectionDetected, flaggedFields } = sanitizeApplicationFields(appData);
    if (injectionDetected) {
      await auditService.logEvent(applicationId, 'INJECTION_ATTEMPT_DETECTED', 'SYSTEM',
        { flaggedFields, message: 'Prompt injection detected and neutralized' }, ipAddress);
      logger.warn('Injection detected', { applicationId, flaggedFields });
    }

    // 3. Validate documents
    const validationResult = await documentValidationService.validateDocuments(applicationId, appData);
    await auditService.logEvent(applicationId, 'DOCUMENT_VALIDATION_COMPLETE', 'SYSTEM', {
      validationPassed: validationResult.validation_passed,
      isComplete: validationResult.is_complete,
      missingDocuments: validationResult.missing_documents,
    }, ipAddress);

    if (!validationResult.is_complete) {
      await execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?',
        ['DOCUMENTS_PENDING', new Date().toISOString(), applicationId]);
      return {
        applicationId, status: 'INCOMPLETE_DOCUMENTS',
        missingDocuments: validationResult.missing_documents, validationResult,
        message: `Processing stopped: missing documents — ${validationResult.missing_documents.join(', ')}.`,
      };
    }

    // 4. Load active policy
    const policy = await policyEngine.getActivePolicy();
    await execute('UPDATE applications SET policy_version_id = ?, updated_at = ? WHERE id = ?',
      [policy.id, new Date().toISOString(), applicationId]);

    // 5. Calculate scores
    const policyScore = await scoringEngine.scoreApplication(
      applicationId,
      {
        annualIncome:        Number(application.annual_income)         || 0,
        monthlyDebtPayments: Number(application.monthly_debt_payments) || 0,
        loanAmount:          Number(application.loan_amount),
        loanTermMonths:      Number(application.loan_term_months),
        creditScore:         Number(application.credit_score)          || 0,
        employmentStatus:    application.employment_status             || '',
        yearsEmployed:       Number(application.years_employed)        || 0,
      },
      policy.rules,
      policy.id
    );

    await auditService.logEvent(applicationId, 'SCORING_COMPLETE', 'SYSTEM', {
      overallScore: policyScore.overall_score, dtiRatio: policyScore.dti_ratio, policyVersion: policy.version,
    }, ipAddress);

    // 6. Evaluate policy rules
    const ruleEvaluations = policyEngine.evaluateRules(
      {
        creditScore:      Number(application.credit_score),
        annualIncome:     Number(application.annual_income),
        yearsEmployed:    Number(application.years_employed),
        employmentStatus: application.employment_status || '',
      },
      { dtiRatio: policyScore.dti_ratio },
      policy.rules
    );

    // 7. Generate recommendation
    const { recommendation, explanation, citations, confidenceLevel } =
      recommendationEngine.generateRecommendation(
        policyScore.overall_score, policyScore.score_breakdown,
        ruleEvaluations, policy.rules, policy.id, applicationId
      );

    const savedRec = await recommendationEngine.saveRecommendation(
      applicationId, recommendation, explanation, citations, confidenceLevel, policy.id
    );

    await auditService.logEvent(applicationId, 'RECOMMENDATION_GENERATED', 'SYSTEM', {
      recommendation, confidenceLevel,
      hardFailures: ruleEvaluations.filter((r) => r.isHard && !r.passed).length,
    }, ipAddress);

    // 8. Fairness check
    const fairnessResult = await fairnessChecker.performFairnessCheck(
      applicationId, appData, recommendation, policyScore.overall_score, policy.rules, policy.id
    );

    await auditService.logEvent(applicationId, 'FAIRNESS_CHECK_COMPLETE', 'SYSTEM', {
      passed: fairnessResult.passed,
      flagReason: fairnessResult.flag_reason,
    }, ipAddress);

    // 9. Done — awaiting underwriter
    await execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?',
      ['AWAITING_DECISION', new Date().toISOString(), applicationId]);
    await auditService.logEvent(applicationId, 'AWAITING_UNDERWRITER_DECISION', 'SYSTEM',
      { recommendation, fairnessPassed: fairnessResult.passed }, ipAddress);

    logger.info('Processing complete', { applicationId, recommendation, overallScore: policyScore.overall_score });

    return {
      applicationId, status: 'COMPLETE',
      validationResult, policyScore,
      recommendation: savedRec, fairnessCheck: fairnessResult,
      message: `Processing complete. AI recommendation: ${recommendation}. Awaiting underwriter decision.`,
    };
  }
}

export const applicationProcessor = new ApplicationProcessor();
export default applicationProcessor;
