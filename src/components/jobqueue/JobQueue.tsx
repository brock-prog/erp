/**
 * JobQueue.tsx
 * Admin Job Order Queue view.
 *
 * Workflow:
 *   1. Parts arrive / job scanned at scan station → creates pending_review JobOrder
 *   2. Admin sees queue, opens order, verifies paint/materials, attaches drawings/notes
 *   3. Admin approves → status becomes 'approved' and appears in scheduling queue
 *   4. Or admin rejects with reason
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList, CheckCircle, XCircle, Clock, Package,
  AlertTriangle, Paperclip, ChevronRight, Filter,
  Calendar, User, Tag, Search, Eye, RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import type { JobOrder, JobOrderMaterialCheck, JobOrderAttachment } from '../../types';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  materials_check: { label: 'Materials Check', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
  scheduled: { label: 'Scheduled', color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
};

const PRIORITY_COLORS = {
  low: 'text-gray-500',
  normal: 'text-blue-600',
  high: 'text-orange-600',
  rush: 'text-red-600 font-bold',
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

interface DetailModalProps {
  order: JobOrder;
  onClose: () => void;
  onApprove: (id: string, notes: string) => void;
  onReject: (id: string, reason: string) => void;
  onStartMaterialCheck: (id: string) => void;
  onUpdateMaterialCheck: (orderId: string, checks: JobOrderMaterialCheck[]) => void;
  onAddNote: (orderId: string, note: string) => void;
}

function DetailModal({ order, onClose, onApprove, onReject, onStartMaterialCheck, onUpdateMaterialCheck, onAddNote }: DetailModalProps) {
  const { state } = useApp();
  const [adminNotes, setAdminNotes] = useState(order.adminNotes ?? '');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [materialChecks, setMaterialChecks] = useState<JobOrderMaterialCheck[]>(order.materialChecks);
  const [newNote, setNewNote] = useState('');

  const canApprove = order.status === 'pending_review' || order.status === 'materials_check';
  const canReject = order.status !== 'approved' && order.status !== 'rejected' && order.status !== 'scheduled';

  // Find the linked job
  const linkedJob = order.scannedJobId ? state.jobs.find(j => j.id === order.scannedJobId) : null;

  function toggleMaterialConfirm(idx: number) {
    const updated = materialChecks.map((c, i) => i === idx ? { ...c, confirmed: !c.confirmed } : c);
    setMaterialChecks(updated);
    onUpdateMaterialCheck(order.id, updated);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-orange-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{order.orderNumber}</h2>
            <p className="text-sm text-gray-500">{order.customerName} • {order.partDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[order.status].color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[order.status].dot}`} />
              {STATUS_CONFIG[order.status].label}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">
              <XCircle size={22} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Job info grid */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Service</p>
              <p className="font-medium capitalize">{order.serviceType.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Parts</p>
              <p className="font-medium">{order.partCount} pcs</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Priority</p>
              <p className={`font-medium capitalize ${PRIORITY_COLORS[order.priority]}`}>{order.priority}</p>
            </div>
            {order.dueDate && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Due Date</p>
                <p className="font-medium">{new Date(order.dueDate).toLocaleDateString()}</p>
              </div>
            )}
            {order.colorCode && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Color</p>
                <p className="font-medium">{order.colorCode} – {order.colorName}</p>
              </div>
            )}
            {order.finish && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Finish</p>
                <p className="font-medium capitalize">{order.finish}</p>
              </div>
            )}
            {order.scannedJobNumber && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Linked Job</p>
                <p className="font-medium font-mono text-brand-600">{order.scannedJobNumber}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Received By</p>
              <p className="font-medium">{order.scannedByName}</p>
            </div>
          </div>

          {/* Notes from scan-in */}
          {order.notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Job Notes</h3>
              <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">{order.notes}</p>
            </div>
          )}

          {/* Materials Check */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Package size={14} className="text-blue-500" /> Materials Availability
              </h3>
              {order.status === 'pending_review' && (
                <Button variant="ghost" size="sm" onClick={() => onStartMaterialCheck(order.id)}>
                  Start Check
                </Button>
              )}
            </div>

            {materialChecks.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
                <Package size={20} className="mx-auto mb-1 text-gray-300" />
                No materials linked. Check if required powder/materials are in stock.
              </div>
            ) : (
              <div className="space-y-2">
                {materialChecks.map((check, idx) => {
                  const sufficient = check.availableQty >= (check.requiredQty || 1);
                  return (
                    <div key={idx} className={`border rounded-xl p-3 flex items-center gap-3 ${check.confirmed ? 'bg-green-50 border-green-200' : sufficient ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
                      <input
                        type="checkbox"
                        checked={check.confirmed}
                        onChange={() => toggleMaterialConfirm(idx)}
                        className="w-4 h-4 accent-green-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{check.itemName}</p>
                        {check.colorCode && <p className="text-xs text-gray-500">Color: {check.colorCode}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${sufficient ? 'text-green-700' : 'text-red-600'}`}>
                          {check.availableQty.toFixed(1)} {check.unit}
                        </p>
                        <p className="text-xs text-gray-400">available</p>
                      </div>
                      {sufficient
                        ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                        : <AlertTriangle size={16} className="text-red-500 shrink-0" />
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Paperclip size={14} className="text-gray-500" /> Attachments
              {order.attachments.length > 0 && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{order.attachments.length}</span>}
            </h3>
            {order.attachments.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
                <Paperclip size={20} className="mx-auto mb-1 text-gray-300" />
                No attachments yet. Add part drawings, spec sheets, or photos.
                <br />
                <span className="text-xs text-gray-300">(File upload coming soon)</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {order.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <Paperclip size={14} className="text-gray-400 shrink-0" />
                    <span className="flex-1 truncate">{att.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{att.type.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-400">{att.uploadedBy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Admin Notes</h3>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              onBlur={() => adminNotes !== order.adminNotes && onAddNote(order.id, adminNotes)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Add notes for the operator / scheduler…"
            />
          </div>

          {/* Linked job detail */}
          {linkedJob && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                <Eye size={14} /> Linked Job: {linkedJob.jobNumber}
              </p>
              <div className="grid grid-cols-2 gap-2 text-blue-700">
                <div><span className="text-blue-400">Status: </span>{linkedJob.status}</div>
                <div><span className="text-blue-400">Est. Hours: </span>{linkedJob.estimatedHours}h</div>
              </div>
            </div>
          )}

          {/* Reject reason */}
          {showReject && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-700">Rejection Reason</h3>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)…"
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReject(false)}>Cancel</Button>
                <Button variant="danger" size="sm" disabled={!rejectReason.trim()} onClick={() => onReject(order.id, rejectReason)}>
                  Confirm Rejection
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {canApprove || canReject ? (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            {canReject && !showReject && (
              <Button variant="danger" size="sm" icon={<XCircle size={15} />} onClick={() => setShowReject(true)}>
                Reject
              </Button>
            )}
            <div className="flex-1" />
            {canApprove && (
              <Button
                variant="success"
                size="sm"
                icon={<CheckCircle size={15} />}
                onClick={() => onApprove(order.id, adminNotes)}
              >
                Approve → Send to Scheduling
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Main Queue View ───────────────────────────────────────────────────────────

export function JobQueue() {
  const { state, dispatch } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const orders = useMemo(() => {
    let list = [...state.jobOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filterStatus !== 'all') list = list.filter(o => o.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.partDescription.toLowerCase().includes(q) ||
        o.scannedJobNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [state.jobOrders, filterStatus, search]);

  const selectedOrder = selectedOrderId ? state.jobOrders.find(o => o.id === selectedOrderId) : null;

  // Status counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.jobOrders.length };
    state.jobOrders.forEach(o => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [state.jobOrders]);

  function handleApprove(orderId: string, adminNotes: string) {
    const order = state.jobOrders.find(o => o.id === orderId)!;
    dispatch({
      type: 'UPDATE_JOB_ORDER',
      payload: {
        ...order,
        status: 'approved',
        adminNotes,
        materialsConfirmed: order.materialChecks.every(c => c.confirmed),
        reviewedById: state.currentUser.id,
        reviewedByName: state.currentUser.name,
        reviewedAt: new Date().toISOString(),
        approvedById: state.currentUser.id,
        approvedByName: state.currentUser.name,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    setSelectedOrderId(null);
  }

  function handleReject(orderId: string, reason: string) {
    const order = state.jobOrders.find(o => o.id === orderId)!;
    dispatch({
      type: 'UPDATE_JOB_ORDER',
      payload: {
        ...order,
        status: 'rejected',
        rejectedReason: reason,
        reviewedById: state.currentUser.id,
        reviewedByName: state.currentUser.name,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    setSelectedOrderId(null);
  }

  function handleStartMaterialCheck(orderId: string) {
    const order = state.jobOrders.find(o => o.id === orderId)!;
    // Refresh material availability from current inventory
    const updatedChecks = order.materialChecks.map(check => {
      const invItem = state.inventory.find(i => i.id === check.inventoryItemId);
      return invItem ? { ...check, availableQty: invItem.quantityOnHand } : check;
    });
    dispatch({
      type: 'UPDATE_JOB_ORDER',
      payload: { ...order, status: 'materials_check', materialChecks: updatedChecks, updatedAt: new Date().toISOString() },
    });
  }

  function handleUpdateMaterialCheck(orderId: string, checks: JobOrderMaterialCheck[]) {
    const order = state.jobOrders.find(o => o.id === orderId)!;
    dispatch({ type: 'UPDATE_JOB_ORDER', payload: { ...order, materialChecks: checks, updatedAt: new Date().toISOString() } });
  }

  function handleAddNote(orderId: string, note: string) {
    const order = state.jobOrders.find(o => o.id === orderId)!;
    dispatch({ type: 'UPDATE_JOB_ORDER', payload: { ...order, adminNotes: note, updatedAt: new Date().toISOString() } });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={24} className="text-orange-500" />
            Job Order Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve incoming job orders before scheduling</p>
        </div>
        <a
          href="/scan"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          Open Scan Station ↗
        </a>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending_review', label: 'Pending Review' },
          { key: 'materials_check', label: 'Materials Check' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'scheduled', label: 'Scheduled' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterStatus === f.key
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-brand-400'
            }`}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span className={`text-xs rounded-full px-1.5 ${filterStatus === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search order, customer, job…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No job orders found</p>
          <p className="text-sm mt-1">Scan a job barcode at the scan station to create an order</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const allMaterialsOk = order.materialChecks.length > 0 && order.materialChecks.every(c => c.confirmed);
            const hasMaterialWarning = order.materialChecks.some(c => c.availableQty < (c.requiredQty || 1));
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-brand-400 hover:shadow-md transition-all"
              >
                {/* Priority indicator */}
                <div className={`w-1 h-12 rounded-full shrink-0 ${
                  order.priority === 'rush' ? 'bg-red-500' :
                  order.priority === 'high' ? 'bg-orange-400' :
                  order.priority === 'normal' ? 'bg-blue-400' : 'bg-gray-300'
                }`} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{order.orderNumber}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {order.priority === 'rush' && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">RUSH</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{order.customerName} – {order.partDescription}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {order.scannedJobNumber && (
                      <span className="flex items-center gap-1"><Tag size={11} />{order.scannedJobNumber}</span>
                    )}
                    <span className="flex items-center gap-1"><User size={11} />{order.scannedByName}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{new Date(order.createdAt).toLocaleDateString()}</span>
                    {order.dueDate && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock size={11} />Due {new Date(order.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Indicators */}
                <div className="flex items-center gap-2 shrink-0">
                  {order.attachments.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Paperclip size={12} />{order.attachments.length}
                    </span>
                  )}
                  {allMaterialsOk && (
                    <span title="Materials confirmed" className="text-green-500"><CheckCircle size={16} /></span>
                  )}
                  {hasMaterialWarning && (
                    <span title="Material shortage" className="text-red-500"><AlertTriangle size={16} /></span>
                  )}
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <DetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onStartMaterialCheck={handleStartMaterialCheck}
          onUpdateMaterialCheck={handleUpdateMaterialCheck}
          onAddNote={handleAddNote}
        />
      )}
    </div>
  );
}
