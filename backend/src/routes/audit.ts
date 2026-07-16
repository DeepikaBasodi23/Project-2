import { Router, Request, Response, NextFunction } from 'express';
import { param, query as queryParam, validationResult } from 'express-validator';
import { auditService } from '../services/auditService';
import { createError } from '../middleware/errorHandler';

const router = Router();

// ------------------------------------------------------------------
// GET /api/v1/audit — Paginated audit history with search/filter
// ------------------------------------------------------------------
router.get(
  '/',
  [
    queryParam('search').optional().isString(),
    queryParam('status').optional().isString(),
    queryParam('recommendation').optional().isIn(['APPROVE', 'REFER', 'DECLINE']),
    queryParam('humanDecision').optional().isIn(['APPROVED', 'DECLINED', 'REQUEST_MORE_DOCS']),
    queryParam('startDate').optional().isISO8601(),
    queryParam('endDate').optional().isISO8601(),
    queryParam('page').optional().isInt({ min: 1 }),
    queryParam('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await auditService.getAuditHistory({
        search: req.query.search as string,
        status: req.query.status as string,
        recommendation: req.query.recommendation as string,
        humanDecision: req.query.humanDecision as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: parseInt(req.query.page as string || '1', 10),
        pageSize: parseInt(req.query.pageSize as string || '20', 10),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ------------------------------------------------------------------
// GET /api/v1/audit/:applicationId — Full audit record for one application
// ------------------------------------------------------------------
router.get(
  '/:applicationId',
  [param('applicationId').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid application ID format' });

      const record = await auditService.getFullAuditRecord(req.params.applicationId);
      if (!record) return next(createError('Application not found', 404));

      res.json(record);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
