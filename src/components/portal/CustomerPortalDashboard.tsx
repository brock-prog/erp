import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Clock, CheckCircle, FileText, Beaker, MessageCircle,
  TrendingUp, AlertCircle, ChevronRight, ArrowRight, Truck,
} from 'lucide-react';
import { useCustomerPortal } from '../../context/CustomerPortalContext';
import { PORTAL_ORDERS } from '../../data/portalData';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received:        { label: 'Received',         color: 'text-gray-600',   bg: 'bg-gray-100' },
  in_pretreat:     { label: 'Pre-Treatment',    color: 'text-indigo-700', bg: 'bg-indigo-50' },
  coating:         { label: 'Powder Coating',   color: 'text-violet-700', bg: 'bg-violet-50' },
  curing:          { label: 'Curing',           color: 'text-orange-700', bg: 'bg-orange-50' },
  qc_inspection:   { label: 'QC Inspection',    color: 'text-blue-700',   bg: 'bg-blue-50' },
  ready_for_pickup:{ label: 'Ready for Pickup', color: 'text-teal-700',   bg: 'bg-teal-50' },
  shipped:         { label: 'Shipped',          color: 'text-emerald-700',bg: 'bg-emerald-50' },
  completed:       { label: 'Completed',        color: 'text-green-700',  bg: 'bg-green-50' },
  on_hold:         { label: 'On Hold',          color: 'text-red-700',    bg: 'bg-red-50' },
};

const PROGRESS_STEPS: string[] = [
  'received', 'in_pretreat', 'coating', 'curing', 'qc_inspection', 'ready_for_pickup', 'shipped', 'completed',
];

