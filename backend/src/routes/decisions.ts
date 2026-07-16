import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { queryOne, execute, query } from '../db/client';
import { normalizeRow, normalizeRows } from '../db/normalize';
import { HumanDecision, Application } from '../types';
import { auditService } from '../services/auditService';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router({ mergeParams: true });

// POST /api/v1/applications/:id/decisions
router.post('/',
  [
    param('id').isUUID(),
    body('underwriter_id').trim().notEmpty(),
    body('decision').isIn(['APPROVED', 'DECLINED', 'REQUEST_MORE_DOCS']),
    body('comments').optional().trim().isString().isLength({ max: 2000 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation Error', details: errors.array() });

      const { id } = req.params;
      const { underwriter_id, underwriter_name, decision, comments, requested_documents } = req.body as {
        underwriter_id: string; underwriter_name?: string;
        decision: 'APPROVED' | 'DECLINED' | 'REQUEST_MORE_DOCS';
        comments?: string; requested_documents?: string[];
      };

      const appRow = await queryOne<Application>('SELECT * FROM applications WHERE id = ?', [id]);
      if (!appRow) return next(createError('Application not found', 404));
      const app = normalizeRow<Application>(appRow as unknown as Record<string, unknown>);

      if (app.status !== 'AWAITING_DECISION') {
        return res.status(400).json({
          error: 'Invalid state',
          message: `Application is "${app.status}". Only AWAITING_DECISION applications can receive a human decision.`,
        });
      }

      const decId = uuidv4();
      await execute(
        `INSERT INTO human_decisions (id, application_id, underwriter_id, underwriter_name, decision, comments, requested_documents)
         VALUES (?,?,?,?,?,?,?)`,
        [decId, id, underwriter_id, underwriter_name || null, decision, comments || null, JSON.stringify(requested_documents || [])]
      );

      const newStatus = decision === 'APPROVED' ? 'APPROVED' : decision === 'DECLINED' ? 'DECLINED' : 'DOCUMENTS_PENDING';
      await execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?',
        [newStatus, new Date().toISOString(), id]);

      await auditService.logEvent(id, 'UNDERWRITER_DECISION', underwriter_id, {
        decision, comments, newStatus, underwriterName: underwriter_name,
      }, req.ip);

      const rows = await query('SELECT * FROM human_decisions WHERE id = ?', [decId]);
      const humanDecision = normalizeRow<HumanDecision>(rows[0] as Record<string, unknown>);
      logger.info('Decision recorded', { applicationId: id, decision });
      return res.status(201).json({ message: 'Decision recorded', decision: humanDecision, applicationStatus: newStatus });
    } catch (err) { return next(err); }
  }
);

// GET /api/v1/applications/:id/decisions
router.get('/', [param('id').isUUID()], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query('SELECT * FROM human_decisions WHERE application_id = ? ORDER BY decided_at DESC', [req.params.id]);
    res.json({ decisions: normalizeRows(rows as Record<string, unknown>[]), count: rows.length });
  } catch (err) { next(err); }
});

export default router;
