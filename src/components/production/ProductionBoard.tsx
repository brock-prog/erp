import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Layers, Maximize2, Minimize2, Lock, Unlock, Clock,
  AlertTriangle, CheckCircle2, Pause,
} from 'lucide-react';
import { clsx } from '../../utils';
import { useApp } from '../../context/AppContext';
import type { Job, JobStatus, WorkstationSession } from '../../types';

// ── Stage definitions ────────────────────────────────────────────────────────
interface StageConfig {
  key: string;
  label: string;
  statuses: JobStatus[];
  color: string; // tailwind bg for header
  textColor: string;
  borderColor: string;
  bgCard: string;
}

const STAGES: StageConfig[] = [
  {
    key: 'pretreat',
    label: 'Pre-Treatment',
    statuses: ['prep', 'blast', 'rack', 'pretreat'],
    color: 'bg-blue-700',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-600',
    bgCard: 'bg-blue-950',
  },
  {
    key: 'coat',
    label: 'Coating',
    statuses: ['coat'],
    color: 'bg-purple-700',
    textColor: 'text-purple-300',
    borderColor: 'border-purple-600',
    bgCard: 'bg-purple-950',
  },
  {
    key: 'cure',
    label: 'Cure / Oven',
    statuses: ['cure'],
    color: 'bg-orange-700',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-600',
    bgCard: 'bg-orange-950',
  },
  {
    key: 'qc',
    label: 'Quality Check',
    statuses: ['qc'],
    color: 'bg-green-700',
    textColor: 'text-green-300',
    borderColor: 'border-green-600',
    bgCard: 'bg-green-950',
  },
  {
    key: 'finishing',
    label: 'Finishing / Ship',
    statuses: ['unrack', 'shipping'],
    color: 'bg-teal-700',
    textColor: 'text-teal-300',
    borderColor: 'border-teal-600',
    bgCard: 'bg-teal-950',
  },
  {
    key: 'hold',
    label: 'On Hold',
    statuses: ['on_hold'],
    color: 'bg-yellow-700',
    textColor: 'text-yellow-300',
    borderColor: 'border-yellow-600',
    bgCard: 'bg-yellow-950',
  },
];

// ── Sub-components ───────────────────────────────────────────────────────────

interface JobCardProps {
  job: Job;
  activeSessions: WorkstationSession[];
  today: string;
}

