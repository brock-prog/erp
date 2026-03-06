// server/src/index.ts — Decora ERP API Server

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { authRouter } from './routes/auth';
import { stateRouter } from './routes/state';
import { usersRouter } from './routes/users';
import { adpRouter } from './routes/adp';
import { backupRouter } from './routes/backup';
import { requireAuth } from './middleware/auth';
import { setupSocket } from './socket';
import { prisma } from './db';
import { startBackupScheduler, stopBackupScheduler, getBackupHealth } from './backup/backup-scheduler';

const app = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: config.frontendUrl,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
setupSocket(io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.set('trust proxy', 1); // Trust nginx reverse proxy

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Handled by nginx
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Socket-Id'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting — strict on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    // Test DB connection
    await prisma.$queryRaw`SELECT 1`;
    const socketCount = (await io.in('default').fetchSockets()).length;
    const backupHealth = getBackupHealth();
    res.json({
      status: 'ok',
      db: 'connected',
      sockets: socketCount,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      backup: {
        schedulerRunning: backupHealth.schedulerRunning,
        lastRunStatus: backupHealth.lastRunStatus,
        lastRunAt: backupHealth.lastRunAt,
        consecutiveFailures: backupHealth.consecutiveFailures,
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: String(err) });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/state', requireAuth, stateRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/adp', requireAuth, adpRouter);
app.use('/api/backup', requireAuth, backupRouter);

// ─── 404 / Error handlers ─────────────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   🏭  Decora ERP API Server                   ║
║   Port:    ${config.port}                             ║
║   Mode:    ${config.nodeEnv.padEnd(10)}                    ║
║   ADP:     ${config.adp.isConfigured ? '✅ Configured       ' : '⚠️  Demo mode        '}        ║
║   Backup:  ${config.backup.enabled ? '✅ ' + config.backup.cronSchedule.padEnd(17) : '⚠️  Disabled         '}        ║
╚═══════════════════════════════════════════════╝
  `);

  // Start automated backup scheduler
  startBackupScheduler();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopBackupScheduler();
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});
