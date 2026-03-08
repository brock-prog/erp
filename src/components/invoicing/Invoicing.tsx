import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, DollarSign, Clock, CheckCircle, AlertTriangle, Receipt, CreditCard, Download, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { formatCurrency, formatDate, invoiceStatusConfig, generateId, generateInvoiceNumber, clsx } from '../../utils';
import { exportInvoicesToQBO, downloadCSV } from '../../utils/qbExport';
import { exportToCSV, type ExportColumn } from '../../lib/exportUtils';
import type { Invoice, InvoiceLineItem, InvoiceStatus, Payment } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const INVOICING_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '✅', label: 'Job Marked Complete',
    description: 'When a job status is set to "complete", a draft invoice is created automatically.' },
  { type: 'action', icon: '📋', label: 'Review Invoice',
    description: 'Check line items, sale price, tax rate, and due date. Adjust as needed.' },
  { type: 'action', icon: '📧', label: 'Send to Customer',
    description: 'Email the invoice or make it available in the Customer Portal for review.' },
  { type: 'decision', icon: '💳', label: 'Payment Received?',
    branches: [
      { label: '✓ Full Payment', color: 'green',
        steps: [{ label: 'Mark invoice Paid' }, { label: 'AR balance updated' }]},
      { label: '⏳ Partial / Late', color: 'amber',
        steps: [{ label: 'Record partial payment' }, { label: 'Balance tracked as outstanding AR' }]},
      { label: '⚠ Overdue', color: 'red',
        steps: [{ label: 'Alert triggered on Dashboard' }, { label: 'Follow up with customer' }]},
    ]},
  { type: 'action', icon: '📤', label: 'Export to Accounting',
    description: 'Export invoices to QBO format or CSV for import into QuickBooks or other accounting software.' },
  { type: 'end', icon: '💰', label: 'Revenue Recorded',
    description: 'Paid invoices are reflected in revenue totals on the Dashboard and Reports.' },
];

const INVOICING_TOUR: TourStep[] = [
  { selector: '[data-tour="inv-stats"]', title: 'AR & Revenue Stats',
    why: 'Outstanding AR, overdue amounts, monthly collections, and uninvoiced jobs — your billing health at a glance.',
    what: 'Red "Overdue" means customers owe past-due money. "Uninvoiced" means completed jobs without a bill.' },
  { selector: '[data-tour="inv-qb"]', title: 'QuickBooks Export',
    why: 'Export invoices as CSV to import into QuickBooks Online — keeps accounting in sync.',
    what: 'Click "Download" to get a CSV. Follow the QBO import path shown to upload it.' },
  { selector: '[data-tour="inv-filters"]', title: 'Filter & Search',
    why: 'Find invoices by status, customer, or number to manage AR efficiently.',
    what: 'Click a status chip to filter. Use search for specific invoices.' },
  { selector: '[data-tour="inv-table"]', title: 'Invoice List',
    why: 'Every invoice with customer, amount, status, due date, and balance in one table.',
    what: 'Click a row to expand. Use "Record Payment" to log partial or full payments.' },
];

function InvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [customerId, setCustomerId] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState(6);
  const [notes, setNotes] = useState('');
  const [extraItems, setExtraItems] = useState<InvoiceLineItem[]>([]);

  const customer = state.customers.find(c => c.id === customerId);
  const completedJobs = state.jobs.filter(j =>
    j.status === 'complete' && !j.invoiceId && (!customerId || j.customerId === customerId)
  );

  function toggleJob(id: string) {
    setSelectedJobIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const jobLineItems: InvoiceLineItem[] = selectedJobIds.map(jid => {
    const job = state.jobs.find(j => j.id === jid)!;
    return {
      id: generateId(), description: `${job.jobNumber} — ${job.parts.map(p => p.description).join(', ')}`,
      quantity: 1, unit: 'job', unitPrice: job.salePrice, discount: 0,
      amount: job.salePrice, jobId: job.id, jobNumber: job.jobNumber,
    };
  });

  const allItems = [...jobLineItems, ...extraItems];
  const subtotal = allItems.reduce((s, i) => s + i.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  function addExtraLine() {
    setExtraItems(prev => [...prev, { id: generateId(), description: '', quantity: 1, unit: 'ea', unitPrice: 0, discount: 0, amount: 0 }]);
  }

  function updateExtra(id: string, field: keyof InvoiceLineItem, value: unknown) {
    setExtraItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
        updated.amount = updated.quantity * updated.unitPrice * (1 - updated.discount / 100);
      }
      return updated;
    }));
  }

  function handleSave() {
    const now = new Date().toISOString().split('T')[0];
    const invoice: Invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(state.invoices.map(i => i.invoiceNumber)),
      customerId,
      customerName: customer?.name ?? '',
      jobIds: selectedJobIds,
      status: 'draft',
      issueDate: now,
      dueDate: dueDate || now,
      lineItems: allItems,
      subtotal,
      discountAmount: 0,
      taxRate,
      taxAmount,
      total,
      amountPaid: 0,
      balance: total,
      payments: [],
      notes,
      createdBy: state.currentUser.name,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_INVOICE', payload: invoice });
    // Mark jobs as invoiced
    selectedJobIds.forEach(jid => {
      const job = state.jobs.find(j => j.id === jid);
      if (job) dispatch({ type: 'UPDATE_JOB', payload: { ...job, invoiceId: invoice.id } });
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Invoice" size="2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!customerId || (selectedJobIds.length === 0 && extraItems.length === 0)}>Create Invoice</Button></>}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <Select label="Customer *" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Select customer...</option>
            {state.customers.filter(c=>c.status==='active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <Input label="Tax Rate (%)" type="number" step="0.25" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
        </div>

        {/* Select completed jobs */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Select Completed Jobs</div>
          <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
            {completedJobs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No uninvoiced completed jobs for this customer</p>}
            {completedJobs.map(job => (
              <label key={job.id} className={clsx('flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors', selectedJobIds.includes(job.id) ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50')}>
                <input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => toggleJob(job.id)} className="rounded" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-800">{job.jobNumber} — {job.customerName}</div>
                  <div className="text-xs text-gray-500">{job.parts.map(p=>p.description).join(', ')}</div>
                </div>
                <span className="text-xs font-bold text-green-700">{formatCurrency(job.salePrice)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Extra line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Additional Charges</span>
            <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={addExtraLine}>Add Line</Button>
          </div>
          {extraItems.map(item => (
            <div key={item.id} className="grid grid-cols-6 gap-2 mb-2 items-end">
              <input value={item.description} onChange={e => updateExtra(item.id, 'description', e.target.value)}
                placeholder="Description..." className="col-span-3 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <input type="number" value={item.quantity} onChange={e => updateExtra(item.id, 'quantity', Number(e.target.value))}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <input type="number" step="0.01" value={item.unitPrice} onChange={e => updateExtra(item.id, 'unitPrice', Number(e.target.value))}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <div className="text-xs font-bold text-right py-1.5">{formatCurrency(item.amount)}</div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-brand-700">{formatCurrency(total)}</span></div>
        </div>

        <Textarea label="Notes / Terms" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

function PaymentModal({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const { dispatch, state } = useApp();
  const [amount, setAmount] = useState(invoice.balance);
  const [method, setMethod] = useState<Payment['method']>('check');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');

  function handleSave() {
    const now = new Date().toISOString().split('T')[0];
    const payment: Payment = {
      id: generateId(), invoiceId: invoice.id, amount, method,
      referenceNumber: ref, receivedDate: now,
      postedBy: state.currentUser.name, notes,
      createdAt: new Date().toISOString(),
    };
    const newPaid = invoice.amountPaid + amount;
    const newBalance = invoice.total - newPaid;
    const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : invoice.status;
    dispatch({ type: 'UPDATE_INVOICE', payload: {
      ...invoice,
      amountPaid: newPaid, balance: Math.max(0, newBalance),
      status: newStatus,
      paidDate: newBalance <= 0 ? now : invoice.paidDate,
      payments: [...invoice.payments, payment],
      updatedAt: now,
    }});
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Record Payment — ${invoice.invoiceNumber}`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>Record Payment</Button></>}>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Invoice Total</span><span className="font-semibold">{formatCurrency(invoice.total)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Paid to Date</span><span className="text-green-600 font-semibold">{formatCurrency(invoice.amountPaid)}</span></div>
          <div className="flex justify-between border-t pt-1"><span className="text-gray-500">Balance Due</span><span className="font-bold text-red-600">{formatCurrency(invoice.balance)}</span></div>
        </div>
        <Input label="Payment Amount ($)" type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        <Select label="Payment Method" value={method} onChange={e => setMethod(e.target.value as Payment['method'])}>
          <option value="check">Check</option><option value="ach">ACH</option>
          <option value="credit_card">Credit Card</option><option value="cash">Cash</option>
          <option value="wire">Wire Transfer</option><option value="other">Other</option>
        </Select>
        <Input label="Reference # (Check #, Transaction ID)" value={ref} onChange={e => setRef(e.target.value)} />
        <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

export function Invoicing() {
  const { state, dispatch, can } = useApp();
  const [params] = useSearchParams();
  const [showNew, setShowNew] = useState(params.get('new') === '1');
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [qbExporting, setQbExporting] = useState(false);
  const [qbResult, setQbResult] = useState<{ invoiceCount: number; lineCount: number; filename: string } | null>(null);

  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, [params]);

  function handleQBOExport() {
    const toExport = statusFilter === 'all'
      ? state.invoices
      : state.invoices.filter(i => i.status === statusFilter);
    const result = exportInvoicesToQBO(toExport, state.customers);
    downloadCSV(result);
    setQbResult({ invoiceCount: result.invoiceCount, lineCount: result.lineCount, filename: result.filename });
    setTimeout(() => setQbResult(null), 6000);
  }

  const filtered = state.invoices.filter(i =>
    statusFilter === 'all' || i.status === statusFilter
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalOutstanding = state.invoices.filter(i => ['sent','partial','overdue'].includes(i.status)).reduce((s,i) => s+i.balance, 0);
  const totalOverdue = state.invoices.filter(i => i.status === 'overdue').reduce((s,i) => s+i.balance, 0);
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const paidThisMonth = state.invoices.filter(i => i.status === 'paid' && i.paidDate?.startsWith(currentYearMonth)).reduce((s,i) => s+i.total, 0);
  const uninvoicedJobs = state.jobs.filter(j => j.status === 'complete' && !j.invoiceId).length;

  return (
    <div className="space-y-5">
      <InvoiceModal open={showNew} onClose={() => setShowNew(false)} />
      {payInvoice && <PaymentModal invoice={payInvoice} open={!!payInvoice} onClose={() => setPayInvoice(null)} />}

      {/* Page header */}
      <div className="flex items-center gap-2">
        <Receipt size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Invoicing</h1>
        <WorkflowHelp title="Invoicing Workflow" description="From completed job to payment received and revenue recorded." steps={INVOICING_WORKFLOW} />
        <GuidedTourButton steps={INVOICING_TOUR} />
      </div>
      {/* Stats */}
      <div data-tour="inv-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-blue-500" /><span className="text-xs text-gray-500">Outstanding AR</span></div><div className="text-2xl font-bold text-blue-700">{formatCurrency(totalOutstanding)}</div></Card>
        <Card><div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} className="text-red-500" /><span className="text-xs text-gray-500">Overdue</span></div><div className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</div></Card>
        <Card><div className="flex items-center gap-2 mb-1"><CheckCircle size={14} className="text-green-500" /><span className="text-xs text-gray-500">Collected (Feb)</span></div><div className="text-2xl font-bold text-green-700">{formatCurrency(paidThisMonth)}</div></Card>
        <Card><div className="flex items-center gap-2 mb-1"><Receipt size={14} className="text-amber-500" /><span className="text-xs text-gray-500">Uninvoiced Jobs</span></div><div className={`text-2xl font-bold ${uninvoicedJobs > 0 ? 'text-amber-600' : 'text-green-700'}`}>{uninvoicedJobs}</div></Card>
      </div>

      {/* Alert for uninvoiced jobs */}
      {uninvoicedJobs > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={17} className="text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-800"><span className="font-semibold">{uninvoicedJobs} completed job{uninvoicedJobs>1?'s':''}</span> have not been invoiced yet.</span>
          {can(2) && <Button size="sm" onClick={() => setShowNew(true)} className="ml-auto">Create Invoice</Button>}
        </div>
      )}

      {/* QuickBooks Export Banner */}
      <div data-tour="inv-qb" className="bg-gradient-to-r from-[#2CA01C]/10 to-emerald-50 border border-[#2CA01C]/25 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          {/* QBO logo approximation */}
          <div className="w-8 h-8 rounded-lg bg-[#2CA01C] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-xs">QB</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">QuickBooks Online Export</div>
            <div className="text-xs text-gray-500">Download CSV → Import in QBO: Settings ⚙ → Import Data → Invoices</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {qbResult && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 font-medium">
              ✓ {qbResult.invoiceCount} invoices exported ({qbResult.filename})
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleQBOExport}
          >
            Export {statusFilter !== 'all' ? `"${statusFilter}"` : 'All'} to QBO
          </Button>
          <a
            href="https://app.qbo.intuit.com/app/importdataentries"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#2CA01C] hover:underline font-medium"
          >
            Open QBO <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="inv-filters" className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 flex-wrap">
          {['all','draft','sent','partial','paid','overdue','void'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              const cols: ExportColumn<Invoice>[] = [
                { key: 'invoiceNumber', header: 'Invoice #' },
                { key: 'customerName', header: 'Customer' },
                { key: 'issueDate', header: 'Issue Date', format: v => formatDate(v) },
                { key: 'dueDate', header: 'Due Date', format: v => formatDate(v) },
                { key: 'subtotal', header: 'Subtotal', format: v => formatCurrency(v) },
                { key: 'taxAmount', header: 'Tax', format: v => formatCurrency(v) },
                { key: 'total', header: 'Total', format: v => formatCurrency(v) },
                { key: 'amountPaid', header: 'Paid', format: v => formatCurrency(v) },
                { key: 'balance', header: 'Balance', format: v => formatCurrency(v) },
                { key: 'status', header: 'Status' },
              ];
              exportToCSV(filtered, cols, 'invoices-export');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
          >
            <Download size={13} />Export
          </button>
          {can(2)
            ? <Button icon={<Plus size={14} />} onClick={() => setShowNew(true)}>New Invoice</Button>
            : <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">View Only</span>
          }
        </div>
      </div>

      {/* Invoice table */}
      <Card padding={false} data-tour="inv-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Invoice #','Customer','Status','Issued','Due','Total','Paid','Balance','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(inv => {
              const sc = invoiceStatusConfig(inv.status);
              return (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{inv.customerName}</td>
                  <td className="px-4 py-3"><Badge className={sc.color}>{sc.label}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">{formatCurrency(inv.amountPaid)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${inv.balance > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{formatCurrency(inv.balance)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => dispatch({ type: 'UPDATE_INVOICE', payload: { ...inv, status: 'sent', sentDate: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString().split('T')[0] } })}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                        >
                          Mark Sent
                        </button>
                      )}
                      {['sent','partial'].includes(inv.status) && (
                        <button onClick={() => setPayInvoice(inv)} className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors">
                          <CreditCard size={12} /> Record Payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