function JobCard({ job, activeSessions, today }: JobCardProps) {
  const isOverdue = job.dueDate < today;
  const runningSessions = activeSessions.filter(
    s => s.jobId === job.id && s.status === 'running',
  );
  const pausedSessions = activeSessions.filter(
    s => s.jobId === job.id && s.status === 'paused',
  );

  return (
    <div
      className={clsx(
        'rounded-xl border-2 p-4 flex flex-col gap-2 shadow-lg',
        isOverdue ? 'border-red-500 bg-red-950' : 'border-gray-700 bg-gray-800',
      )}
    >
      {/* Top row: job number + overdue */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-black text-white tracking-tight leading-none">
          {job.jobNumber}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isOverdue && (
            <span className="flex items-center gap-1 text-xs font-bold bg-red-600 text-white rounded px-1.5 py-0.5">
              <AlertTriangle size={10} />
              OVERDUE
            </span>
          )}
          {job.powderSpec?.colorCode && (
            <span
              className="text-xs font-mono bg-white/10 text-white/70 rounded px-1.5"
              title={job.powderSpec.colorName}
            >
              {job.powderSpec.colorCode}
            </span>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="text-sm font-semibold text-gray-200 truncate">{job.customerName}</div>

      {/* Description */}
      <div className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
        {job.notes || job.parts[0]?.description || job.serviceType}
      </div>

      {/* Footer: qty, due, operator */}
      <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-gray-700">
        <span className="text-xs text-gray-400 font-medium">
          Qty: <span className="text-white font-bold">{job.parts.reduce((s, p) => s + p.quantity, 0)}</span>
        </span>
        <span className={clsx('text-xs font-medium', isOverdue ? 'text-red-400' : 'text-gray-400')}>
          Due {format(new Date(job.dueDate + 'T00:00:00'), 'MMM d')}
        </span>
      </div>

      {/* Active operators */}
      {runningSessions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {runningSessions.map(s => (
            <span
              key={s.id}
              className="flex items-center gap-1 text-xs bg-green-700/50 text-green-300 rounded-full px-2 py-0.5 border border-green-600/50"
            >
              <CheckCircle2 size={9} />
              {s.operatorName}
            </span>
          ))}
        </div>
      )}
      {pausedSessions.length > 0 && runningSessions.length === 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {pausedSessions.map(s => (
            <span
              key={s.id}
              className="flex items-center gap-1 text-xs bg-yellow-700/50 text-yellow-300 rounded-full px-2 py-0.5 border border-yellow-600/50"
            >
              <Pause size={9} />
              {s.operatorName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProductionBoard() {
  const { state } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockClicks, setUnlockClicks] = useState(0);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
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
      if (next >= 3) {
        setLocked(false);
        return 0;
      }
      return next;
    });
    // reset after 2s of no clicks
    setTimeout(() => setUnlockClicks(0), 2000);
  }, []);

  const today = format(now, 'yyyy-MM-dd');
  const timeStr = format(now, 'HH:mm:ss');
  const dateStr = format(now, 'EEEE, MMMM d yyyy');

  // Active workstation sessions (running or paused)
  const activeSessions = state.workstationSessions.filter(
    s => s.status === 'running' || s.status === 'paused',
  );

  // Jobs by stage
  const stagesWithJobs = STAGES.map(stage => ({
    ...stage,
    jobs: state.jobs.filter(j => (stage.statuses as string[]).includes(j.status)),
  }));

  const totalActive = stagesWithJobs.reduce((sum, s) => sum + s.jobs.length, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <Layers size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">CoatPro — Production Board</div>
            <div className="text-gray-500 text-xs">{totalActive} jobs in production</div>
          </div>
        </div>

        {/* Center: Clock */}
        <div className="flex flex-col items-center">
          <div className="text-3xl font-mono font-black text-white tracking-widest">{timeStr}</div>
          <div className="text-xs text-gray-400">{dateStr}</div>
        </div>

        {/* Right: Controls (hidden when locked) */}
        {!locked ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocked(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Lock size={13} />
              Lock Screen
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <a
              href="/"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              ← Dashboard
            </a>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={handleUnlockAttempt}
            title="Click 3× quickly to unlock"
          >
            <Lock size={18} className={unlockClicks > 0 ? 'text-yellow-400' : 'text-gray-600'} />
            {unlockClicks > 0 && (
              <span className="text-xs text-yellow-400">{3 - unlockClicks} more…</span>
            )}
          </div>
        )}
      </header>

      {/* ── Stage grid ── */}
      <main className="flex-1 overflow-auto p-4">
        <div className="grid gap-4 h-full" style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }}>
          {stagesWithJobs.map(stage => (
            <div key={stage.key} className="flex flex-col gap-3 min-w-0">
              {/* Column header */}
              <div className={clsx('rounded-lg px-3 py-2.5 flex items-center justify-between', stage.color)}>
                <span className="font-bold text-white text-sm uppercase tracking-wide">{stage.label}</span>
                <span className="text-xs font-black bg-white/20 text-white rounded-full px-2 py-0.5 leading-none">
                  {stage.jobs.length}
                </span>
              </div>

              {/* Job cards */}
              <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                {stage.jobs.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-800 p-4 text-center text-gray-700 text-xs">
                    No jobs
                  </div>
                ) : (
                  stage.jobs.map(job => (
                    <JobCard key={job.id} job={job} activeSessions={activeSessions} today={today} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Bottom status bar ── */}
      <footer className="flex-shrink-0 bg-gray-900 border-t border-gray-800 px-6 py-2 flex items-center gap-6 text-xs text-gray-500">
        <span>
          Active operators:{' '}
          <span className="text-green-400 font-bold">
            {activeSessions.filter(s => s.status === 'running').length}
          </span>
        </span>
        <span>
          Paused:{' '}
          <span className="text-yellow-400 font-bold">
            {activeSessions.filter(s => s.status === 'paused').length}
          </span>
        </span>
        <span>
          Total jobs in production:{' '}
          <span className="text-white font-bold">{totalActive}</span>
        </span>
        {locked && (
          <span className="ml-auto text-gray-700 flex items-center gap-1">
            <Lock size={10} /> Screen locked — click lock icon 3× to unlock
          </span>
        )}
      </footer>
    </div>
  );
}
