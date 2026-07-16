import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { policyEngine } from '../services/policyEngine';
import { createError } from '../middleware/errorHandler';
import { PolicyRules } from '../types';

const router = Router();

// GET /api/v1/policy/versions — List all policy versions
router.get('/versions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await policyEngine.listVersions();
    res.json({ versions, count: versions.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/policy/versions/active — Get currently active version
router.get('/versions/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await policyEngine.getActivePolicy();
    res.json(version);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/policy/versions/:id — Get a specific version
router.get(
  '/versions/:id',
  [param('id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID format' });

      const version = await policyEngine.getPolicyById(req.params.id);
      if (!version) return next(createError('Policy version not found', 404));
      res.json(version);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/policy/versions — Create new policy version
router.post(
  '/versions',
  [
    body('version').trim().notEmpty().withMessage('Version string is required'),
    body('description').optional().trim().isString(),
    body('rules').isObject().withMessage('Rules object is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array() });
      }
      const { version, description, rules } = req.body as {
        version: string;
        description: string;
        rules: PolicyRules;
      };
      const created = await policyEngine.createVersion(version, description, rules);
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/v1/policy/versions/:id/activate — Activate a version
router.put(
  '/versions/:id/activate',
  [param('id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid ID format' });

      const activated = await policyEngine.activateVersion(req.params.id);
      res.json({ message: 'Policy version activated', version: activated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
