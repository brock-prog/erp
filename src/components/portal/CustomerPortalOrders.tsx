import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Package, ChevronRight, CheckCircle, Clock, Truck, Search,
  ArrowLeft, MapPin, Calendar, Weight, Hash, FileText,
  Circle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useCustomerPortal } from '../../context/CustomerPortalContext';
import { PORTAL_ORDERS } from '../../data/portalData';
import type { PortalOrderStatus } from '../../types/portal';

// ─── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PortalOrderStatus, { label: string; color: string; bg: string; border: string }> = {
  received:         { label: 'Order Received',   color: 'text-gray-700',   bg: 'bg-gray-100',    border: 'border-gray-300' },
  in_pretreat:      { label: 'Pre-Treatment',    color: 'text-indigo-700', bg: 'bg-indigo-50',   border: 'border-indigo-300' },
  coating:          { label: 'Powder Coating',   color: 'text-violet-700', bg: 'bg-violet-50',   border: 'border-violet-300' },
  curing:           { label: 'Curing Oven',      color: 'text-orange-700', bg: 'bg-orange-50',   border: 'border-orange-300' },
  qc_inspection:    { label: 'QC Inspection',    color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-300' },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'text-teal-700',   bg: 'bg-teal-50',     border: 'border-teal-300' },
  shipped:          { label: 'Shipped',          color: 'text-emerald-700',bg: 'bg-emerald-50',  border: 'border-emerald-300' },
  completed:        { label: 'Completed',        color: 'text-green-700',  bg: 'bg-green-50',    border: 'border-green-300' },
  on_hold:          { label: 'On Hold',          color: 'text-red-700',    bg: 'bg-red-50',      border: 'border-red-300' },
};

const STEPS: PortalOrderStatus[] = [
  'received', 'in_pretreat', 'coating', 'curing', 'qc_inspection', 'ready_for_pickup', 'shipped', 'completed',
];

