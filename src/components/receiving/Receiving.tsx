/**
 * Receiving.tsx
 * Three-tab receiving hub:
 *  1. Receiving Calendar  — 7-day rolling board, receipts by expected/received date
 *  2. Expected Deliveries — admin PO / advance-delivery entry + today's briefing
 *  3. All Receipts        — existing full receipt list
 */

import React, { useState, useMemo } from 'react';
import {
  PackageOpen, AlertTriangle, CheckCircle, Clock, Plus, X, Printer,
  Calendar, ArrowLeft, ArrowRight, Truck, ChevronDown, ChevronUp,
  Hash, Package, ArrowDown, Edit2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { StatCard } from '../ui/StatCard';
import { formatDate, formatCurrency, generateId, clsx } from '../../utils';
import type { Receipt, ReceiptStatus, ReceiptType, ReceiptItem, BarcodeLabel } from '../../types';
import { PhotoCapture } from '../ui/PhotoCapture';
import { LabelPrintModal } from '../../barcode/LabelPrintModal';
import { buildReceiptLabel } from '../../barcode/BarcodeUtils';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';

const RECEIVING_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🚚', label: 'Delivery Expected',
    description: 'Create an expected delivery entry (PO number, supplier, ETA) so the team knows what is coming.' },
  { type: 'action', icon: '📅', label: 'Monitor Delivery Calendar',
    description: 'Check the 7-day rolling calendar to see upcoming arrivals and plan dock space.' },
  { type: 'action', icon: '📦', label: 'Receive the Delivery',
    description: 'When goods arrive, click "Receive" — enter items, quantities, and condition.' },
  { type: 'decision', icon: '🔎', label: 'Discrepancy Found?',
    branches: [
      { label: '✓ All Good', color: 'green',
        steps: [{ label: 'Confirm receipt' }, { label: 'Inventory QOH updated automatically' }]},
      { label: '⚠ Discrepancy', color: 'red',
        steps: [{ label: 'Flag issue with notes + photos' }, { label: 'Notify purchasing / supplier' }]},
    ]},
  { type: 'action', icon: '🏷️', label: 'Print Receipt Label',
    description: 'Generate and print a barcode label for the received items for inventory tracking.' },
  { type: 'end', icon: '✅', label: 'Stock Updated',
    description: 'Inventory quantities on hand are updated and visible in the Inventory module.' },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReceiptStatus, { label: string; color: string; calBg: string; calBorder: string }> = {
  expected:    { label: 'Expected',     color: 'bg-blue-100 text-blue-800',    calBg: 'bg-blue-50',    calBorder: 'border-blue-200' },
  received:    { label: 'Received',     color: 'bg-yellow-100 text-yellow-800', calBg: 'bg-yellow-50',  calBorder: 'border-yellow-200' },
  inspecting:  { label: 'Inspecting',   color: 'bg-purple-100 text-purple-800', calBg: 'bg-purple-50',  calBorder: 'border-purple-200' },
  accepted:    { label: 'Accepted',     color: 'bg-green-100 text-green-800',   calBg: 'bg-green-50',   calBorder: 'border-green-200' },
  discrepancy: { label: 'Discrepancy',  color: 'bg-orange-100 text-orange-800', calBg: 'bg-orange-50',  calBorder: 'border-orange-200' },
  rejected:    { label: 'Rejected',     color: 'bg-red-100 text-red-800',       calBg: 'bg-red-50',     calBorder: 'border-red-200' },
};

const TYPE_CONFIG: Record<ReceiptType, { label: string; color: string; short: string }> = {
  customer_material: { label: 'Customer Material', color: 'bg-indigo-100 text-indigo-700',  short: 'CUST' },
  raw_material:      { label: 'Raw Material',       color: 'bg-teal-100 text-teal-700',     short: 'RAW' },
  purchase_order:    { label: 'Purchase Order',     color: 'bg-blue-100 text-blue-700',     short: 'PO' },
  return:            { label: 'Return',             color: 'bg-gray-100 text-gray-600',     short: 'RTN' },
};

const RECEIPT_FLOW: ReceiptStatus[] = ['expected', 'received', 'inspecting', 'accepted'];

type RecvTab = 'calendar' | 'expected' | 'receipts';

// ── Calendar helpers ───────────────────────────────────────────────────────────

