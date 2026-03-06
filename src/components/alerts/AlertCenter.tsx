import React, { useMemo, useState } from 'react';
import {
  Bell, AlertTriangle, CheckCircle, Clock, TrendingDown,
  Package, Users, Wrench, ShieldAlert, ChevronRight, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { clsx, formatDate, isOverdue } from '../../utils';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const ALERT_TOUR: TourStep[] = [
  { selector: '[data-tour="alert-summary"]', title: 'Alert Summary',      why: 'Counts of critical, warning, info, and dismissed alerts give a quick severity breakdown.',       what: 'Critical alerts need same-day action. Warnings should be reviewed weekly. Info is advisory.' },
  { selector: '[data-tour="alert-filters"]', title: 'Category Filters',   why: 'Filter by production, sales, quality, maintenance, inventory, or finance to focus on one area.',  what: 'Click a category to isolate alerts. Use "All" to see everything. Dismiss resolved alerts.' },
  { selector: '[data-tour="alert-list"]',    title: 'Alert Feed',         why: 'Each alert card shows severity, category, affected area, and a recommended action.',              what: 'Read the description and take action. Dismiss alerts once handled to keep the feed clean.' },
];

// ── Alert types ──────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertCategory = 'production' | 'sales' | 'quality' | 'maintenance' | 'inventory' | 'finance';

interface SmartAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  detail: string;
  link?: string;
  timestamp: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const SEV: Record<AlertSeverity, { color: string; dot: string; badge: string; icon: React.ReactNode }> = {
  critical: { color: 'border-red-200 bg-red-50',    dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',    icon: <AlertTriangle size={14} className="text-red-500" /> },
  warning:  { color: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', icon: <Clock size={14} className="text-amber-500" /> },
  info:     { color: 'border-blue-200 bg-blue-50',   dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',  icon: <Bell size={14} className="text-blue-500" /> },
};

const CAT_ICONS: Record<AlertCategory, React.ReactNode> = {
  production:  <Wrench size={14} className="text-brand-500" />,
  sales:       <TrendingDown size={14} className="text-purple-500" />,
  quality:     <ShieldAlert size={14} className="text-orange-500" />,
  maintenance: <Wrench size={14} className="text-red-500" />,
  inventory:   <Package size={14} className="text-amber-500" />,
  finance:     <CheckCircle size={14} className="text-accent-500" />,
};

// ── Hook: generate smart alerts from state ────────────────────────────────────

export function useSmartAlerts(): SmartAlert[] {
  const { state } = useApp();

  return useMemo(() => {
    const alerts: SmartAlert[] = [];
    const now = new Date();

    // ── Production: overdue jobs ─────────────────────────────────
    const overdueJobs = state.jobs.filter(j =>
      !['complete','cancelled','on_hold'].includes(j.status) && isOverdue(j.dueDate, j.status),
    );
    if (overdueJobs.length > 0) {
      alerts.push({
        id: 'overdue-jobs',
        severity: overdueJobs.length > 3 ? 'critical' : 'warning',
        category: 'production',
        title: `${overdueJobs.length} overdue job${overdueJobs.length > 1 ? 's' : ''}`,
        detail: overdueJobs.slice(0, 3).map(j => `${j.jobNumber} (${j.customerName})`).join(', ') + (overdueJobs.length > 3 ? ` +${overdueJobs.length - 3} more` : ''),
        link: '/jobs',
        timestamp: now.toISOString(),
      });
    }

    // ── Production: rush jobs unassigned ─────────────────────────
    const unassignedRush = state.jobs.filter(j => j.priority === 'rush' && !j.assignedOperator && !['complete','cancelled'].includes(j.status));
    if (unassignedRush.length > 0) {
      alerts.push({
        id: 'unassigned-rush',
        severity: 'critical',
        category: 'production',
        title: `${unassignedRush.length} rush job${unassignedRush.length > 1 ? 's' : ''} unassigned`,
        detail: unassignedRush.map(j => j.jobNumber).join(', '),
        link: '/jobs',
        timestamp: now.toISOString(),
      });
    }

    // ── Sales: quotes expiring within 3 days ─────────────────────
    const expiringQuotes = state.quotes?.filter(q => {
      if (q.status !== 'sent') return false;
      const exp = new Date(q.expiryDate);
      const diff = (exp.getTime() - now.getTime()) / 86400000;
      return diff <= 3 && diff >= 0;
    }) ?? [];
    if (expiringQuotes.length > 0) {
      alerts.push({
        id: 'expiring-quotes',
        severity: 'warning',
        category: 'sales',
        title: `${expiringQuotes.length} quote${expiringQuotes.length > 1 ? 's' : ''} expiring within 3 days`,
        detail: expiringQuotes.slice(0, 3).map((q: any) => `${q.quoteNumber} — ${q.customerName}`).join(', '),
        link: '/quotes',
        timestamp: now.toISOString(),
      });
    }

    // ── Sales: CRM opportunities needing follow-up (no update > 7 days) ─
    const staleOpps = state.crmOpportunities.filter(o => {
      if (!['lead','prospect','quoted','negotiating'].includes(o.stage)) return false;
      const updated = new Date(o.updatedAt ?? o.createdAt);
      return (now.getTime() - updated.getTime()) / 86400000 > 7;
    });
    if (staleOpps.length > 0) {
      alerts.push({
        id: 'stale-opportunities',
        severity: 'warning',
        category: 'sales',
        title: `${staleOpps.length} CRM opportunit${staleOpps.length > 1 ? 'ies' : 'y'} needing follow-up (7+ days)`,
        detail: staleOpps.slice(0, 3).map(o => o.title).join(', ') + (staleOpps.length > 3 ? ` +${staleOpps.length - 3} more` : ''),
        link: '/crm',
        timestamp: now.toISOString(),
      });
    }

    // ── Quality: jobs in QC > 2 days ─────────────────────────────
    const stuckQC = state.jobs.filter(j => {
      if (j.status !== 'qc') return false;
      const last = j.statusHistory?.find(h => h.status === 'qc');
      if (!last) return false;
      return (now.getTime() - new Date(last.timestamp).getTime()) / 86400000 > 2;
    });
    if (stuckQC.length > 0) {
      alerts.push({
        id: 'stuck-qc',
        severity: 'warning',
        category: 'quality',
        title: `${stuckQC.length} job${stuckQC.length > 1 ? 's' : ''} stuck in QC > 2 days`,
        detail: stuckQC.map(j => j.jobNumber).join(', '),
        link: '/quality',
        timestamp: now.toISOString(),
      });
    }

    // ── Maintenance: overdue or due soon ──────────────────────────
    const overdueMain = state.maintenanceSchedules.filter(s => s.status === 'overdue');
    const dueSoonMain = state.maintenanceSchedules.filter(s => s.status === 'due_soon');
    if (overdueMain.length > 0) {
      alerts.push({
        id: 'maintenance-overdue',
        severity: 'critical',
        category: 'maintenance',
        title: `${overdueMain.length} maintenance item${overdueMain.length > 1 ? 's' : ''} overdue`,
        detail: overdueMain.slice(0, 3).map(s => s.equipmentName).join(', '),
        link: '/costing',
        timestamp: now.toISOString(),
      });
    }
    if (dueSoonMain.length > 0) {
      alerts.push({
        id: 'maintenance-due-soon',
        severity: 'warning',
        category: 'maintenance',
        title: `${dueSoonMain.length} maintenance item${dueSoonMain.length > 1 ? 's' : ''} due soon`,
        detail: dueSoonMain.slice(0, 3).map(s => s.equipmentName).join(', '),
        link: '/costing',
        timestamp: now.toISOString(),
      });
    }

    // ── Inventory: low stock ──────────────────────────────────────
    const lowStock = state.inventory.filter(i => i.quantityOnHand - i.quantityAllocated <= i.reorderPoint);
    const outOfStock = lowStock.filter(i => i.quantityOnHand - i.quantityAllocated <= 0);
    if (outOfStock.length > 0) {
      alerts.push({
        id: 'out-of-stock',
        severity: 'critical',
        category: 'inventory',
        title: `${outOfStock.length} inventory item${outOfStock.length > 1 ? 's' : ''} out of stock`,
        detail: outOfStock.slice(0, 3).map(i => i.name).join(', '),
        link: '/inventory',
        timestamp: now.toISOString(),
      });
    }
    const lowNotOut = lowStock.filter(i => i.quantityOnHand - i.quantityAllocated > 0);
    if (lowNotOut.length > 0) {
      alerts.push({
        id: 'low-stock',
        severity: 'warning',
        category: 'inventory',
        title: `${lowNotOut.length} item${lowNotOut.length > 1 ? 's' : ''} at or below reorder point`,
        detail: lowNotOut.slice(0, 3).map(i => i.name).join(', '),
        link: '/inventory',
        timestamp: now.toISOString(),
      });
    }

    // ── Finance: invoices overdue ─────────────────────────────────
    const overdueInv = state.invoices.filter(i => i.status === 'overdue');
    if (overdueInv.length > 0) {
      const total = overdueInv.reduce((s, i) => s + i.balance, 0);
      alerts.push({
        id: 'overdue-invoices',
        severity: overdueInv.length > 5 ? 'critical' : 'warning',
        category: 'finance',
        title: `${overdueInv.length} overdue invoice${overdueInv.length > 1 ? 's' : ''} — $${total.toLocaleString()}`,
        detail: overdueInv.slice(0, 3).map(i => i.customerName).join(', '),
        link: '/invoices',
        timestamp: now.toISOString(),
      });
    }

    // Sort: critical first, then warning, then info
    const sevOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  }, [state]);
}

// ── Alert Center Page ─────────────────────────────────────────────────────────

export function AlertCenter() {
  const alerts = useSmartAlerts();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filterCat, setFilterCat] = useState<AlertCategory | 'all'>('all');

  const visible = alerts.filter(a => !dismissed.has(a.id) && (filterCat === 'all' || a.category === filterCat));
  const criticalCount = visible.filter(a => a.severity === 'critical').length;
  const warningCount  = visible.filter(a => a.severity === 'warning').length;

  const CATS: Array<{ id: AlertCategory | 'all'; label: string }> = [
    { id: 'all', label: `All (${visible.length})` },
    { id: 'production',  label: 'Production' },
    { id: 'sales',       label: 'Sales' },
    { id: 'quality',     label: 'Quality' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'inventory',   label: 'Inventory' },
    { id: 'finance',     label: 'Finance' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-brand-gradient text-white rounded-xl px-5 py-4 shadow-brand">
        <div className="flex items-center gap-3">
          <Bell size={22} />
          <div>
            <div className="font-bold tracking-tight flex items-center gap-2">Alert Center <GuidedTourButton steps={ALERT_TOUR} /></div>
            <div className="text-white/60 text-xs mt-0.5">Smart notifications generated from live ERP data</div>
          </div>
          <div className="ml-auto flex gap-2">
            {criticalCount > 0 && <Badge className="bg-red-500 text-white font-bold">{criticalCount} Critical</Badge>}
            {warningCount > 0 && <Badge className="bg-amber-400 text-amber-900 font-bold">{warningCount} Warnings</Badge>}
            {visible.length === 0 && <Badge className="bg-white/20 text-white">All clear ✓</Badge>}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div data-tour="alert-summary" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critical', value: alerts.filter(a => !dismissed.has(a.id) && a.severity === 'critical').length, cls: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Warnings', value: alerts.filter(a => !dismissed.has(a.id) && a.severity === 'warning').length,  cls: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Info',     value: alerts.filter(a => !dismissed.has(a.id) && a.severity === 'info').length,     cls: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Dismissed', value: dismissed.size, cls: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
        ].map(s => (
          <div key={s.label} className={clsx('rounded-xl border p-4', s.bg)}>
            <div className={clsx('text-2xl font-extrabold', s.cls)}>{s.value}</div>
            <div className="text-xs font-semibold text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div data-tour="alert-filters" className="flex flex-wrap gap-1.5">
        {CATS.map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCat(c.id as AlertCategory | 'all')}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
              filterCat === c.id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
            )}
          >
            {c.id !== 'all' && CAT_ICONS[c.id as AlertCategory]}
            {c.label}
          </button>
        ))}
        {dismissed.size > 0 && (
          <button
            onClick={() => setDismissed(new Set())}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Restore {dismissed.size} dismissed
          </button>
        )}
      </div>

      {/* Alert list */}
      <div data-tour="alert-list">
      {visible.length === 0 ? (
        <div className="rounded-xl border border-accent-200 bg-accent-50 px-5 py-10 text-center">
          <CheckCircle size={36} className="mx-auto mb-3 text-accent-500 opacity-60" />
          <p className="text-sm font-semibold text-accent-700">All clear! No active alerts.</p>
          <p className="text-xs text-accent-600 mt-1">Great work — keep the green going.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(alert => {
            const s = SEV[alert.severity];
            return (
              <div
                key={alert.id}
                className={clsx('flex items-start gap-3 p-4 rounded-xl border-2 transition-all', s.color)}
              >
                <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <Badge className={s.badge}>{alert.severity}</Badge>
                    <Badge className="bg-gray-100 text-gray-600 gap-1">
                      {CAT_ICONS[alert.category]} {alert.category}
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{alert.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{alert.detail}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {alert.link && (
                    <a href={alert.link} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5 whitespace-nowrap">
                      View <ChevronRight size={12} />
                    </a>
                  )}
                  <button
                    onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
