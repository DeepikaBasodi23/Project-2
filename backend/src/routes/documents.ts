import { Router, Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import { query, queryOne, execute } from '../db/client';
import { normalizeRow, normalizeRows } from '../db/normalize';
import { Document } from '../types';
import upload from '../middleware/upload';
import { auditService } from '../services/auditService';
import { sanitizeInput } from '../utils/sanitize';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = Router({ mergeParams: true });

// POST /api/v1/applications/:id/documents
router.post('/', [param('id').isUUID()], upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid application ID' });

      const { id } = req.params;
      const { document_type } = req.body;
      if (!document_type) return res.status(400).json({ error: 'document_type is required' });

      const validTypes = ['GOVERNMENT_ID', 'INCOME_PROOF', 'BANK_STATEMENT', 'CREDIT_REPORT', 'OTHER'];
      if (!validTypes.includes(document_type)) return res.status(400).json({ error: 'Invalid document_type', validTypes });

      const appRow = await queryOne('SELECT id FROM applications WHERE id = ?', [id]);
      if (!appRow) return next(createError('Application not found', 404));

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

      const savedDocs: Document[] = [];
      for (const file of files) {
        if (sanitizeInput(file.originalname).injectionDetected) {
          logger.warn('Suspicious filename', { filename: file.originalname, applicationId: id });
        }
        const docId = uuidv4();
        await execute(
          `INSERT INTO documents (id, application_id, document_type, original_filename, stored_filename, file_size_bytes, mime_type)
           VALUES (?,?,?,?,?,?,?)`,
          [docId, id, document_type, file.originalname, file.filename, file.size, file.mimetype]
        );
        const rows = await query('SELECT * FROM documents WHERE id = ?', [docId]);
        savedDocs.push(normalizeRow<Document>(rows[0] as Record<string, unknown>));
      }

      await auditService.logEvent(id, 'DOCUMENTS_UPLOADED', req.ip || 'unknown', {
        documentType: document_type, fileCount: files.length,
        filenames: files.map((f) => f.originalname),
      });
      logger.info('Documents uploaded', { applicationId: id, count: files.length });
      return res.status(201).json({ message: `${savedDocs.length} document(s) uploaded`, documents: savedDocs });
    } catch (err) { return next(err); }
  }
);

// GET /api/v1/applications/:id/documents
router.get('/', [param('id').isUUID()], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query('SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at', [req.params.id]);
    res.json({ documents: normalizeRows(rows as Record<string, unknown>[]), count: rows.length });
  } catch (err) { next(err); }
});

// DELETE /api/v1/applications/:id/documents/:docId
router.delete('/:docId', [param('id').isUUID(), param('docId').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, docId } = req.params;
      const docRow = await queryOne('SELECT * FROM documents WHERE id = ? AND application_id = ?', [docId, id]);
      if (!docRow) return next(createError('Document not found', 404));
      const doc = normalizeRow<Document>(docRow as Record<string, unknown>);
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', doc.stored_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await execute('DELETE FROM documents WHERE id = ?', [docId]);
      await auditService.logEvent(id, 'DOCUMENT_DELETED', req.ip || 'unknown', {
        documentId: docId, documentType: doc.document_type, filename: doc.original_filename,
      });
      res.json({ message: 'Document deleted successfully' });
    } catch (err) { next(err); }
  }
);

export default router;
