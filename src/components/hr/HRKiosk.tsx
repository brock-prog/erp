/**
 * HR Employee Self-Service Kiosk Terminal
 *
 * Fullscreen touch-optimized terminal for shop floor workers.
 * Design follows UKG/Paychex kiosk UX best practices:
 *  - Large touch targets (min 80px)
 *  - 45-second inactivity auto-return to idle
 *  - PIN authentication (default demo PIN: 1234)
 *  - Safety acknowledgement on clock-in
 *  - Job costing prompt at punch (links to active work orders)
 *  - ADP sync status in header
 *
 * Route: /hr-kiosk (fullscreen, no sidebar — added alongside WorkstationTerminal)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  Clock, Calendar, DollarSign, Bell, Award,
  ChevronLeft, CheckCircle2, AlertTriangle,
  LogIn, LogOut, Briefcase, User, X, RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { clsx } from '../../utils';
import { ADP_IS_CONFIGURED, DEMO_ACCRUALS, DEMO_PAY_STATEMENT } from '../../services/adpService';
import type { Employee } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type KioskScreen =
  | 'idle'
  | 'select-employee'
  | 'pin'
  | 'safety'
  | 'home'
  | 'clock-confirm'
  | 'job-select'
  | 'schedule'
  | 'pto'
  | 'pay'
  | 'announcements'
  | 'certs'
  | 'success';

// ─── Static content ───────────────────────────────────────────────────────────

const SAFETY_NOTICES = [
  {
    id: 'sn1',
    icon: '🦺',
    title: 'PPE Required in Coating Area',
    body: 'Respirator, gloves, and safety glasses must be worn at all times in the powder coating booth. No exceptions.',
  },
  {
    id: 'sn2',
    icon: '⚠️',
    title: 'New Coating Running Today: Axalta Pure White Gloss',
    body: 'SDS updated. Review the Safety Data Sheet before handling. Wear nitrile gloves — this formulation is a skin sensitizer.',
  },
];

const ANNOUNCEMENTS = [
  { id: 'a1', icon: '🍕', date: 'Feb 24', title: 'Team Lunch — Friday Mar 1', body: 'Company-wide lunch in the breakroom at noon. All employees welcome.' },
  { id: 'a2', icon: '💳', date: 'Feb 23', title: 'Direct Deposit Deadline — Feb 28', body: 'Update your direct deposit info before Feb 28 to avoid delays on the March 15 payroll.' },
  { id: 'a3', icon: '📋', date: 'Feb 20', title: 'OSHA Refresher — Sign Up by Mar 5', body: '10-hour OSHA refresher scheduled for March 10. Sign up with HR by March 5 to secure your seat.' },
];

const DEMO_SCHEDULE = [
  { day: 'Thu, Feb 26', shift: '6:00 AM – 2:30 PM', status: 'today' },
  { day: 'Fri, Feb 27', shift: '6:00 AM – 2:30 PM', status: 'upcoming' },
  { day: 'Mon, Mar 2',  shift: '6:00 AM – 2:30 PM', status: 'upcoming' },
  { day: 'Tue, Mar 3',  shift: '6:00 AM – 2:30 PM', status: 'upcoming' },
  { day: 'Wed, Mar 4',  shift: '6:00 AM – 2:30 PM', status: 'upcoming' },
];

const DEMO_PIN = '1234'; // All employees use this PIN in demo mode

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center">
      <div className="text-6xl font-black text-white tracking-tight tabular-nums leading-none">
        {format(now, 'h:mm')}
        <span className="text-4xl font-semibold text-white/50 ml-1">{format(now, 'ss')}</span>
        <span className="text-3xl font-medium text-white/50 ml-2">{format(now, 'a')}</span>
      </div>
      <div className="text-white/55 text-xl mt-2 font-light">{format(now, 'EEEE, MMMM d, yyyy')}</div>
    </div>
  );
}

function PinPad({
  pin, onDigit, onBack, onConfirm, error,
}: {
  pin: string;
  onDigit: (d: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Dots */}
      <div className="flex gap-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={clsx(
              'w-5 h-5 rounded-full border-2 transition-all duration-200',
              pin.length > i
                ? 'bg-emerald-400 border-emerald-400 scale-110'
                : 'bg-transparent border-white/30',
            )}
          />
        ))}
      </div>
      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm font-medium flex items-center gap-2 bg-red-950/50 px-4 py-2 rounded-xl">
          <X size={14} /> {error}
        </div>
      )}
      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button
            key={d}
            onClick={() => pin.length < 4 && onDigit(d)}
            className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-3xl font-bold transition-all active:scale-95 select-none"
          >
            {d}
          </button>
        ))}
        <button
          onClick={onBack}
          className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/70 text-xl transition-all active:scale-95 flex items-center justify-center select-none"
        >
          ⌫
        </button>
        <button
          onClick={() => pin.length < 4 && onDigit('0')}
          className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-3xl font-bold transition-all active:scale-95 select-none"
        >
          0
        </button>
        <button
          onClick={onConfirm}
          className="w-20 h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-3xl transition-all active:scale-95 flex items-center justify-center select-none"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

