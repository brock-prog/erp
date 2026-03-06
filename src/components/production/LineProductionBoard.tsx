/**
 * LineProductionBoard
 *
 * TV-display production board for any production line.
 * Designed to be shown on large screens at workstations, updating in real-time
 * as jobs move through stages from start to packaged & ready to ship.
 *
 * Lines:
 *  - vertical      → SAT Vertical Powder Line (original board)
 *  - horizontal    → Horizontal Powder Line (auto conveyor)
 *  - batch         → Batch Powder Line
 *  - extrusion-sub → Automatic Extrusion Sublimation Machine
 *  - panel-sub     → Panel Sublimation Machine
 */

import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Layers, Maximize2, Minimize2, Lock, Unlock, Clock,
  AlertTriangle, CheckCircle2, Pause, ChevronRight, ArrowRight,
  Package, Thermometer, Wind, Printer, Zap, Box,
} from 'lucide-react';
import { clsx } from '../../utils';
import { useApp } from '../../context/AppContext';
import type { Job, JobStatus, WorkstationSession, ServiceType, LineType } from '../../types';

// ─── Board Configs ────────────────────────────────────────────────────────────

interface StageConfig {
  key: string;
  label: string;
  sublabel?: string;
  statuses: JobStatus[];
  headerCls: string;
  cardCls: string;
  borderCls: string;
  textCls: string;
  icon: React.ElementType;
}

interface BoardConfig {
  id: string;
  name: string;
  shortName: string;
  description: string;
  serviceTypes: ServiceType[];
  lineTypes?: LineType[];
  stages: StageConfig[];
  headerBg: string;
  accentColor: string;
  icon: React.ElementType;
  path: string;
}