function getProgressPercent(status: string): number {
  const idx = PROGRESS_STEPS.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / PROGRESS_STEPS.length) * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CustomerPortalDashboard() {
  const { portalState } = useCustomerPortal();
  const session = portalState.session!;

  const myOrders = PORTAL_ORDERS.filter(o => o.customerId === session.customerId);
  const activeOrders = myOrders.filter(o => !['completed', 'shipped'].includes(o.status));
  const recentCompleted = myOrders.filter(o => o.status === 'completed').slice(0, 2);
  const readyOrders = myOrders.filter(o => o.status === 'ready_for_pickup');
  const inTransitOrders = myOrders.filter(o => o.status === 'shipped');
  const totalActive = activeOrders.length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">

      {/* ── Welcome header ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1f355e] to-[#2a4a80] rounded-2xl p-8 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm font-medium">{greeting},</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">{session.contactName}</h1>
            <p className="text-white/70 text-sm mt-1">{session.companyName}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/portal/quote-request"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition-all"
            >
              <FileText className="w-4 h-4" />
              Request a Quote
            </Link>
            <Link
              to="/portal/orders"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#009877] hover:bg-[#007a61] rounded-xl text-sm font-semibold transition-all shadow"
            >
              <Package className="w-4 h-4" />
              View All Orders
            </Link>
          </div>
        </div>
      </div>

      {/* ── Alert banners ─────────────────────────────────────────────────── */}
      {readyOrders.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-teal-800 text-sm">
              {readyOrders.length === 1
                ? `Order ${readyOrders[0].jobNumber} is ready for pickup!`
                : `${readyOrders.length} orders are ready for pickup!`}
            </p>
            <p className="text-teal-600 text-xs mt-0.5">
              Please contact us to arrange pickup or delivery.
            </p>
          </div>
          <Link to="/portal/orders" className="text-teal-700 hover:text-teal-900 font-semibold text-sm flex items-center gap-1">
            View <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {inTransitOrders.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-emerald-800 text-sm">
              {inTransitOrders.length === 1
                ? `Order ${inTransitOrders[0].jobNumber} is on its way!`
                : `${inTransitOrders.length} orders are currently in transit.`}
            </p>
            {inTransitOrders[0].trackingNumber && (
              <p className="text-emerald-600 text-xs mt-0.5">
                Tracking: {inTransitOrders[0].trackingNumber} via {inTransitOrders[0].carrier}
              </p>
            )}
          </div>
          <Link to="/portal/orders" className="text-emerald-700 hover:text-emerald-900 font-semibold text-sm flex items-center gap-1">
            Track <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Orders',
            value: totalActive,
            icon: Clock,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            ring: 'ring-blue-100',
          },
          {
            label: 'Ready for Pickup',
            value: readyOrders.length,
            icon: CheckCircle,
            color: 'text-teal-600',
            bg: 'bg-teal-50',
            ring: 'ring-teal-100',
          },
          {
            label: 'In Transit',
            value: inTransitOrders.length,
            icon: Truck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            ring: 'ring-emerald-100',
          },
          {
            label: 'Total Orders',
            value: myOrders.length,
            icon: TrendingUp,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            ring: 'ring-violet-100',
          },
        ].map(({ label, value, icon: Icon, color, bg, ring }) => (
          <div key={label} className={`bg-white rounded-xl p-5 shadow-sm ring-1 ${ring} flex items-center gap-4`}>
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Active orders ─────────────────────────────────────────────────── */}
      {activeOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Active Orders</h2>
            <Link to="/portal/orders" className="text-[#1f355e] text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {activeOrders.map(order => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.received;
              const pct = getProgressPercent(order.status);
              const latestEvent = order.statusHistory[order.statusHistory.length - 1];
              return (
                <Link
                  key={order.id}
                  to={`/portal/orders/${order.id}`}
                  className="block bg-white rounded-xl shadow-sm ring-1 ring-gray-100 p-5 hover:shadow-md hover:ring-[#1f355e]/20 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 text-sm">{order.jobNumber}</span>
                        {order.poNumber && (
                          <span className="text-xs text-gray-400">PO: {order.poNumber}</span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm">{order.description}</p>
                      {order.color && (
                        <p className="text-gray-400 text-xs mt-0.5">{order.color}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        Est. {formatDate(order.expectedCompletion)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Progress</span>
                      <span className="text-xs font-semibold text-gray-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-[#1f355e] to-[#009877] h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Latest update */}
                  {latestEvent.note && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                      <span className="font-semibold text-gray-600">Latest update: </span>
                      {latestEvent.note}
                    </p>
                  )}

                  {/* Footer row */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{order.quantity.toLocaleString()} {order.unitType}</span>
                      {order.weight && <span>· {order.weight.toLocaleString()} lbs</span>}
                    </div>
                    <span className="text-[#1f355e] text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Track order <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              to: '/portal/quote-request',
              icon: FileText,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              label: 'Request a Quote',
              desc: 'Get pricing for new powder coating work',
            },
            {
              to: '/portal/sample-request',
              icon: Beaker,
              color: 'text-violet-600',
              bg: 'bg-violet-50',
              label: 'Request Samples',
              desc: 'Order colour and finish sample chips',
            },
            {
              to: '/portal/contact',
              icon: MessageCircle,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              label: 'Contact Us',
              desc: 'Talk to our team — questions or changes',
            },
          ].map(({ to, icon: Icon, color, bg, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="bg-white rounded-xl shadow-sm ring-1 ring-gray-100 p-5 hover:shadow-md hover:ring-[#1f355e]/20 transition-all group flex items-start gap-4"
            >
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm group-hover:text-[#1f355e] transition-colors">{label}</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recently completed ────────────────────────────────────────────── */}
      {recentCompleted.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recently Completed</h2>
          <div className="space-y-3">
            {recentCompleted.map(order => (
              <Link
                key={order.id}
                to={`/portal/orders/${order.id}`}
                className="flex items-center gap-4 bg-white rounded-xl shadow-sm ring-1 ring-gray-100 px-5 py-4 hover:shadow-md transition-all group"
              >
                <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-800">{order.jobNumber}</span>
                    <span className="text-xs text-gray-400 truncate">{order.description}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Completed {formatDate(order.statusHistory[order.statusHistory.length - 1]?.timestamp ?? order.expectedCompletion)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1f355e] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {myOrders.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No orders yet</h3>
          <p className="text-gray-400 text-sm mb-6">Ready to get started? Request a quote and we'll take it from there.</p>
          <Link
            to="/portal/quote-request"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80] transition-colors"
          >
            <FileText className="w-4 h-4" />
            Request a Quote
          </Link>
        </div>
      )}
    </div>
  );
}
