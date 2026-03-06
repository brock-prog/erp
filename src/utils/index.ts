import { format, parseISO, differenceInDays } from 'date-fns';
import type { JobStatus, SubJobStatus, Priority, InvoiceStatus, QuoteStatus } from '../types';
import { clsx } from 'clsx';
export { clsx };

export function formatCurrency(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
}

export function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return dateStr; }
}

export function formatDateTime(dateStr: string): string {
  try { return format(parseISO(dateStr), 'MMM d, yyyy h:mm a'); } catch { return dateStr; }
}

export function daysUntil(dateStr: string): number {
  try { return differenceInDays(parseISO(dateStr), new Date()); } catch { return 0; }
}

export function isOverdue(dateStr: string, status?: string): boolean {
  if (status === 'complete' || status === 'cancelled') return false;
  return daysUntil(dateStr) < 0;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function generateJobNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .filter(n => n.startsWith(`WO-${year}`))
    .map(n => parseInt(n.split('-')[2] || '0', 10));
  const next = Math.max(0, ...nums) + 1;
  return `WO-${year}-${String(next).padStart(4, '0')}`;
}

export function generateQuoteNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .filter(n => n.startsWith(`Q-${year}`))
    .map(n => parseInt(n.split('-')[2] || '0', 10));
  const next = Math.max(0, ...nums) + 1;
  return `Q-${year}-${String(next).padStart(4, '0')}`;
}

export function generateInvoiceNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .filter(n => n.startsWith(`INV-${year}`))
    .map(n => parseInt(n.split('-')[2] || '0', 10));
  const next = Math.max(0, ...nums) + 1;
  return `INV-${year}-${String(next).padStart(4, '0')}`;
}

// ─── Status labels & colors ───────────────────────────────────────────────────

const JOB_STATUS_CONFIG: Record<JobStatus, { label: string; color: string }> = {
  quote:     { label: 'Quote',       color: 'bg-gray-100 text-gray-700' },
  received:  { label: 'Received',    color: 'bg-blue-100 text-blue-700' },
  prep:      { label: 'Prep',        color: 'bg-yellow-100 text-yellow-800' },
  blast:     { label: 'Blasting',    color: 'bg-orange-100 text-orange-700' },
  rack:      { label: 'Racking',     color: 'bg-violet-100 text-violet-700' },
  pretreat:  { label: 'Pretreat',    color: 'bg-cyan-100 text-cyan-700' },
  coat:      { label: 'Coating',     color: 'bg-indigo-100 text-indigo-700' },
  cure:      { label: 'Curing',      color: 'bg-red-100 text-red-700' },
  qc:        { label: 'QC',          color: 'bg-amber-100 text-amber-700' },
  unrack:                { label: 'Unracking',          color: 'bg-teal-100 text-teal-700' },
  awaiting_sublimation:  { label: 'Awaiting Sub.',       color: 'bg-cyan-100 text-cyan-700' },
  shipping:              { label: 'Shipping',            color: 'bg-emerald-100 text-emerald-700' },
  complete:              { label: 'Complete',            color: 'bg-green-100 text-green-700' },
  on_hold:               { label: 'On Hold',             color: 'bg-gray-100 text-gray-600' },
  cancelled:             { label: 'Cancelled',           color: 'bg-red-50 text-red-400' },
};

const SUB_STATUS_CONFIG: Record<SubJobStatus, { label: string; color: string }> = {
  queued:    { label: 'Queued',      color: 'bg-gray-100 text-gray-700' },
  design:    { label: 'Design',      color: 'bg-purple-100 text-purple-700' },
  printing:  { label: 'Printing',    color: 'bg-blue-100 text-blue-700' },
  pressing:  { label: 'Pressing',    color: 'bg-orange-100 text-orange-700' },
  qc:        { label: 'QC',          color: 'bg-amber-100 text-amber-700' },
  packaging: { label: 'Packaging',   color: 'bg-teal-100 text-teal-700' },
  complete:  { label: 'Complete',    color: 'bg-green-100 text-green-700' },
  on_hold:   { label: 'On Hold',     color: 'bg-gray-100 text-gray-600' },
};

export function jobStatusConfig(status: JobStatus): { label: string; color: string } {
  return JOB_STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' };
}

export function subStatusConfig(status: SubJobStatus): { label: string; color: string } {
  return SUB_STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' };
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-gray-500', dot: 'bg-gray-400' },
  normal: { label: 'Normal', color: 'text-blue-600', dot: 'bg-blue-500' },
  high:   { label: 'High',   color: 'text-orange-600', dot: 'bg-orange-500' },
  rush:   { label: 'RUSH',   color: 'text-red-600', dot: 'bg-red-500' },
};

export function priorityConfig(priority: Priority) {
  return PRIORITY_CONFIG[priority];
}

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  partial:  { label: 'Partial',  color: 'bg-yellow-100 text-yellow-700' },
  paid:     { label: 'Paid',     color: 'bg-green-100 text-green-700' },
  overdue:  { label: 'Overdue',  color: 'bg-red-100 text-red-700' },
  void:     { label: 'Void',     color: 'bg-gray-100 text-gray-400' },
  writeoff: { label: 'Write-off', color: 'bg-gray-100 text-gray-400' },
};

export function invoiceStatusConfig(status: InvoiceStatus) {
  return INVOICE_STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
}

const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  expired:   { label: 'Expired',   color: 'bg-orange-100 text-orange-700' },
  converted: { label: 'Converted', color: 'bg-purple-100 text-purple-700' },
};

export function quoteStatusConfig(status: QuoteStatus) {
  return QUOTE_STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
}

export function serviceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    powder_coating: 'Powder Coating',
    sublimation: 'Sublimation',
    both: 'PC + Sublimation',
    other: 'Other',
  };
  return map[type] ?? type;
}

export function inventoryCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    powder: 'Powder',
    chemical: 'Chemical',
    sublimation_ink: 'Sub. Ink',
    transfer_paper: 'Transfer Paper',
    substrate: 'Substrate',
    packaging: 'Packaging',
    consumable: 'Consumable',
    equipment_part: 'Equipment Part',
  };
  return map[cat] ?? cat;
}

export function calcLineItemTotal(qty: number, price: number, discount: number): number {
  return qty * price * (1 - discount / 100);
}

export function sumLineItems(items: { quantity: number; unitPrice: number; discount: number }[]): number {
  return items.reduce((s, i) => s + calcLineItemTotal(i.quantity, i.unitPrice, i.discount), 0);
}