const BOARDS: BoardConfig[] = [
  // ── 1. Vertical Powder Line (SAT) ──────────────────────────────────────────
  {
    id: 'vertical',
    name: 'SAT Vertical Powder Line',
    shortName: 'Vertical',
    description: 'SAT Vertical Cube Line — automatic powder coating',
    serviceTypes: ['powder_coating', 'both'],
    lineTypes: ['manual'],
    headerBg: 'bg-[#0f172a]',
    accentColor: '#3b82f6',
    icon: Layers,
    path: '/production-board',
    stages: [
      { key: 'pretreat', label: 'Pre-Treatment', sublabel: 'Prep / Blast / Rack', statuses: ['prep', 'blast', 'rack', 'pretreat'], headerCls: 'bg-blue-700', cardCls: 'bg-blue-950', borderCls: 'border-blue-600', textCls: 'text-blue-300', icon: Wind },
      { key: 'coat',     label: 'Coating',       sublabel: 'Powder Application',  statuses: ['coat'],                             headerCls: 'bg-purple-700', cardCls: 'bg-purple-950', borderCls: 'border-purple-600', textCls: 'text-purple-300', icon: Layers },
      { key: 'cure',     label: 'Cure / Oven',   sublabel: 'Bake Cycle',          statuses: ['cure'],                             headerCls: 'bg-orange-700', cardCls: 'bg-orange-950', borderCls: 'border-orange-600', textCls: 'text-orange-300', icon: Thermometer },
      { key: 'qc',       label: 'Quality Check', sublabel: 'Final Inspection',    statuses: ['qc'],                               headerCls: 'bg-green-700',  cardCls: 'bg-green-950',  borderCls: 'border-green-600',  textCls: 'text-green-300',  icon: CheckCircle2 },
      { key: 'finish',   label: 'Pack & Ship',   sublabel: 'Unrack / Ship',       statuses: ['unrack', 'shipping'],               headerCls: 'bg-teal-700',   cardCls: 'bg-teal-950',   borderCls: 'border-teal-600',   textCls: 'text-teal-300',   icon: Package },
      { key: 'hold',     label: 'On Hold',       sublabel: 'Awaiting Action',     statuses: ['on_hold'],                          headerCls: 'bg-yellow-700', cardCls: 'bg-yellow-950', borderCls: 'border-yellow-600', textCls: 'text-yellow-300', icon: Pause },
    ],
  },

  // ── 2. Horizontal Powder Line ───────────────────────────────────────────────
  {
    id: 'horizontal',
    name: 'Horizontal Powder Line',
    shortName: 'Horizontal',
    description: 'Horizontal auto conveyor line — continuous powder coating',
    serviceTypes: ['powder_coating', 'both'],
    lineTypes: ['horizontal_auto'],
    headerBg: 'bg-slate-900',
    accentColor: '#06b6d4',
    icon: ArrowRight,
    path: '/horizontal-board',
    stages: [
      { key: 'pretreat', label: 'Pre-Treatment', sublabel: 'Prep / Chemical Wash',  statuses: ['prep', 'blast', 'pretreat'], headerCls: 'bg-cyan-800',   cardCls: 'bg-cyan-950',   borderCls: 'border-cyan-700',   textCls: 'text-cyan-300',   icon: Wind },
      { key: 'load',     label: 'Conveyor Load', sublabel: 'Rack / Hang Parts',     statuses: ['rack'],                     headerCls: 'bg-sky-700',    cardCls: 'bg-sky-950',    borderCls: 'border-sky-600',    textCls: 'text-sky-300',    icon: Layers },
      { key: 'coat',     label: 'Coating Zone',  sublabel: 'Auto Application',      statuses: ['coat'],                     headerCls: 'bg-violet-700', cardCls: 'bg-violet-950', borderCls: 'border-violet-600', textCls: 'text-violet-300', icon: Zap },
      { key: 'cure',     label: 'Cure Oven',     sublabel: 'Conveyor Bake',         statuses: ['cure'],                     headerCls: 'bg-orange-700', cardCls: 'bg-orange-950', borderCls: 'border-orange-600', textCls: 'text-orange-300', icon: Thermometer },
      { key: 'unload',   label: 'Unload & QC',   sublabel: 'Unrack / Inspect',      statuses: ['unrack', 'qc'],             headerCls: 'bg-emerald-700',cardCls: 'bg-emerald-950',borderCls: 'border-emerald-600',textCls: 'text-emerald-300',icon: CheckCircle2 },
      { key: 'ship',     label: 'Pack & Ship',   sublabel: 'Ready for Dispatch',    statuses: ['shipping'],                 headerCls: 'bg-teal-700',   cardCls: 'bg-teal-950',   borderCls: 'border-teal-600',   textCls: 'text-teal-300',   icon: Package },
      { key: 'hold',     label: 'On Hold',       sublabel: 'Awaiting Action',       statuses: ['on_hold'],                  headerCls: 'bg-yellow-700', cardCls: 'bg-yellow-950', borderCls: 'border-yellow-600', textCls: 'text-yellow-300', icon: Pause },
    ],
  },

  // ── 3. Batch Powder Line ────────────────────────────────────────────────────
  {
    id: 'batch',
    name: 'Batch Powder Line',
    shortName: 'Batch',
    description: 'Batch oven system — small runs and specialty work',
    serviceTypes: ['powder_coating', 'both'],
    lineTypes: ['batch'],
    headerBg: 'bg-zinc-900',
    accentColor: '#f59e0b',
    icon: Box,
    path: '/batch-board',
    stages: [
      { key: 'prep',    label: 'Preparation',  sublabel: 'Clean / Blast',      statuses: ['prep', 'blast'],        headerCls: 'bg-amber-800',  cardCls: 'bg-amber-950',  borderCls: 'border-amber-700',  textCls: 'text-amber-300',  icon: Wind },
      { key: 'rack',    label: 'Rack & Stage', sublabel: 'Hang / Mask / Stage', statuses: ['rack', 'pretreat'],    headerCls: 'bg-yellow-700', cardCls: 'bg-yellow-950', borderCls: 'border-yellow-600', textCls: 'text-yellow-300', icon: Layers },
      { key: 'coat',    label: 'Coat',         sublabel: 'Powder Application',  statuses: ['coat'],                headerCls: 'bg-purple-700', cardCls: 'bg-purple-950', borderCls: 'border-purple-600', textCls: 'text-purple-300', icon: Zap },
      { key: 'bake',    label: 'Batch Cure',   sublabel: 'Oven Bake',           statuses: ['cure'],                headerCls: 'bg-red-700',    cardCls: 'bg-red-950',    borderCls: 'border-red-600',    textCls: 'text-red-300',    icon: Thermometer },
      { key: 'inspect', label: 'Inspection',   sublabel: 'Unrack / QC',         statuses: ['unrack', 'qc'],        headerCls: 'bg-green-700',  cardCls: 'bg-green-950',  borderCls: 'border-green-600',  textCls: 'text-green-300',  icon: CheckCircle2 },
      { key: 'ship',    label: 'Ship Ready',   sublabel: 'Pack / Dispatch',     statuses: ['shipping'],            headerCls: 'bg-teal-700',   cardCls: 'bg-teal-950',   borderCls: 'border-teal-600',   textCls: 'text-teal-300',   icon: Package },
      { key: 'hold',    label: 'On Hold',      sublabel: 'Awaiting Action',     statuses: ['on_hold'],             headerCls: 'bg-zinc-700',   cardCls: 'bg-zinc-800',   borderCls: 'border-zinc-600',   textCls: 'text-zinc-300',   icon: Pause },
    ],
  },

  // ── 4. Automatic Extrusion Sublimation ─────────────────────────────────────
  {
    id: 'extrusion-sub',
    name: 'Extrusion Sublimation Machine',
    shortName: 'Extrusion Sub',
    description: 'Auto extrusion sublimation — aluminum profiles & extrusions',
    serviceTypes: ['sublimation', 'both'],
    headerBg: 'bg-violet-950',
    accentColor: '#a78bfa',
    icon: Zap,
    path: '/extrusion-board',
    stages: [
      { key: 'prep',    label: 'Preparation',   sublabel: 'Clean / Inspect Profiles', statuses: ['prep'],            headerCls: 'bg-indigo-700', cardCls: 'bg-indigo-950', borderCls: 'border-indigo-600', textCls: 'text-indigo-300', icon: Wind },
      { key: 'setup',   label: 'Profile Setup', sublabel: 'Film Wrap / Staging',      statuses: ['rack'],            headerCls: 'bg-violet-700', cardCls: 'bg-violet-950', borderCls: 'border-violet-600', textCls: 'text-violet-300', icon: Layers },
      { key: 'press',   label: 'Heat Press',    sublabel: 'Sublimation Transfer',     statuses: ['coat'],            headerCls: 'bg-purple-700', cardCls: 'bg-purple-950', borderCls: 'border-purple-600', textCls: 'text-purple-300', icon: Thermometer },
      { key: 'cool',    label: 'Cool Down',     sublabel: 'Controlled Cooling',       statuses: ['cure'],            headerCls: 'bg-blue-700',   cardCls: 'bg-blue-950',   borderCls: 'border-blue-600',   textCls: 'text-blue-300',   icon: Zap },
      { key: 'trim',    label: 'Trim & Finish', sublabel: 'Film Removal / Inspect',   statuses: ['unrack', 'qc'],    headerCls: 'bg-green-700',  cardCls: 'bg-green-950',  borderCls: 'border-green-600',  textCls: 'text-green-300',  icon: CheckCircle2 },
      { key: 'ship',    label: 'Pack & Ship',   sublabel: 'Wrap & Dispatch',          statuses: ['shipping'],        headerCls: 'bg-teal-700',   cardCls: 'bg-teal-950',   borderCls: 'border-teal-600',   textCls: 'text-teal-300',   icon: Package },
      { key: 'hold',    label: 'On Hold',       sublabel: 'Awaiting Action',          statuses: ['on_hold'],         headerCls: 'bg-zinc-700',   cardCls: 'bg-zinc-800',   borderCls: 'border-zinc-600',   textCls: 'text-zinc-300',   icon: Pause },
    ],
  },

  // ── 5. Panel Sublimation Machine ────────────────────────────────────────────
  {
    id: 'panel-sub',
    name: 'Panel Sublimation Machine',
    shortName: 'Panel Sub',
    description: 'Flat panel heat press — boards, signs, panels',
    serviceTypes: ['sublimation', 'both'],
    headerBg: 'bg-rose-950',
    accentColor: '#f43f5e',
    icon: Printer,
    path: '/panel-board',
    stages: [
      { key: 'artwork', label: 'Artwork Prep',  sublabel: 'Print / Layout Check',  statuses: ['prep'],            headerCls: 'bg-pink-700',   cardCls: 'bg-pink-950',   borderCls: 'border-pink-600',   textCls: 'text-pink-300',   icon: Printer },
      { key: 'queue',   label: 'Press Queue',   sublabel: 'Substrate Staged',      statuses: ['rack'],            headerCls: 'bg-rose-700',   cardCls: 'bg-rose-950',   borderCls: 'border-rose-600',   textCls: 'text-rose-300',   icon: Layers },
      { key: 'press',   label: 'Heat Press',    sublabel: 'Pressing / Transfer',   statuses: ['coat'],            headerCls: 'bg-red-700',    cardCls: 'bg-red-950',    borderCls: 'border-red-600',    textCls: 'text-red-300',    icon: Thermometer },
      { key: 'cool',    label: 'Cool Down',     sublabel: 'Controlled Cooling',    statuses: ['cure'],            headerCls: 'bg-orange-700', cardCls: 'bg-orange-950', borderCls: 'border-orange-600', textCls: 'text-orange-300', icon: Zap },
      { key: 'qc',      label: 'QC & Pack',     sublabel: 'Inspect / Pack',        statuses: ['unrack', 'qc'],    headerCls: 'bg-green-700',  cardCls: 'bg-green-950',  borderCls: 'border-green-600',  textCls: 'text-green-300',  icon: CheckCircle2 },
      { key: 'ship',    label: 'Ship Ready',    sublabel: 'Ready for Dispatch',    statuses: ['shipping'],        headerCls: 'bg-teal-700',   cardCls: 'bg-teal-950',   borderCls: 'border-teal-600',   textCls: 'text-teal-300',   icon: Package },
      { key: 'hold',    label: 'On Hold',       sublabel: 'Awaiting Action',       statuses: ['on_hold'],         headerCls: 'bg-zinc-700',   cardCls: 'bg-zinc-800',   borderCls: 'border-zinc-600',   textCls: 'text-zinc-300',   icon: Pause },
    ],
  },
];

