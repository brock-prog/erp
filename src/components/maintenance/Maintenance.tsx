import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Calendar,
  Plus, Activity, X, Check, TrendingUp, BarChart2, Users,
  ClipboardList, Cpu, ChevronRight, Edit2, Trash2, Zap,
  Package, Timer, DollarSign, Percent, BookOpen, Info, ExternalLink,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { StatCard } from '../ui/StatCard';
import { formatDate, formatCurrency, generateId, clsx } from '../../utils';
import { exportToCSV, type ExportColumn } from '../../lib/exportUtils';
import { MaintenanceScheduler } from '../equipment/MaintenanceScheduler';
import type {
  MaintenanceTask, MaintenancePriority, MaintenanceType,
  MaintenanceChecklistItem, MaintenancePart, LaborEntry,
  MaintenanceSchedule, SparePart,
} from '../../types';
import { PhotoCapture } from '../ui/PhotoCapture';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const MAINTENANCE_TOUR: TourStep[] = [
  { selector: '[data-tour="maint-tabs"]', title: 'Maintenance Tabs',
    why: 'Dashboard, Work Orders, PM Schedule, Equipment Health, and Analytics — each manages a different aspect of CMMS.',
    what: 'Dashboard = KPIs + upcoming. Work Orders = full task list. PM Schedule = preventive maintenance calendar.' },
  { selector: '[data-tour="maint-new"]', title: 'New Work Order',
    why: 'Every maintenance task — preventive, corrective, or emergency — starts with a work order.',
    what: 'Click "New Work Order" to select equipment, type, priority, and assign a technician.' },
  { selector: '[data-tour="maint-content"]', title: 'Tab Content',
    why: 'Active tab shows relevant maintenance data with filters, tables, and action buttons.',
    what: 'Use the Dashboard for a quick overview. Switch to Work Orders for full CRUD management with labor and parts tracking.' },
];

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<MaintenanceType, string> = {
  preventive: 'Preventive', corrective: 'Corrective',
  emergency: 'Emergency', calibration: 'Calibration', inspection: 'Inspection',
};
const TYPE_COLORS: Record<MaintenanceType, string> = {
  preventive: 'bg-blue-100 text-blue-800',
  corrective: 'bg-orange-100 text-orange-800',
  emergency: 'bg-red-100 text-red-800',
  calibration: 'bg-purple-100 text-purple-800',
  inspection: 'bg-teal-100 text-teal-800',
};
const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  complete: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};
const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low: 'text-gray-500', medium: 'text-blue-600', high: 'text-orange-600', critical: 'text-red-600',
};
const PRIORITY_BG: Record<MaintenancePriority, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700', critical: 'bg-red-50 text-red-700',
};

// Disposal instructions by part type / notes keywords
function getDisposalInstructions(part: MaintenancePart, sparePart?: SparePart): string {
  const notes = sparePart?.notes?.toLowerCase() ?? '';
  const desc = part.description.toLowerCase();
  if (notes.includes('gema') || desc.includes('gema') || notes.includes('1020') || notes.includes('1019') || notes.includes('1018') || notes.includes('1015')) {
    return 'GEMA OEM part — contact GEMA USA (317-808-4888) to inquire about core return / warranty. Keep defective part in labelled bag until GEMA confirms return or disposal. Part No: ' + (sparePart?.partNumber ?? part.partNumber ?? 'see notes');
  }
  if (notes.includes('filter') || desc.includes('filter')) {
    return 'Used filter — dispose in sealed bag in designated industrial waste bin. Do not place in regular recycling. Powder residue is non-hazardous but must be contained.';
  }
  if (notes.includes('hose') || desc.includes('hose')) {
    return 'Powder hose — cut into sections before disposal to prevent reuse. Dispose in industrial waste. Note: antistatic hose must not be reused once removed.';
  }
  if (notes.includes('oil') || notes.includes('lubric') || desc.includes('oil')) {
    return 'Used lubricant / oil — dispose as used oil per provincial regulations (Ontario: designated used oil depot). Do not pour down drain.';
  }
  if (notes.includes('battery') || desc.includes('battery')) {
    return 'Battery — dispose at designated electronics recycling depot (WEEE). Do not place in regular waste. Lithium cells are fire risk in landfill.';
  }
  return 'Dispose per applicable local waste regulations. If unsure of material classification, contact safety supervisor before disposal.';
}

