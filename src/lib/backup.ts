// src/lib/backup.ts
// Full-state backup and restore for DECORA ERP.
// Backups are encrypted-compatible JSON files; intended for download to external SSD.
// Security: all data stays client-side — no third-party upload, no telemetry.

export const BACKUP_VERSION = '1.0';
export const SOFTWARE_NAME  = 'DECORA ERP';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupManifest {
  version: '1.0';
  software: 'DECORA ERP';
  createdAt: string;           // ISO 8601
  createdBy: string;
  recordCounts: Record<string, number>;
  totalRecords: number;
  sizeEstimateBytes: number;
  checksum: string;            // simple djb2 hash of state JSON for integrity check
}

export interface BackupFile {
  manifest: BackupManifest;
  state: Record<string, unknown>;
}

export interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  sizeBytes: number;
  fileName: string;
  createdBy: string;
  totalRecords: number;
}

export interface BackupSettings {
  enabled: boolean;
  intervalHours: 1 | 6 | 24;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_KEY  = 'coatpro_backup_history';
const SETTINGS_KEY = 'coatpro_backup_settings';

/** State slices included in every backup (excludes transient UI/session data). */
const BACKUP_SLICES = [
  'customers', 'jobs', 'quotes', 'invoices', 'inventory',
  'inventoryTransactions', 'incomingShipments', 'pendingJobOrders',
  'savedParts', 'employees', 'receipts', 'shipments',
  'maintenanceSchedules', 'maintenanceTasks', 'crmOpportunities',
  'crmActivities', 'jobOrders', 'costEntries', 'ncrs',
  'qcInspections', 'ovenCureLogs', 'chemicalBathLogs',
  'certificates', 'reworkRecords', 'racks', 'batches',
  'customDropdowns', 'auditLog', 'users', 'processSessions',
  'spareParts', 'workInstructions', 'criticalSuppliers',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fast djb2 checksum — integrity check, not cryptographic. */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep 32-bit unsigned
  }
  return hash.toString(16).padStart(8, '0');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function estimateSize(obj: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(obj)).length; }
  catch { return 0; }
}

// ─── Core backup functions ────────────────────────────────────────────────────

/**
 * Build a BackupFile from the current app state.
 * Only includes persisted slices — not transient UI state.
 */
export function createBackupPayload(
  state: Record<string, unknown>,
  userName: string,
): BackupFile {
  const sliced: Record<string, unknown> = {};
  const counts: Record<string, number> = {};

  for (const key of BACKUP_SLICES) {
    const val = state[key];
    sliced[key] = val;
    counts[key] = Array.isArray(val) ? val.length : (val != null ? 1 : 0);
  }

  const stateJson = JSON.stringify(sliced);
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  const sizeEstimateBytes = estimateSize(sliced);

  return {
    manifest: {
      version: '1.0',
      software: 'DECORA ERP',
      createdAt: new Date().toISOString(),
      createdBy: userName,
      recordCounts: counts,
      totalRecords,
      sizeEstimateBytes,
      checksum: djb2(stateJson),
    },
    state: sliced,
  };
}

/**
 * Trigger a file download of the full backup, and record it in history.
 * Returns the history entry so callers can update their display.
 */
export function downloadBackup(
  state: Record<string, unknown>,
  userName: string,
): BackupHistoryEntry {
  const payload = createBackupPayload(state, userName);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `decora-erp-backup-${ts}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const entry: BackupHistoryEntry = {
    id: `bkp-${Date.now()}`,
    timestamp: new Date().toISOString(),
    sizeBytes: payload.manifest.sizeEstimateBytes,
    fileName,
    createdBy: userName,
    totalRecords: payload.manifest.totalRecords,
  };
  addToHistory(entry);
  return entry;
}

/**
 * Read and parse a backup .json file from a File input.
 * Throws a descriptive error if the file is invalid.
 */
export async function readBackupFile(file: File): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const data = JSON.parse(raw) as BackupFile;
        if (!data?.manifest?.version || !data?.state) {
          reject(new Error('Invalid backup file — missing manifest or state'));
          return;
        }
        if (data.manifest.software !== 'DECORA ERP') {
          reject(new Error('This backup was not created by DECORA ERP'));
          return;
        }
        // Checksum verification
        const stateJson = JSON.stringify(data.state);
        const actualChecksum = djb2(stateJson);
        if (data.manifest.checksum && data.manifest.checksum !== actualChecksum) {
          reject(new Error(`Checksum mismatch — backup file may be corrupted (expected ${data.manifest.checksum}, got ${actualChecksum})`));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error('Could not parse backup file: ' + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

// ─── Backup history (localStorage) ───────────────────────────────────────────

export function loadHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as BackupHistoryEntry[]) : [];
  } catch { return []; }
}

function addToHistory(entry: BackupHistoryEntry): void {
  const existing = loadHistory();
  const updated = [entry, ...existing].slice(0, 10);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
}

// ─── Backup settings (localStorage) ──────────────────────────────────────────

export function loadBackupSettings(): BackupSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as BackupSettings) : { enabled: false, intervalHours: 6 };
  } catch { return { enabled: false, intervalHours: 6 }; }
}

export function saveBackupSettings(s: BackupSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// ─── Session timeout settings (localStorage) ──────────────────────────────────

const TIMEOUT_KEY = 'coatpro_session_timeout_min';

export function loadSessionTimeout(): number {
  return parseInt(localStorage.getItem(TIMEOUT_KEY) ?? '0', 10) || 0;
}

export function saveSessionTimeout(minutes: number): void {
  localStorage.setItem(TIMEOUT_KEY, String(minutes));
}
