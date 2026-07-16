import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { testConnection } from './db/client';
import { runMigration, ensureDefaultPolicy } from './db/migrate';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Route imports
import applicationsRouter from './routes/applications';
import documentsRouter from './routes/documents';
import decisionsRouter from './routes/decisions';
import auditRouter from './routes/audit';
import policyRouter from './routes/policy';

const app = express();

// ------------------------------------------------------------------
// Security & request parsing middleware
// ------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(config.isDevelopment ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ------------------------------------------------------------------
// Health check
// ------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ------------------------------------------------------------------
// API Routes
// ------------------------------------------------------------------
const API = '/api/v1';
app.use(`${API}/applications`, applicationsRouter);
app.use(`${API}/applications/:id/documents`, documentsRouter);
app.use(`${API}/applications/:id/decisions`, decisionsRouter);
app.use(`${API}/audit`, auditRouter);
app.use(`${API}/policy`, policyRouter);

// ------------------------------------------------------------------
// Error handling
// ------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// ------------------------------------------------------------------
// Start server
// ------------------------------------------------------------------
async function start(): Promise<void> {
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error('Cannot connect to database. Exiting.');
    process.exit(1);
  }

  // Auto-migrate on every boot — all statements use IF NOT EXISTS, safe to repeat
  await runMigration();

  // Seed default policy if none exists
  await ensureDefaultPolicy();

  app.listen(config.port, () => {
    logger.info(`Loan Processing Agent backend running on port ${config.port}`, {
      env: config.nodeEnv,
      port: config.port,
    });
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: (err as Error).message });
  process.exit(1);
});

export default app;
