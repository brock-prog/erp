// server/src/backup/backup-scheduler.ts — Cron-based backup scheduling with health tracking
//
// Runs a full Supabase → local disk backup on a configurable schedule (default: every 6 hours).
// Fires one immediate backup on server startup so we don't wait 6h after a restart.
// Tracks health state (last run, failures, history) for the API to expose.

import cron from 'node-cron';
import { config } from '../config';
import { runBackup, listBackups, getBackupDiskUsage, type BackupResult } from './backup-service';

// ─── Health state (in-memory, reset on server restart) ──────────────────────

interface BackupHealth {
  schedulerRunning: boolean;
  cronSchedule: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | 'never';
  lastError: string | null;
  consecutiveFailures: number;
  totalRunsSinceStart: number;
  serverStartedAt: string;
}

const health: BackupHealth = {
  schedulerRunning: false,
  cronSchedule: config.backup.cronSchedule,
  lastRunAt: null,
  lastRunStatus: 'never',
  lastError: null,
  consecutiveFailures: 0,
  totalRunsSinceStart: 0,
  serverStartedAt: new Date().toISOString(),
};

// Recent results (kept in memory for quick API access)
const recentResults: BackupResult[] = [];
const MAX_RECENT = 20;

// ─── Run backup and update health ───────────────────────────────────────────

async function executeBackup(source: 'server-automated' | 'server-manual' = 'server-automated'): Promise<BackupResult> {
  const result = await runBackup(source);

  health.lastRunAt = new Date().toISOString();
  health.totalRunsSinceStart++;

  if (result.success) {
    health.lastRunStatus = 'success';
    health.lastError = null;
    health.consecutiveFailures = 0;
  } else {
    health.lastRunStatus = 'failed';
    health.lastError = result.error;
    health.consecutiveFailures++;

    // Log loud warning on repeated failures
    if (health.consecutiveFailures >= 3) {
      console.error(
        `[backup] ⚠️  ${health.consecutiveFailures} consecutive backup failures! Last error: ${result.error}`
      );
    }
  }

  // Push to recent results ring buffer
  recentResults.unshift(result);
  if (recentResults.length > MAX_RECENT) recentResults.pop();

  return result;
}

// ─── Start the scheduler ────────────────────────────────────────────────────

let scheduledTask: cron.ScheduledTask | null = null;

export function startBackupScheduler(): void {
  if (!config.backup.enabled) {
    console.log('[backup] Scheduler disabled (BACKUP_ENABLED=false)');
    return;
  }

  if (!config.supabase.isConfigured) {
    console.log('[backup] Scheduler skipped — Supabase not configured');
    return;
  }

  const schedule = config.backup.cronSchedule;

  if (!cron.validate(schedule)) {
    console.error(`[backup] Invalid cron schedule: "${schedule}". Scheduler not started.`);
    return;
  }

  // Schedule recurring backups
  scheduledTask = cron.schedule(schedule, () => {
    console.log('[backup] Scheduled backup triggered');
    executeBackup('server-automated').catch(err => {
      console.error('[backup] Unhandled error in scheduled backup:', err);
    });
  });

  health.schedulerRunning = true;
  health.cronSchedule = schedule;

  console.log(`[backup] ✅ Scheduler started — running "${schedule}"`);

  // Fire one immediate backup on startup (delayed 5s to let server fully start)
  setTimeout(() => {
    console.log('[backup] Running initial startup backup...');
    executeBackup('server-automated').catch(err => {
      console.error('[backup] Startup backup error:', err);
    });
  }, 5_000);
}

// ─── Stop the scheduler ─────────────────────────────────────────────────────

export function stopBackupScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    health.schedulerRunning = false;
    console.log('[backup] Scheduler stopped');
  }
}

// ─── Manual trigger (from API) ──────────────────────────────────────────────

export async function triggerManualBackup(): Promise<BackupResult> {
  console.log('[backup] Manual backup triggered via API');
  return executeBackup('server-manual');
}

// ─── Health / status getters ────────────────────────────────────────────────

export function getBackupHealth() {
  const disk = getBackupDiskUsage();
  const backups = listBackups();
  const latestBackup = backups[0] ?? null;

  return {
    ...health,
    disk,
    latestBackup,
    backupCount: backups.length,
    maxBackups: config.backup.maxBackups,
  };
}

export function getBackupHistory(limit = 20) {
  return listBackups().slice(0, limit);
}

export function getRecentResults() {
  return recentResults;
}