function getDateRange(weekOffset = 0): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i + weekOffset * 7);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Primary display date for calendar: expectedDate if set, else receivedDate */
function receiptDisplayDate(r: Receipt): string {
  return r.expectedDate ?? r.receivedDate;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function Receiving() {
  const { state, dispatch } = useApp();
  const { receipts, jobs, customers, inventory } = state;

  const [activeTab, setActiveTab]       = useState<RecvTab>('calendar');
  const [weekOffset, setWeekOffset]     = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType]     = useState<string>('all');
  const [showModal, setShowModal]       = useState(false);
  const [editReceipt, setEditReceipt]   = useState<Receipt | null>(null);
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [showExpModal, setShowExpModal] = useState(false);
  const [editExpected, setEditExpected] = useState<Receipt | null>(null);
  const [printLabels, setPrintLabels]   = useState<BarcodeLabel[] | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Stats
  const expectedToday  = receipts.filter(r => r.status === 'expected' && r.expectedDate === today);
  const receivedToday  = receipts.filter(r => r.receivedDate === today && r.status !== 'expected').length;
  const discrepancies  = receipts.filter(r => r.status === 'discrepancy').length;
  const pendingInspect = receipts.filter(r => r.status === 'received' || r.status === 'inspecting').length;
  const overdueCount   = receipts.filter(r => r.status === 'expected' && r.expectedDate && r.expectedDate < today).length;

  const alertBadge = expectedToday.length + overdueCount;

  const TABS: { id: RecvTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'calendar', label: 'Receiving Calendar', icon: <Calendar size={15} /> },
    { id: 'expected', label: 'Expected Deliveries', icon: <Clock size={15} />, badge: alertBadge || undefined },
    { id: 'receipts', label: 'All Receipts',        icon: <PackageOpen size={15} /> },
  ];

  // Shared helpers
  function advanceReceipt(r: Receipt) {
    const idx = RECEIPT_FLOW.indexOf(r.status);
    if (idx < 0 || idx >= RECEIPT_FLOW.length - 1) return;
    const now = new Date().toISOString();
    dispatch({
      type: 'UPDATE_RECEIPT',
      payload: {
        ...r, status: RECEIPT_FLOW[idx + 1],
        receivedDate: r.status === 'expected' ? today : r.receivedDate,
        acceptedDate: RECEIPT_FLOW[idx + 1] === 'accepted' ? now.slice(0, 10) : r.acceptedDate,
        updatedAt: now,
      },
    });
  }

  function markDiscrepancy(r: Receipt) {
    dispatch({ type: 'UPDATE_RECEIPT', payload: { ...r, status: 'discrepancy', updatedAt: new Date().toISOString() } });
  }

  function markRejected(r: Receipt) {
    dispatch({ type: 'UPDATE_RECEIPT', payload: { ...r, status: 'rejected', updatedAt: new Date().toISOString() } });
  }

  function markReceived(r: Receipt) {
    dispatch({
      type: 'UPDATE_RECEIPT',
      payload: { ...r, status: 'received', receivedDate: today, updatedAt: new Date().toISOString() },
    });
  }

  function handleSave(receipt: Receipt) {
    if (editReceipt) dispatch({ type: 'UPDATE_RECEIPT', payload: receipt });
    else dispatch({ type: 'ADD_RECEIPT', payload: receipt });
    setShowModal(false); setEditReceipt(null);
  }

  function handleSaveExpected(receipt: Receipt) {
    if (editExpected) dispatch({ type: 'UPDATE_RECEIPT', payload: receipt });
    else dispatch({ type: 'ADD_RECEIPT', payload: receipt });
    setShowExpModal(false); setEditExpected(null);
  }

  const filteredReceipts = receipts
    .filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterType !== 'all' && r.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col h-full">
      {printLabels && <LabelPrintModal labels={printLabels} title="Print Receipt Label" onClose={() => setPrintLabels(null)} />}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <PackageOpen size={22} className="text-brand-500" /> Receiving
              <WorkflowHelp title="Receiving Workflow" description="PO entry, delivery calendar, and receipt management for incoming stock." steps={RECEIVING_WORKFLOW} />
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Purchase order entry, incoming delivery calendar, and receipt management</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              icon={<Clock size={15} />}
              onClick={() => { setEditExpected(null); setShowExpModal(true); }}
            >
              Add Expected Delivery
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => { setEditReceipt(null); setShowModal(true); }}
            >
              Log Receipt
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Expected Today',    value: expectedToday.length, color: 'text-blue-600',   bg: 'bg-blue-50',   icon: <Clock size={16} /> },
            { label: 'Received Today',    value: receivedToday,        color: 'text-green-600',  bg: 'bg-green-50',  icon: <CheckCircle size={16} /> },
            { label: 'Pending Inspection', value: pendingInspect,      color: 'text-purple-600', bg: 'bg-purple-50', icon: <Package size={16} /> },
            { label: 'Discrepancies',     value: discrepancies,        color: discrepancies > 0 ? 'text-orange-600' : 'text-gray-500', bg: discrepancies > 0 ? 'bg-orange-50' : 'bg-gray-50', icon: <AlertTriangle size={16} /> },
            { label: 'Overdue Expected',  value: overdueCount,         color: overdueCount > 0 ? 'text-red-600' : 'text-gray-500', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-gray-50', icon: <AlertTriangle size={16} /> },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl p-3 flex items-center gap-2`}>
              <div className={k.color}>{k.icon}</div>
              <div>
                <p className="text-xs text-gray-500 leading-tight">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.icon} {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${activeTab === t.id ? 'bg-white text-brand-600' : 'bg-orange-500 text-white'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">

        {/* ── Calendar Tab ────────────────────────────────────────────────── */}
        {activeTab === 'calendar' && (
          <ReceivingCalendar
            receipts={receipts}
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
            onClickReceipt={setDetailReceipt}
            onMarkReceived={markReceived}
          />
        )}

        {/* ── Expected Deliveries Tab ──────────────────────────────────────── */}
        {activeTab === 'expected' && (
          <ExpectedDeliveriesView
            receipts={receipts}
            today={today}
            onMarkReceived={markReceived}
            onEdit={r => { setEditExpected(r); setShowExpModal(true); }}
            onDetail={setDetailReceipt}
            onAdd={() => { setEditExpected(null); setShowExpModal(true); }}
          />
        )}

        {/* ── All Receipts Tab ────────────────────────────────────────────── */}
        {activeTab === 'receipts' && (
          <>
            {discrepancies > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3 mb-4">
                <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                <span className="text-sm text-orange-800 font-semibold">{discrepancies} receipt discrepanc{discrepancies > 1 ? 'ies' : 'y'} require resolution.</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Types</option>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <Button icon={<Plus size={15} />} onClick={() => { setEditReceipt(null); setShowModal(true); }}>New Receipt</Button>
            </div>

            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Receipt #', 'Type', 'Vendor / Customer', 'PO #', 'Expected', 'Received', 'Items', 'Carrier', 'Value', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredReceipts.map(receipt => {
                      const sc = STATUS_CONFIG[receipt.status];
                      const tc = TYPE_CONFIG[receipt.type];
                      const isAdvanceable = RECEIPT_FLOW.includes(receipt.status) && receipt.status !== 'accepted';
                      return (
                        <tr key={receipt.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailReceipt(receipt)}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{receipt.receiptNumber}</td>
                          <td className="px-4 py-3"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tc.color}`}>{tc.short}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-800 max-w-[130px] truncate">{receipt.vendorName ?? receipt.customerName ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{receipt.poNumber ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{receipt.expectedDate ? formatDate(receipt.expectedDate) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{receipt.status !== 'expected' ? formatDate(receipt.receivedDate) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-center text-gray-700">{receipt.items.length}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[90px]">{receipt.carrierName ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-700">{receipt.totalValue ? formatCurrency(receipt.totalValue) : '—'}</td>
                          <td className="px-4 py-3"><Badge className={sc.color}>{sc.label}</Badge></td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {isAdvanceable && (
                                <button onClick={() => advanceReceipt(receipt)} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                                  {receipt.status === 'expected' ? 'Mark Received' : receipt.status === 'received' ? 'Inspect' : '✓ Accept'}
                                </button>
                              )}
                              <button onClick={() => setPrintLabels([buildReceiptLabel(receipt)])} className="p-1 text-gray-400 hover:text-purple-600 rounded" title="Print label">
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredReceipts.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">No receipts found</div>}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <ReceiptModal
          receipt={editReceipt}
          jobs={jobs}
          customers={customers}
          inventory={inventory}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditReceipt(null); }}
        />
      )}
      {showExpModal && (
        <ExpectedDeliveryModal
          receipt={editExpected}
          onSave={handleSaveExpected}
          onClose={() => { setShowExpModal(false); setEditExpected(null); }}
        />
      )}
      {detailReceipt && (
        <ReceiptDetailModal
          receipt={detailReceipt}
          onClose={() => setDetailReceipt(null)}
          onEdit={() => { setEditReceipt(detailReceipt); setDetailReceipt(null); setShowModal(true); }}
          onAccept={() => { advanceReceipt(detailReceipt); setDetailReceipt(null); }}
          onDiscrepancy={() => { markDiscrepancy(detailReceipt); setDetailReceipt(null); }}
          onReject={() => { markRejected(detailReceipt); setDetailReceipt(null); }}
        />
      )}
    </div>
  );
}

// ── Receiving Calendar ─────────────────────────────────────────────────────────

function ReceivingCalendar({
  receipts, weekOffset, onWeekChange, onClickReceipt, onMarkReceived,
}: {
  receipts: Receipt[];
  weekOffset: number;
  onWeekChange: (o: number) => void;
  onClickReceipt: (r: Receipt) => void;
  onMarkReceived: (r: Receipt) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = getDateRange(weekOffset);

  const byDate = useMemo(() => {
    const map: Record<string, Receipt[]> = {};
    dates.forEach(d => { map[d] = []; });
    receipts.forEach(r => {
      const d = receiptDisplayDate(r);
      if (map[d]) map[d].push(r);
    });
    return map;
  }, [receipts, weekOffset]);

  const totalThisWeek = dates.reduce((s, d) => s + (byDate[d]?.length ?? 0), 0);
  const expectedThisWeek = dates.reduce((s, d) => s + (byDate[d]?.filter(r => r.status === 'expected').length ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{totalThisWeek}</span> receipt{totalThisWeek !== 1 ? 's' : ''} this week
          {expectedThisWeek > 0 && <span className="ml-2 text-blue-600 font-medium">· {expectedThisWeek} expected</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWeekChange(weekOffset - 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={() => onWeekChange(0)}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
          >
            This Week
          </button>
          <button
            onClick={() => onWeekChange(weekOffset + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-3">
        {dates.map(date => {
          const dayReceipts = byDate[date] ?? [];
          const isToday = date === today;
          const isPast = date < today;
          return (
            <div key={date} className={`flex flex-col rounded-xl border-2 overflow-hidden ${
              isToday ? 'border-brand-400 shadow-sm' : 'border-gray-200'
            }`}>
              {/* Day header */}
              <div className={`px-3 py-2 text-center ${
                isToday ? 'bg-brand-600' : isPast ? 'bg-gray-100' : 'bg-gray-50'
              }`}>
                <p className={`text-xs font-bold ${isToday ? 'text-white' : 'text-gray-600'}`}>
                  {formatDateLabel(date)}
                </p>
                <p className={`text-[10px] ${isToday ? 'text-white/70' : 'text-gray-400'}`}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                {dayReceipts.length > 0 && (
                  <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isToday ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                  }`}>
                    {dayReceipts.length}
                  </span>
                )}
              </div>

              {/* Receipt cards */}
              <div className="flex-1 p-2 space-y-1.5 bg-white min-h-[120px]">
                {dayReceipts.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[10px] text-gray-300">—</p>
                  </div>
                ) : (
                  dayReceipts.map(r => {
                    const sc = STATUS_CONFIG[r.status];
                    const tc = TYPE_CONFIG[r.type];
                    const isOverdue = r.status === 'expected' && r.expectedDate && r.expectedDate < today;
                    return (
                      <div
                        key={r.id}
                        onClick={() => onClickReceipt(r)}
                        className={`rounded-lg p-2 cursor-pointer border text-[11px] space-y-1 hover:shadow-sm transition-shadow ${
                          isOverdue ? 'bg-red-50 border-red-200' : `${sc.calBg} ${sc.calBorder}`
                        }`}
                      >
                        <div className="font-mono font-bold text-brand-700 truncate">{r.receiptNumber}</div>
                        <div className="text-gray-700 truncate font-medium">{r.vendorName ?? r.customerName ?? '—'}</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${tc.color}`}>{tc.short}</span>
                          <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${sc.color}`}>{sc.label}</span>
                        </div>
                        {r.poNumber && <div className="text-gray-400 truncate">{r.poNumber}</div>}
                        {r.carrierName && <div className="text-gray-400 truncate">{r.carrierName}</div>}
                        {r.status === 'expected' && (
                          <button
                            onClick={e => { e.stopPropagation(); onMarkReceived(r); }}
                            className="w-full text-[10px] font-semibold text-green-700 bg-green-100 hover:bg-green-200 rounded py-0.5 transition-colors"
                          >
                            ✓ Mark Received
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="font-semibold text-gray-600">Status:</span>
        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
          <span key={key} className={`px-2 py-0.5 rounded-full font-medium ${val.color}`}>{val.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Expected Deliveries View ───────────────────────────────────────────────────

function ExpectedDeliveriesView({
  receipts, today, onMarkReceived, onEdit, onDetail, onAdd,
}: {
  receipts: Receipt[];
  today: string;
  onMarkReceived: (r: Receipt) => void;
  onEdit: (r: Receipt) => void;
  onDetail: (r: Receipt) => void;
  onAdd: () => void;
}) {
  const expected = receipts.filter(r => r.status === 'expected');
  const overdue  = expected.filter(r => r.expectedDate && r.expectedDate < today).sort((a, b) => (a.expectedDate ?? '').localeCompare(b.expectedDate ?? ''));
  const todayExp = expected.filter(r => r.expectedDate === today);
  const upcoming = expected.filter(r => r.expectedDate && r.expectedDate > today).sort((a, b) => (a.expectedDate ?? '').localeCompare(b.expectedDate ?? ''));
  const noDate   = expected.filter(r => !r.expectedDate);

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {todayExp.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-start gap-3">
          <ArrowDown size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-800">
              {todayExp.length} delivery{todayExp.length > 1 ? 'ies' : ''} expected today
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {todayExp.map(r => r.vendorName ?? r.customerName ?? r.receiptNumber).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">
              {overdue.length} overdue expected deliver{overdue.length > 1 ? 'ies' : 'y'} — not yet marked received
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdue.map(r => `${r.vendorName ?? r.customerName ?? r.receiptNumber} (${formatDate(r.expectedDate!)})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Add button */}
      <div className="flex justify-end">
        <Button icon={<Plus size={15} />} onClick={onAdd}>Add Expected Delivery / PO</Button>
      </div>

      {/* Sections */}
      {overdue.length > 0 && (
        <ExpectedSection title="⚠ Overdue" items={overdue} headerColor="bg-red-50 border-red-200 text-red-700"
          onMarkReceived={onMarkReceived} onEdit={onEdit} onDetail={onDetail} />
      )}
      {todayExp.length > 0 && (
        <ExpectedSection title="📦 Due Today" items={todayExp} headerColor="bg-blue-50 border-blue-200 text-blue-700"
          onMarkReceived={onMarkReceived} onEdit={onEdit} onDetail={onDetail} />
      )}
      {upcoming.length > 0 && (
        <ExpectedSection title="📅 Upcoming" items={upcoming} headerColor="bg-gray-50 border-gray-200 text-gray-700"
          onMarkReceived={onMarkReceived} onEdit={onEdit} onDetail={onDetail} />
      )}
      {noDate.length > 0 && (
        <ExpectedSection title="No Date Set" items={noDate} headerColor="bg-gray-50 border-gray-200 text-gray-500"
          onMarkReceived={onMarkReceived} onEdit={onEdit} onDetail={onDetail} />
      )}

      {expected.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No expected deliveries entered</p>
          <p className="text-sm mt-1">Add purchase orders and incoming deliveries to help your team anticipate arrivals.</p>
          <button onClick={onAdd} className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-500">
            + Add Expected Delivery
          </button>
        </div>
      )}
    </div>
  );
}

function ExpectedSection({
  title, items, headerColor, onMarkReceived, onEdit, onDetail,
}: {
  title: string; items: Receipt[]; headerColor: string;
  onMarkReceived: (r: Receipt) => void;
  onEdit: (r: Receipt) => void;
  onDetail: (r: Receipt) => void;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border text-sm font-bold ${headerColor}`}>
        {title}
        <span className="ml-auto text-xs font-normal opacity-70">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden bg-white divide-y divide-gray-50">
        {items.map(r => {
          const tc = TYPE_CONFIG[r.type];
          return (
            <div
              key={r.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => onDetail(r)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-brand-700">{r.receiptNumber}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tc.color}`}>{tc.label}</span>
                  {r.poNumber && <span className="text-xs text-gray-500">PO: {r.poNumber}</span>}
                </div>
                <div className="text-sm font-medium text-gray-800 mt-0.5">{r.vendorName ?? r.customerName ?? '—'}</div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                  {r.expectedDate && <span>Expected: <strong className="text-gray-600">{formatDate(r.expectedDate)}</strong></span>}
                  {r.carrierName && <span><Truck size={10} className="inline" /> {r.carrierName}</span>}
                  {r.trackingNumber && <span># {r.trackingNumber}</span>}
                  <span>{r.items.length} item{r.items.length !== 1 ? 's' : ''}</span>
                  {r.totalValue && <span>{formatCurrency(r.totalValue)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onEdit(r)}
                  className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => onMarkReceived(r)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  ✓ Received
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Expected Delivery Modal (admin PO / advance entry) ────────────────────────

function ExpectedDeliveryModal({
  receipt, onSave, onClose,
}: {
  receipt: Receipt | null;
  onSave: (r: Receipt) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType]               = useState<ReceiptType>(receipt?.type ?? 'purchase_order');
  const [vendorName, setVendorName]   = useState(receipt?.vendorName ?? '');
  const [poNumber, setPoNumber]       = useState(receipt?.poNumber ?? '');
  const [expectedDate, setExpectedDate] = useState(receipt?.expectedDate ?? '');
  const [carrierName, setCarrierName] = useState(receipt?.carrierName ?? '');
  const [tracking, setTracking]       = useState(receipt?.trackingNumber ?? '');
  const [notes, setNotes]             = useState(receipt?.notes ?? '');
  const [items, setItems]             = useState<ReceiptItem[]>(
    receipt?.items ?? [{ id: generateId(), description: '', quantityReceived: 0, quantityExpected: 1, unit: 'ea', condition: 'good' }]
  );

  function addItem() {
    setItems(it => [...it, { id: generateId(), description: '', quantityReceived: 0, quantityExpected: 1, unit: 'ea', condition: 'good' }]);
  }

  function updateItem(id: string, key: keyof ReceiptItem, value: unknown) {
    setItems(it => it.map(i => i.id === id ? { ...i, [key]: value } : i));
  }

  function removeItem(id: string) {
    setItems(it => it.filter(i => i.id !== id));
  }

  function handleSave() {
    const now = new Date().toISOString();
    onSave({
      id: receipt?.id ?? generateId(),
      receiptNumber: receipt?.receiptNumber ?? `RCV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      type,
      status: 'expected',
      vendorName: vendorName || undefined,
      poNumber: poNumber || undefined,
      carrierName: carrierName || undefined,
      trackingNumber: tracking || undefined,
      expectedDate: expectedDate || undefined,
      receivedDate: today,
      receivedById: 'admin',
      receivedByName: 'Admin',
      items,
      overallCondition: 'good',
      notes: notes || undefined,
      photos: receipt?.photos ?? [],
      createdAt: receipt?.createdAt ?? now,
      updatedAt: now,
    });
  }

  const isEditing = !!receipt;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEditing ? `Edit Expected Delivery: ${receipt.receiptNumber}` : 'Add Expected Delivery / Purchase Order'}
      size="xl"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{isEditing ? 'Save Changes' : 'Save Expected Delivery'}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 items-start">
          <Clock size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Enter purchase orders and incoming deliveries in advance so your receiving team knows what to anticipate. This will appear on the <strong>Receiving Calendar</strong> and alert receivers on the day of expected arrival.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Delivery Type" value={type} onChange={e => setType(e.target.value as ReceiptType)} className="col-span-2">
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>

          <Input
            label={type === 'customer_material' ? 'Customer Name' : 'Vendor / Supplier Name'}
            value={vendorName}
            onChange={e => setVendorName(e.target.value)}
            placeholder={type === 'customer_material' ? 'e.g. Ironclad Metal Works' : 'e.g. Powder Supplier Co.'}
          />
          <Input
            label="PO Number / Reference"
            icon={<Hash size={14} />}
            value={poNumber}
            onChange={e => setPoNumber(e.target.value)}
            placeholder="e.g. PO-2026-0123"
          />

          <Input
            label="Expected Arrival Date"
            type="date"
            value={expectedDate}
            onChange={e => setExpectedDate(e.target.value)}
          />
          <Input
            label="Carrier"
            icon={<Truck size={14} />}
            value={carrierName}
            onChange={e => setCarrierName(e.target.value)}
            placeholder="FedEx, UPS, Own Truck…"
          />

          <Input
            label="Tracking Number"
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            placeholder="Tracking # / BOL"
            className="col-span-2"
          />

          <Textarea
            label="Internal Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Handling instructions, storage location, who to notify…"
            className="col-span-2"
          />
        </div>

        {/* Expected items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Package size={14} className="text-brand-500" /> Expected Items
            </p>
            <button onClick={addItem} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              <Plus size={12} /> Add Item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <Input
                    label={idx === 0 ? 'Description' : ''}
                    value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Part / material description"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={idx === 0 ? 'Exp. Qty' : ''}
                    type="number" min="0"
                    value={String(item.quantityExpected ?? '')}
                    onChange={e => updateItem(item.id, 'quantityExpected', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={idx === 0 ? 'Unit' : ''}
                    value={item.unit}
                    onChange={e => updateItem(item.id, 'unit', e.target.value)}
                    placeholder="ea"
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    label={idx === 0 ? 'Cost' : ''}
                    type="number" min="0" step="0.01"
                    value={String(item.unitCost ?? '')}
                    onChange={e => updateItem(item.id, 'unitCost', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-1 pb-1">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Full Receipt Modal (existing, unchanged) ───────────────────────────────────

function ReceiptModal({ receipt, jobs, customers, inventory, onSave, onClose }: {
  receipt: Receipt | null;
  jobs: ReturnType<typeof useApp>['state']['jobs'];
  customers: ReturnType<typeof useApp>['state']['customers'];
  inventory: ReturnType<typeof useApp>['state']['inventory'];
  onSave: (r: Receipt) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<ReceiptType>(receipt?.type ?? 'customer_material');
  const [custId, setCustId] = useState(receipt?.customerId ?? '');
  const [vendorName, setVendorName] = useState(receipt?.vendorName ?? '');
  const [jobId, setJobId] = useState(receipt?.jobId ?? '');
  const [poNumber, setPoNumber] = useState(receipt?.poNumber ?? '');
  const [carrierName, setCarrierName] = useState(receipt?.carrierName ?? '');
  const [trackingNumber, setTrackingNumber] = useState(receipt?.trackingNumber ?? '');
  const [bolNumber, setBolNumber] = useState(receipt?.bolNumber ?? '');
  const [expectedDate, setExpectedDate] = useState(receipt?.expectedDate ?? '');
  const [receivedDate, setReceivedDate] = useState(receipt?.receivedDate ?? new Date().toISOString().slice(0, 10));
  const [overallCondition, setOverallCondition] = useState<'good' | 'damaged' | 'mixed'>(receipt?.overallCondition ?? 'good');
  const [inspectionNotes, setInspectionNotes] = useState(receipt?.inspectionNotes ?? '');
  const [notes, setNotes] = useState(receipt?.notes ?? '');
  const [photos, setPhotos] = useState<string[]>(receipt?.photos ?? []);
  const [items, setItems] = useState<ReceiptItem[]>(
    receipt?.items ?? [{ id: generateId(), description: '', quantityReceived: 1, unit: 'ea', condition: 'good' }]
  );

  const custJobs = jobs.filter(j => j.customerId === custId);
  const customer = customers.find(c => c.id === custId);

  function addItem() { setItems(it => [...it, { id: generateId(), description: '', quantityReceived: 1, unit: 'ea', condition: 'good' }]); }
  function updateItem(id: string, key: keyof ReceiptItem, value: unknown) { setItems(it => it.map(i => i.id === id ? { ...i, [key]: value } : i)); }
  function removeItem(id: string) { setItems(it => it.filter(i => i.id !== id)); }

  function handleSave() {
    const now = new Date().toISOString();
    const job = jobs.find(j => j.id === jobId);
    const totalValue = items.reduce((s, i) => s + ((i.unitCost ?? 0) * i.quantityReceived), 0);
    onSave({
      id: receipt?.id ?? generateId(),
      receiptNumber: receipt?.receiptNumber ?? `RCV-2026-${String(Date.now()).slice(-4)}`,
      type, status: receipt?.status ?? (receivedDate <= new Date().toISOString().slice(0, 10) ? 'received' : 'expected'),
      vendorName: vendorName || undefined,
      customerId: custId || undefined,
      customerName: customer?.name,
      jobId: jobId || undefined,
      jobNumber: job?.jobNumber,
      poNumber: poNumber || undefined,
      carrierName: carrierName || undefined,
      trackingNumber: trackingNumber || undefined,
      bolNumber: bolNumber || undefined,
      expectedDate: expectedDate || undefined,
      receivedDate,
      acceptedDate: receipt?.acceptedDate,
      receivedById: 'u2', receivedByName: 'Sam Chen',
      items, overallCondition,
      inspectionNotes: inspectionNotes || undefined,
      totalValue: totalValue || undefined,
      notes: notes || undefined,
      photos,
      createdAt: receipt?.createdAt ?? now, updatedAt: now,
    });
  }

  const isCustomerMaterial = type === 'customer_material';
  const isPO = type === 'purchase_order';

  return (
    <Modal open={true} onClose={onClose} title={receipt ? `Edit Receipt: ${receipt.receiptNumber}` : 'New Receipt'} size="2xl"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>{receipt ? 'Save' : 'Create Receipt'}</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Receipt Type" value={type} onChange={e => setType(e.target.value as ReceiptType)} className="col-span-2">
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        {isCustomerMaterial && (
          <>
            <Select label="Customer" value={custId} onChange={e => { setCustId(e.target.value); setJobId(''); }}>
              <option value="">— Select customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Link to Job" value={jobId} onChange={e => setJobId(e.target.value)}>
              <option value="">— Optional —</option>
              {custJobs.map(j => <option key={j.id} value={j.id}>{j.jobNumber}</option>)}
            </Select>
          </>
        )}
        {isPO && (
          <>
            <Input label="Vendor Name" value={vendorName} onChange={e => setVendorName(e.target.value)} />
            <Input label="PO Number" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
          </>
        )}
        {!isCustomerMaterial && !isPO && (
          <Input label="Vendor Name" value={vendorName} onChange={e => setVendorName(e.target.value)} className="col-span-2" />
        )}
        <Input label="Carrier" value={carrierName} onChange={e => setCarrierName(e.target.value)} placeholder="FedEx, UPS..." />
        <Input label="Tracking #" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
        <Input label="Expected Date" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
        <Input label="Received Date" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
        <Select label="Overall Condition" value={overallCondition} onChange={e => setOverallCondition(e.target.value as 'good' | 'damaged' | 'mixed')}>
          <option value="good">Good</option><option value="damaged">Damaged</option><option value="mixed">Mixed</option>
        </Select>
        <div />
        <Textarea label="Inspection Notes" value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} rows={2} className="col-span-2" />
        <Textarea label="Internal Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="col-span-2" />
      </div>
      <div className="mt-5">
        <PhotoCapture photos={photos} onChange={setPhotos} label="Receipt Photos" compact />
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Line Items</div>
          <button onClick={addItem} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Plus size={12} />Add Item</button>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <Input label={items.indexOf(item) === 0 ? 'Description' : ''} value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Part / material description" />
              </div>
              <div className="col-span-1">
                <Input label={items.indexOf(item) === 0 ? 'Exp.' : ''} type="number" min="0" value={String(item.quantityExpected ?? '')} onChange={e => updateItem(item.id, 'quantityExpected', Number(e.target.value))} placeholder="Exp." />
              </div>
              <div className="col-span-1">
                <Input label={items.indexOf(item) === 0 ? 'Recv.' : ''} type="number" min="0" value={String(item.quantityReceived)} onChange={e => updateItem(item.id, 'quantityReceived', Number(e.target.value))} />
              </div>
              <div className="col-span-1">
                <Input label={items.indexOf(item) === 0 ? 'Unit' : ''} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} placeholder="ea" />
              </div>
              <div className="col-span-1">
                <Input label={items.indexOf(item) === 0 ? 'Cost' : ''} type="number" min="0" step="0.01" value={String(item.unitCost ?? '')} onChange={e => updateItem(item.id, 'unitCost', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <Select label={items.indexOf(item) === 0 ? 'Condition' : ''} value={item.condition} onChange={e => updateItem(item.id, 'condition', e.target.value)}>
                  <option value="good">Good</option><option value="damaged">Damaged</option><option value="mixed">Mixed</option>
                </Select>
              </div>
              <div className="col-span-1">
                <Input label={items.indexOf(item) === 0 ? 'Notes' : ''} value={item.notes ?? ''} onChange={e => updateItem(item.id, 'notes', e.target.value)} placeholder="Notes" />
              </div>
              <div className="col-span-1 pb-1">
                <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 p-1"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── Receipt Detail Modal ───────────────────────────────────────────────────────

function ReceiptDetailModal({ receipt, onClose, onEdit, onAccept, onDiscrepancy, onReject }: {
  receipt: Receipt;
  onClose: () => void;
  onEdit: () => void;
  onAccept: () => void;
  onDiscrepancy: () => void;
  onReject: () => void;
}) {
  const sc = STATUS_CONFIG[receipt.status];
  const tc = TYPE_CONFIG[receipt.type];
  const isActionable = ['received', 'inspecting'].includes(receipt.status);

  return (
    <Modal open={true} onClose={onClose} title={`Receipt: ${receipt.receiptNumber}`} size="lg"
      footer={
        <div className="flex gap-2 justify-between">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onEdit}>Edit</Button>
            {isActionable && (
              <>
                <Button variant="danger" onClick={onReject}>Reject</Button>
                <Button variant="secondary" onClick={onDiscrepancy}>Discrepancy</Button>
                <Button onClick={onAccept}>Accept</Button>
              </>
            )}
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={sc.color}>{sc.label}</Badge>
          <Badge className={tc.color}>{tc.label}</Badge>
          <span className="text-sm text-gray-600">{receipt.vendorName ?? receipt.customerName ?? '—'}</span>
          {receipt.jobNumber && <span className="font-mono text-xs text-brand-700">{receipt.jobNumber}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Expected Date',  value: receipt.expectedDate ? formatDate(receipt.expectedDate) : '—' },
            { label: 'Received Date',  value: receipt.status !== 'expected' ? formatDate(receipt.receivedDate) : '—' },
            { label: 'Carrier',        value: receipt.carrierName ?? '—' },
            { label: 'Tracking #',     value: receipt.trackingNumber ?? receipt.bolNumber ?? '—' },
            { label: 'PO Number',      value: receipt.poNumber ?? '—' },
            { label: 'Condition',      value: receipt.overallCondition },
            { label: 'Total Value',    value: receipt.totalValue ? formatCurrency(receipt.totalValue) : '—' },
            { label: 'Accepted Date',  value: receipt.acceptedDate ? formatDate(receipt.acceptedDate) : '—' },
          ].map(row => (
            <div key={row.label} className="flex justify-between">
              <span className="text-gray-500">{row.label}</span>
              <span className={clsx('font-medium',
                row.label === 'Condition' && receipt.overallCondition === 'damaged' ? 'text-red-600' :
                row.label === 'Condition' && receipt.overallCondition === 'mixed' ? 'text-orange-600' :
                'text-gray-800'
              )}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Line Items</div>
          <table className="w-full text-xs border rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {['Description', 'P/N', 'Expected', 'Received', 'Unit', 'Unit Cost', 'Total', 'Condition', 'Notes'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipt.items.map(item => {
                const discrepancy = item.quantityExpected != null && item.quantityReceived !== item.quantityExpected;
                return (
                  <tr key={item.id} className={clsx(discrepancy && 'bg-orange-50')}>
                    <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{item.description}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{item.partNumber ?? '—'}</td>
                    <td className={clsx('px-3 py-2 text-center', discrepancy && 'text-orange-600 font-semibold')}>{item.quantityExpected ?? '—'}</td>
                    <td className={clsx('px-3 py-2 text-center font-semibold', discrepancy ? 'text-orange-600' : 'text-gray-700')}>{item.quantityReceived}</td>
                    <td className="px-3 py-2 text-gray-600">{item.unit}</td>
                    <td className="px-3 py-2 text-gray-600">{item.unitCost ? formatCurrency(item.unitCost) : '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{item.unitCost ? formatCurrency(item.unitCost * item.quantityReceived) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={clsx('font-medium capitalize', item.condition === 'damaged' ? 'text-red-600' : item.condition === 'mixed' ? 'text-orange-600' : 'text-green-600')}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{item.notes ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {receipt.inspectionNotes && (
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <span className="font-semibold">Inspection Notes: </span>{receipt.inspectionNotes}
          </div>
        )}
        {receipt.status === 'discrepancy' && (
          <div className="bg-orange-50 rounded-lg p-3 text-xs text-orange-800">
            <span className="font-semibold">Discrepancy: </span>{receipt.inspectionNotes ?? 'See line items for quantity differences.'}
          </div>
        )}
        {(receipt.photos?.length ?? 0) > 0 && (
          <PhotoCapture photos={receipt.photos ?? []} onChange={() => {}} label="Receipt Photos" readOnly />
        )}
      </div>
    </Modal>
  );
}
