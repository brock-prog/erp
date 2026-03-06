// server/src/backup/backup-service.ts — Core server-side backup, verify, and rotate logic
//
// Pulls all 22 Supabase JSONB tables → writes timestamped JSON to local disk.
// Each backup is verified (re-read, checksum, record count) before being considered valid.
// Rotation keeps the last N backups (configurable, default 120 = 30 days at 6h intervals).

import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

// ─── Table map (mirrors src/lib/db.ts TABLES) ──────────────────────────────

const SUPABASE_TABLES = {
  customers:             'decora_customers',
  jobs:                  'decora_jobs',
  quotes:                'decora_quotes',
  invoices:              'decora_invoices',
  inventoryItems:        'decora_inventory_items',
  inventoryTransactions: 'decora_inventory_transactions',
  incomingShipments:     'decora_incoming_shipments',
  pendingJobOrders:      'decora_pending_job_orders',
  savedParts:            'decora_saved_parts',
  processSessions:       'decora_process_sessions',
  employees:             'decora_employees',
  receipts:              'decora_receipts',
  shipments:             'decora_shipments',
  maintenanceSchedules:  'decora_maintenance_schedules',
  maintenanceTasks:      'decora_maintenance_tasks',
  crmOpportunities:      'decora_crm_opportunities',
  crmActivities:         'decora_crm_activities',
  jobOrders:             'decora_job_orders',
  costEntries:           'decora_cost_entries',
  scanEvents:            'decora_scan_events',
  ncrs:                  'decora_ncrs',
  qcInspections:         'decora_qc_inspections',
} as const;

type TableKey = keyof typeof SUPABASE_TABLES;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BackupManifest {
  version: string;
  software: string;
  createdAt: string;
  source: 'server-automated' | 'server-manual';
  recordCounts: Record<string, number>;
  totalRecords: number;
  sizeBytes: number;
  checksum: string;
  verified: boolean;
  verifiedAt: string | null;
}

export interface BackupResult {
  success: boolean;
  fileName: string | null;
  filePath: string | null;
  manifest: BackupManifest | null;
  error: string | null;
  durationMs: number;
}

export interface BackupFileInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  totalRecords: number;
  verified: boolean;
  source: string;
}

// ─── djb2 hash (matches client-side backup.ts) ─────────────────────────────

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

// ─── Supabase client (service role — bypasses RLS) ──────────────────────────

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  if (!config.supabase.isConfigured) return null;
  supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

// ─── Fetch all data from a single table ─────────────────────────────────────

async function fetchTable(client: SupabaseClient, tableName: string): Promise<unknown[]> {
  const { data, error } = await client
    .from(tableName)
    .select('data')
    .order('updated_at', { ascending: true });
  if (error) {
    console.warn(`[backup] Failed to read ${tableName}: ${error.message}`);
    return [];
  }
  return (data ?? []).map((row: { data: unknown }) => row.data);
}

// ─── Ensure backup directory exists ─────────────────────────────────────────

function ensureBackupDir(): string {
  const dir = path.resolve(config.backup.dir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[backup] Created backup directory: ${dir}`);
  }
  return dir;
}

// ─── Run a full backup ──────────────────────────────────────────────────────

export async function runBackup(
  source: 'server-automated' | 'server-manual' = 'server-automated'
): Promise<BackupResult> {
  const start = Date.now();

  const client = getSupabaseAdmin();
  if (!client) {
    return {
      success: false,
      fileName: null,
      filePath: null,
      manifest: null,
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      durationMs: Date.now() - start,
    };
  }

  try {
    // 1. Pull all tables in parallel
    const tableKeys = Object.keys(SUPABASE_TABLES) as TableKey[];
    const results = await Promise.allSettled(
      tableKeys.map(key => fetchTable(client, SUPABASE_TABLES[key]))
    );

    const state: Record<string, unknown[]> = {};
    const recordCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (let i = 0; i < tableKeys.length; i++) {
      const key = tableKeys[i];
      const result = results[i];
      const rows = result.status === 'fulfilled' ? result.value : [];
      state[key] = rows;
      recordCounts[key] = rows.length;
      totalRecords += rows.length;
    }

    // 2. Build payload
    const stateJson = JSON.stringify(state);
    const checksum = djb2(stateJson);

    const manifest: BackupManifest = {
      version: '2.0',
      software: 'DECORA ERP (Server Backup)',
      createdAt: new Date().toISOString(),
      source,
      recordCounts,
      totalRecords,
      sizeBytes: Buffer.byteLength(stateJson, 'utf-8'),
      checksum,
      verified: false,
      verifiedAt: null,
    };

    const payload = { manifest, state };
    const payloadJson = JSON.stringify(payload, null, 0); // compact — no pretty-print to save disk

    // 3. Write to disk
    const dir = ensureBackupDir();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `decora-erp-server-backup-${ts}.json`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, payloadJson, 'utf-8');

    // 4. Verify — re-read, parse, check checksum
    const verified = verifyBackup(filePath, checksum, totalRecords);
    manifest.verified = verified;
    manifest.verifiedAt = verified ? new Date().toISOString() : null;

    // Re-write with verified flag updated
    if (verified) {
      const verifiedPayload = { manifest, state };
      fs.writeFileSync(filePath, JSON.stringify(verifiedPayload, null, 0), 'utf-8');
    }

    const durationMs = Date.now() - start;
    console.log(
      `[backup] ${verified ? '✅' : '⚠️'} ${fileName} — ${totalRecords} records across ${tableKeys.length} tables — ${formatBytes(manifest.sizeBytes)} — ${durationMs}ms`
    );

    // 5. Rotate old backups
    rotateBackups(dir);

    return {
      success: true,
      fileName,
      filePath,
      manifest,
      error: null,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[backup] ❌ Backup failed: ${errorMsg}`);
    return {
      success: false,
      fileName: null,
      filePath: null,
      manifest: null,
      error: errorMsg,
      durationMs,
    };
  }
}

