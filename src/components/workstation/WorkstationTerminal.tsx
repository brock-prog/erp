import React, { useEffect, useState, useCallback, useRef } from 'react';
import { format, differenceInSeconds } from 'date-fns';
import {
  Layers, Play, Pause, Square, AlertTriangle, ChevronLeft,
  Clock, User, Package, CheckCircle2, X,
} from 'lucide-react';
import { clsx, generateId } from '../../utils';
import { useApp } from '../../context/AppContext';
import type { Job, JobStatus, WorkstationName, WorkstationSession } from '../../types';

// ── Workstation config ───────────────────────────────────────────────────────

interface WorkstationConfig {
  name: WorkstationName;
  label: string;
  color: string;
  hoverColor: string;
  stages: JobStatus[];
  icon: string;
}

const WORKSTATIONS: WorkstationConfig[] = [
  { name: 'blast',    label: 'Blast Cabinet', color: 'bg-slate-700',  hoverColor: 'hover:bg-slate-600', stages: ['prep', 'blast'],          icon: '💨' },
  { name: 'pretreat', label: 'Pre-Treatment', color: 'bg-blue-700',   hoverColor: 'hover:bg-blue-600',  stages: ['rack', 'pretreat'],        icon: '🧪' },
  { name: 'coat',     label: 'Powder Coat',   color: 'bg-purple-700', hoverColor: 'hover:bg-purple-600',stages: ['coat'],                    icon: '🎨' },
  { name: 'cure',     label: 'Cure / Oven',   color: 'bg-orange-700', hoverColor: 'hover:bg-orange-600',stages: ['cure'],                    icon: '🔥' },
  { name: 'qc',       label: 'Quality Check', color: 'bg-green-700',  hoverColor: 'hover:bg-green-600', stages: ['qc'],                      icon: '✅' },
  { name: 'unrack',   label: 'Unracking',     color: 'bg-teal-700',   hoverColor: 'hover:bg-teal-600',  stages: ['unrack'],                  icon: '📦' },
  { name: 'shipping', label: 'Shipping',      color: 'bg-indigo-700', hoverColor: 'hover:bg-indigo-600',stages: ['shipping'],                icon: '🚚' },
  { name: 'design',   label: 'Design',        color: 'bg-pink-700',   hoverColor: 'hover:bg-pink-600',  stages: ['received', 'quote'],       icon: '🖥️' },
  { name: 'printing', label: 'Printing',      color: 'bg-rose-700',   hoverColor: 'hover:bg-rose-600',  stages: ['received'],                icon: '🖨️' },
  { name: 'pressing', label: 'Heat Press',    color: 'bg-red-700',    hoverColor: 'hover:bg-red-600',   stages: ['received'],                icon: '♨️' },
  { name: 'packing',  label: 'Packing',       color: 'bg-cyan-700',   hoverColor: 'hover:bg-cyan-600',  stages: ['qc', 'unrack'],            icon: '📫' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// ── Step components ──────────────────────────────────────────────────────────

// Step 1: Pick Workstation
function StationPicker({
  jobs,
  sessions,
  onSelect,
}: {
  jobs: Job[];
  sessions: WorkstationSession[];
  onSelect: (ws: WorkstationConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div className="text-center">
        <div className="text-3xl font-black text-white mb-1">Select Your Workstation</div>
        <div className="text-gray-400 text-sm">Tap the station you are working at</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {WORKSTATIONS.map(ws => {
          const wsJobs = jobs.filter(j => (ws.stages as string[]).includes(j.status));
          const wsSessions = sessions.filter(s => s.workstation === ws.name && (s.status === 'running' || s.status === 'paused'));
          return (
            <button
              key={ws.name}
              onClick={() => onSelect(ws)}
              className={clsx(
                'flex flex-col items-center gap-3 rounded-2xl p-6 border-2 border-white/10 transition-all active:scale-95',
                ws.color, ws.hoverColor,
              )}
            >
              <span className="text-4xl">{ws.icon}</span>
              <span className="text-white font-bold text-lg text-center leading-tight">{ws.label}</span>
              <div className="flex gap-3 text-xs text-white/70">
                <span>{wsJobs.length} jobs</span>
                {wsSessions.length > 0 && (
                  <span className="text-green-300 font-bold">{wsSessions.length} active</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 2: Enter operator name + helpers
function OperatorEntry({
  workstation,
  recentOperators,
  onConfirm,
  onBack,
}: {
  workstation: WorkstationConfig;
  recentOperators: string[];
  onConfirm: (name: string, helpers: string[]) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [helpers, setHelpers] = useState<string[]>([]);
  const [helperInput, setHelperInput] = useState('');

  function addHelper() {
    const h = helperInput.trim();
    if (!h || helpers.includes(h)) { setHelperInput(''); return; }
    setHelpers(prev => [...prev, h]);
    setHelperInput('');
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-fit">
        <ChevronLeft size={16} /> Back
      </button>
      <div className="text-center">
        <div className="text-2xl">{workstation.icon}</div>
        <div className="text-3xl font-black text-white mt-1">{workstation.label}</div>
        <div className="text-gray-400 text-sm mt-1">Who is working at this station?</div>
      </div>

      {/* Primary operator */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name…"
        className="w-full bg-gray-800 border-2 border-gray-700 focus:border-brand-500 rounded-xl px-5 py-4 text-white text-xl placeholder-gray-600 outline-none text-center"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim(), helpers); }}
      />
      {recentOperators.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2 text-center">Recent operators</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {recentOperators.map(op => (
              <button
                key={op}
                onClick={() => setName(op)}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helpers section */}
      <div className="bg-gray-800/60 rounded-2xl p-4 space-y-3">
        <div className="text-sm text-gray-400 font-medium">Helpers at this station (optional)</div>
        {helpers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {helpers.map(h => (
              <span key={h} className="flex items-center gap-1.5 bg-gray-700 text-white text-sm rounded-full px-3 py-1 font-medium">
                {h}
                <button onClick={() => setHelpers(prev => prev.filter(x => x !== h))} className="text-gray-400 hover:text-white leading-none">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={helperInput}
            onChange={e => setHelperInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addHelper(); }}
            placeholder="Helper name…"
            className="flex-1 bg-gray-700 border border-gray-600 focus:border-brand-500 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none"
          />
          <button
            onClick={addHelper}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl font-medium transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      <button
        onClick={() => { if (name.trim()) onConfirm(name.trim(), helpers); }}
        disabled={!name.trim()}
        className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-bold text-xl rounded-2xl py-4 transition-colors active:scale-95"
      >
        Continue →
      </button>
    </div>
  );
}

// Step 3: Pick job
function JobPicker({
  workstation,
  operatorName,
  jobs,
  onSelect,
  onBack,
}: {
  workstation: WorkstationConfig;
  operatorName: string;
  jobs: Job[];
  onSelect: (job: Job) => void;
  onBack: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const stageJobs = jobs.filter(j => (workstation.stages as string[]).includes(j.status));

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-fit">
        <ChevronLeft size={16} /> Back
      </button>
      <div className="text-center">
        <div className="text-2xl font-black text-white">
          {workstation.icon} {workstation.label}
        </div>
        <div className="text-gray-400 text-sm">Hi {operatorName} — select a job to start</div>
      </div>
      {stageJobs.length === 0 ? (
        <div className="text-center text-gray-600 py-12 text-lg">No jobs queued for this station</div>
      ) : (
        <div className="flex flex-col gap-3">
          {stageJobs.map(job => {
            const isOverdue = job.dueDate < today;
            return (
              <button
                key={job.id}
                onClick={() => onSelect(job)}
                className={clsx(
                  'flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all active:scale-98 hover:border-brand-500',
                  isOverdue ? 'border-red-600 bg-red-950/50' : 'border-gray-700 bg-gray-800 hover:bg-gray-750',
                )}
              >
                {job.powderSpec?.colorCode && (
                  <div className="flex-shrink-0 text-xs font-mono bg-gray-700 text-gray-300 rounded px-2 py-1 self-center">
                    {job.powderSpec.colorCode}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-2xl font-black text-white">{job.jobNumber}</span>
                    {isOverdue && (
                      <span className="text-xs font-bold bg-red-600 text-white rounded px-1.5 py-0.5 flex items-center gap-1">
                        <AlertTriangle size={9} /> OVERDUE
                      </span>
                    )}
                  </div>
                  <div className="text-gray-200 font-semibold text-sm truncate">{job.customerName}</div>
                  <div className="text-gray-400 text-xs truncate">{job.notes || job.parts[0]?.description || job.serviceType}</div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-white font-bold text-lg">{job.parts.reduce((s, p) => s + p.quantity, 0)}</span>
                  <span className="text-gray-500 text-xs">pcs</span>
                  <span className={clsx('text-xs', isOverdue ? 'text-red-400' : 'text-gray-500')}>
                    Due {format(new Date(job.dueDate + 'T00:00:00'), 'MMM d')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Step 4: Active timer
interface TimerScreenProps {
  session: WorkstationSession;
  job: Job;
  onPause: () => void;
  onResume: () => void;
  onComplete: (partsCompleted: number, notes: string) => void;
  onAbandon: () => void;
}

function TimerScreen({ session, job, onPause, onResume, onComplete, onAbandon }: TimerScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const [partsCompleted, setPartsCompleted] = useState(job.parts.reduce((s, p) => s + p.quantity, 0));
  const [notes, setNotes] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session.status === 'running') {
      const base = differenceInSeconds(new Date(), new Date(session.startedAt));
      setElapsed(base);
      intervalRef.current = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), new Date(session.startedAt)));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [session.status, session.startedAt]);

  const isRunning = session.status === 'running';

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
      {/* Job header */}
      <div className={clsx('rounded-2xl border-2 p-5 text-center', isRunning ? 'border-green-600 bg-green-950/40' : 'border-yellow-600 bg-yellow-950/40')}>
        <div className="text-4xl font-black text-white mb-1">{job.jobNumber}</div>
        <div className="text-gray-300 font-semibold">{job.customerName}</div>
        <div className="text-gray-400 text-sm mt-0.5 line-clamp-2">{job.notes || job.parts[0]?.description || job.serviceType}</div>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm">
          <span className="text-gray-400">Qty: <span className="text-white font-bold">{job.parts.reduce((s, p) => s + p.quantity, 0)}</span></span>
          <span className="text-gray-400">Station: <span className="text-white font-bold capitalize">{session.workstation}</span></span>
        </div>
      </div>

      {/* Timer display */}
      <div className="text-center">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
          {isRunning ? 'Elapsed Time' : 'PAUSED'}
        </div>
        <div className={clsx(
          'font-mono font-black text-7xl tracking-tighter',
          isRunning ? 'text-white' : 'text-yellow-400',
        )}>
          {formatElapsed(elapsed)}
        </div>
        <div className="text-xs text-gray-600 mt-1">
          Started {format(new Date(session.startedAt), 'h:mm a')} · {session.operatorName}
          {session.helpers && session.helpers.length > 0 && (
            <span className="ml-1 text-gray-500">+ {session.helpers.join(', ')}</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!showComplete ? (
        <div className="flex flex-col gap-3">
          {isRunning ? (
            <button
              onClick={onPause}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-2xl rounded-2xl py-5 flex items-center justify-center gap-3 transition-colors active:scale-95"
            >
              <Pause size={28} /> PAUSE
            </button>
          ) : (
            <button
              onClick={onResume}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold text-2xl rounded-2xl py-5 flex items-center justify-center gap-3 transition-colors active:scale-95"
            >
              <Play size={28} /> RESUME
            </button>
          )}
          <button
            onClick={() => setShowComplete(true)}
            className="w-full bg-red-700 hover:bg-red-600 text-white font-bold text-2xl rounded-2xl py-5 flex items-center justify-center gap-3 transition-colors active:scale-95"
          >
            <Square size={28} /> COMPLETE
          </button>
          <button
            onClick={onAbandon}
            className="w-full bg-transparent border border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 font-medium text-sm rounded-xl py-3 transition-colors"
          >
            Abandon / Cancel Session
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-center text-lg font-bold text-white">Finishing up…</div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Parts completed</label>
            <input
              type="number"
              value={partsCompleted}
              onChange={e => setPartsCompleted(Number(e.target.value))}
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-brand-500 rounded-xl px-4 py-3 text-white text-xl text-center outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any issues or comments…"
              rows={2}
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-brand-500 rounded-xl px-4 py-3 text-white text-sm resize-none outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowComplete(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl py-4 text-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => onComplete(partsCompleted, notes)}
              className="flex-[2] bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl py-4 text-xl flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              <CheckCircle2 size={22} /> Save & Finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

type Step = 'station' | 'operator' | 'job' | 'timer';

export function WorkstationTerminal() {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState<Step>('station');
  const [selectedWs, setSelectedWs] = useState<WorkstationConfig | null>(null);
  const [operatorName, setOperatorName] = useState('');
  const [operatorHelpers, setOperatorHelpers] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeSession, setActiveSession] = useState<WorkstationSession | null>(null);
  const [recentOperators, setRecentOperators] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cp_recent_operators') ?? '[]'); } catch { return []; }
  });
  const [completedSession, setCompletedSession] = useState<WorkstationSession | null>(null);

  const now = new Date().toISOString();

  const handleSelectStation = useCallback((ws: WorkstationConfig) => {
    setSelectedWs(ws);
    setStep('operator');
  }, []);

  const handleOperatorConfirm = useCallback((name: string, helpers: string[]) => {
    setOperatorName(name);
    setOperatorHelpers(helpers);
    // Save to recent
    setRecentOperators(prev => {
      const updated = [name, ...prev.filter(o => o !== name)].slice(0, 6);
      localStorage.setItem('cp_recent_operators', JSON.stringify(updated));
      return updated;
    });
    setStep('job');
  }, []);

  const handleJobSelect = useCallback((job: Job) => {
    if (!selectedWs) return;
    const session: WorkstationSession = {
      id: generateId(),
      jobId: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customerName,
      workstation: selectedWs.name,
      operatorName,
      helpers: operatorHelpers.length > 0 ? operatorHelpers : undefined,
      startedAt: new Date().toISOString(),
      status: 'running',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_WORKSTATION_SESSION', payload: session });
    setSelectedJob(job);
    setActiveSession(session);
    setStep('timer');
  }, [selectedWs, operatorName, operatorHelpers, dispatch]);

  const handlePause = useCallback(() => {
    if (!activeSession) return;
    const updated: WorkstationSession = {
      ...activeSession,
      status: 'paused',
      pausedAt: new Date().toISOString(),
    };
    dispatch({ type: 'UPDATE_WORKSTATION_SESSION', payload: updated });
    setActiveSession(updated);
  }, [activeSession, dispatch]);

  const handleResume = useCallback(() => {
    if (!activeSession) return;
    const updated: WorkstationSession = {
      ...activeSession,
      status: 'running',
      pausedAt: undefined,
    };
    dispatch({ type: 'UPDATE_WORKSTATION_SESSION', payload: updated });
    setActiveSession(updated);
  }, [activeSession, dispatch]);

  const handleComplete = useCallback((partsCompleted: number, notes: string) => {
    if (!activeSession) return;
    const endedAt = new Date().toISOString();
    const durationMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(activeSession.startedAt).getTime()) / 60000,
    );
    const updated: WorkstationSession = {
      ...activeSession,
      status: 'completed',
      endedAt,
      durationMinutes,
      partsCompleted,
      notes: notes || undefined,
    };
    dispatch({ type: 'UPDATE_WORKSTATION_SESSION', payload: updated });
    setCompletedSession(updated);
    setActiveSession(null);
    setSelectedJob(null);
  }, [activeSession, dispatch]);

  const handleAbandon = useCallback(() => {
    if (!activeSession) return;
    const updated: WorkstationSession = { ...activeSession, status: 'abandoned', endedAt: new Date().toISOString() };
    dispatch({ type: 'UPDATE_WORKSTATION_SESSION', payload: updated });
    setActiveSession(null);
    setSelectedJob(null);
    setStep('station');
    setSelectedWs(null);
    setOperatorName('');
    setOperatorHelpers([]);
  }, [activeSession, dispatch]);

  const resetToStart = useCallback(() => {
    setStep('station');
    setSelectedWs(null);
    setOperatorName('');
    setOperatorHelpers([]);
    setSelectedJob(null);
    setActiveSession(null);
    setCompletedSession(null);
  }, []);

  // Completed splash screen
  if (completedSession) {
    const mins = completedSession.durationMinutes ?? 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 gap-6">
        <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-white" />
        </div>
        <div className="text-center">
          <div className="text-4xl font-black text-white mb-2">Session Complete!</div>
          <div className="text-gray-400 text-lg">{completedSession.jobNumber} · {completedSession.customerName}</div>
        </div>
        <div className="flex gap-8 text-center">
          <div>
            <div className="text-3xl font-black text-white">{h}h {m}m</div>
            <div className="text-gray-500 text-xs mt-0.5">Time logged</div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">{completedSession.partsCompleted ?? '—'}</div>
            <div className="text-gray-500 text-xs mt-0.5">Parts completed</div>
          </div>
        </div>
        {completedSession.helpers && completedSession.helpers.length > 0 && (
          <div className="text-gray-400 text-sm text-center">
            Helpers: <span className="text-white font-medium">{completedSession.helpers.join(', ')}</span>
          </div>
        )}
        {completedSession.notes && (
          <div className="bg-gray-800 rounded-xl px-5 py-3 text-gray-300 text-sm max-w-sm text-center">
            {completedSession.notes}
          </div>
        )}
        <button
          onClick={resetToStart}
          className="mt-4 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xl rounded-2xl px-10 py-5 transition-colors active:scale-95"
        >
          Start New Job →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">Workstation Terminal</div>
            <div className="text-gray-500 text-xs">
              {step === 'station' && 'Select your workstation'}
              {step === 'operator' && selectedWs?.label}
              {step === 'job' && `${selectedWs?.label} · ${operatorName}`}
              {step === 'timer' && `${selectedWs?.label} · ${operatorName}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-600" />
          <span className="text-gray-500 text-xs font-mono">{format(new Date(), 'HH:mm')}</span>
          {step !== 'station' && step !== 'timer' && (
            <button
              onClick={resetToStart}
              className="ml-3 text-gray-600 hover:text-gray-400 flex items-center gap-1 text-xs"
            >
              <X size={14} /> Reset
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {step === 'station' && (
          <StationPicker
            jobs={state.jobs}
            sessions={state.workstationSessions}
            onSelect={handleSelectStation}
          />
        )}
        {step === 'operator' && selectedWs && (
          <OperatorEntry
            workstation={selectedWs}
            recentOperators={recentOperators}
            onConfirm={handleOperatorConfirm}
            onBack={() => setStep('station')}
          />
        )}
        {step === 'job' && selectedWs && (
          <JobPicker
            workstation={selectedWs}
            operatorName={operatorName}
            jobs={state.jobs}
            onSelect={handleJobSelect}
            onBack={() => setStep('operator')}
          />
        )}
        {step === 'timer' && activeSession && selectedJob && (
          <TimerScreen
            session={activeSession}
            job={selectedJob}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleComplete}
            onAbandon={handleAbandon}
          />
        )}
      </main>
    </div>
  );
}
