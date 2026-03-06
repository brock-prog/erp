/**
 * QuickBooks Online — Level 1 CSV Export (Push-only, import via QBO "Import Data")
 *
 * Generates a QBO-compatible invoice CSV that users can import in:
 * QBO → Settings ⚙ → Import Data → Invoices
 *
 * Canadian tax codes recognized by QBO: HST, GST, PST, QST, OUT OF SCOPE
 */

import type { Invoice, Customer } from '../types';
import { getTaxRates } from './taxUtils';

// ─── QBO Tax Code Mapping ─────────────────────────────────────────────────────

function qboTaxCode(invoice: Invoice, customer: Customer | undefined): string {
  if (!customer || customer.taxExempt) return 'Exempt';

  const country = customer.billingAddress?.country ?? 'CA';
  if (country !== 'CA') return 'OUT OF SCOPE';

  const province = customer.billingAddress?.state ?? '';
  const rates = getTaxRates(country, province);

  if (rates.hstRate > 0) return 'HST';
  if (rates.qstRate > 0) return 'GST+QST';
  if (rates.pstRate > 0) return `GST+PST`;
  if (rates.gstRate > 0) return 'GST';
  return 'OUT OF SCOPE';
}

// ─── Row Builder ──────────────────────────────────────────────────────────────

function csvCell(value: string | number | undefined): string {
  const s = String(value ?? '');
  // Wrap in quotes if contains comma, newline, or quote
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

// ─── QBO Invoice CSV Export ───────────────────────────────────────────────────

export interface QBOExportResult {
  csv: string;
  filename: string;
  invoiceCount: number;
  lineCount: number;
}

export function exportInvoicesToQBO(
  invoices: Invoice[],
  customers: Customer[],
): QBOExportResult {
  const headers = [
    '*InvoiceNo',
    '*Customer',
    '*InvoiceDate',
    '*DueDate',
    'Terms',
    'Location',
    'Memo',
    '*ItemName',
    'ItemDescription',
    '*ItemQuantity',
    '*ItemRate',
    '*ItemTaxCode',
    '*ItemAmount',
    'Currency',
  ];

  const rows: string[] = [headers.join(',')];

  for (const inv of invoices) {
    const customer = customers.find(c => c.id === inv.customerId);
    const taxCode = qboTaxCode(inv, customer);
    const currency = customer?.currency ?? 'CAD';
    const terms = customer?.paymentTerms ?? 'Net 30';

    if (inv.lineItems.length === 0) {
      // Fallback: single row with total
      rows.push(csvRow([
        inv.invoiceNumber,
        inv.customerName,
        inv.issueDate,
        inv.dueDate,
        terms,
        '',
        inv.notes ?? '',
        'Services',
        `Invoice ${inv.invoiceNumber}`,
        1,
        inv.subtotal.toFixed(2),
        taxCode,
        inv.subtotal.toFixed(2),
        currency,
      ]));
    } else {
      inv.lineItems.forEach((item, idx) => {
        const itemAmt = item.amount ?? (item.unitPrice * item.quantity * (1 - (item.discount ?? 0) / 100));
        rows.push(csvRow([
          inv.invoiceNumber,
          inv.customerName,
          inv.issueDate,
          inv.dueDate,
          idx === 0 ? terms : '',         // Terms only on first line
          '',
          idx === 0 ? (inv.notes ?? '') : '',  // Memo only on first line
          (item as any).serviceType
            ? (item as any).serviceType.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
            : 'Services',
          item.description || `${inv.invoiceNumber} — line ${idx + 1}`,
          item.quantity,
          item.unitPrice.toFixed(2),
          taxCode,
          itemAmt.toFixed(2),
          currency,
        ]));
      });
    }
  }

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return {
    csv: rows.join('\n'),
    filename: `QBO_Invoices_${today}.csv`,
    invoiceCount: invoices.length,
    lineCount: rows.length - 1,
  };
}

// ─── Download Trigger ─────────────────────────────────────────────────────────

export function downloadCSV(result: QBOExportResult): void {
  const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