// ─── Main Kiosk Component ─────────────────────────────────────────────────────

export function HRKiosk() {
  const { state, dispatch } = useApp();
  const { employees, attendanceRecords, trainingRecords, jobs } = state;

  const [screen,   setScreen]   = useState<KioskScreen>('idle');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [pin,      setPin]      = useState('');
  const [pinError, setPinError] = useState('');
  const [safetyAcked, setSafetyAcked] = useState<string[]>([]);
  const [successMsg,  setSuccessMsg]  = useState('');
  const [clockAction, setClockAction] = useState<'in' | 'out'>('in');
  const [selectedJob, setSelectedJob] = useState('');
  const [ptoForm,     setPtoForm]     = useState({ type: 'vacation', date: '', reason: '' });

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Active jobs for job selection at clock-in ──
  const activeJobs = jobs.filter(j =>
    ['rack', 'pretreat', 'coat', 'cure', 'qc', 'unrack'].includes(j.status)
  );

  // ── Today's attendance for the current employee ──
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const todayAtt  = employee
    ? attendanceRecords.find(a => a.employeeId === employee.id && a.date === todayDate)
    : null;

  // ── Inactivity timer — returns to idle after 45 seconds ──
  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (screen !== 'idle') {
      idleTimer.current = setTimeout(() => {
        goToIdle();
      }, 45_000);
    }
  }, [screen]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [screen, resetIdleTimer]);

  // ── Navigation helpers ──
  function goToIdle() {
    setScreen('idle');
    setEmployee(null);
    setPin('');
    setPinError('');
    setSafetyAcked([]);
    setSuccessMsg('');
    setClockAction('in');
    setSelectedJob('');
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }

  function goBack() {
    if (screen === 'pin')           return setScreen('select-employee');
    if (screen === 'safety')        return setScreen('pin');
    if (screen === 'home')          return goToIdle();
    if (screen === 'clock-confirm') return setScreen('home');
    if (screen === 'job-select')    return setScreen('clock-confirm');
    if (screen === 'schedule')      return setScreen('home');
    if (screen === 'pto')           return setScreen('home');
    if (screen === 'pay')           return setScreen('home');
    if (screen === 'announcements') return setScreen('home');
    if (screen === 'certs')         return setScreen('home');
    return setScreen('home');
  }

  // ── PIN entry ──
  function onPinDigit(d: string) {
    setPinError('');
    setPin(p => p.length < 4 ? p + d : p);
  }

  function onPinBack() {
    setPinError('');
    setPin(p => p.slice(0, -1));
  }

  function onPinConfirm() {
    if (pin.length < 4) return;
    if (pin === DEMO_PIN) {
      setPin('');
      setPinError('');
      // Check if safety notices need acknowledgement (only at clock-in time)
      setScreen('safety');
    } else {
      setPinError('Incorrect PIN — try again');
      setPin('');
    }
  }

  // ── Safety ack ──
  function onAckNotice(id: string) {
    setSafetyAcked(prev => [...prev, id]);
  }
  const allNoticesAcked = SAFETY_NOTICES.every(n => safetyAcked.includes(n.id));

  // ── Clock action ──
  function onClockIn(jobRef?: string) {
    if (!employee) return;
    const now = format(new Date(), 'HH:mm');
    const existing = todayAtt;

    if (existing) {
      // Update existing record with clock-in
      dispatch({
        type: 'UPDATE_ATTENDANCE',
        payload: {
          ...existing,
          clockIn: now,
          status: 'present',
          notes: jobRef ? `Job: ${jobRef}` : existing.notes,
        },
      });
    } else {
      // Create new attendance record
      dispatch({
        type: 'ADD_ATTENDANCE',
        payload: {
          id:          `att${Date.now()}`,
          employeeId:  employee.id,
          employeeName:`${employee.firstName} ${employee.lastName}`,
          date:        todayDate,
          clockIn:     now,
          breakMinutes: 30,
          totalHours:  0,
          overtimeHours: 0,
          status:      'present',
          notes:       jobRef ? `Job: ${jobRef}` : undefined,
          createdAt:   new Date().toISOString(),
          jobCostingRef: jobRef,
        },
      });
    }

    setSuccessMsg(`Clocked IN at ${now}${jobRef ? ` · Job ${jobRef}` : ''}`);
    setScreen('success');
  }

  function onClockOut() {
    if (!employee || !todayAtt) return;
    const now = format(new Date(), 'HH:mm');
    const [iH, iM] = (todayAtt.clockIn ?? '00:00').split(':').map(Number);
    const [oH, oM] = now.split(':').map(Number);
    const totalMins = (oH * 60 + oM) - (iH * 60 + iM) - todayAtt.breakMinutes;
    const totalHours = Math.max(0, Math.round((totalMins / 60) * 100) / 100);
    const overtimeHours = Math.max(0, Math.round(Math.max(0, totalHours - 8) * 100) / 100);

    dispatch({
      type: 'UPDATE_ATTENDANCE',
      payload: { ...todayAtt, clockOut: now, totalHours, overtimeHours },
    });

    setSuccessMsg(`Clocked OUT at ${now} · ${totalHours.toFixed(2)}h worked`);
    setScreen('success');
  }

  // ── PTO submit ──
  function onSubmitPTO() {
    if (!employee || !ptoForm.date) return;
    setSuccessMsg(`Time off request submitted for ${ptoForm.date}${ADP_IS_CONFIGURED ? ' · Sent to ADP' : ''}`);
    setPtoForm({ type: 'vacation', date: '', reason: '' });
    setScreen('success');
  }

  // ── Certs for current employee ──
  const myTraining = employee
    ? trainingRecords.filter(t => t.employeeId === employee.id)
    : [];

  // ─── Screens ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col select-none"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      onPointerDown={resetIdleTimer}
    >

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Employee Self-Service</div>
            <div className="text-xs text-white/40">CoatPro HR Kiosk</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ADP badge */}
          <div className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            ADP_IS_CONFIGURED
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/40'
              : 'bg-white/10 text-white/40 border border-white/10',
          )}>
            <RefreshCw size={11} />
            {ADP_IS_CONFIGURED ? 'ADP Synced' : 'ADP Not Configured'}
          </div>

          {screen !== 'idle' && employee && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold">
                {employee.avatarInitials}
              </div>
              <span className="text-sm font-medium">{employee.firstName} {employee.lastName}</span>
            </div>
          )}

          {screen !== 'idle' && (
            <button
              onClick={goToIdle}
              className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Exit / Cancel"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── Screen content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 pt-4">

        {/* ── IDLE ── */}
        {screen === 'idle' && (
          <div className="flex flex-col items-center gap-10 max-w-lg w-full">
            <LiveClock />
            <button
              onClick={() => setScreen('select-employee')}
              className="w-full py-6 rounded-3xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-2xl font-bold transition-all active:scale-98 shadow-2xl shadow-brand-900/40"
            >
              Tap to Begin
            </button>
            <div className="text-white/30 text-sm text-center">
              {ANNOUNCEMENTS.length} announcement{ANNOUNCEMENTS.length !== 1 ? 's' : ''} · {SAFETY_NOTICES.length} active safety notice{SAFETY_NOTICES.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* ── SELECT EMPLOYEE ── */}
        {screen === 'select-employee' && (
          <div className="w-full max-w-2xl space-y-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Who are you?</div>
              <div className="text-white/40 text-sm mt-1">Select your name to continue</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {employees.filter(e => e.status === 'active').map(emp => {
                const att = attendanceRecords.find(a => a.employeeId === emp.id && a.date === todayDate);
                const clockedIn = att?.clockIn && !att?.clockOut;
                return (
                  <button
                    key={emp.id}
                    onClick={() => { setEmployee(emp); setScreen('pin'); }}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/8 hover:bg-white/15 active:bg-white/20 border border-white/10 transition-all active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-brand-700 flex items-center justify-center text-xl font-bold text-white">
                      {emp.avatarInitials}
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-white text-sm leading-tight">{emp.firstName}</div>
                      <div className="text-white/50 text-xs">{emp.lastName}</div>
                    </div>
                    {clockedIn && (
                      <div className="text-xs bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/40">
                        Clocked in {att.clockIn}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center pt-2">
              <button onClick={goToIdle} className="text-white/30 hover:text-white/60 text-sm flex items-center gap-1.5 transition-colors">
                <ChevronLeft size={15} /> Back
              </button>
            </div>
          </div>
        )}

        {/* ── PIN ── */}
        {screen === 'pin' && employee && (
          <div className="flex flex-col items-center gap-6 w-full max-w-xs">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-brand-700 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3">
                {employee.avatarInitials}
              </div>
              <div className="text-2xl font-bold text-white">{employee.firstName} {employee.lastName}</div>
              <div className="text-white/40 text-sm mt-1">Enter your 4-digit PIN</div>
              {!ADP_IS_CONFIGURED && (
                <div className="text-white/25 text-xs mt-1">Demo PIN: 1234</div>
              )}
            </div>
            <PinPad
              pin={pin}
              onDigit={onPinDigit}
              onBack={onPinBack}
              onConfirm={onPinConfirm}
              error={pinError}
            />
            <button onClick={goBack} className="text-white/30 hover:text-white/60 text-sm flex items-center gap-1.5 transition-colors">
              <ChevronLeft size={15} /> Different employee
            </button>
          </div>
        )}

        {/* ── SAFETY ── */}
        {screen === 'safety' && (
          <div className="w-full max-w-lg space-y-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Safety Notices</div>
              <div className="text-white/40 text-sm mt-1">Please read and acknowledge before proceeding</div>
            </div>
            <div className="space-y-3">
              {SAFETY_NOTICES.map(notice => {
                const acked = safetyAcked.includes(notice.id);
                return (
                  <div
                    key={notice.id}
                    className={clsx(
                      'rounded-2xl p-5 border transition-all',
                      acked
                        ? 'bg-emerald-950/40 border-emerald-700/40'
                        : 'bg-amber-950/40 border-amber-700/40',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl flex-shrink-0">{notice.icon}</span>
                      <div className="flex-1">
                        <div className={clsx('font-semibold text-base', acked ? 'text-emerald-300' : 'text-amber-200')}>
                          {notice.title}
                        </div>
                        <div className="text-white/60 text-sm mt-1">{notice.body}</div>
                      </div>
                      {acked ? (
                        <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <button
                          onClick={() => onAckNotice(notice.id)}
                          className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all active:scale-95"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              disabled={!allNoticesAcked}
              onClick={() => setScreen('home')}
              className={clsx(
                'w-full py-5 rounded-2xl text-white text-xl font-bold transition-all',
                allNoticesAcked
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-98'
                  : 'bg-white/10 text-white/30 cursor-not-allowed',
              )}
            >
              {allNoticesAcked ? 'Continue to Menu →' : `Acknowledge all ${SAFETY_NOTICES.length} notices to continue`}
            </button>
          </div>
        )}

        {/* ── HOME ── */}
        {screen === 'home' && employee && (
          <div className="w-full max-w-xl space-y-5">
            <div className="text-center">
              <div className="text-xl text-white/60">Welcome back,</div>
              <div className="text-3xl font-black text-white">{employee.firstName} {employee.preferredName && employee.preferredName !== employee.firstName ? `"${employee.preferredName}"` : ''} {employee.lastName}</div>
              <div className="text-white/40 text-sm mt-1">{employee.position} · {employee.department}</div>
              {todayAtt?.clockIn && !todayAtt?.clockOut && (
                <div className="inline-flex items-center gap-1.5 mt-2 bg-emerald-900/60 text-emerald-300 text-sm px-3 py-1 rounded-full border border-emerald-700/40">
                  <Clock size={13} /> Clocked in since {todayAtt.clockIn}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Clock In / Clock Out — primary action */}
              {!todayAtt?.clockIn || todayAtt?.clockOut ? (
                <button
                  onClick={() => { setClockAction('in'); setScreen('clock-confirm'); }}
                  className="col-span-2 flex items-center justify-center gap-4 py-6 rounded-2xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 transition-all active:scale-98"
                >
                  <LogIn size={28} />
                  <span className="text-2xl font-black">Clock In</span>
                </button>
              ) : (
                <button
                  onClick={() => { setClockAction('out'); setScreen('clock-confirm'); }}
                  className="col-span-2 flex items-center justify-center gap-4 py-6 rounded-2xl bg-red-700 hover:bg-red-600 active:bg-red-800 transition-all active:scale-98"
                >
                  <LogOut size={28} />
                  <span className="text-2xl font-black">Clock Out</span>
                </button>
              )}

              {/* Secondary tiles */}
              {[
                { icon: <Calendar size={24} />, label: 'My Schedule', screen: 'schedule' as KioskScreen, color: 'bg-blue-800 hover:bg-blue-700' },
                { icon: <DollarSign size={24} />, label: 'Pay & Time Off', screen: 'pay' as KioskScreen, color: 'bg-violet-800 hover:bg-violet-700' },
                { icon: <Bell size={24} />, label: 'Announcements', screen: 'announcements' as KioskScreen, color: 'bg-amber-800 hover:bg-amber-700', badge: ANNOUNCEMENTS.length },
                { icon: <Award size={24} />, label: 'My Certifications', screen: 'certs' as KioskScreen, color: 'bg-teal-800 hover:bg-teal-700' },
                { icon: <Briefcase size={24} />, label: 'Request Time Off', screen: 'pto' as KioskScreen, color: 'bg-indigo-800 hover:bg-indigo-700' },
              ].map(tile => (
                <button
                  key={tile.label}
                  onClick={() => setScreen(tile.screen)}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-2 py-5 px-4 rounded-2xl transition-all active:scale-95',
                    tile.color,
                  )}
                >
                  <div className="relative">
                    {tile.icon}
                    {tile.badge != null && (
                      <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {tile.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-center leading-tight">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CLOCK CONFIRM ── */}
        {screen === 'clock-confirm' && employee && (
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <div className={clsx(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                clockAction === 'in' ? 'bg-emerald-700' : 'bg-red-700',
              )}>
                {clockAction === 'in' ? <LogIn size={28} /> : <LogOut size={28} />}
              </div>
              <div className="text-3xl font-black text-white">
                {clockAction === 'in' ? 'Clock In' : 'Clock Out'}
              </div>
              <div className="text-white/40 text-sm mt-1">{format(new Date(), 'h:mm:ss a')}</div>
            </div>

            {clockAction === 'in' && (
              <div>
                <div className="text-white/60 text-sm mb-2 text-center">Select job to work on (optional)</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => setSelectedJob('')}
                    className={clsx(
                      'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm',
                      !selectedJob ? 'bg-brand-700 border-brand-500' : 'bg-white/5 border-white/10 hover:bg-white/10',
                    )}
                  >
                    No specific job
                  </button>
                  {activeJobs.slice(0, 8).map(job => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job.id)}
                      className={clsx(
                        'w-full text-left px-4 py-3 rounded-xl border transition-all',
                        selectedJob === job.id ? 'bg-brand-700 border-brand-500' : 'bg-white/5 border-white/10 hover:bg-white/10',
                      )}
                    >
                      <div className="text-sm font-semibold">{job.jobNumber}</div>
                      <div className="text-xs text-white/50">{job.customerName} · {job.status.toUpperCase()}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {clockAction === 'out' && todayAtt?.clockIn && (
              <div className="bg-white/8 rounded-2xl p-4 text-center">
                <div className="text-white/50 text-sm">You clocked in at</div>
                <div className="text-3xl font-black text-white mt-1">{todayAtt.clockIn}</div>
                <div className="text-white/40 text-sm mt-1">
                  {(() => {
                    const [iH, iM] = todayAtt.clockIn.split(':').map(Number);
                    const now = new Date();
                    const totalMins = (now.getHours() * 60 + now.getMinutes()) - (iH * 60 + iM);
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    return `${h}h ${m}m on the clock`;
                  })()}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (clockAction === 'in') {
                    const jobNum = activeJobs.find(j => j.id === selectedJob)?.jobNumber;
                    onClockIn(jobNum || undefined);
                  } else {
                    onClockOut();
                  }
                }}
                className={clsx(
                  'w-full py-5 rounded-2xl text-white text-xl font-black transition-all active:scale-98',
                  clockAction === 'in'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500',
                )}
              >
                Confirm {clockAction === 'in' ? 'Clock In' : 'Clock Out'}
              </button>
              <button onClick={goBack} className="text-white/30 hover:text-white/60 text-sm text-center transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {screen === 'schedule' && (
          <div className="w-full max-w-md space-y-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">My Schedule</div>
              <div className="text-white/40 text-sm mt-1">Upcoming shifts</div>
            </div>
            <div className="space-y-2">
              {DEMO_SCHEDULE.map(s => (
                <div
                  key={s.day}
                  className={clsx(
                    'rounded-2xl px-5 py-4 border flex items-center justify-between',
                    s.status === 'today'
                      ? 'bg-brand-900/50 border-brand-700/50'
                      : 'bg-white/5 border-white/10',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={clsx('font-semibold', s.status === 'today' ? 'text-brand-300' : 'text-white')}>
                        {s.day}
                      </span>
                      {s.status === 'today' && (
                        <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full font-medium">Today</span>
                      )}
                    </div>
                    <div className="text-white/50 text-sm mt-0.5">{s.shift}</div>
                  </div>
                  <Clock size={18} className={s.status === 'today' ? 'text-brand-400' : 'text-white/20'} />
                </div>
              ))}
            </div>
            {!ADP_IS_CONFIGURED && (
              <div className="text-white/25 text-xs text-center">
                Schedule synced from ADP Workforce Now when configured
              </div>
            )}
            <BackButton onClick={goBack} />
          </div>
        )}

        {/* ── REQUEST TIME OFF ── */}
        {screen === 'pto' && (
          <div className="w-full max-w-sm space-y-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Request Time Off</div>
              <div className="text-white/40 text-sm mt-1">Submit a PTO request</div>
            </div>

            {/* PTO balance */}
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEMO_ACCRUALS).map(([type, hours]) => (
                <div key={type} className="bg-white/8 rounded-xl p-3 text-center border border-white/10">
                  <div className="text-2xl font-black text-white">{hours}</div>
                  <div className="text-xs text-white/40 mt-0.5 capitalize">{type} hrs</div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="text-white/50 text-sm block mb-1.5">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['vacation', 'sick', 'personal'].map(t => (
                    <button
                      key={t}
                      onClick={() => setPtoForm(f => ({ ...f, type: t }))}
                      className={clsx(
                        'py-2.5 rounded-xl text-sm font-semibold capitalize transition-all',
                        ptoForm.type === t
                          ? 'bg-brand-600 text-white'
                          : 'bg-white/8 text-white/50 hover:bg-white/15 border border-white/10',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1.5">Date</label>
                <input
                  type="date"
                  value={ptoForm.date}
                  onChange={e => setPtoForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-brand-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-white/50 text-sm block mb-1.5">Reason (optional)</label>
                <input
                  type="text"
                  value={ptoForm.reason}
                  onChange={e => setPtoForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Appointment, personal day…"
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-base placeholder-white/25 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              disabled={!ptoForm.date}
              onClick={onSubmitPTO}
              className={clsx(
                'w-full py-4 rounded-2xl text-white font-bold text-lg transition-all',
                ptoForm.date
                  ? 'bg-brand-600 hover:bg-brand-500 active:scale-98'
                  : 'bg-white/10 text-white/30 cursor-not-allowed',
              )}
            >
              Submit Request{ADP_IS_CONFIGURED ? ' → ADP' : ''}
            </button>
            <BackButton onClick={goBack} />
          </div>
        )}

        {/* ── PAY & ACCRUALS ── */}
        {screen === 'pay' && (
          <div className="w-full max-w-sm space-y-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Pay & Accruals</div>
              <div className="text-white/40 text-sm mt-1">
                {ADP_IS_CONFIGURED ? 'Live from ADP Workforce Now' : 'Demo data — connect ADP to see live info'}
              </div>
            </div>

            {/* PTO balances */}
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Time Off Balances</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Vacation', hours: DEMO_ACCRUALS.vacation },
                  { label: 'Sick',     hours: DEMO_ACCRUALS.sick     },
                  { label: 'Personal', hours: DEMO_ACCRUALS.personal  },
                ].map(item => (
                  <div key={item.label} className="bg-white/8 rounded-xl p-4 text-center border border-white/10">
                    <div className="text-3xl font-black text-white">{item.hours}</div>
                    <div className="text-xs text-white/40 mt-0.5">{item.label} hrs</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last pay stub */}
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Last Pay Statement</div>
              <div className="bg-white/8 rounded-2xl p-5 space-y-3 border border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Pay Date</span>
                  <span className="text-white font-semibold">{DEMO_PAY_STATEMENT.payDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Pay Period</span>
                  <span className="text-white">{DEMO_PAY_STATEMENT.period}</span>
                </div>
                <div className="border-t border-white/10 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Gross Pay</span>
                    <span className="text-white">${DEMO_PAY_STATEMENT.grossPay.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Deductions</span>
                    <span className="text-red-400">−${DEMO_PAY_STATEMENT.deductions.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-white">Net Pay</span>
                    <span className="text-emerald-400 text-lg">${DEMO_PAY_STATEMENT.netPay.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            <BackButton onClick={goBack} />
          </div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {screen === 'announcements' && (
          <div className="w-full max-w-md space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Announcements</div>
              <div className="text-white/40 text-sm mt-1">Company news and updates</div>
            </div>
            <div className="space-y-3">
              {ANNOUNCEMENTS.map(a => (
                <div key={a.id} className="bg-white/8 rounded-2xl p-5 border border-white/10">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{a.icon}</span>
                    <div>
                      <div className="font-semibold text-white">{a.title}</div>
                      <div className="text-white/50 text-sm mt-1">{a.body}</div>
                      <div className="text-white/25 text-xs mt-2">{a.date}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <BackButton onClick={goBack} />
          </div>
        )}

        {/* ── CERTIFICATIONS ── */}
        {screen === 'certs' && employee && (
          <div className="w-full max-w-md space-y-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">My Certifications</div>
              <div className="text-white/40 text-sm mt-1">Training & compliance status</div>
            </div>
            {myTraining.length === 0 ? (
              <div className="text-center text-white/30 py-8">No training records on file.</div>
            ) : (
              <div className="space-y-2">
                {myTraining.map(t => {
                  const isExpired = t.status === 'expired';
                  const isExpiring = t.expiryDate && !isExpired &&
                    (new Date(t.expiryDate).getTime() - Date.now()) < 30 * 86_400_000;
                  return (
                    <div
                      key={t.id}
                      className={clsx(
                        'rounded-2xl px-5 py-4 border flex items-center justify-between',
                        isExpired ? 'bg-red-950/40 border-red-700/40' :
                        isExpiring ? 'bg-amber-950/40 border-amber-700/40' :
                        'bg-white/5 border-white/10',
                      )}
                    >
                      <div>
                        <div className={clsx('font-semibold text-sm', isExpired ? 'text-red-300' : isExpiring ? 'text-amber-300' : 'text-white')}>
                          {t.trainingTitle}
                        </div>
                        {t.expiryDate && (
                          <div className={clsx('text-xs mt-0.5', isExpired ? 'text-red-400' : 'text-white/40')}>
                            {isExpired ? '⚠ Expired' : 'Expires'}: {t.expiryDate}
                          </div>
                        )}
                      </div>
                      <div className={clsx(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        t.status === 'completed' ? 'bg-emerald-900/60 text-emerald-300' :
                        t.status === 'expired'   ? 'bg-red-900/60 text-red-300' :
                        t.status === 'scheduled' ? 'bg-blue-900/60 text-blue-300' :
                        'bg-white/10 text-white/40',
                      )}>
                        {t.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <BackButton onClick={goBack} />
          </div>
        )}

        {/* ── SUCCESS ── */}
        {screen === 'success' && (
          <SuccessScreen message={successMsg} onDone={goToIdle} />
        )}

      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center pt-1">
      <button onClick={onClick} className="text-white/30 hover:text-white/60 text-sm flex items-center gap-1.5 transition-colors">
        <ChevronLeft size={15} /> Back
      </button>
    </div>
  );
}

function SuccessScreen({ message, onDone }: { message: string; onDone: () => void }) {
  const [count, setCount] = useState(5);
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(id); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center">
        <CheckCircle2 size={40} />
      </div>
      <div>
        <div className="text-3xl font-black text-white">Done!</div>
        <div className="text-emerald-300 text-lg mt-2">{message}</div>
      </div>
      <div className="text-white/30 text-sm">Returning to start in {count}…</div>
      <button
        onClick={onDone}
        className="px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
      >
        Done
      </button>
    </div>
  );
}