const STEP_LABELS: Record<PortalOrderStatus, string> = {
  received:         'Received',
  in_pretreat:      'Pre-Treatment',
  coating:          'Coating',
  curing:           'Curing',
  qc_inspection:    'QC',
  ready_for_pickup: 'Ready',
  shipped:          'Shipped',
  completed:        'Complete',
  on_hold:          'On Hold',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Order List ───────────────────────────────────────────────────────────────

export function CustomerPortalOrders() {
  const { portalState } = useCustomerPortal();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');

  const myOrders = PORTAL_ORDERS.filter(o => o.customerId === portalState.session!.customerId);
  const filtered = myOrders.filter(o => {
    if (filter === 'active' && ['completed', 'shipped'].includes(o.status)) return false;
    if (filter === 'completed' && !['completed', 'shipped'].includes(o.status)) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.jobNumber.toLowerCase().includes(q) ||
             o.description.toLowerCase().includes(q) ||
             (o.color ?? '').toLowerCase().includes(q) ||
             (o.poNumber ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 text-sm mt-1">{myOrders.length} total orders on your account</p>
        </div>
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all capitalize -mb-px ${
              filter === f
                ? 'border-[#1f355e] text-[#1f355e]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'all' ? `All (${myOrders.length})` :
             f === 'active' ? `Active (${myOrders.filter(o => !['completed','shipped'].includes(o.status)).length})` :
             `Completed (${myOrders.filter(o => ['completed','shipped'].includes(o.status)).length})`}
          </button>
        ))}
      </div>

      {/* Order cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
          <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No orders found{search ? ' for that search' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const stepIdx = STEPS.indexOf(order.status);
            const pct = stepIdx >= 0 ? Math.round(((stepIdx + 1) / STEPS.length) * 100) : 0;
            const isComplete = ['completed', 'shipped'].includes(order.status);
            return (
              <Link
                key={order.id}
                to={`/portal/orders/${order.id}`}
                className="block bg-white rounded-xl shadow-sm ring-1 ring-gray-100 hover:shadow-md hover:ring-[#1f355e]/20 transition-all group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{order.jobNumber}</span>
                        {order.poNumber && (
                          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                            PO: {order.poNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm mt-1 truncate">{order.description}</p>
                      {order.color && <p className="text-gray-400 text-xs mt-0.5">{order.color}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(order.expectedCompletion)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {!isComplete && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Production progress</span>
                        <span className="text-xs font-semibold text-gray-600">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-[#1f355e] to-[#009877] h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {order.quantity.toLocaleString()} {order.unitType}
                      </span>
                      {order.weight && (
                        <span className="flex items-center gap-1">
                          <Weight className="w-3 h-3" />
                          {order.weight.toLocaleString()} lbs
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Ordered {formatDate(order.orderDate)}
                      </span>
                    </div>
                    <span className="text-[#1f355e] text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Details <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Order Detail ─────────────────────────────────────────────────────────────

export function CustomerPortalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { portalState } = useCustomerPortal();
  const navigate = useNavigate();
  const [showFullHistory, setShowFullHistory] = useState(false);

  const order = PORTAL_ORDERS.find(
    o => o.id === id && o.customerId === portalState.session!.customerId
  );

  if (!order) {
    return (
      <div className="text-center py-20">
        <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">Order not found.</p>
        <button onClick={() => navigate('/portal/orders')} className="mt-4 text-[#1f355e] font-semibold text-sm">
          ← Back to Orders
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status];
  const currentStepIdx = STEPS.indexOf(order.status);
  const isComplete = ['completed', 'shipped'].includes(order.status);
  const completedSteps = new Set(order.statusHistory.map(e => e.status));

  return (
    <div className="space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/portal/orders')}
          className="p-2 rounded-xl bg-white shadow-sm ring-1 ring-gray-100 text-gray-500 hover:text-gray-800 hover:shadow-md transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order.jobNumber}</h1>
          <p className="text-gray-500 text-sm">{order.description}</p>
        </div>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1" style={{ color: 'inherit' }}>Current Status</p>
            <h2 className={`text-2xl font-black ${cfg.color}`}>{cfg.label}</h2>
            {order.customerNotes && (
              <p className={`text-sm mt-2 ${cfg.color} opacity-80 max-w-xl leading-relaxed`}>{order.customerNotes}</p>
            )}
          </div>
          <div className="text-right">
            <p className={`text-xs opacity-60 mb-0.5 ${cfg.color}`}>Expected completion</p>
            <p className={`text-lg font-bold ${cfg.color}`}>{formatDate(order.expectedCompletion)}</p>
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-6">Production Journey</h3>
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />

          <div className="space-y-4">
            {STEPS.filter(s => s !== 'on_hold').map((step, idx) => {
              const completed = completedSteps.has(step);
              const isCurrent = step === order.status;
              const event = order.statusHistory.find(e => e.status === step);
              const stepCfg = STATUS_CONFIG[step];

              return (
                <div key={step} className="relative flex items-start gap-4 pl-10">
                  {/* Step dot */}
                  <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    completed
                      ? 'bg-[#009877] border-[#009877] shadow-md'
                      : isCurrent
                      ? 'bg-white border-[#1f355e] shadow-md ring-4 ring-[#1f355e]/10'
                      : 'bg-white border-gray-200'
                  }`}>
                    {completed ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1f355e] animate-pulse" />
                    ) : (
                      <Circle className="w-3 h-3 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${
                        completed ? 'text-gray-800' : isCurrent ? 'text-[#1f355e]' : 'text-gray-400'
                      }`}>
                        {stepCfg.label}
                      </span>
                      {event && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatDateTime(event.timestamp)}
                        </span>
                      )}
                    </div>
                    {event?.note && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{event.note}</p>
                    )}
                    {isCurrent && !event?.note && (
                      <p className="text-xs text-[#1f355e]/70 mt-1">In progress…</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Order Details</h3>
          <dl className="space-y-3">
            {[
              { label: 'Job Number',    value: order.jobNumber },
              { label: 'PO Number',     value: order.poNumber ?? '—' },
              { label: 'Description',   value: order.description },
              { label: 'Profile Type',  value: order.profileType ?? '—' },
              { label: 'Color',         value: order.color ?? '—' },
              { label: 'Finish',        value: order.finish ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-gray-800 font-medium text-right max-w-[60%]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Quantity & Shipping</h3>
          <dl className="space-y-3">
            {[
              { label: 'Quantity',         value: `${order.quantity.toLocaleString()} ${order.unitType}` },
              { label: 'Total Weight',     value: order.weight ? `${order.weight.toLocaleString()} lbs` : '—' },
              { label: 'Order Date',       value: formatDate(order.orderDate) },
              { label: 'Est. Completion',  value: formatDate(order.expectedCompletion) },
              { label: 'Carrier',          value: order.carrier ?? '—' },
              { label: 'Tracking Number',  value: order.trackingNumber ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-gray-800 font-medium text-right max-w-[60%]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Need help */}
      <div className="bg-gradient-to-r from-[#1f355e] to-[#2a4a80] rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-lg">Have a question about this order?</h3>
          <p className="text-white/70 text-sm mt-1">Our team is here to help with changes, questions, or delivery updates.</p>
        </div>
        <Link
          to="/portal/contact"
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1f355e] rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow"
        >
          Contact Us <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
