import React, { useState, useEffect, useMemo } from 'react';
import {
  Play, Square, CheckCircle, AlertTriangle, Clock, Wrench,
  ChevronDown, ChevronUp, User, Settings, RotateCcw, Info,
  Plus, Edit2, Trash2, CalendarDays, List, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/FormInput';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { clsx } from '../../utils';
import type { MaintenanceSchedule, EquipmentRuntimeEntry, MaintenanceTask, Equipment, WorkInstruction, User as UserType } from '../../types';

// ─── Live clock hook — refreshes every 10 s to keep countdown accurate ────────

function useLiveTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeLiveHours(entry?: EquipmentRuntimeEntry): number {
  if (!entry) return 0;
  const base = entry.runtimeHoursTotal;
  if (!entry.runtimeSessionStart) return base;
  const elapsed = (Date.now() - new Date(entry.runtimeSessionStart).getTime()) / 3_600_000;
  return base + elapsed;
}

function formatHours(h: number): string {
  const total = Math.floor(h);
  return total.toLocaleString('en-CA') + ' hrs';
}

function formatHoursDecimal(h: number): string {
  return h.toFixed(1) + ' hrs';
}

interface ScheduleComputed {
  hoursSinceService: number;
  hoursRemaining: number | null;
  daysRemaining: number | null;
  status: 'ok' | 'due_soon' | 'overdue';
}

function computeSchedule(s: MaintenanceSchedule, liveHours: number): ScheduleComputed {
  const hoursSinceService = liveHours - (s.lastServiceHours ?? 0);

  let hoursRemaining: number | null = null;
  let daysRemaining: number | null = null;
  let status: 'ok' | 'due_soon' | 'overdue' = 'ok';

  if (s.intervalHours != null) {
    hoursRemaining = s.intervalHours - hoursSinceService;
    const warn = s.warnWithinHours ?? 50;
    if (hoursRemaining < 0) status = 'overdue';
    else if (hoursRemaining <= warn) status = 'due_soon';
    else status = 'ok';
  }

  if (s.intervalDays != null && s.lastServiceDate) {
    const daysSince = (Date.now() - new Date(s.lastServiceDate).getTime()) / 86_400_000;
    daysRemaining = s.intervalDays - daysSince;
    const warn = s.warnWithinDays ?? 5;
    const dayStatus: 'ok' | 'due_soon' | 'overdue' =
      daysRemaining < 0 ? 'overdue' : daysRemaining <= warn ? 'due_soon' : 'ok';
    // Most urgent status wins
    if (dayStatus === 'overdue' || (dayStatus === 'due_soon' && status === 'ok')) {
      status = dayStatus;
      if (hoursRemaining === null) hoursRemaining = null; // use days only
    }
  }

  return { hoursSinceService, hoursRemaining, daysRemaining, status };
}

const STATUS_BADGE: Record<string, string> = {
  ok:        'bg-green-100 text-green-700',
  due_soon:  'bg-amber-100 text-amber-700',
  overdue:   'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  ok:       'OK',
  due_soon: 'Due Soon',
  overdue:  'OVERDUE',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  ok:       <CheckCircle size={13} />,
  due_soon: <AlertTriangle size={13} />,
  overdue:  <AlertTriangle size={13} />,
};

// ─── Equipment Runtime Card ────────────────────────────────────────────────────

interface RuntimeCardProps {
  equipmentId: string;
  equipmentName: string;
  entry: EquipmentRuntimeEntry | undefined;
  liveHours: number;
  scheduleCount: { ok: number; due_soon: number; overdue: number };
  onStart: () => void;
  onStop: () => void;
}

function RuntimeCard({ equipmentId: _id, equipmentName, entry, liveHours, scheduleCount, onStart, onStop }: RuntimeCardProps) {
  const isRunning = !!entry?.runtimeSessionStart;

  return (
    <div className={clsx(
      'rounded-xl border-2 p-4 transition-all',
      isRunning ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">{equipmentName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={clsx(
              'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full',
              isRunning ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500',
            )}>
              {isRunning ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Running</> : 'Stopped'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-gray-900 leading-none">
            {Math.floor(liveHours).toLocaleString('en-CA')}
          </p>
          <p className="text-[11px] text-gray-400">total hours</p>
        </div>
      </div>

      {/* Schedule status pills */}
      <div className="flex gap-1.5 mb-3">
        {scheduleCount.overdue > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            {scheduleCount.overdue} overdue
          </span>
        )}
        {scheduleCount.due_soon > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {scheduleCount.due_soon} due soon
          </span>
        )}
        {scheduleCount.ok > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            {scheduleCount.ok} ok
          </span>
        )}
      </div>

      {/* Start / Stop */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors"
          >
            <Square size={12} fill="currentColor" /> Stop Equipment
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
          >
            <Play size={12} fill="currentColor" /> Start Equipment
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Schedule Row ──────────────────────────────────────────────────────────────

interface ScheduleRowProps {
  schedule: MaintenanceSchedule;
  computed: ScheduleComputed;
  onLogService: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isManagerPlus?: boolean;
  isAdmin?: boolean;
}

function ScheduleRow({ schedule: s, computed: c, onLogService, onEdit, onDelete, isManagerPlus, isAdmin }: ScheduleRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={clsx(
        'border-b border-gray-100 hover:bg-gray-50 transition-colors',
        c.status === 'overdue' ? 'bg-red-50/40' : c.status === 'due_soon' ? 'bg-amber-50/30' : '',
      )}>
        {/* Status */}
        <td className="px-3 py-2.5">
          <span className={clsx('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full', STATUS_BADGE[c.status])}>
            {STATUS_ICON[c.status]} {STATUS_LABEL[c.status]}
          </span>
        </td>

        {/* Task */}
        <td className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div>
              <p className="text-sm font-medium text-gray-900 leading-tight">{s.taskName}</p>
              {s.description && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-[11px] text-gray-400 hover:text-brand-600 flex items-center gap-0.5 mt-0.5"
                >
                  {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {expanded ? 'Hide details' : 'Show details'}
                </button>
              )}
            </div>
          </div>
        </td>

        {/* Role */}
        <td className="px-3 py-2.5">
          {s.responsibleRole === 'operator' ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              <User size={10} /> Operator
            </span>
          ) : s.responsibleRole === 'maintenance' ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              <Settings size={10} /> Maintenance
            </span>
          ) : null}
        </td>

        {/* Interval */}
        <td className="px-3 py-2.5 text-xs text-gray-500">
          {s.intervalHours != null && <span>Every {s.intervalHours.toLocaleString()} hrs</span>}
          {s.intervalHours != null && s.intervalDays != null && <br />}
          {s.intervalDays != null && <span>/ {s.intervalDays}d</span>}
        </td>

        {/* Since last service */}
        <td className="px-3 py-2.5">
          <div className="text-xs font-mono text-gray-700">
            {formatHoursDecimal(Math.max(0, c.hoursSinceService))}
          </div>
          {s.lastServiceDate && (
            <div className="text-[11px] text-gray-400">
              Serviced {s.lastServiceDate}
            </div>
          )}
        </td>

        {/* Remaining */}
        <td className="px-3 py-2.5">
          {c.hoursRemaining != null && (
            <span className={clsx(
              'text-xs font-mono font-semibold',
              c.hoursRemaining < 0 ? 'text-red-600' : c.hoursRemaining <= (s.warnWithinHours ?? 50) ? 'text-amber-600' : 'text-green-700',
            )}>
              {c.hoursRemaining < 0
                ? `${formatHoursDecimal(Math.abs(c.hoursRemaining))} overdue`
                : `${formatHoursDecimal(c.hoursRemaining)} left`}
            </span>
          )}
          {c.daysRemaining != null && c.hoursRemaining == null && (
            <span className={clsx(
              'text-xs font-mono font-semibold',
              c.daysRemaining < 0 ? 'text-red-600' : c.daysRemaining <= (s.warnWithinDays ?? 5) ? 'text-amber-600' : 'text-green-700',
            )}>
              {c.daysRemaining < 0
                ? `${Math.ceil(Math.abs(c.daysRemaining))}d overdue`
                : `${Math.floor(c.daysRemaining)}d left`}
            </span>
          )}
        </td>

        {/* Action */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={onLogService}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-brand-600 hover:text-white hover:border-brand-600 transition-colors"
            >
              <RotateCcw size={11} /> Log Service
            </button>
            {isManagerPlus && onEdit && (
              <button
                onClick={onEdit}
                className="p-1 rounded text-gray-400 hover:text-brand-600"
                title="Edit schedule"
              >
                <Edit2 size={13} />
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                onClick={onDelete}
                className="p-1 rounded text-gray-400 hover:text-red-600"
                title="Delete schedule"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && s.description && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={7} className="px-6 py-2.5">
            <div className="flex gap-2 text-xs text-gray-600">
              <Info size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <span>{s.description}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Log Service Confirmation Modal ───────────────────────────────────────────

interface LogServiceModalProps {
  schedule: MaintenanceSchedule;
  liveHours: number;
  onConfirm: (completedBy: string) => void;
  onClose: () => void;
}

function LogServiceModal({ schedule: s, liveHours, onConfirm, onClose }: LogServiceModalProps) {
  const [completedBy, setCompletedBy] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw size={18} className="text-brand-600" />
          <h2 className="text-base font-bold text-gray-900">Log Maintenance Service</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Recording service for <strong>{s.taskName}</strong> on <strong>{s.equipmentName}</strong>.
        </p>

        <div className="space-y-3 mb-5">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Current Equipment Runtime</span>
              <span className="font-mono font-bold text-gray-900">{formatHours(liveHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Service Date</span>
              <span className="font-medium text-gray-900">{new Date().toLocaleDateString('en-CA')}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Completed By (optional)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Technician name…"
              value={completedBy}
              onChange={e => setCompletedBy(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          This will reset the hours counter for this task and update the last service date to today.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(completedBy)}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            Confirm Service Logged
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function MaintenanceScheduler() {
  const { state, dispatch } = useApp();
  const { maintenanceSchedules, equipmentRuntime, equipment, workInstructions, users, maintenanceTasks } = state;
  const { currentUser } = state;
  const isAdmin = currentUser?.role === 'admin';
  const isManagerPlus = ['admin', 'manager'].includes(currentUser?.role ?? '');
  const tick = useLiveTick(); // refreshes every 10 s
  void tick; // side-effect: causes re-render

  const [filterEquip, setFilterEquip] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'operator' | 'maintenance'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'due_soon' | 'overdue'>('all');
  const [logServiceTarget, setLogServiceTarget] = useState<MaintenanceSchedule | null>(null);
  const [schedModal, setSchedModal] = useState<{ open: boolean; sched: MaintenanceSchedule | null }>({ open: false, sched: null });
  const [deleteConfirm, setDeleteConfirm] = useState<MaintenanceSchedule | null>(null);
  const [calView, setCalView] = useState<'list' | 'calendar'>('list');
  const [calMonth, setCalMonth] = useState(() => new Date());

  // ── Compute live hours per equipment ──────────────────────────────────────
  const liveHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of Object.values(equipmentRuntime)) {
      map[entry.equipmentId] = computeLiveHours(entry);
    }
    return map;
  }, [equipmentRuntime, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unique equipment IDs that have schedules ───────────────────────────────
  const equipmentIdsWithSchedules = useMemo(() =>
    [...new Set(maintenanceSchedules.map(s => s.equipmentId))],
  [maintenanceSchedules]);

  // ── Schedule status counts per equipment ──────────────────────────────────
  const scheduleStatusCounts = useMemo(() => {
    const counts: Record<string, { ok: number; due_soon: number; overdue: number }> = {};
    for (const s of maintenanceSchedules) {
      const lh = liveHoursMap[s.equipmentId] ?? 0;
      const c = computeSchedule(s, lh);
      if (!counts[s.equipmentId]) counts[s.equipmentId] = { ok: 0, due_soon: 0, overdue: 0 };
      counts[s.equipmentId][c.status]++;
    }
    return counts;
  }, [maintenanceSchedules, liveHoursMap]);

  // ── Filtered schedules ────────────────────────────────────────────────────
  const computedSchedules = useMemo(() => {
    return maintenanceSchedules.map(s => ({
      schedule: s,
      computed: computeSchedule(s, liveHoursMap[s.equipmentId] ?? 0),
    }));
  }, [maintenanceSchedules, liveHoursMap]);

  const filtered = useMemo(() => {
    return computedSchedules.filter(({ schedule: s, computed: c }) => {
      if (filterEquip !== 'all' && s.equipmentId !== filterEquip) return false;
      if (filterRole !== 'all' && s.responsibleRole !== filterRole) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      return true;
    });
  }, [computedSchedules, filterEquip, filterRole, filterStatus]);

  // ── Sorted: overdue first, then due_soon, then ok — within group by taskName
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, ok: 2 };
    const diff = order[a.computed.status] - order[b.computed.status];
    if (diff !== 0) return diff;
    return a.schedule.taskName.localeCompare(b.schedule.taskName);
  }), [filtered]);

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalOverdue  = computedSchedules.filter(x => x.computed.status === 'overdue').length;
  const totalDueSoon  = computedSchedules.filter(x => x.computed.status === 'due_soon').length;
  const totalOk       = computedSchedules.filter(x => x.computed.status === 'ok').length;

  function handleLogService(schedule: MaintenanceSchedule) {
    setLogServiceTarget(schedule);
  }

  function confirmLogService(completedBy: string) {
    if (!logServiceTarget) return;
    const lh = liveHoursMap[logServiceTarget.equipmentId] ?? 0;
    dispatch({ type: 'LOG_MAINTENANCE_SERVICE', payload: {
      scheduleId: logServiceTarget.id,
      serviceHours: lh,
      completedByName: completedBy || undefined,
    }});
    setLogServiceTarget(null);
  }

  return (
    <div className="space-y-6">

      {/* ── Summary Banner ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-xl font-bold text-red-700">{totalOverdue}</p>
            <p className="text-xs text-red-600">Overdue</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock size={20} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-xl font-bold text-amber-700">{totalDueSoon}</p>
            <p className="text-xs text-amber-600">Due Soon</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-xl font-bold text-green-700">{totalOk}</p>
            <p className="text-xs text-green-600">Up to Date</p>
          </div>
        </div>
      </div>

      {/* ── Equipment Runtime Cards ──────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Play size={14} className="text-brand-600" /> Equipment Runtime
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipmentIdsWithSchedules.map(eqId => {
            const eq = equipment.find(e => e.id === eqId);
            const name = eq?.name ?? eqId;
            const entry = equipmentRuntime[eqId];
            const lh = liveHoursMap[eqId] ?? 0;
            const counts = scheduleStatusCounts[eqId] ?? { ok: 0, due_soon: 0, overdue: 0 };
            return (
              <RuntimeCard
                key={eqId}
                equipmentId={eqId}
                equipmentName={name}
                entry={entry}
                liveHours={lh}
                scheduleCount={counts}
                onStart={() => dispatch({ type: 'START_EQUIPMENT_RUNTIME', payload: eqId })}
                onStop={() => dispatch({ type: 'STOP_EQUIPMENT_RUNTIME', payload: eqId })}
              />
            );
          })}
        </div>
      </div>

      {/* ── Schedule Table ───────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Wrench size={14} className="text-brand-600" /> Maintenance Schedules
            <span className="text-xs font-normal text-gray-400">({sorted.length} shown)</span>
          </h3>
          <div className="flex flex-wrap gap-2 items-center">
            {isManagerPlus && (
              <Button size="sm" onClick={() => setSchedModal({ open: true, sched: null })}>
                <Plus size={13} className="mr-1" /> Add Schedule
              </Button>
            )}
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setCalView('list')}
                className={clsx('flex items-center gap-1 px-3 py-1.5 transition-colors', calView === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
              >
                <List size={12} /> List
              </button>
              <button
                onClick={() => setCalView('calendar')}
                className={clsx('flex items-center gap-1 px-3 py-1.5 border-l border-gray-300 transition-colors', calView === 'calendar' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
              >
                <CalendarDays size={12} /> Calendar
              </button>
            </div>
            {/* Equipment filter */}
            <select
              value={filterEquip}
              onChange={e => setFilterEquip(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="all">All Equipment</option>
              {equipmentIdsWithSchedules.map(id => {
                const eq = equipment.find(e => e.id === id);
                return <option key={id} value={id}>{eq?.name ?? id}</option>;
              })}
            </select>

            {/* Role filter */}
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value as typeof filterRole)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="all">All Roles</option>
              <option value="operator">Operator</option>
              <option value="maintenance">Maintenance</option>
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="due_soon">Due Soon</option>
              <option value="ok">OK</option>
            </select>
          </div>
        </div>

        {calView === 'list' && <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Status</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Role</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Interval</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Since Service</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Remaining</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No maintenance schedules match the current filters.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    let lastEquipId = '';
                    const rows: React.ReactNode[] = [];
                    for (const { schedule, computed } of sorted) {
                      if (schedule.equipmentId !== lastEquipId) {
                        lastEquipId = schedule.equipmentId;
                        const eq = equipment.find(e => e.id === schedule.equipmentId);
                        const lh = liveHoursMap[schedule.equipmentId] ?? 0;
                        const running = !!equipmentRuntime[schedule.equipmentId]?.runtimeSessionStart;
                        rows.push(
                          <tr key={`eq-${schedule.equipmentId}`} className="bg-gray-50 border-b border-gray-100">
                            <td colSpan={7} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Wrench size={13} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-700">{eq?.name ?? schedule.equipmentId}</span>
                                <span className="text-[11px] text-gray-400 font-mono">{formatHours(lh)}</span>
                                {running && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Running
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      rows.push(
                        <ScheduleRow
                          key={schedule.id}
                          schedule={schedule}
                          computed={computed}
                          onLogService={() => handleLogService(schedule)}
                          onEdit={() => setSchedModal({ open: true, sched: schedule })}
                          onDelete={() => setDeleteConfirm(schedule)}
                          isManagerPlus={isManagerPlus}
                          isAdmin={isAdmin}
                        />
                      );
                    }
                    return rows;
                  })()
                )}
              </tbody>
            </table>
          </div>
        </Card>}

        {calView === 'calendar' && (
          <CalendarView
            month={calMonth}
            onMonthChange={setCalMonth}
            schedules={maintenanceSchedules}
            tasks={maintenanceTasks}
            equipment={equipment}
            liveHoursMap={liveHoursMap}
            onEditSchedule={isManagerPlus ? (s) => setSchedModal({ open: true, sched: s }) : undefined}
          />
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="text-xs text-gray-400 flex flex-wrap gap-4">
        <span className="flex items-center gap-1"><User size={11} /> <strong>Operator</strong> — production floor operator tasks (daily/weekly)</span>
        <span className="flex items-center gap-1"><Settings size={11} /> <strong>Maintenance</strong> — skilled maintenance technician required (500–2000 hr intervals)</span>
        <span className="flex items-center gap-1"><Clock size={11} /> Runtime updates live every 10 s while equipment is running</span>
      </div>

      {/* ── Log Service Modal ────────────────────────────────────────────── */}
      {logServiceTarget && (
        <LogServiceModal
          schedule={logServiceTarget}
          liveHours={liveHoursMap[logServiceTarget.equipmentId] ?? 0}
          onConfirm={confirmLogService}
          onClose={() => setLogServiceTarget(null)}
        />
      )}

      {/* ── Schedule Modal ───────────────────────────────────────────────── */}
      {schedModal.open && (
        <ScheduleModal
          sched={schedModal.sched}
          equipment={equipment}
          workInstructions={workInstructions}
          users={users}
          onSave={(s) => {
            dispatch({ type: schedModal.sched ? 'UPDATE_MAINTENANCE_SCHEDULE' : 'ADD_MAINTENANCE_SCHEDULE', payload: s });
            setSchedModal({ open: false, sched: null });
          }}
          onClose={() => setSchedModal({ open: false, sched: null })}
        />
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      {deleteConfirm && (
        <Modal open={true} onClose={() => setDeleteConfirm(null)} title="Delete Schedule" size="sm">
          <p className="text-sm text-gray-700 mb-4">
            Delete schedule <strong>{deleteConfirm.taskName}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'DELETE_MAINTENANCE_SCHEDULE', payload: deleteConfirm.id });
                setDeleteConfirm(null);
              }}
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────

function ScheduleModal({
  sched, equipment, workInstructions, users, onSave, onClose,
}: {
  sched: MaintenanceSchedule | null;
  equipment: Equipment[];
  workInstructions: WorkInstruction[];
  users: UserType[];
  onSave: (s: MaintenanceSchedule) => void;
  onClose: () => void;
}) {
  const isNew = !sched;
  const [form, setForm] = useState<Partial<MaintenanceSchedule>>(sched ?? {
    responsibleRole: 'operator', notifyUserIds: [], currentHours: 0, status: 'ok',
  });
  const [intervalType, setIntervalType] = useState<'hours' | 'days'>(
    sched?.intervalHours != null ? 'hours' : 'days',
  );
  const set = (k: keyof MaintenanceSchedule, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const filteredWIs = useMemo(() => {
    if (!form.equipmentId) return workInstructions;
    return workInstructions.filter(w => !w.equipmentId || w.equipmentId === form.equipmentId);
  }, [workInstructions, form.equipmentId]);

  function save() {
    if (!form.equipmentId || !form.taskName?.trim()) return;
    const eq = equipment.find(e => e.id === form.equipmentId);
    const now = new Date().toISOString().slice(0, 10);
    onSave({
      ...form,
      id: sched?.id ?? `ms-${Date.now()}`,
      equipmentId: form.equipmentId,
      equipmentName: eq?.name ?? '',
      taskName: form.taskName.trim(),
      responsibleRole: form.responsibleRole ?? 'operator',
      notifyUserIds: form.notifyUserIds ?? [],
      currentHours: sched?.currentHours ?? 0,
      status: sched?.status ?? 'ok',
      createdAt: sched?.createdAt ?? now,
      updatedAt: now,
      ...(intervalType === 'hours'
        ? { intervalHours: form.intervalHours, warnWithinHours: form.warnWithinHours, intervalDays: undefined, warnWithinDays: undefined }
        : { intervalDays: form.intervalDays, warnWithinDays: form.warnWithinDays, intervalHours: undefined, warnWithinHours: undefined }),
    } as MaintenanceSchedule);
  }

  const wiOptions = [
    { value: '', label: 'None' },
    ...filteredWIs.map(w => ({
      value: w.id,
      label: w.documentNumber ? `[${w.documentNumber}] ${w.title} (Rev. ${w.revision})` : `${w.title} (Rev. ${w.revision})`,
    })),
  ];

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Add Maintenance Schedule' : 'Edit Schedule'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Equipment"
          value={form.equipmentId ?? ''}
          onChange={v => set('equipmentId', v)}
          options={[{ value: '', label: 'Select equipment' }, ...equipment.map(e => ({ value: e.id, label: e.name }))]}
        />
        <div className="col-span-1">
          <Input label="Task Name" value={form.taskName ?? ''} onChange={v => set('taskName', v)} placeholder="e.g. Inspect gun electrodes" />
        </div>
        <Select
          label="Responsible Role"
          value={form.responsibleRole ?? 'operator'}
          onChange={v => set('responsibleRole', v as 'operator' | 'maintenance')}
          options={[{ value: 'operator', label: 'Operator' }, { value: 'maintenance', label: 'Maintenance Tech' }]}
        />
        <Select
          label="Assigned To (optional)"
          value={form.assignedToId ?? ''}
          onChange={v => {
            const u = users.find(u => u.id === v);
            set('assignedToId', v || undefined);
            set('assignedToName', u?.name ?? undefined);
          }}
          options={[{ value: '', label: 'Unassigned' }, ...users.map(u => ({ value: u.id, label: u.name }))]}
        />

        {/* Interval type toggle */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Interval Type</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm w-fit">
            <button
              type="button"
              onClick={() => setIntervalType('days')}
              className={clsx('px-4 py-1.5 transition-colors', intervalType === 'days' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >
              Calendar Days
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('hours')}
              className={clsx('px-4 py-1.5 border-l border-gray-300 transition-colors', intervalType === 'hours' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >
              Runtime Hours
            </button>
          </div>
        </div>

        {intervalType === 'days' ? (
          <>
            <Input label="Interval (days)" type="number" value={String(form.intervalDays ?? '')} onChange={v => set('intervalDays', v ? Number(v) : undefined)} placeholder="e.g. 7" />
            <Input label="Warn Within (days)" type="number" value={String(form.warnWithinDays ?? '')} onChange={v => set('warnWithinDays', v ? Number(v) : undefined)} placeholder="e.g. 2" />
          </>
        ) : (
          <>
            <Input label="Interval (hours)" type="number" value={String(form.intervalHours ?? '')} onChange={v => set('intervalHours', v ? Number(v) : undefined)} placeholder="e.g. 800" />
            <Input label="Warn Within (hours)" type="number" value={String(form.warnWithinHours ?? '')} onChange={v => set('warnWithinHours', v ? Number(v) : undefined)} placeholder="e.g. 50" />
          </>
        )}

        <div className="col-span-2">
          <Select label="Work Instruction (optional)" value={form.workInstructionId ?? ''} onChange={v => set('workInstructionId', v || undefined)} options={wiOptions} />
        </div>
        <div className="col-span-2">
          <Textarea label="Description" value={form.description ?? ''} onChange={v => set('description', v)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!form.equipmentId || !form.taskName?.trim()}>Save Schedule</Button>
      </div>
    </Modal>
  );
}

// ─── Calendar View ─────────────────────────────────────────────────────────────

type CalendarEvent = {
  date: string;         // YYYY-MM-DD
  label: string;
  equipment: string;
  status: 'ok' | 'due_soon' | 'overdue';
  sourceType: 'schedule' | 'task';
  sourceId: string;
  scheduleObj?: MaintenanceSchedule;
};

const CAL_STATUS_DOT: Record<string, string> = {
  ok:       'bg-green-500',
  due_soon: 'bg-amber-500',
  overdue:  'bg-red-500',
};

function CalendarView({
  month, onMonthChange, schedules, tasks, equipment, liveHoursMap, onEditSchedule,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  schedules: MaintenanceSchedule[];
  tasks: MaintenanceTask[];
  equipment: Equipment[];
  liveHoursMap: Record<string, number>;
  onEditSchedule?: (s: MaintenanceSchedule) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = month.getFullYear();
  const monthIdx = month.getMonth(); // 0-based

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  // getDay(): 0=Sun → shift to Mon-start: (getDay()+6)%7 → 0=Mon…6=Sun
  const firstDayOfWeek = (new Date(year, monthIdx, 1).getDay() + 6) % 7;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Build events
  const events = useMemo((): CalendarEvent[] => {
    const out: CalendarEvent[] = [];
    const pfx = (n: number) => String(n).padStart(2, '0');
    const yyyymm = `${year}-${pfx(monthIdx + 1)}`;

    // From day-based schedules
    for (const s of schedules) {
      if (s.intervalDays == null) continue;
      if (!s.lastServiceDate) continue;
      const lastMs = new Date(s.lastServiceDate).getTime();
      const nextMs = lastMs + s.intervalDays * 86_400_000;
      const nextDate = new Date(nextMs);
      const dateStr = `${nextDate.getFullYear()}-${pfx(nextDate.getMonth() + 1)}-${pfx(nextDate.getDate())}`;
      if (!dateStr.startsWith(yyyymm)) continue;
      const lh = liveHoursMap[s.equipmentId] ?? 0;
      const c = computeSchedule(s, lh);
      const eq = equipment.find(e => e.id === s.equipmentId);
      out.push({
        date: dateStr,
        label: s.taskName,
        equipment: eq?.name ?? s.equipmentName,
        status: c.status,
        sourceType: 'schedule',
        sourceId: s.id,
        scheduleObj: s,
      });
    }

    // From tasks with scheduledDate
    for (const t of tasks) {
      if (!t.scheduledDate) continue;
      if (!t.scheduledDate.startsWith(yyyymm)) continue;
      let status: CalendarEvent['status'] = 'ok';
      if (!t.completedDate && t.scheduledDate < todayStr) status = 'overdue';
      else if (!t.completedDate && t.scheduledDate <= todayStr) status = 'due_soon';
      const eq = equipment.find(e => e.id === t.equipmentId);
      out.push({
        date: t.scheduledDate,
        label: t.title,
        equipment: eq?.name ?? t.equipmentName,
        status,
        sourceType: 'task',
        sourceId: t.id,
      });
    }

    return out;
  }, [schedules, tasks, equipment, liveHoursMap, year, monthIdx, todayStr]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  function prevMonth() { onMonthChange(new Date(year, monthIdx - 1, 1)); setSelectedDay(null); }
  function nextMonth() { onMonthChange(new Date(year, monthIdx + 1, 1)); setSelectedDay(null); }

  // Build grid cells: leading blanks + day cells
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const pfx = (n: number) => String(n).padStart(2, '0');
  const dayStr = (d: number) => `${year}-${pfx(monthIdx + 1)}-${pfx(d)}`;

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  return (
    <div className="space-y-3">
      {/* Calendar header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold text-gray-900">{MONTH_NAMES[monthIdx]} {year}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`blank-${idx}`} className="border-b border-r border-gray-100 min-h-[72px] bg-gray-50/50" />;
            }
            const ds = dayStr(day);
            const dayEvents = eventsByDate[ds] ?? [];
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDay;
            const shown = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - 3;
            return (
              <div
                key={ds}
                onClick={() => setSelectedDay(isSelected ? null : ds)}
                className={clsx(
                  'border-b border-r border-gray-100 min-h-[72px] p-1.5 cursor-pointer transition-colors',
                  isSelected ? 'bg-brand-50 ring-1 ring-inset ring-brand-400' : 'hover:bg-gray-50',
                )}
              >
                <div className={clsx(
                  'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                  isToday ? 'bg-brand-600 text-white' : 'text-gray-700',
                )}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {shown.map((ev, i) => (
                    <div key={i} className="flex items-center gap-1 min-w-0">
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', CAL_STATUS_DOT[ev.status])} />
                      <span className="text-[10px] text-gray-600 truncate leading-tight">{ev.label}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-gray-400">+{overflow} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && selectedEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-800">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h4>
          <div className="space-y-2">
            {selectedEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-t border-gray-100">
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', CAL_STATUS_DOT[ev.status])} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{ev.label}</div>
                  <div className="text-xs text-gray-500">{ev.equipment}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={clsx(
                    'text-[11px] px-2 py-0.5 rounded-full font-medium',
                    STATUS_BADGE[ev.status],
                  )}>
                    {STATUS_LABEL[ev.status]}
                  </span>
                  {ev.sourceType === 'schedule' && ev.scheduleObj && onEditSchedule && (
                    <button
                      onClick={() => onEditSchedule(ev.scheduleObj!)}
                      className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-0.5"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedDay && selectedEvents.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400 text-center">
          No scheduled maintenance on this day.
        </div>
      )}
    </div>
  );
}