function daysUntilDate(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function dueBadgeColor(dateStr: string): string {
  const d = daysUntilDate(dateStr);
  if (d < 0) return 'bg-red-100 text-red-800';
  if (d === 0) return 'bg-red-100 text-red-800';
  if (d <= 7) return 'bg-orange-100 text-orange-800';
  if (d <= 30) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}
function dueBadgeLabel(dateStr: string): string {
  const d = daysUntilDate(dateStr);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  if (d <= 7) return `Due in ${d}d`;
  if (d <= 30) return `Due in ${d}d`;
  return `Due in ${d}d`;
}
function cardBorderColor(dateStr: string | undefined): string {
  if (!dateStr) return 'border-l-gray-300';
  const d = daysUntilDate(dateStr);
  if (d < 0) return 'border-l-red-500';
  if (d <= 7) return 'border-l-red-400';
  if (d <= 30) return 'border-l-yellow-400';
  return 'border-l-green-400';
}

function computeLaborCost(entries: LaborEntry[] = []): number {
  return entries.reduce((s, e) => s + e.hoursWorked * e.hourlyRate, 0);
}
function computePartsCost(parts: MaintenancePart[] = []): number {
  return parts.reduce((s, p) => s + p.quantity * p.unitCost, 0);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function Maintenance() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { maintenanceTasks, maintenanceSchedules, equipment, users, spareParts, workInstructions, currentUser } = state;

  type TabKey = 'dashboard' | 'work_orders' | 'pm_schedule' | 'equipment' | 'analytics';
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<MaintenanceTask | null>(null);
  const [prefillFromSchedule, setPrefillFromSchedule] = useState<Partial<MaintenanceTask> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceTask | null>(null);

  // Work Orders filters
  const [fStatus, setFStatus] = useState('all');
  const [fEquip, setFEquip] = useState('all');
  const [fType, setFType] = useState('all');
  const [fPriority, setFPriority] = useState('all');
  const [fSearch, setFSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7);
  const yearStart = today.slice(0, 4);
  const isAdminOrManager = ['admin', 'manager'].includes(currentUser?.role ?? '');

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const overdue = useMemo(() => maintenanceTasks.filter(t => t.status === 'overdue'), [maintenanceTasks]);
  const inProgress = useMemo(() => maintenanceTasks.filter(t => t.status === 'in_progress'), [maintenanceTasks]);
  const scheduledThisWeek = useMemo(() => maintenanceTasks.filter(t => t.status === 'scheduled' && t.scheduledDate >= today && t.scheduledDate <= weekEnd), [maintenanceTasks, today, weekEnd]);
  const completedThisMonth = useMemo(() => maintenanceTasks.filter(t => t.status === 'complete' && (t.completedDate ?? '').startsWith(monthStart)), [maintenanceTasks, monthStart]);
  const completedYTD = useMemo(() => maintenanceTasks.filter(t => t.status === 'complete' && (t.completedDate ?? '').startsWith(yearStart)), [maintenanceTasks, yearStart]);
  const costThisMonth = useMemo(() => completedThisMonth.reduce((s, t) => s + t.laborCost + t.partsCost, 0), [completedThisMonth]);
  const costYTD = useMemo(() => completedYTD.reduce((s, t) => s + t.laborCost + t.partsCost, 0), [completedYTD]);
  const downtimeYTD = useMemo(() => completedYTD.reduce((s, t) => s + (t.downtimeHours ?? 0), 0), [completedYTD]);
  const avgMTTR = useMemo(() => {
    const corrective = completedYTD.filter(t => t.type === 'corrective' && t.actualHours);
    return corrective.length > 0 ? corrective.reduce((s, t) => s + (t.actualHours ?? 0), 0) / corrective.length : 0;
  }, [completedYTD]);
  const pmScheduledCount = useMemo(() => maintenanceTasks.filter(t => t.type === 'preventive').length, [maintenanceTasks]);
  const pmCompliantCount = useMemo(() => maintenanceTasks.filter(t => t.type === 'preventive' && t.status === 'complete' && (t.completedDate ?? '') <= t.scheduledDate).length, [maintenanceTasks]);
  const pmCompliance = pmScheduledCount > 0 ? Math.round((pmCompliantCount / pmScheduledCount) * 100) : 100;

  // ── Upcoming (schedule / dashboard) ──────────────────────────────────────
  const upcoming = useMemo(() => maintenanceTasks
    .filter(t => t.status !== 'complete' && t.status !== 'cancelled')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
  [maintenanceTasks]);

  // ── Work Orders filtered list ─────────────────────────────────────────────
  const filtered = useMemo(() => maintenanceTasks.filter(t => {
    if (fStatus !== 'all' && t.status !== fStatus) return false;
    if (fEquip !== 'all' && t.equipmentId !== fEquip) return false;
    if (fType !== 'all' && t.type !== fType) return false;
    if (fPriority !== 'all' && t.priority !== fPriority) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.taskNumber.toLowerCase().includes(q) && !t.equipmentName.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [maintenanceTasks, fStatus, fEquip, fType, fPriority, fSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function openNew(prefill?: Partial<MaintenanceTask>) {
    setEditTask(null);
    setPrefillFromSchedule(prefill ?? null);
    setShowModal(true);
  }
  function openEdit(t: MaintenanceTask) { setEditTask(t); setPrefillFromSchedule(null); setShowModal(true); }

  function handleSave(task: MaintenanceTask) {
    if (editTask) {
      dispatch({ type: 'UPDATE_MAINTENANCE', payload: task });
    } else {
      dispatch({ type: 'ADD_MAINTENANCE', payload: task });
    }
    // Inventory deduction: handled inside WorkOrderModal on save
    setShowModal(false);
  }

  function handleDelete(task: MaintenanceTask) {
    dispatch({ type: 'DELETE_MAINTENANCE', payload: task.id });
    setConfirmDelete(null);
  }

  function markStatus(task: MaintenanceTask, newStatus: MaintenanceTask['status']) {
    const now = new Date().toISOString();
    dispatch({
      type: 'UPDATE_MAINTENANCE',
      payload: {
        ...task,
        status: newStatus,
        completedDate: newStatus === 'complete' ? now.slice(0, 10) : task.completedDate,
        updatedAt: now,
      },
    });
  }

  function toggleChecklist(task: MaintenanceTask, itemId: string) {
    const updated = {
      ...task,
      checklist: task.checklist.map(c =>
        c.id === itemId ? { ...c, completed: !c.completed, completedBy: currentUser?.name ?? 'Operator', completedAt: new Date().toISOString() } : c
      ),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'UPDATE_MAINTENANCE', payload: updated });
  }

  function handleExportWorkOrders() {
    const cols: ExportColumn<MaintenanceTask>[] = [
      { key: 'taskNumber', header: 'Task #' },
      { key: 'equipmentName', header: 'Equipment' },
      { key: 'type', header: 'Type', format: (v: MaintenanceType) => TYPE_LABELS[v] ?? v },
      { key: 'title', header: 'Title' },
      { key: 'priority', header: 'Priority' },
      { key: 'status', header: 'Status', format: (v: string) => v.replace('_', ' ') },
      { key: 'scheduledDate', header: 'Scheduled', format: (v: string) => v ? formatDate(v) : '' },
      { key: 'assignedToName', header: 'Assigned To', format: (v: string | undefined) => v ?? '' },
      { key: 'estimatedHours', header: 'Est. Hours', format: (v: number | undefined) => v?.toString() ?? '' },
      { key: 'actualHours', header: 'Actual Hours', format: (v: number | undefined) => v ? `${v}h` : '' },
      { key: 'laborCost', header: 'Labor Cost', format: (v: number) => formatCurrency(v ?? 0) },
      { key: 'partsCost', header: 'Parts Cost', format: (v: number) => formatCurrency(v ?? 0) },
      { key: 'description', header: 'Description' },
      { key: 'notes', header: 'Notes' },
    ];
    exportToCSV(filtered, cols, 'maintenance-work-orders');
  }

  function generateWOFromSchedule(schedule: MaintenanceSchedule) {
    const num = String(maintenanceTasks.length + 1).padStart(4, '0');
    const prefill: Partial<MaintenanceTask> = {
      equipmentId: schedule.equipmentId,
      equipmentName: schedule.equipmentName,
      type: 'preventive',
      title: schedule.taskName,
      description: schedule.description ?? '',
      status: 'scheduled',
      priority: schedule.status === 'overdue' ? 'high' : 'medium',
      scheduledDate: today,
      estimatedHours: 1,
      laborCost: 0, partsCost: 0,
      laborEntries: [],
      parts: [], checklist: [],
    };
    // Pre-fill task number hint (will be finalised in modal handleSave)
    (prefill as Record<string, unknown>)['_suggestedNum'] = num;
    openNew(prefill);
  }

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <Activity size={14} /> },
    { key: 'work_orders', label: 'Work Orders', icon: <ClipboardList size={14} />, badge: overdue.length + inProgress.length },
    { key: 'pm_schedule', label: 'PM Schedule', icon: <Calendar size={14} />, badge: maintenanceSchedules.filter(s => s.status === 'overdue').length },
    { key: 'equipment', label: 'Equipment', icon: <Cpu size={14} /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Overdue alert strip */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800 flex-1">
            <span className="font-semibold">{overdue.length} overdue work order{overdue.length > 1 ? 's' : ''}:</span>{' '}
            {overdue.slice(0, 3).map(t => `${t.equipmentName} — ${t.title}`).join(' · ')}
            {overdue.length > 3 && ` · +${overdue.length - 3} more`}
          </div>
          <button onClick={() => { setFStatus('overdue'); setTab('work_orders'); }} className="text-xs text-red-700 underline whitespace-nowrap">View all</button>
        </div>
      )}

      {/* Tab nav + New button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GuidedTourButton steps={MAINTENANCE_TOUR} />
        </div>
        <div data-tour="maint-tabs" className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t.icon}{t.label}
              {!!t.badge && t.badge > 0 && (
                <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-semibold', tab === t.key ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700')}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        <span data-tour="maint-new"><Button icon={<Plus size={15} />} onClick={() => openNew()}>New Work Order</Button></span>
      </div>

      {/* ── Dashboard Tab ──────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={18} />} color="red" />
            <StatCard label="In Progress" value={inProgress.length} icon={<Activity size={18} />} color="yellow" />
            <StatCard label="Scheduled This Week" value={scheduledThisWeek.length} icon={<Calendar size={18} />} color="blue" />
            <StatCard label="Cost This Month" value={formatCurrency(costThisMonth)} icon={<DollarSign size={18} />} color="purple" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Cost YTD" value={formatCurrency(costYTD)} icon={<TrendingUp size={18} />} color="green" />
            <StatCard label="Downtime YTD (h)" value={downtimeYTD.toFixed(1)} icon={<Timer size={18} />} color="yellow" />
            <StatCard label="PM Compliance" value={`${pmCompliance}%`} icon={<Percent size={18} />} color={pmCompliance >= 90 ? 'green' : pmCompliance >= 70 ? 'yellow' : 'red'} />
            <StatCard label="Avg MTTR (h)" value={avgMTTR > 0 ? avgMTTR.toFixed(1) : '—'} icon={<Wrench size={18} />} color="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Upcoming this week */}
            <Card>
              <CardHeader title="Upcoming Tasks" subtitle="Active & scheduled work orders" />
              <div className="space-y-2 mt-3">
                {upcoming.slice(0, 8).map(task => {
                  const checkDone = task.checklist.filter(c => c.completed).length;
                  return (
                    <div
                      key={task.id}
                      onClick={() => openEdit(task)}
                      className={clsx('flex items-start gap-3 p-2.5 rounded-lg border-l-4 bg-gray-50 hover:bg-gray-100 cursor-pointer', cardBorderColor(task.scheduledDate))}
                    >
                      <div className="w-10 text-center flex-shrink-0">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase">{new Date(task.scheduledDate + 'T12:00:00').toLocaleString('en', { month: 'short' })}</div>
                        <div className="text-base font-bold text-gray-800 leading-tight">{new Date(task.scheduledDate + 'T12:00:00').getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{task.title}</div>
                        <button
                          className="text-xs text-brand-500 hover:text-brand-700 hover:underline mt-0.5 text-left leading-tight"
                          onClick={e => { e.stopPropagation(); setFEquip(task.equipmentId); setTab('work_orders'); }}
                          title={`Show all WOs for ${task.equipmentName}`}
                        >{task.equipmentName}</button>
                        {task.checklist.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex-1 bg-gray-200 rounded-full h-1 max-w-[80px]">
                              <div className="bg-brand-500 h-1 rounded-full" style={{ width: `${(checkDone / task.checklist.length) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400">{checkDone}/{task.checklist.length}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
                        <span className={clsx('text-[10px] font-bold uppercase', PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                      </div>
                    </div>
                  );
                })}
                {upcoming.length === 0 && <div className="text-center text-sm text-gray-400 py-6">No active work orders</div>}
                {upcoming.length > 8 && (
                  <button onClick={() => setTab('work_orders')} className="text-xs text-brand-600 hover:underline w-full text-center pt-1">
                    View all {upcoming.length} tasks →
                  </button>
                )}
              </div>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader title="Recent Activity" subtitle="Last 10 status changes" />
              <div className="space-y-2 mt-3">
                {[...maintenanceTasks]
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .slice(0, 10)
                  .map(task => (
                    <div key={task.id} className="flex items-center gap-3 text-xs py-1 border-b border-gray-50 last:border-0">
                      <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
                      <button className="flex-1 truncate text-gray-700 hover:text-brand-600 text-left" onClick={() => openEdit(task)}>{task.title}</button>
                      <button
                        className="text-gray-400 hover:text-brand-600 hover:underline whitespace-nowrap"
                        onClick={() => { setFEquip(task.equipmentId); setTab('work_orders'); }}
                        title={task.equipmentName}
                      >{task.equipmentName.split(' ')[0]}</button>
                      <span className="text-gray-400 whitespace-nowrap">{formatDate(task.updatedAt?.slice(0, 10))}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Work Orders Tab ────────────────────────────────────────────── */}
      {tab === 'work_orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-end">
            <Input
              label="" placeholder="Search task #, title, equipment…"
              value={fSearch} onChange={e => setFSearch(e.target.value)}
              className="min-w-[200px]"
            />
            <Select label="" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {['scheduled', 'in_progress', 'overdue', 'complete', 'cancelled'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </Select>
            <Select label="" value={fEquip} onChange={e => setFEquip(e.target.value)}>
              <option value="all">All Equipment</option>
              {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select label="" value={fType} onChange={e => setFType(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select label="" value={fPriority} onChange={e => setFPriority(e.target.value)}>
              <option value="all">All Priorities</option>
              {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            {(fStatus !== 'all' || fEquip !== 'all' || fType !== 'all' || fPriority !== 'all' || fSearch) && (
              <button onClick={() => { setFStatus('all'); setFEquip('all'); setFType('all'); setFPriority('all'); setFSearch(''); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
            )}
            <div className="ml-auto">
              <Button
                icon={<Download size={15} />}
                onClick={handleExportWorkOrders}
                variant="secondary"
                disabled={filtered.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Task #', 'Equipment', 'Type', 'Title', 'Priority', 'Status', 'Scheduled', 'Assigned', 'Est.h', 'Actual.h', 'Labor', 'Parts', 'Total', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(task)}>
                      <td className="px-3 py-2.5 font-mono text-xs text-brand-700 whitespace-nowrap">{task.taskNumber}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" onClick={e => e.stopPropagation()}>
                        <button
                          className="text-gray-700 hover:text-brand-600 hover:underline text-left w-full truncate"
                          onClick={() => { setFEquip(task.equipmentId); }}
                          title={`Filter WOs for ${task.equipmentName}`}
                        >{task.equipmentName}</button>
                      </td>
                      <td className="px-3 py-2.5"><Badge className={TYPE_COLORS[task.type]}>{TYPE_LABELS[task.type]}</Badge></td>
                      <td className="px-3 py-2.5 text-xs text-gray-800 max-w-[200px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{task.title}</span>
                          {task.workInstructionId && workInstructions.find(w => w.id === task.workInstructionId) && (
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/work-instructions?id=${task.workInstructionId}`); }}
                              className="flex-shrink-0 text-brand-400 hover:text-brand-700"
                              title={`View WI: ${workInstructions.find(w => w.id === task.workInstructionId)?.documentNumber ?? 'Work Instruction'}`}
                            >
                              <BookOpen size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><Badge className={PRIORITY_BG[task.priority]}>{task.priority}</Badge></td>
                      <td className="px-3 py-2.5"><Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge></td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{formatDate(task.scheduledDate)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{task.assignedToName ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{task.estimatedHours}h</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{task.actualHours ? `${task.actualHours}h` : '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatCurrency(task.laborCost)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatCurrency(task.partsCost)}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 whitespace-nowrap">{formatCurrency(task.laborCost + task.partsCost)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {task.status === 'scheduled' && (
                            <button onClick={() => markStatus(task, 'in_progress')} className="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 px-2 py-0.5 rounded-md whitespace-nowrap">Start</button>
                          )}
                          {task.status === 'in_progress' && (
                            <button onClick={() => markStatus(task, 'complete')} className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-0.5 rounded-md whitespace-nowrap">Complete</button>
                          )}
                          <button onClick={() => openEdit(task)} className="p-1 text-gray-400 hover:text-brand-600 rounded"><Edit2 size={12} /></button>
                          {isAdminOrManager && (
                            <button onClick={() => setConfirmDelete(task)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">No work orders match filters</div>}
            </div>
          </Card>
        </div>
      )}

      {/* ── PM Schedule Tab ────────────────────────────────────────────── */}
      {tab === 'pm_schedule' && (
        <div className="space-y-5">
          {/* Due/Overdue schedules — quick WO generation */}
          {maintenanceSchedules.filter(s => s.status !== 'ok').length > 0 && (
            <Card>
              <CardHeader
                title="Action Required — Due & Overdue PM Tasks"
                subtitle="Click 'Generate Work Order' to create a work order from a due PM schedule"
              />
              <div className="mt-3 space-y-2">
                {maintenanceSchedules
                  .filter(s => s.status !== 'ok')
                  .sort((a, b) => (a.status === 'overdue' ? -1 : 1) - (b.status === 'overdue' ? -1 : 1))
                  .map(s => (
                    <div key={s.id} className={clsx(
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg border',
                      s.status === 'overdue' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50',
                    )}>
                      <Badge className={s.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                        {s.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{s.taskName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{s.equipmentName}</span>
                          {s.workInstructionId && workInstructions.find(w => w.id === s.workInstructionId) && (
                            <button
                              onClick={() => navigate(`/work-instructions?id=${s.workInstructionId}`)}
                              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 hover:underline"
                            >
                              <BookOpen size={11} />
                              {(workInstructions.find(w => w.id === s.workInstructionId) as typeof workInstructions[0] & { documentNumber?: string })?.documentNumber ?? 'View WI'}
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus size={12} />}
                        onClick={() => generateWOFromSchedule(s)}
                      >
                        Generate Work Order
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Full PM Scheduler (existing component) */}
          <MaintenanceScheduler />
        </div>
      )}

      {/* ── Equipment Health Tab ───────────────────────────────────────── */}
      {tab === 'equipment' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {equipment.map(eq => {
            const equipTasks = maintenanceTasks.filter(t => t.equipmentId === eq.id);
            const overdueEq = equipTasks.filter(t => t.status === 'overdue').length;
            const inProgEq = equipTasks.filter(t => t.status === 'in_progress').length;
            const completedEq = equipTasks.filter(t => t.status === 'complete');
            const ytdCostEq = completedEq
              .filter(t => (t.completedDate ?? '').startsWith(yearStart))
              .reduce((s, t) => s + t.laborCost + t.partsCost, 0);
            const openEq = equipTasks.filter(t => !['complete', 'cancelled'].includes(t.status)).length;
            const statusColors: Record<string, string> = {
              operational: 'bg-green-100 text-green-800',
              maintenance: 'bg-yellow-100 text-yellow-800',
              down: 'bg-red-100 text-red-800',
              retired: 'bg-gray-100 text-gray-600',
            };
            return (
              <Card
                key={eq.id}
                className={clsx('border-l-4', overdueEq > 0 ? 'border-l-red-400' : inProgEq > 0 ? 'border-l-yellow-400' : 'border-l-green-400')}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-semibold text-gray-900 text-sm truncate">{eq.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{eq.location} · {eq.model}</div>
                  </div>
                  <Badge className={statusColors[eq.status]}>{eq.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="text-gray-500">Last PM</div>
                  <div className="text-gray-700 text-right">{eq.lastMaintenanceDate ? formatDate(eq.lastMaintenanceDate) : '—'}</div>
                  <div className="text-gray-500">Open WOs</div>
                  <div className={clsx('text-right font-semibold', openEq > 0 ? (overdueEq > 0 ? 'text-red-600' : 'text-yellow-600') : 'text-green-600')}>
                    {openEq > 0 ? `${openEq} open${overdueEq > 0 ? ` (${overdueEq} overdue)` : ''}` : 'None'}
                  </div>
                  <div className="text-gray-500">Total WOs</div>
                  <div className="text-gray-700 text-right">{equipTasks.length}</div>
                  <div className="text-gray-500">Cost YTD</div>
                  <div className="text-gray-700 text-right font-semibold">{ytdCostEq > 0 ? formatCurrency(ytdCostEq) : '—'}</div>
                </div>
                <button
                  onClick={() => { setFEquip(eq.id); setFStatus('all'); setTab('work_orders'); }}
                  className="mt-3 w-full text-xs text-brand-600 hover:text-brand-800 hover:underline flex items-center justify-center gap-1"
                >
                  View work orders <ChevronRight size={11} />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Analytics Tab ─────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <AnalyticsTab
          tasks={maintenanceTasks}
          equipment={equipment}
          yearStart={yearStart}
          monthStart={monthStart}
          onNavigateToEquipment={(eqId) => { setFEquip(eqId); setFStatus('all'); setTab('work_orders'); }}
        />
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showModal && (
        <WorkOrderModal
          task={editTask}
          prefill={prefillFromSchedule}
          equipment={equipment}
          users={users}
          spareParts={spareParts}
          workInstructions={workInstructions}
          taskCount={maintenanceTasks.length}
          isAdminOrManager={isAdminOrManager}
          currentUserName={currentUser?.name ?? 'Unknown'}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setPrefillFromSchedule(null); }}
          onToggleChecklist={editTask ? (id) => toggleChecklist(editTask, id) : undefined}
          onDelete={isAdminOrManager && editTask ? () => { setShowModal(false); setConfirmDelete(editTask); } : undefined}
          onDeductInventory={(sparePartId, qty) => {
            const sp = spareParts.find(s => s.id === sparePartId);
            if (sp) {
              dispatch({
                type: 'UPDATE_SPARE_PART',
                payload: { ...sp, quantityOnHand: Math.max(0, sp.quantityOnHand - qty), updatedAt: new Date().toISOString() },
              });
            }
          }}
        />
      )}

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete Work Order" size="sm"
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Delete Permanently</Button>
            </div>
          }
        >
          <div className="text-sm text-gray-700 space-y-2">
            <p>Are you sure you want to delete <span className="font-semibold">{confirmDelete.taskNumber} — {confirmDelete.title}</span>?</p>
            <p className="text-gray-500">This action cannot be undone and will remove all labor entries, parts, and checklist data associated with this work order.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────

function AnalyticsTab({
  tasks, equipment, yearStart, monthStart, onNavigateToEquipment,
}: {
  tasks: MaintenanceTask[];
  equipment: { id: string; name: string; location: string }[];
  yearStart: string;
  monthStart: string;
  onNavigateToEquipment: (equipmentId: string) => void;
}) {
  const completedYTD = tasks.filter(t => t.status === 'complete' && (t.completedDate ?? '').startsWith(yearStart));
  const completed = tasks.filter(t => t.status === 'complete');

  // Cost by equipment
  const byEquipment = useMemo(() => {
    const map: Record<string, { id: string; name: string; wos: number; hours: number; labor: number; parts: number; total: number }> = {};
    completedYTD.forEach(t => {
      if (!map[t.equipmentId]) map[t.equipmentId] = { id: t.equipmentId, name: t.equipmentName, wos: 0, hours: 0, labor: 0, parts: 0, total: 0 };
      map[t.equipmentId].wos++;
      map[t.equipmentId].hours += t.actualHours ?? t.estimatedHours;
      map[t.equipmentId].labor += t.laborCost;
      map[t.equipmentId].parts += t.partsCost;
      map[t.equipmentId].total += t.laborCost + t.partsCost;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [completedYTD]);

  const maxCost = byEquipment.reduce((m, r) => Math.max(m, r.total), 1);

  // Monthly trend (last 12 months)
  const monthly = useMemo(() => {
    const months: { month: string; labor: number; parts: number; total: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const m = d.toISOString().slice(0, 7);
      const bucket = completed.filter(t => (t.completedDate ?? '').startsWith(m));
      months.push({
        month: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
        labor: bucket.reduce((s, t) => s + t.laborCost, 0),
        parts: bucket.reduce((s, t) => s + t.partsCost, 0),
        total: bucket.reduce((s, t) => s + t.laborCost + t.partsCost, 0),
        count: bucket.length,
      });
    }
    return months;
  }, [completed]);

  const maxMonthCost = monthly.reduce((m, r) => Math.max(m, r.total), 1);

  // Technician utilization
  const byTech = useMemo(() => {
    const map: Record<string, { name: string; wos: number; hours: number; cost: number }> = {};
    completed.forEach(task => {
      (task.laborEntries ?? []).forEach(e => {
        if (!map[e.technicianName]) map[e.technicianName] = { name: e.technicianName, wos: 0, hours: 0, cost: 0 };
        map[e.technicianName].hours += e.hoursWorked;
        map[e.technicianName].cost += e.hoursWorked * e.hourlyRate;
      });
      if (task.assignedToName && !(task.laborEntries ?? []).length) {
        // fallback: count WO if no labor entries
        if (!map[task.assignedToName]) map[task.assignedToName] = { name: task.assignedToName, wos: 0, hours: 0, cost: 0 };
        map[task.assignedToName].wos++;
        map[task.assignedToName].hours += task.actualHours ?? task.estimatedHours;
        map[task.assignedToName].cost += task.laborCost;
      }
    });
    // Merge WOs into tech records
    completed.forEach(task => {
      if (task.assignedToName && (task.laborEntries ?? []).length === 0) return; // already counted
      (task.laborEntries ?? []).forEach(e => {
        if (map[e.technicianName]) {
          map[e.technicianName].wos = (map[e.technicianName].wos ?? 0);
        }
      });
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [completed]);

  // PM compliance per equipment
  const pmCompliance = useMemo(() => {
    const map: Record<string, { id: string; name: string; scheduled: number; onTime: number }> = {};
    tasks.filter(t => t.type === 'preventive').forEach(t => {
      if (!map[t.equipmentId]) map[t.equipmentId] = { id: t.equipmentId, name: t.equipmentName, scheduled: 0, onTime: 0 };
      map[t.equipmentId].scheduled++;
      if (t.status === 'complete' && (t.completedDate ?? '') <= t.scheduledDate) map[t.equipmentId].onTime++;
    });
    return Object.values(map).sort((a, b) => (a.onTime / Math.max(a.scheduled, 1)) - (b.onTime / Math.max(b.scheduled, 1)));
  }, [tasks]);

  const totalYTD = completedYTD.reduce((s, t) => s + t.laborCost + t.partsCost, 0);
  const laborYTD = completedYTD.reduce((s, t) => s + t.laborCost, 0);
  const partsYTD = completedYTD.reduce((s, t) => s + t.partsCost, 0);
  const downtimeYTD = completedYTD.reduce((s, t) => s + (t.downtimeHours ?? 0), 0);
  const corrective = tasks.filter(t => t.type === 'corrective' && t.status === 'complete' && t.actualHours);
  const avgMTTR = corrective.length > 0 ? corrective.reduce((s, t) => s + (t.actualHours ?? 0), 0) / corrective.length : 0;
  const pmSched = tasks.filter(t => t.type === 'preventive').length;
  const pmOnTime = tasks.filter(t => t.type === 'preventive' && t.status === 'complete' && (t.completedDate ?? '') <= t.scheduledDate).length;
  const pmPct = pmSched > 0 ? Math.round((pmOnTime / pmSched) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* A. Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Spend YTD" value={formatCurrency(totalYTD)} icon={<DollarSign size={18} />} color="purple" />
        <StatCard label="Labor YTD" value={formatCurrency(laborYTD)} icon={<Users size={18} />} color="blue" />
        <StatCard label="Parts YTD" value={formatCurrency(partsYTD)} icon={<Package size={18} />} color="yellow" />
        <StatCard label="Downtime YTD (h)" value={downtimeYTD.toFixed(1)} icon={<Timer size={18} />} color="red" />
        <StatCard label="PM Compliance" value={`${pmPct}%`} icon={<Percent size={18} />} color={pmPct >= 90 ? 'green' : pmPct >= 70 ? 'yellow' : 'red'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="WOs Completed YTD" value={completedYTD.length} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="Avg MTTR (corrective)" value={avgMTTR > 0 ? `${avgMTTR.toFixed(1)}h` : '—'} icon={<Clock size={18} />} color="yellow" />
        <StatCard label="Avg Cost / WO" value={completedYTD.length > 0 ? formatCurrency(totalYTD / completedYTD.length) : '—'} icon={<TrendingUp size={18} />} color="blue" />
      </div>

      {/* B. Cost by Equipment */}
      <Card>
        <CardHeader title="Cost by Equipment — YTD" subtitle={`${completedYTD.length} completed work orders`} />
        {byEquipment.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Equipment', 'WOs', 'Hours', 'Labor', 'Parts', 'Total', 'Spend'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byEquipment.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm max-w-[200px] truncate">
                      <button
                        className="font-medium text-brand-600 hover:text-brand-800 hover:underline text-left truncate w-full"
                        onClick={() => onNavigateToEquipment(row.id)}
                        title={`View WOs for ${row.name}`}
                      >{row.name}</button>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.wos}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.hours.toFixed(1)}h</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{formatCurrency(row.labor)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{formatCurrency(row.parts)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(row.total)}</td>
                    <td className="px-3 py-2.5 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${(row.total / maxCost) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round((row.total / maxCost) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-sm text-gray-400 py-8 mt-3">No completed work orders this year</div>
        )}
      </Card>

      {/* C. Monthly Cost Trend */}
      <Card>
        <CardHeader title="Monthly Cost Trend — Rolling 12 Months" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Month', 'WOs', 'Labor', 'Parts', 'Total', 'Trend'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthly.map(row => (
                <tr key={row.month} className={clsx('hover:bg-gray-50', row.month === new Date().toLocaleString('en', { month: 'short', year: '2-digit' }) ? 'bg-brand-50' : '')}>
                  <td className="px-3 py-2 text-xs font-medium text-gray-700 whitespace-nowrap">{row.month}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{row.count}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(row.labor)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(row.parts)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-800">{formatCurrency(row.total)}</td>
                  <td className="px-3 py-2 w-32">
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-400 h-2 rounded-full" style={{ width: `${(row.total / maxMonthCost) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* D. Technician Utilization */}
      <Card>
        <CardHeader title="Technician Utilization" subtitle="Based on labor entries logged on completed work orders" />
        {byTech.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Technician', 'WOs', 'Total Hours', 'Est. Labor Cost'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byTech.map(row => (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm text-gray-800 font-medium">{row.name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{row.wos}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{row.hours.toFixed(1)}h</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-sm text-gray-400 py-8 mt-3">No labor entries recorded yet. Add labor entries to work orders to track technician utilization.</div>
        )}
      </Card>

      {/* E. PM Compliance per Equipment */}
      <Card>
        <CardHeader title="PM Compliance by Equipment" subtitle="Preventive maintenance tasks: completed on or before scheduled date" />
        {pmCompliance.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Equipment', 'PM Tasks', 'On-Time', '% Compliance', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pmCompliance.map(row => {
                  const pct = Math.round((row.onTime / Math.max(row.scheduled, 1)) * 100);
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-sm max-w-[200px] truncate">
                        <button
                          className="font-medium text-brand-600 hover:text-brand-800 hover:underline text-left truncate w-full"
                          onClick={() => onNavigateToEquipment(row.id)}
                          title={`View WOs for ${row.name}`}
                        >{row.name}</button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{row.scheduled}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">{row.onTime}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold">
                        <span className={pct >= 90 ? 'text-green-700' : pct >= 70 ? 'text-yellow-700' : 'text-red-700'}>{pct}%</span>
                      </td>
                      <td className="px-3 py-2.5 w-32">
                        <div className="bg-gray-100 rounded-full h-2">
                          <div
                            className={clsx('h-2 rounded-full', pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-sm text-gray-400 py-8 mt-3">No preventive maintenance tasks recorded yet.</div>
        )}
      </Card>
    </div>
  );
}

// ─── Work Order Modal ─────────────────────────────────────────────────────────

interface WOMProps {
  task: MaintenanceTask | null;
  prefill: Partial<MaintenanceTask> | null;
  equipment: { id: string; name: string }[];
  users: { id: string; name: string; role?: string }[];
  spareParts: SparePart[];
  workInstructions: { id: string; title: string; equipmentId?: string; revision: string; documentNumber?: string }[];
  taskCount: number;
  isAdminOrManager: boolean;
  currentUserName: string;
  onSave: (t: MaintenanceTask) => void;
  onClose: () => void;
  onToggleChecklist?: (id: string) => void;
  onDelete?: () => void;
  onDeductInventory: (sparePartId: string, qty: number) => void;
}

function WorkOrderModal({
  task, prefill, equipment, users, spareParts, workInstructions,
  taskCount, isAdminOrManager, currentUserName,
  onSave, onClose, onToggleChecklist, onDelete, onDeductInventory,
}: WOMProps) {
  const navigate = useNavigate();
  const isEdit = !!task;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<Partial<MaintenanceTask>>(() => {
    if (task) return task;
    return {
      equipmentId: equipment[0]?.id ?? '',
      equipmentName: equipment[0]?.name ?? '',
      type: 'preventive', status: 'scheduled', priority: 'medium',
      scheduledDate: today,
      estimatedHours: 2, laborCost: 0, partsCost: 0,
      laborEntries: [], parts: [], checklist: [],
      title: '', description: '',
      ...prefill,
    };
  });

  const [modalTab, setModalTab] = useState<'details' | 'labor' | 'parts' | 'checklist' | 'notes'>('details');
  const [newCheck, setNewCheck] = useState('');
  const [newLaborEntry, setNewLaborEntry] = useState<Partial<LaborEntry>>({ technicianName: currentUserName, date: today, hoursWorked: 1, hourlyRate: 0 });
  const [photos, setPhotos] = useState<string[]>(task?.photos ?? []);
  const [partSearch, setPartSearch] = useState('');
  const [showPartPicker, setShowPartPicker] = useState(false);

  // Part confirmation tracking
  const [confirmedParts, setConfirmedParts] = useState<Set<string>>(new Set(
    task?.parts.filter(p => p.confirmedUsed).map(p => p.id) ?? []
  ));

  // New manual part entry
  const [newPart, setNewPart] = useState<Partial<MaintenancePart>>({ description: '', quantity: 1, unitCost: 0 });

  function set(k: keyof MaintenanceTask, v: unknown) {
    setForm(f => {
      if (k === 'equipmentId') {
        const eq = equipment.find(e => e.id === String(v));
        return { ...f, equipmentId: String(v), equipmentName: eq?.name ?? '' };
      }
      if (k === 'assignedToId') {
        const u = users.find(u => u.id === String(v));
        return { ...f, assignedToId: String(v), assignedToName: u?.name };
      }
      return { ...f, [k]: v };
    });
  }

  // Computed costs
  const laborEntries = form.laborEntries ?? [];
  const computedLaborCost = computeLaborCost(laborEntries);
  const parts = form.parts ?? [];
  const computedPartsCost = computePartsCost(parts);

  // Parts from inventory picker
  const filteredSpareParts = useMemo(() => {
    const q = partSearch.toLowerCase();
    const eqId = form.equipmentId;
    return spareParts.filter(sp => {
      const matchEq = !eqId || sp.equipmentId === eqId;
      const matchQ = !q || sp.description.toLowerCase().includes(q) || sp.partNumber.toLowerCase().includes(q);
      return matchEq && matchQ;
    }).slice(0, 20);
  }, [spareParts, partSearch, form.equipmentId]);

  function addFromInventory(sp: SparePart) {
    const part: MaintenancePart = {
      id: generateId(),
      sparePartId: sp.id,
      partNumber: sp.partNumber,
      description: sp.description,
      quantity: 1,
      unitCost: sp.unitCost,
    };
    setForm(f => ({ ...f, parts: [...(f.parts ?? []), part] }));
    setShowPartPicker(false);
    setPartSearch('');
  }

  function addManualPart() {
    if (!newPart.description?.trim()) return;
    const part: MaintenancePart = { id: generateId(), description: newPart.description!, quantity: newPart.quantity ?? 1, unitCost: newPart.unitCost ?? 0 };
    setForm(f => ({ ...f, parts: [...(f.parts ?? []), part] }));
    setNewPart({ description: '', quantity: 1, unitCost: 0 });
  }

  function removePart(id: string) {
    setForm(f => ({ ...f, parts: (f.parts ?? []).filter(p => p.id !== id) }));
    setConfirmedParts(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  function addLaborEntry() {
    if (!newLaborEntry.technicianName?.trim() || !newLaborEntry.hoursWorked) return;
    const entry: LaborEntry = {
      id: generateId(),
      technicianName: newLaborEntry.technicianName!,
      date: newLaborEntry.date ?? today,
      hoursWorked: Number(newLaborEntry.hoursWorked),
      hourlyRate: Number(newLaborEntry.hourlyRate ?? 0),
      notes: newLaborEntry.notes,
    };
    setForm(f => ({ ...f, laborEntries: [...(f.laborEntries ?? []), entry] }));
    setNewLaborEntry({ technicianName: currentUserName, date: today, hoursWorked: 1, hourlyRate: 0 });
  }

  function removeLaborEntry(id: string) {
    setForm(f => ({ ...f, laborEntries: (f.laborEntries ?? []).filter(e => e.id !== id) }));
  }

  function addChecklist() {
    if (!newCheck.trim()) return;
    const item: MaintenanceChecklistItem = { id: generateId(), task: newCheck.trim(), completed: false };
    setForm(f => ({ ...f, checklist: [...(f.checklist ?? []), item] }));
    setNewCheck('');
  }

  function removeChecklist(id: string) {
    setForm(f => ({ ...f, checklist: (f.checklist ?? []).filter(c => c.id !== id) }));
  }

  function togglePartConfirm(partId: string) {
    setConfirmedParts(prev => {
      const s = new Set(prev);
      if (s.has(partId)) s.delete(partId); else s.add(partId);
      return s;
    });
  }

  function handleSave() {
    const now = new Date().toISOString();
    const year = now.slice(0, 4);
    const taskNum = task?.taskNumber ?? `MWO-${year}-${String(taskCount + 1).padStart(4, '0')}`;
    const finalParts = (form.parts ?? []).map(p => ({
      ...p,
      confirmedUsed: confirmedParts.has(p.id),
      disposalConfirmedAt: confirmedParts.has(p.id) ? now : p.disposalConfirmedAt,
    }));

    // Deduct inventory for confirmed parts (only on completion, new confirmations)
    const wasComplete = task?.status === 'complete';
    const nowComplete = (form.status === 'complete');
    if (nowComplete) {
      finalParts.forEach(p => {
        if (p.sparePartId && p.confirmedUsed && !task?.parts.find(tp => tp.id === p.id && tp.confirmedUsed)) {
          onDeductInventory(p.sparePartId, p.quantity);
        }
      });
    }

    void wasComplete; // suppress unused warning

    onSave({
      id: task?.id ?? generateId(),
      taskNumber: taskNum,
      equipmentId: form.equipmentId ?? '',
      equipmentName: form.equipmentName ?? '',
      type: form.type ?? 'preventive',
      title: form.title ?? '',
      description: form.description ?? '',
      status: form.status ?? 'scheduled',
      priority: form.priority ?? 'medium',
      scheduledDate: form.scheduledDate ?? today,
      completedDate: form.status === 'complete' ? (form.completedDate ?? today) : form.completedDate,
      estimatedHours: Number(form.estimatedHours) || 1,
      actualHours: form.actualHours ? Number(form.actualHours) : undefined,
      assignedToId: form.assignedToId,
      assignedToName: form.assignedToName,
      laborEntries: laborEntries,
      laborCost: computedLaborCost,
      parts: finalParts,
      partsCost: computedPartsCost,
      checklist: form.checklist ?? [],
      nextScheduledDate: form.nextScheduledDate,
      recurrenceIntervalDays: form.recurrenceIntervalDays ? Number(form.recurrenceIntervalDays) : undefined,
      downtimeHours: form.downtimeHours ? Number(form.downtimeHours) : undefined,
      workInstructionId: form.workInstructionId,
      completionNotes: form.completionNotes,
      notes: form.notes,
      photos,
      createdBy: task?.createdBy ?? currentUserName,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
    });
  }

  const filteredWIs = workInstructions.filter(wi => !form.equipmentId || wi.equipmentId === form.equipmentId);
  const linkedWI = workInstructions.find(wi => wi.id === form.workInstructionId);
  const unconfirmedInventoryParts = parts.filter(p => p.sparePartId && form.status === 'complete' && !confirmedParts.has(p.id));

  const MODAL_TABS = [
    { key: 'details', label: 'Details' },
    { key: 'labor', label: `Labor${laborEntries.length > 0 ? ` (${laborEntries.length})` : ''}` },
    { key: 'parts', label: `Parts${parts.length > 0 ? ` (${parts.length})` : ''}` },
    { key: 'checklist', label: `Checklist${(form.checklist ?? []).length > 0 ? ` (${(form.checklist ?? []).length})` : ''}` },
    { key: 'notes', label: 'Notes & Photos' },
  ] as const;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `${task.taskNumber} — ${task.title}` : 'New Maintenance Work Order'}
      size="2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {isEdit && onDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={onDelete}>Delete</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title?.trim()}>
              {isEdit ? 'Save Changes' : 'Create Work Order'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Status banner at top */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
        <Badge className={STATUS_COLORS[form.status ?? 'scheduled']}>{(form.status ?? 'scheduled').replace('_', ' ')}</Badge>
        <Badge className={TYPE_COLORS[form.type ?? 'preventive']}>{TYPE_LABELS[form.type ?? 'preventive']}</Badge>
        <Badge className={PRIORITY_BG[form.priority ?? 'medium']}>{form.priority ?? 'medium'}</Badge>
        <span className="text-xs text-gray-400 ml-auto">
          Est. {form.estimatedHours}h · Labor: {formatCurrency(computedLaborCost)} · Parts: {formatCurrency(computedPartsCost)} ·{' '}
          <span className="font-semibold text-gray-600">Total: {formatCurrency(computedLaborCost + computedPartsCost)}</span>
        </span>
      </div>

      {/* Modal inner tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-4">
        {MODAL_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setModalTab(t.key)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
              modalTab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {modalTab === 'details' && (
        <div className="grid grid-cols-2 gap-4">
          <Select label="Equipment" value={form.equipmentId} onChange={e => set('equipmentId', e.target.value)}>
            {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </Select>
          <Select label="Type" value={form.type} onChange={e => set('type', e.target.value as MaintenanceType)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Title" value={form.title ?? ''} onChange={e => set('title', e.target.value)} className="col-span-2" />
          <Textarea label="Description" value={form.description ?? ''} onChange={e => set('description', e.target.value)} className="col-span-2" rows={2} />
          <Select label="Priority" value={form.priority} onChange={e => set('priority', e.target.value as MaintenancePriority)}>
            {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select label="Status" value={form.status} onChange={e => set('status', e.target.value as MaintenanceTask['status'])}>
            {['scheduled', 'in_progress', 'overdue', 'complete', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          <Input label="Scheduled Date" type="date" value={form.scheduledDate ?? ''} onChange={e => set('scheduledDate', e.target.value)} />
          <Input label="Est. Hours" type="number" min="0.5" step="0.5" value={form.estimatedHours ?? ''} onChange={e => set('estimatedHours', e.target.value)} />
          <Select
            label="Assigned To"
            value={form.assignedToId ?? ''}
            onChange={e => set('assignedToId', e.target.value)}
          >
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select
            label="Work Instruction"
            value={form.workInstructionId ?? ''}
            onChange={e => set('workInstructionId', e.target.value || undefined)}
          >
            <option value="">None</option>
            {filteredWIs.map(wi => <option key={wi.id} value={wi.id}>{wi.documentNumber ? `[${wi.documentNumber}] ` : ''}{wi.title} (Rev. {wi.revision})</option>)}
          </Select>
          {linkedWI && (
            <div className="col-span-2 flex items-center gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
              <BookOpen size={13} />
              <span className="font-medium">Linked instruction:</span>
              {linkedWI.documentNumber && <span className="font-mono font-semibold">{linkedWI.documentNumber}</span>}
              {linkedWI.title} — Rev. {linkedWI.revision}
              <button
                type="button"
                onClick={() => navigate(`/work-instructions?id=${linkedWI.id}`)}
                className="ml-auto flex items-center gap-1 text-brand-600 hover:text-brand-800 hover:underline"
                title="Open work instruction"
              >
                <ExternalLink size={12} /> View
              </button>
            </div>
          )}
          <Input
            label="Recurrence (days)"
            type="number" min="1" placeholder="e.g. 90"
            value={form.recurrenceIntervalDays ?? ''}
            onChange={e => set('recurrenceIntervalDays', e.target.value)}
          />
          <Input
            label="Next PM Date"
            type="date"
            value={form.nextScheduledDate ?? ''}
            onChange={e => set('nextScheduledDate', e.target.value)}
          />
          {form.status === 'complete' && (
            <>
              <Input label="Actual Hours" type="number" min="0.5" step="0.5" value={form.actualHours ?? ''} onChange={e => set('actualHours', e.target.value)} />
              <Input label="Downtime Hours" type="number" min="0" step="0.5" value={form.downtimeHours ?? ''} onChange={e => set('downtimeHours', e.target.value)} />
              <Input label="Completed Date" type="date" value={form.completedDate ?? today} onChange={e => set('completedDate', e.target.value)} className="col-span-2" />
            </>
          )}
        </div>
      )}

      {/* Labor tab */}
      {modalTab === 'labor' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Labor Entries</div>
            <div className="text-sm font-semibold text-gray-800">
              Total: {formatCurrency(computedLaborCost)}
              <span className="text-xs text-gray-400 font-normal ml-1">
                ({laborEntries.reduce((s, e) => s + e.hoursWorked, 0).toFixed(1)}h)
              </span>
            </div>
          </div>

          {laborEntries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="py-1.5 text-left">Technician</th>
                    <th className="py-1.5 text-left">Date</th>
                    <th className="py-1.5 text-center">Hours</th>
                    <th className="py-1.5 text-right">Rate (/h)</th>
                    <th className="py-1.5 text-right">Total</th>
                    <th className="py-1.5 text-left pl-2">Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {laborEntries.map(e => (
                    <tr key={e.id} className="border-t border-gray-50">
                      <td className="py-1.5 font-medium text-gray-800">{e.technicianName}</td>
                      <td className="py-1.5 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-1.5 text-center text-gray-800">{e.hoursWorked}h</td>
                      <td className="py-1.5 text-right text-gray-600">{formatCurrency(e.hourlyRate)}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-800">{formatCurrency(e.hoursWorked * e.hourlyRate)}</td>
                      <td className="py-1.5 pl-2 text-gray-400 max-w-[120px] truncate">{e.notes}</td>
                      <td className="py-1.5 pl-2">
                        <button onClick={() => removeLaborEntry(e.id)} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add entry row */}
          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Add Labor Entry</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Select
                label="Technician"
                value={newLaborEntry.technicianName ?? ''}
                onChange={e => setNewLaborEntry(l => ({ ...l, technicianName: e.target.value }))}
                className="col-span-2 sm:col-span-1"
              >
                <option value={currentUserName}>{currentUserName}</option>
                {users.filter(u => u.name !== currentUserName).map(u => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </Select>
              <Input label="Date" type="date" value={newLaborEntry.date ?? today} onChange={e => setNewLaborEntry(l => ({ ...l, date: e.target.value }))} />
              <Input label="Hours" type="number" min="0.5" step="0.5" value={newLaborEntry.hoursWorked ?? ''} onChange={e => setNewLaborEntry(l => ({ ...l, hoursWorked: Number(e.target.value) }))} />
              <Input label="Rate ($/h)" type="number" min="0" step="0.50" value={newLaborEntry.hourlyRate ?? ''} onChange={e => setNewLaborEntry(l => ({ ...l, hourlyRate: Number(e.target.value) }))} />
              <div className="flex items-end">
                <Button variant="secondary" onClick={addLaborEntry} className="w-full">Add</Button>
              </div>
            </div>
            <Input
              label="Notes (optional)"
              value={newLaborEntry.notes ?? ''}
              onChange={e => setNewLaborEntry(l => ({ ...l, notes: e.target.value }))}
              placeholder="e.g. pinch valve replacement on guns 1-12"
              className="mt-2"
            />
          </div>

          {laborEntries.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-200 rounded-lg">
              No labor entries yet. Add technician time entries above to track labor cost accurately.
            </div>
          )}
        </div>
      )}

      {/* Parts tab */}
      {modalTab === 'parts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Parts Used</div>
            <div className="text-sm font-semibold text-gray-800">Total: {formatCurrency(computedPartsCost)}</div>
          </div>

          {parts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="py-1.5 text-left">Part #</th>
                    <th className="py-1.5 text-left">Description</th>
                    <th className="py-1.5 text-center">Qty</th>
                    <th className="py-1.5 text-right">Unit</th>
                    <th className="py-1.5 text-right">Total</th>
                    <th className="py-1.5 text-center">Source</th>
                    {form.status === 'complete' && <th className="py-1.5 text-center">Used & Disposed</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {parts.map(p => {
                    const sp = spareParts.find(s => s.id === p.sparePartId);
                    const isConfirmed = confirmedParts.has(p.id);
                    return (
                      <tr key={p.id} className={clsx('border-t border-gray-50', isConfirmed && form.status === 'complete' ? 'bg-green-50' : '')}>
                        <td className="py-1.5 font-mono text-gray-500">{p.partNumber ?? '—'}</td>
                        <td className="py-1.5 text-gray-800 max-w-[180px]">
                          <div className="truncate">{p.description}</div>
                          {sp && <div className="text-[10px] text-gray-400">{sp.equipmentName} · {sp.location}</div>}
                        </td>
                        <td className="py-1.5 text-center text-gray-800">{p.quantity}</td>
                        <td className="py-1.5 text-right text-gray-600">{formatCurrency(p.unitCost)}</td>
                        <td className="py-1.5 text-right font-semibold text-gray-800">{formatCurrency(p.quantity * p.unitCost)}</td>
                        <td className="py-1.5 text-center">
                          {p.sparePartId ? (
                            <Badge className="bg-blue-50 text-blue-700">Inventory</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500">Manual</Badge>
                          )}
                        </td>
                        {form.status === 'complete' && (
                          <td className="py-1.5 text-center">
                            <button
                              onClick={() => togglePartConfirm(p.id)}
                              className={clsx(
                                'flex items-center justify-center w-5 h-5 rounded border mx-auto transition-colors',
                                isConfirmed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400',
                              )}
                            >
                              {isConfirmed && <Check size={10} className="text-white" />}
                            </button>
                          </td>
                        )}
                        <td className="py-1.5 pl-2">
                          <button onClick={() => removePart(p.id)} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Disposal instructions for WO being completed */}
          {form.status === 'complete' && parts.filter(p => p.sparePartId).length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <Info size={13} />
                Part Disposal / Return Instructions — Check each part above when used & disposed
              </div>
              {parts.filter(p => p.sparePartId).map(p => {
                const sp = spareParts.find(s => s.id === p.sparePartId);
                return (
                  <div key={p.id} className={clsx('text-xs rounded px-2 py-1.5', confirmedParts.has(p.id) ? 'bg-green-100 text-green-800 line-through' : 'bg-white text-gray-700')}>
                    <span className="font-medium">{p.description}:</span> {getDisposalInstructions(p, sp)}
                  </div>
                );
              })}
              {unconfirmedInventoryParts.length > 0 && (
                <div className="text-xs text-amber-700 font-medium">
                  ⚠ {unconfirmedInventoryParts.length} part{unconfirmedInventoryParts.length > 1 ? 's' : ''} not yet confirmed — check the box above after installing and disposing of old parts. Inventory will be decremented on save.
                </div>
              )}
            </div>
          )}

          {/* Add from inventory */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex gap-2">
              <Button
                variant="secondary" size="sm" icon={<Package size={13} />}
                onClick={() => setShowPartPicker(!showPartPicker)}
              >
                {showPartPicker ? 'Hide Inventory' : 'Select from Inventory'}
              </Button>
            </div>

            {showPartPicker && (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                <Input
                  label="" placeholder="Search by description or part number…"
                  value={partSearch} onChange={e => setPartSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredSpareParts.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">No parts found for this equipment</div>
                  )}
                  {filteredSpareParts.map(sp => (
                    <button
                      key={sp.id}
                      onClick={() => addFromInventory(sp)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-brand-200 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800">{sp.description}</span>
                          <span className="text-gray-400 ml-2 font-mono">{sp.partNumber}</span>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <div className="text-gray-700">{formatCurrency(sp.unitCost)}</div>
                          <div className={clsx('text-[10px]', sp.quantityOnHand <= sp.reorderPoint ? 'text-red-500 font-semibold' : 'text-gray-400')}>
                            {sp.quantityOnHand} in stock
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual add */}
            <div className="flex gap-2 items-end pt-1">
              <Input label="Manual entry" placeholder="Part description" value={newPart.description ?? ''} onChange={e => setNewPart(p => ({ ...p, description: e.target.value }))} />
              <Input label="Qty" type="number" min="1" value={newPart.quantity ?? 1} onChange={e => setNewPart(p => ({ ...p, quantity: Number(e.target.value) }))} />
              <Input label="Unit $" type="number" min="0" step="0.01" value={newPart.unitCost ?? 0} onChange={e => setNewPart(p => ({ ...p, unitCost: Number(e.target.value) }))} />
              <Button variant="secondary" onClick={addManualPart} className="mb-0">Add</Button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist tab */}
      {modalTab === 'checklist' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">Checklist</span>
            {(form.checklist ?? []).length > 0 && (
              <span className="text-gray-500 text-xs">
                {(form.checklist ?? []).filter(c => c.completed).length} / {(form.checklist ?? []).length} complete
              </span>
            )}
          </div>
          {(form.checklist ?? []).length > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div
                className="bg-brand-500 h-1.5 rounded-full transition-all"
                style={{ width: `${((form.checklist ?? []).filter(c => c.completed).length / (form.checklist ?? []).length) * 100}%` }}
              />
            </div>
          )}
          <div className="space-y-1.5">
            {(form.checklist ?? []).map((item, i) => (
              <div key={item.id} className="flex items-start gap-2.5">
                {isEdit && onToggleChecklist ? (
                  <button
                    onClick={() => onToggleChecklist(item.id)}
                    className={clsx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-brand-400',
                    )}
                  >
                    {item.completed && <Check size={10} className="text-white" />}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 w-5 mt-0.5 flex-shrink-0">{i + 1}.</span>
                )}
                <span className={clsx('text-sm flex-1', item.completed && 'line-through text-gray-400')}>{item.task}</span>
                {item.completed && item.completedBy && (
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{item.completedBy}</span>
                )}
                {!isEdit && (
                  <button onClick={() => removeChecklist(item.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><X size={12} /></button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3 border-t border-gray-100 pt-3">
            <Input
              label="" placeholder="Add checklist item…"
              value={newCheck}
              onChange={e => setNewCheck(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChecklist()}
            />
            <Button variant="secondary" onClick={addChecklist} className="self-end">Add</Button>
          </div>
          {(form.checklist ?? []).length === 0 && (
            <div className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              No checklist items. Type above and press Enter to add.
            </div>
          )}
        </div>
      )}

      {/* Notes & Photos tab */}
      {modalTab === 'notes' && (
        <div className="space-y-4">
          {form.status === 'complete' && (
            <Textarea
              label="Completion Notes"
              value={form.completionNotes ?? ''}
              onChange={e => set('completionNotes', e.target.value)}
              rows={3}
              placeholder="What was found, what was done, any follow-up required…"
            />
          )}
          <Textarea
            label="General Notes"
            value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Scheduling notes, access requirements, special instructions…"
          />
          <PhotoCapture photos={photos} onChange={setPhotos} label="Work Order Photos" compact />
        </div>
      )}
    </Modal>
  );
}
