// server/src/routes/backup.ts — Admin-only backup API endpoints
//
// GET  /api/backup/health     → backup scheduler health + disk usage
// GET  /api/backup/history    → list of backup files on disk
// POST /api/backup/trigger    → manually run a backup now
// GET  /api/backup/download/:fileName → download a specific backup file

import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireRole } from '../middleware/rbac';
import { config } from '../config';
import {
  getBackupHealth,
  getBackupHistory,
  getRecentResults,
  triggerManualBackup,
} from '../backup/backup-scheduler';

export const backupRouter = Router();

// All backup routes require admin role
backupRouter.use(requireRole('admin'));

// ─── GET /health — current backup health status ─────────────────────────────

backupRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const health = getBackupHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get backup health', detail: String(err) });
  }
});

// ─── GET /history — list backup files on disk ───────────────────────────────

backupRouter.get('/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const history = getBackupHistory(limit);
    res.json({ backups: history, total: history.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups', detail: String(err) });
  }
});

// ─── GET /results — recent backup run results (from memory) ─────────────────

backupRouter.get('/results', (_req: Request, res: Response) => {
  try {
    const results = getRecentResults();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get results', detail: String(err) });
  }
});

// ─── POST /trigger — manually run a backup now ──────────────────────────────

backupRouter.post('/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await triggerManualBackup();
    if (result.success) {
      res.json({
        message: 'Backup completed successfully',
        ...result,
      });
    } else {
      res.status(500).json({
        message: 'Backup failed',
        ...result,
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Backup trigger failed', detail: String(err) });
  }
});

// ─── GET /download/:fileName — download a specific backup file ──────────────

backupRouter.get('/download/:fileName', (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;

    // Security: only allow our backup file pattern (no path traversal)
    if (!/^decora-erp-server-backup-[\d\-T]+\.json$/.test(fileName)) {
      res.status(400).json({ error: 'Invalid backup file name' });
      return;
    }

    const dir = path.resolve(config.backup.dir);
    const filePath = path.join(dir, fileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Backup file not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Download failed', detail: String(err) });
  }
});
