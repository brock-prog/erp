import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, Pause, CheckCircle2, UserPlus, X, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateId } from '../../utils';
import type { ProcessSession, ProcessType } from '../../types';

interface ProcessTimerProps {
  processType: ProcessType;
  /** Set after the reference entity is created (e.g. after shipment saved) */
  referenceId?: string;
  referenceLabel?: string;
  /** Called when the timer starts (useful for advancing the parent step) */
  onStart?: () => void;
  /** Called when the operator hits Complete */
  onComplete: (session: ProcessSession) => void;
}

function formatSecs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * ProcessTimer — shown at the top of kiosk screens.
 * Designed for light (#f4f6fa) kiosk backgrounds.
 *
 * States:
 *  idle     → "Start" button; helpers can be added
 *  running  → live green banner; Pause + Complete controls
 *  paused   → amber banner; Resume + Complete controls
 *  complete → green notes panel; Save & Complete button
 */
export function ProcessTimer({
  processType,
  referenceId,
  referenceLabel,
  onStart,
  onComplete,
}: ProcessTimerProps) {
  const { state, dispatch } = useApp();
  const { currentUser } = state;

  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [sessionId] = useState(() => generateId());
  const [startedAt, setStartedAt] = useState<string>('');
  const [displaySecs, setDisplaySecs] = useState(0);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [helperInput, setHelperInput] = useState('');
  const [showHelperInput, setShowHelperInput] = useState(false);
  const [showCompletePanel, setShowCompletePanel] = useState(false);
  const [notes, setNotes] = useState('');

  // Accumulated seconds (excluding paused time)
  const accSecsRef = useRef(0);
  const lastResumeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerStatus === 'running') {
      lastResumeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setDisplaySecs(accSecsRef.current + Math.floor((Date.now() - lastResumeRef.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerStatus]);

  function handleStart() {
    const now = new Date().toISOString();
    setStartedAt(now);
    lastResumeRef.current = Date.now();
    setTimerStatus('running');
    onStart?.();
    const session: ProcessSession = {
      id: sessionId,
      processType,
      referenceId,
      referenceLabel,
      operatorName: currentUser.name,
      helpers: [...helpers],
      startedAt: now,
      status: 'running',
      createdAt: now,
    };
    dispatch({ type: 'ADD_PROCESS_SESSION', payload: session });
  }

  function handlePause() {
    accSecsRef.current += Math.floor((Date.now() - lastResumeRef.current) / 1000);
    setDisplaySecs(accSecsRef.current);
    setTimerStatus('paused');
  }

  function handleResume() {
    setTimerStatus('running');
  }

  function handleComplete() {
    if (!startedAt) return;
    if (timerStatus === 'running') {
      accSecsRef.current += Math.floor((Date.now() - lastResumeRef.current) / 1000);
    }
    const endedAt = new Date().toISOString();
    const totalMinutes = Math.round(accSecsRef.current / 60);
    const session: ProcessSession = {
      id: sessionId,
      processType,
      referenceId,
      referenceLabel,
      operatorName: currentUser.name,
      helpers: [...helpers],
      startedAt,
      endedAt,
      totalMinutes,
      status: 'completed',
      notes: notes.trim() || undefined,
      createdAt: startedAt,
    };
    dispatch({ type: 'UPDATE_PROCESS_SESSION', payload: session });
    onComplete(session);
  }

  function addHelper() {
    const name = helperInput.trim();
    if (!name || helpers.includes(name)) { setHelperInput(''); setShowHelperInput(false); return; }
    setHelpers(prev => [...prev, name]);
    setHelperInput('');
    setShowHelperInput(false);
  }

  // ── IDLE ─────────────────────────────────────────────────────────────────────
  if (timerStatus === 'idle') {
    return (
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={15} className="text-brand-500" />
            <span className="text-sm font-semibold text-gray-700">Session Timer</span>
          </div>
          <span className="text-xs text-gray-400">Start before submitting</span>
        </div>

        {/* Operator */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {currentUser.avatarInitials}
          </div>
          <span className="text-sm text-gray-800 font-medium">{currentUser.name}</span>
          <span className="text-xs text-gray-400 ml-1">— primary operator</span>
        </div>

        {/* Helpers */}
        {helpers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {helpers.map(h => (
              <span key={h} className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs rounded-full px-2.5 py-1 font-medium border border-brand-100">
                {h}
                <button
                  onClick={() => setHelpers(prev => prev.filter(x => x !== h))}
                  className="text-brand-400 hover:text-brand-700 ml-0.5"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add helper input */}
        {showHelperInput ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={helperInput}
              onChange={e => setHelperInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addHelper(); if (e.key === 'Escape') setShowHelperInput(false); }}
              placeholder="Helper name…"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-brand-400"
            />
            <button onClick={addHelper} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg font-medium">Add</button>
            <button onClick={() => setShowHelperInput(false)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowHelperInput(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors w-fit"
          >
            <UserPlus size={13} /> Add helper
          </button>
        )}

        {/* Start */}
        <button
          onClick={handleStart}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-500 active:scale-95 text-white font-bold rounded-xl transition-all text-sm"
        >
          <Play size={15} fill="white" /> Start Session
        </button>
      </div>
    );
  }

  // ── COMPLETE PANEL ───────────────────────────────────────────────────────────
  if (showCompletePanel) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600" />
          <span className="text-sm font-semibold text-green-700">Complete Session</span>
          <span className="ml-auto font-mono text-sm font-bold text-gray-700">{formatSecs(displaySecs)}</span>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any issues or observations…"
            rows={2}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-brand-400 resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompletePanel(false)}
            className="flex-1 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-xl font-medium"
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            className="flex-[2] py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95"
          >
            <CheckCircle2 size={15} /> Save & Complete
          </button>
        </div>
      </div>
    );
  }

  // ── RUNNING / PAUSED BANNER ──────────────────────────────────────────────────
  const isRunning = timerStatus === 'running';
  return (
    <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-3 ${
      isRunning
        ? 'border-green-200 bg-green-50'
        : 'border-amber-200 bg-amber-50'
    }`}>
      {/* Operator + helpers */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          {currentUser.avatarInitials}
        </div>
        <span className="text-gray-700 text-xs font-medium truncate">{currentUser.name}</span>
        {helpers.length > 0 && (
          <span className="flex items-center gap-1 text-gray-500 text-xs flex-shrink-0">
            <Users size={11} /> +{helpers.length}
          </span>
        )}
      </div>

      {/* Elapsed time */}
      <span className={`font-mono font-bold text-base tabular-nums flex-shrink-0 ${
        isRunning ? 'text-gray-900' : 'text-amber-700'
      }`}>
        {formatSecs(displaySecs)}
      </span>

      {/* Status label */}
      <span className={`text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${
        isRunning ? 'text-green-600' : 'text-amber-600'
      }`}>
        {isRunning ? 'LIVE' : 'PAUSED'}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {isRunning ? (
          <button
            onClick={handlePause}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs rounded-lg font-medium transition-colors"
          >
            <Pause size={12} /> Pause
          </button>
        ) : (
          <button
            onClick={handleResume}
            className="flex items-center gap-1 px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded-lg font-medium transition-colors"
          >
            <Play size={12} fill="currentColor" /> Resume
          </button>
        )}
        <button
          onClick={() => setShowCompletePanel(true)}
          className="flex items-center gap-1 px-2.5 py-1 bg-brand-100 hover:bg-brand-200 text-brand-700 text-xs rounded-lg font-medium transition-colors"
        >
          <CheckCircle2 size={12} /> Complete
        </button>
      </div>
    </div>
  );
}