// ─── Verify a backup file ───────────────────────────────────────────────────

function verifyBackup(filePath: string, expectedChecksum: string, expectedRecords: number): boolean {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.manifest || !parsed.state) {
      console.warn('[backup] Verify: missing manifest or state');
      return false;
    }

    // Re-hash the state portion
    const stateJson = JSON.stringify(parsed.state);
    const actualChecksum = djb2(stateJson);

    if (actualChecksum !== expectedChecksum) {
      console.warn(`[backup] Verify: checksum mismatch (expected ${expectedChecksum}, got ${actualChecksum})`);
      return false;
    }

    // Check total records roughly match
    let total = 0;
    for (const key of Object.keys(parsed.state)) {
      if (Array.isArray(parsed.state[key])) {
        total += parsed.state[key].length;
      }
    }

    if (total !== expectedRecords) {
      console.warn(`[backup] Verify: record count mismatch (expected ${expectedRecords}, got ${total})`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`[backup] Verify failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ─── Rotate old backups ─────────────────────────────────────────────────────

function rotateBackups(dir: string): void {
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('decora-erp-server-backup-') && f.endsWith('.json'))
    .sort()
    .reverse(); // newest first

  const maxBackups = config.backup.maxBackups;
  if (files.length <= maxBackups) return;

  const toDelete = files.slice(maxBackups);
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, file));
      console.log(`[backup] 🗑  Rotated old backup: ${file}`);
    } catch (err) {
      console.warn(`[backup] Failed to delete ${file}: ${err}`);
    }
  }
}

// ─── List backups on disk ───────────────────────────────────────────────────

export function listBackups(): BackupFileInfo[] {
  const dir = path.resolve(config.backup.dir);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.startsWith('decora-erp-server-backup-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .map(fileName => {
      const filePath = path.join(dir, fileName);
      const stat = fs.statSync(filePath);

      // Try to read just the manifest (fast — seek first few KB)
      let totalRecords = 0;
      let verified = false;
      let source = 'unknown';
      let createdAt = stat.mtime.toISOString();

      try {
        // Read first 2KB — enough for the manifest header
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(2048);
        fs.readSync(fd, buf, 0, 2048, 0);
        fs.closeSync(fd);

        const partial = buf.toString('utf-8');
        // Extract totalRecords from manifest
        const trMatch = partial.match(/"totalRecords":(\d+)/);
        if (trMatch) totalRecords = parseInt(trMatch[1], 10);
        const vMatch = partial.match(/"verified":(true|false)/);
        if (vMatch) verified = vMatch[1] === 'true';
        const sMatch = partial.match(/"source":"([^"]+)"/);
        if (sMatch) source = sMatch[1];
        const cMatch = partial.match(/"createdAt":"([^"]+)"/);
        if (cMatch) createdAt = cMatch[1];
      } catch {
        // If we can't read the manifest, use file stats
      }

      return {
        fileName,
        filePath,
        sizeBytes: stat.size,
        createdAt,
        totalRecords,
        verified,
        source,
      };
    });
}

// ─── Get disk usage for backup directory ────────────────────────────────────

export function getBackupDiskUsage(): { totalBytes: number; fileCount: number } {
  const dir = path.resolve(config.backup.dir);
  if (!fs.existsSync(dir)) return { totalBytes: 0, fileCount: 0 };

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('decora-erp-server-backup-') && f.endsWith('.json'));

  let totalBytes = 0;
  for (const f of files) {
    try {
      totalBytes += fs.statSync(path.join(dir, f)).size;
    } catch { /* skip */ }
  }

  return { totalBytes, fileCount: files.length };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
