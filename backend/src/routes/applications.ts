import { Router, Request, Response, NextFunction } from 'express';
import { body, query as qp, param, validationResult } from 'express-validator';
import { query, queryOne, execute } from '../db/client';
import { normalizeRow, normalizeRows } from '../db/normalize';
import { Application } from '../types';
import { applicationProcessor } from '../services/applicationProcessor';
import { auditService } from '../services/auditService';
import { sanitizeApplicationFields } from '../utils/sanitize';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/v1/applications
router.post(
  '/',
  [
    body('applicant_name').trim().notEmpty().withMessage('Applicant name is required'),
    body('applicant_email').trim().isEmail().withMessage('Valid email is required'),
    body('loan_amount').isFloat({ min: 1000 }).withMessage('Loan amount must be at least $1,000'),
    body('loan_purpose').trim().notEmpty().withMessage('Loan purpose is required'),
    body('loan_term_months').isInt({ min: 6, max: 360 }).withMessage('Loan term must be between 6 and 360 months'),
    body('annual_income').optional().isFloat({ min: 0 }),
    body('credit_score').optional().isInt({ min: 300, max: 850 }),
    body('years_employed').optional().isFloat({ min: 0 }),
    body('monthly_debt_payments').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation Error', details: errors.array() });

      const { sanitized, injectionDetected, flaggedFields } = sanitizeApplicationFields(req.body);
      const {
        applicant_name, applicant_email, applicant_phone, date_of_birth,
        address, city, state, zip_code, loan_amount, loan_purpose, loan_term_months,
        employment_status, employer_name, annual_income, monthly_debt_payments,
        credit_score, years_employed, notes,
      } = sanitized as Record<string, unknown>;

      const id = uuidv4();
      await execute(
        `INSERT INTO applications (id, applicant_name, applicant_email, applicant_phone, date_of_birth,
           address, city, state, zip_code, loan_amount, loan_purpose, loan_term_months,
           employment_status, employer_name, annual_income, monthly_debt_payments,
           credit_score, years_employed, notes, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'SUBMITTED')`,
        [id, applicant_name, applicant_email, applicant_phone || null, date_of_birth || null,
         address || null, city || null, state || null, zip_code || null,
         loan_amount, loan_purpose, loan_term_months,
         employment_status || null, employer_name || null,
         annual_income || null, monthly_debt_payments || 0,
         credit_score || null, years_employed || null, notes || null]
      );

      const appRow = await queryOne('SELECT * FROM applications WHERE id = ?', [id]);
      const app = normalizeRow<Application>(appRow as Record<string, unknown>);

      await auditService.logEvent(id, 'APPLICATION_SUBMITTED', req.ip || 'unknown', {
        applicant_email, loan_amount, loan_purpose, injectionDetected, flaggedFields,
      });

      if (injectionDetected) logger.warn('Injection in submission', { applicationId: id, flaggedFields });
      logger.info('Application created', { applicationId: id });

      return res.status(201).json({
        message: 'Application submitted successfully',
        application: app,
        ...(injectionDetected && { warning: 'Some input fields were sanitized for security.' }),
      });
    } catch (err) { return next(err); }
  }
);

// GET /api/v1/applications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page     = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    const offset   = (page - 1) * pageSize;
    const status   = req.query.status as string | undefined;
    const search   = req.query.search as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (search) {
      conditions.push('(a.applicant_name LIKE ? OR a.applicant_email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM applications a ${where}`, params
    );
    const total = Number(countRows[0]?.count || 0);

    const dataRows = await query(
      `SELECT a.*, r.recommendation, hd.decision as human_decision, fc.passed as fairness_passed
       FROM applications a
       LEFT JOIN recommendations r ON r.application_id = a.id
         AND r.created_at = (SELECT MAX(r2.created_at) FROM recommendations r2 WHERE r2.application_id = a.id)
       LEFT JOIN human_decisions hd ON hd.application_id = a.id
         AND hd.decided_at = (SELECT MAX(hd2.decided_at) FROM human_decisions hd2 WHERE hd2.application_id = a.id)
       LEFT JOIN fairness_checks fc ON fc.application_id = a.id
         AND fc.checked_at = (SELECT MAX(fc2.checked_at) FROM fairness_checks fc2 WHERE fc2.application_id = a.id)
       ${where}
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      data: normalizeRows(dataRows as Record<string, unknown>[]),
      total, page, pageSize, totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) { next(err); }
});

// GET /api/v1/applications/:id
router.get('/:id', [param('id').isUUID()], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID format' });
    const record = await auditService.getFullAuditRecord(req.params.id);
    if (!record) return next(createError('Application not found', 404));
    res.json(record);
  } catch (err) { next(err); }
});

// POST /api/v1/applications/:id/process
router.post('/:id/process', [param('id').isUUID()], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID format' });
    const appRow = await queryOne<Application>('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!appRow) return next(createError('Application not found', 404));
    const app = normalizeRow<Application>(appRow as unknown as Record<string, unknown>);
    if (['APPROVED', 'DECLINED'].includes(app.status)) {
      return res.status(400).json({ error: 'Cannot reprocess', message: `Application already ${app.status}` });
    }
    const result = await applicationProcessor.processApplication(req.params.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/applications/:id/status
router.get('/:id/status', [param('id').isUUID()], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await queryOne<{ status: string; updated_at: string }>(
      'SELECT status, updated_at FROM applications WHERE id = ?', [req.params.id]
    );
    if (!row) return next(createError('Application not found', 404));
    res.json(row);
  } catch (err) { next(err); }
});

export default router;
