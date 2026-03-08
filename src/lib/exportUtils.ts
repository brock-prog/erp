/**
 * Universal Export Utility — CSV, Excel, PDF export for all modules
 *
 * Usage:
 *   import { exportToCSV, exportToExcel } from '../lib/exportUtils';
 *
 *   const columns = [
 *     { key: 'jobNumber', header: 'Job #' },
 *     { key: 'customerName', header: 'Customer' },
 *     { key: 'salePrice', header: 'Sale Price', format: (v) => formatCurrency(v) },
 *   ];
 *   exportToCSV(jobs, columns, 'jobs-export');
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportColumn<T> {
  /** Property key on the data object */
  key: keyof T & string;
  /** Column header label */
  header: string;
  /** Optional formatter — if not provided, raw value is used */
  format?: (value: any, row: T) => string;
}

export interface ExportOptions {
  /** Include timestamp in filename (default: true) */
  timestamp?: boolean;
  /** Sheet name for Excel export (default: 'Data') */
  sheetName?: string;
}

// ─── CSV Cell Escaping ───────────────────────────────────────────────────────

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Wrap in quotes if contains comma, newline, quote, or leading/trailing whitespace
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r') || s !== s.trim()) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ─── CSV Generation ──────────────────────────────────────────────────────────

export function generateCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
): string {
  const headerRow = columns.map(c => csvCell(c.header)).join(',');
  const dataRows = data.map(row =>
    columns.map(col => {
      const rawValue = row[col.key];
      const formatted = col.format ? col.format(rawValue, row) : rawValue;
      return csvCell(formatted as any);
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// ─── File Download Helper ────────────────────────────────────────────────────

export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;',
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Export to CSV (one-liner) ───────────────────────────────────────────────

export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filenameBase: string,
  options: ExportOptions = {},
): void {
  const { timestamp = true } = options;
  const datePart = timestamp ? `-${new Date().toISOString().split('T')[0]}` : '';
  const filename = `${filenameBase}${datePart}.csv`;
  const csv = '\uFEFF' + generateCSV(data, columns); // BOM for Excel UTF-8
  downloadFile(csv, filename);
}

// ─── Export to Excel (via SheetJS — lazy import) ─────────────────────────────
// SheetJS (xlsx) is an optional dependency. If not installed, falls back to CSV.

export async function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filenameBase: string,
  options: ExportOptions = {},
): Promise<void> {
  const { timestamp = true, sheetName = 'Data' } = options;
  const datePart = timestamp ? `-${new Date().toISOString().split('T')[0]}` : '';
  const filename = `${filenameBase}${datePart}.xlsx`;

  try {
    // Dynamic import — only loads SheetJS if installed
    const XLSX = await import('xlsx');

    // Build array-of-arrays for the sheet
    const aoa: (string | number | boolean | null)[][] = [];

    // Header row
    aoa.push(columns.map(c => c.header));

    // Data rows
    data.forEach(row => {
      aoa.push(columns.map(col => {
        const rawValue = row[col.key];
        if (col.format) return col.format(rawValue, row);
        if (rawValue === null || rawValue === undefined) return '';
        return rawValue as any;
      }));
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-size columns (rough estimate based on header + data width)
    const colWidths = columns.map((col, i) => {
      const headerLen = col.header.length;
      const maxDataLen = data.reduce((max, row) => {
        const val = col.format ? col.format(row[col.key], row) : String(row[col.key] ?? '');
        return Math.max(max, String(val).length);
      }, 0);
      return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 40) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
  } catch {
    // SheetJS not installed — fall back to CSV with .xlsx extension warning
    console.warn('xlsx package not installed, falling back to CSV export');
    exportToCSV(data, columns, filenameBase, options);
  }
}

// ─── Export Dropdown Options ─────────────────────────────────────────────────
// Helper for UI: returns the export format options available

export type ExportFormat = 'csv' | 'excel';

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'Export to CSV' },
  { value: 'excel', label: 'Export to Excel' },
];

export async function exportData<T>(
  format: ExportFormat,
  data: T[],
  columns: ExportColumn<T>[],
  filenameBase: string,
  options: ExportOptions = {},
): Promise<void> {
  if (format === 'excel') {
    await exportToExcel(data, columns, filenameBase, options);
  } else {
    exportToCSV(data, columns, filenameBase, options);
  }
}