export function getBoardConfig(id: string): BoardConfig {
  return BOARDS.find(b => b.id === id) ?? BOARDS[0];
}

// ─── Status → Stage index for progress indicator ──────────────────────────────

function getStageIndex(stages: StageConfig[], status: JobStatus): number {
  return stages.findIndex(s => (s.statuses as string[]).includes(status));
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: Job;
  activeSessions: WorkstationSession[];
  today: string;
  stages: StageConfig[];
  currentStageIdx: number;
  totalStages: number;
}

function JobCard({ job, activeSessions, today, stages, currentStageIdx, totalStages }: JobCardProps) {
  const isOverdue = job.dueDate < today;
  const isPriority = job.priority === 'rush' || job.priority === 'high';
  const runningSessions = activeSessions.filter(s => s.jobId === job.id && s.status === 'running');
  const pausedSessions = activeSessions.filter(s => s.jobId === job.id && s.status === 'paused');
  const qty = job.parts.reduce((s, p) => s + p.quantity, 0);

  // Progress — ignore last "On Hold" stage for progress calc
  const visibleStages = stages.filter(s => s.key !== 'hold');
  const progressStageIdx = visibleStages.findIndex(s => (s.statuses as string[]).includes(job.status));
  const progressPct = progressStageIdx >= 0
    ? Math.round(((progressStageIdx + 1) / visibleStages.length) * 100)
    : 0;

  return (
    <div
      className={clsx(
        'rounded-2xl border-2 p-4 flex flex-col gap-2.5 shadow-xl transition-all',
        isOverdue
          ? 'border-red-500 bg-red-950'
          : isPriority
            ? 'border-amber-400 bg-gray-800'
            : 'border-gray-700 bg-gray-800',
      )}
    >
      {/* Top: job number + badges */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl font-black text-white tracking-tight leading-none">
          {job.jobNumber}
        </span>
        <div className="flex flex-col items-end gap-1.5">
          {isOverdue && (
            <span className="flex items-center gap-1 text-xs font-black bg-red-600 text-white rounded-lg px-2 py-0.5 uppercase tracking-wider">
              <AlertTriangle size={10} /> OVERDUE
            </span>
          )}
          {isPriority && !isOverdue && (
            <span className="flex items-center gap-1 text-xs font-black bg-amber-500 text-black rounded-lg px-2 py-0.5 uppercase tracking-wider">
              RUSH
            </span>
          )}
          {job.powderSpec?.colorCode && (
            <span className="text-xs font-mono bg-white/10 text-white/70 rounded-lg px-2 py-0.5">
              {job.powderSpec.colorCode}
            </span>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="text-base font-bold text-white truncate leading-tight">
        {job.customerName}
      </div>

      {/* Description */}
      <div className="text-sm text-gray-300 line-clamp-2 leading-relaxed">
        {job.notes || job.parts[0]?.description || job.serviceType.replace(/_/g, ' ')}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span className="text-gray-400 font-medium">{progressPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, backgroundColor: '#22c55e' }}
          />
        </div>
      </div>

      {/* Footer: qty + due date */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-700">
        <span className="text-sm text-gray-400 font-medium">
          Qty: <span className="text-white font-black">{qty}</span>
        </span>
        <span className={clsx('text-sm font-semibold flex items-center gap-1', isOverdue ? 'text-red-400' : 'text-gray-400')}>
          <Clock size={12} />
          {format(new Date(job.dueDate + 'T00:00:00'), 'MMM d')}
        </span>
      </div>

      {/* Active operators */}
      {runningSessions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {runningSessions.map(s => (
            <span key={s.id} className="flex items-center gap-1 text-xs bg-green-700/50 text-green-300 rounded-full px-2.5 py-0.5 border border-green-600/50 font-medium">
              <CheckCircle2 size={9} /> {s.operatorName}
            </span>
          ))}
        </div>
      )}
      {pausedSessions.length > 0 && runningSessions.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {pausedSessions.map(s => (
            <span key={s.id} className="flex items-center gap-1 text-xs bg-yellow-700/50 text-yellow-300 rounded-full px-2.5 py-0.5 border border-yellow-600/50 font-medium">
              <Pause size={9} /> {s.operatorName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────

function StageColumn({
  stage,
  jobs,
  activeSessions,
  today,
  allStages,
  stageIndex,
}: {
  stage: StageConfig;
  jobs: Job[];
  activeSessions: WorkstationSession[];
  today: string;
  allStages: StageConfig[];
  stageIndex: number;
}) {
  const StageIcon = stage.icon;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Column header */}
      <div className={clsx('rounded-xl px-3 py-2.5 flex items-center justify-between gap-2', stage.headerCls)}>
        <div className="flex items-center gap-2 min-w-0">
          <StageIcon size={16} className="text-white flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white text-sm uppercase tracking-wide leading-tight truncate">
              {stage.label}
            </div>
            {stage.sublabel && (
              <div className="text-[10px] text-white/60 leading-tight truncate">{stage.sublabel}</div>
            )}
          </div>
        </div>
        <span className="text-sm font-black bg-white/20 text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 leading-none">
          {jobs.length}
        </span>
      </div>

      {/* Job cards */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {jobs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-800 p-5 text-center text-gray-700 text-sm font-medium">
            Clear
          </div>
        ) : (
          jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              activeSessions={activeSessions}
              today={today}
              stages={allStages}
              currentStageIdx={stageIndex}
              totalStages={allStages.length}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Board Switcher ───────────────────────────────────────────────────────────

function BoardSwitcher({ currentId }: { currentId: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {BOARDS.map(board => {
        const Icon = board.icon;
        const isCurrent = board.id === currentId;
        return (
          <a
            key={board.id}
            href={board.path}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
              isCurrent
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10',
            )}
          >
            <Icon size={11} /> {board.shortName}
          </a>
        );
      })}
    </div>
  );
}

// ─── Main Board Component ─────────────────────────────────────────────────────

export function LineProductionBoard({ boardId }: { boardId: string }) {
  const { state } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockClicks, setUnlockClicks] = useState(0);

  const board = getBoardConfig(boardId);
  const BoardIcon = board.icon;

  // Live clock — 1 second tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fullscreen sync
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  const handleUnlockAttempt = useCallback(() => {
    setUnlockClicks(c => {
      const next = c + 1;
      if (next >= 3) { setLocked(false); return 0; }
      return next;
    });
    setTimeout(() => setUnlockClicks(0), 2000);
  }, []);

  const today = format(now, 'yyyy-MM-dd');
  const timeStr = format(now, 'HH:mm:ss');
  const dateStr = format(now, 'EEE, MMM d yyyy');

  const activeSessions = state.workstationSessions.filter(
    s => s.status === 'running' || s.status === 'paused',
  );

  // Filter jobs by service type relevant to this board
  const boardJobs = state.jobs.filter(j => {
    const serviceMatch = (board.serviceTypes as string[]).includes(j.serviceType);
    if (!serviceMatch) return false;
    // If board has lineType filter and job has rackConfig, apply it
    if (board.lineTypes && j.quotedRackConfig?.lineType) {
      return (board.lineTypes as string[]).includes(j.quotedRackConfig.lineType);
    }
    return true;
  });

  // Group jobs into stages (exclude completed/delivered)
  const stagesWithJobs = board.stages.map(stage => ({
    ...stage,
    jobs: boardJobs.filter(j => (stage.statuses as string[]).includes(j.status)),
  }));

  const totalActive = stagesWithJobs.reduce((sum, s) => sum + s.jobs.length, 0);
  const overdueCount = boardJobs.filter(j => j.dueDate < today && j.status !== 'shipping').length;

  // Stats
  const runningCount = activeSessions.filter(s => s.status === 'running').length;
  const pausedCount = activeSessions.filter(s => s.status === 'paused').length;

  return (
    <div
      className="min-h-screen text-white flex flex-col overflow-hidden"
      style={{ background: '#0a0a0f' }}
    >
      {/* ── Main Header ── */}
      <header className={clsx('flex-shrink-0 border-b border-white/10 px-5 py-3', board.headerBg)}>
        <div className="flex items-center justify-between gap-4">
          {/* Left: board identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: board.accentColor + '30', border: `1px solid ${board.accentColor}50` }}
            >
              <BoardIcon size={20} style={{ color: board.accentColor }} />
            </div>
            <div className="min-w-0">
              <div className="text-white font-black text-lg leading-tight truncate">
                CoatPro — {board.name}
              </div>
              <div className="text-white/40 text-xs leading-tight truncate">{board.description}</div>
            </div>
          </div>

          {/* Center: live clock */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="text-4xl font-mono font-black text-white tracking-widest tabular-nums">
              {timeStr}
            </div>
            <div className="text-xs text-white/40">{dateStr}</div>
          </div>

          {/* Right: controls */}
          {!locked ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setLocked(true)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Lock size={12} /> Lock
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-colors"
              >
                {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                {isFullscreen ? 'Exit FS' : 'Fullscreen'}
              </button>
              <a
                href="/"
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-colors"
              >
                ← Dashboard
              </a>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0"
              onClick={handleUnlockAttempt}
              title="Click 3× quickly to unlock"
            >
              <Lock size={20} className={unlockClicks > 0 ? 'text-yellow-400' : 'text-white/20'} />
              {unlockClicks > 0 && (
                <span className="text-xs text-yellow-400">{3 - unlockClicks} more…</span>
              )}
            </div>
          )}
        </div>

        {/* Board switcher row */}
        <div className="mt-2.5">
          <BoardSwitcher currentId={boardId} />
        </div>
      </header>

      {/* ── Stats bar ── */}
      <div className="flex-shrink-0 bg-black/40 border-b border-white/5 px-5 py-2 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-white/50">Jobs in queue:</span>
          <span className="text-white font-black">{totalActive}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/50">Operators active:</span>
          <span className="text-green-400 font-black">{runningCount}</span>
        </div>
        {pausedCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-white/50">Paused:</span>
            <span className="text-yellow-400 font-black">{pausedCount}</span>
          </div>
        )}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-white/50">Overdue:</span>
            <span className="text-red-400 font-black">{overdueCount}</span>
          </div>
        )}
        <div className="ml-auto text-xs text-white/20">
          Updates every second · {board.shortName} Line
        </div>
      </div>

      {/* ── Stage grid ── */}
      <main className="flex-1 overflow-auto p-4">
        <div
          className="grid gap-3 h-full"
          style={{ gridTemplateColumns: `repeat(${board.stages.length}, minmax(0, 1fr))` }}
        >
          {stagesWithJobs.map((stage, idx) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              jobs={stage.jobs}
              activeSessions={activeSessions}
              today={today}
              allStages={board.stages}
              stageIndex={idx}
            />
          ))}
        </div>

        {/* Empty state */}
        {totalActive === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-8xl font-black text-white/5 mb-4">CLEAR</div>
              <div className="text-white/20 text-xl font-medium">No active jobs on {board.shortName}</div>
            </div>
          </div>
        )}
      </main>

      {/* ── Status footer ── */}
      <footer className="flex-shrink-0 bg-black/60 border-t border-white/5 px-5 py-2 flex items-center gap-6 text-xs text-white/30">
        {board.stages.map(s => {
          const count = stagesWithJobs.find(sw => sw.key === s.key)?.jobs.length ?? 0;
          return (
            <span key={s.key} className={count > 0 ? 'text-white/60 font-semibold' : ''}>
              {s.label}: <span className={count > 0 ? s.textCls : ''}>{count}</span>
            </span>
          );
        })}
        {locked && (
          <span className="ml-auto flex items-center gap-1">
            <Lock size={9} /> Locked — tap 3× to unlock
          </span>
        )}
      </footer>
    </div>
  );
}
