import React, { useState, useMemo } from 'react';
import {
  Users, Clock, BookOpen, FileText, Plus, Search, Edit2,
  CheckCircle, XCircle, AlertTriangle, Download, Upload,
  Phone, Mail, Calendar, DollarSign, Award, ChevronDown, ChevronUp,
  RefreshCw, ExternalLink, Link2, Link2Off,
} from 'lucide-react';
import { ADP_IS_CONFIGURED } from '../../services/adpService';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/FormInput';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { StatCard } from '../ui/StatCard';
import { formatDate, clsx } from '../../utils';
import type {
  Employee, EmployeeStatus, EmploymentType, PayType,
  AttendanceRecord, AttendanceStatus,
  TrainingRecord, TrainingCategory, TrainingStatus,
} from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const HR_TOUR: TourStep[] = [
  { selector: '[data-tour="hr-adp"]',   title: 'ADP Integration',   why: 'Shows whether payroll sync with ADP Workforce Now is active — avoids duplicate data entry.',   what: 'Check the status badge. Green = connected and syncing. Grey = manual payroll exports only.' },
  { selector: '[data-tour="hr-tabs"]',   title: 'Module Tabs',       why: 'HR is split into Employee Files, Attendance, Training & Certs, and Documents for compliance.',   what: 'Click each tab to manage that HR area. Training & Certs tracks expiry dates for safety compliance.' },
  { selector: '[data-tour="hr-kiosk"]',  title: 'Employee Kiosk',    why: 'Shop floor workers clock in/out from the kiosk without accessing the full ERP.',               what: 'Click "Open Employee Kiosk" to launch the self-service terminal in a new window.' },
];

const HR_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '👤', label: 'New Employee Onboards',
    description: 'HR admin adds the employee record with personal details, role, pay type, and start date.' },
  { type: 'action', icon: '🕐', label: 'Daily Clock-In / Clock-Out',
    description: 'Employees use the HR Kiosk to clock in and out. Attendance records are created automatically.' },
  { type: 'action', icon: '📚', label: 'Training Records',
    description: 'Log completed training courses, certifications, and safety compliance records per employee.' },
  { type: 'decision', icon: '⏰', label: 'Overtime / Absence?',
    branches: [
      { label: '⏱ Overtime', color: 'amber',
        steps: [{ label: 'Attendance flagged for manager review' }, { label: 'Approve or adjust hours' }]},
      { label: '❌ Absence', color: 'red',
        steps: [{ label: 'Mark absence with reason code' }, { label: 'Notify supervisor' }]},
    ]},
  { type: 'action', icon: '💰', label: 'Payroll Export',
    description: 'Export attendance data to ADP or download CSV for payroll processing.' },
  { type: 'end', icon: '✅', label: 'Records Updated',
    description: 'Employee files, attendance history, and training records stored in Supabase.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMP_STATUS_BADGE: Record<EmployeeStatus, string> = {
  active:      'bg-green-100 text-green-700',
  inactive:    'bg-gray-100 text-gray-500',
  on_leave:    'bg-amber-100 text-amber-700',
  terminated:  'bg-red-100 text-red-700',
};

const ATT_STATUS_BADGE: Record<AttendanceStatus, string> = {
  present:  'bg-green-100 text-green-700',
  absent:   'bg-red-100 text-red-700',
  late:     'bg-amber-100 text-amber-700',
  half_day: 'bg-orange-100 text-orange-700',
  pto:      'bg-blue-100 text-blue-700',
  sick:     'bg-purple-100 text-purple-700',
  holiday:  'bg-indigo-100 text-indigo-700',
};

const TRAIN_STATUS_BADGE: Record<TrainingStatus, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  expired:     'bg-red-100 text-red-700',
  waived:      'bg-gray-100 text-gray-500',
};

type Tab = 'employees' | 'attendance' | 'training' | 'documents';

// ─── Main Component ───────────────────────────────────────────────────────────

export function HR() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<Tab>('employees');
  const [empModal, setEmpModal] = useState<{ open: boolean; emp: Employee | null }>({ open: false, emp: null });
  const [attModal, setAttModal] = useState<{ open: boolean; rec: AttendanceRecord | null }>({ open: false, rec: null });
  const [trainModal, setTrainModal] = useState<{ open: boolean; rec: TrainingRecord | null }>({ open: false, rec: null });
  const [empSearch, setEmpSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [attDateFilter, setAttDateFilter] = useState('2026-02-25');
  const [trainEmpFilter, setTrainEmpFilter] = useState('');
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  const { employees, attendanceRecords, trainingRecords } = state;

  const today = '2026-02-25';

  // KPIs
  const active = employees.filter(e => e.status === 'active').length;
  const onLeave = employees.filter(e => e.status === 'on_leave').length;
  const todayPresent = attendanceRecords.filter(a => a.date === today && (a.status === 'present' || a.status === 'late')).length;
  const expiredTraining = trainingRecords.filter(t => t.status === 'expired').length;

  const departments = [...new Set(employees.map(e => e.department))].sort();

  const filteredEmployees = useMemo(() => employees.filter(e => {
    if (deptFilter && e.department !== deptFilter) return false;
    if (!empSearch) return true;
    const q = empSearch.toLowerCase();
    return `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
      || e.position.toLowerCase().includes(q)
      || e.employeeNumber.toLowerCase().includes(q);
  }), [employees, empSearch, deptFilter]);

  const filteredAttendance = useMemo(() =>
    attendanceRecords.filter(a => a.date === attDateFilter)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [attendanceRecords, attDateFilter]);

  const filteredTraining = useMemo(() =>
    trainingRecords
      .filter(t => !trainEmpFilter || t.employeeId === trainEmpFilter)
      .sort((a, b) => {
        // Put expired first, then scheduled, then completed
        const order: Record<TrainingStatus, number> = { expired: 0, scheduled: 1, in_progress: 2, completed: 3, waived: 4 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      }),
    [trainingRecords, trainEmpFilter]);

  function getEmployeeAttToday(empId: string) {
    return attendanceRecords.find(a => a.date === today && a.employeeId === empId);
  }

  function getEmployeeTraining(empId: string) {
    return trainingRecords.filter(t => t.employeeId === empId);
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'employees',  label: 'Employee Files',     icon: <Users size={15} /> },
    { id: 'attendance', label: 'Attendance',         icon: <Clock size={15} /> },
    { id: 'training',   label: 'Training & Certs',   icon: <Award size={15} /> },
    { id: 'documents',  label: 'Documents',          icon: <FileText size={15} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">HR Terminal <WorkflowHelp title="HR Terminal Workflow" description="Employee records, attendance tracking, training, and payroll export." steps={HR_WORKFLOW} /> <GuidedTourButton steps={HR_TOUR} /></h1>
          <p className="text-gray-500 text-sm mt-0.5">Employee records, attendance, training, and compliance</p>
        </div>
        <a
          href="/hr-kiosk"
          target="_blank"
          rel="noopener noreferrer"
          data-tour="hr-kiosk"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 text-sm font-medium transition-colors"
        >
          <ExternalLink size={14} />
          Open Employee Kiosk
        </a>
      </div>

      {/* ADP Integration Status */}
      <div data-tour="hr-adp" className={clsx(
        'rounded-xl px-4 py-3 border flex items-center gap-4',
        ADP_IS_CONFIGURED
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gray-50 border-gray-200',
      )}>
        <div className={clsx(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
          ADP_IS_CONFIGURED ? 'bg-emerald-100' : 'bg-gray-100',
        )}>
          {ADP_IS_CONFIGURED ? <Link2 size={18} className="text-emerald-700" /> : <Link2Off size={18} className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">ADP Workforce Now</span>
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              ADP_IS_CONFIGURED ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
            )}>
              {ADP_IS_CONFIGURED ? 'Connected' : 'Not Configured'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {ADP_IS_CONFIGURED
              ? 'Employee data, PTO balances, and pay stubs are syncing from ADP. Timecards submitted to ADP Payroll Data Input at end of pay period.'
              : 'Set VITE_ADP_CLIENT_ID and VITE_ADP_CLIENT_SECRET in your .env to connect. ADP syncs employees, pay rates, PTO balances, and accepts timecard submissions.'}
          </p>
        </div>
        {ADP_IS_CONFIGURED ? (
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-medium transition-colors flex-shrink-0">
            <RefreshCw size={12} /> Sync Now
          </button>
        ) : (
          <a
            href="https://developers.adp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors flex-shrink-0"
          >
            <ExternalLink size={12} /> ADP Docs
          </a>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Employees" value={active} color="green" icon={<Users size={20} />} />
        <StatCard label="On Leave" value={onLeave} color="yellow" icon={<Clock size={20} />} />
        <StatCard label="Present Today" value={`${todayPresent} / ${active}`} color="blue" icon={<CheckCircle size={20} />} />
        <StatCard label="Expired Training" value={expiredTraining} color={expiredTraining > 0 ? 'red' : 'green'} icon={<Award size={20} />} />
      </div>

      {expiredTraining > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertTriangle size={16} />
          <strong>{expiredTraining} training certification{expiredTraining > 1 ? 's' : ''} expired</strong> — schedule renewals immediately to maintain compliance.
        </div>
      )}

      {/* Tabs */}
      <div data-tour="hr-tabs" className="border-b border-gray-200 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Employee Files ── */}
      {tab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Search employees…"
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <Button size="sm" onClick={() => setEmpModal({ open: true, emp: null })}>
              <Plus size={15} className="mr-1" /> New Employee
            </Button>
          </div>

          <div className="space-y-2">
            {filteredEmployees.map(emp => {
              const expanded = expandedEmp === emp.id;
              const attToday = getEmployeeAttToday(emp.id);
              const trainItems = getEmployeeTraining(emp.id);
              const expiredCerts = trainItems.filter(t => t.status === 'expired').length;
              return (
                <Card key={emp.id} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {emp.avatarInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {emp.firstName} {emp.lastName}
                            {emp.preferredName && emp.preferredName !== emp.firstName && <span className="text-gray-400 text-xs ml-1">({emp.preferredName})</span>}
                          </span>
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', EMP_STATUS_BADGE[emp.status])}>
                            {emp.status.replace('_', ' ')}
                          </span>
                          {expiredCerts > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <AlertTriangle size={10} /> {expiredCerts} cert{expiredCerts > 1 ? 's' : ''} expired
                            </span>
                          )}
                          {emp.adpAoid && (
                            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1',
                              emp.adpSyncStatus === 'synced'  ? 'bg-emerald-100 text-emerald-700' :
                              emp.adpSyncStatus === 'error'   ? 'bg-red-100 text-red-700' :
                              emp.adpSyncStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-500'
                            )}>
                              <RefreshCw size={9} /> ADP {emp.adpSyncStatus ?? 'linked'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {emp.employeeNumber} · {emp.position} · {emp.department}
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-400">
                          {emp.phone && <span className="flex items-center gap-1"><Phone size={11} />{emp.phone}</span>}
                          <span className="flex items-center gap-1"><Mail size={11} />{emp.email}</span>
                          <span className="flex items-center gap-1"><Calendar size={11} />Hired {formatDate(emp.hireDate)}</span>
                          <span className="flex items-center gap-1"><DollarSign size={11} />
                            {emp.payType === 'hourly' ? `$${emp.payRate}/hr` : `$${emp.payRate.toLocaleString()}/yr`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {attToday && (
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ATT_STATUS_BADGE[attToday.status])}>
                            {attToday.clockIn ? `In ${attToday.clockIn}` : attToday.status}
                          </span>
                        )}
                        <button onClick={() => setEmpModal({ open: true, emp })} className="text-gray-400 hover:text-brand-600 p-1 rounded">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setExpandedEmp(expanded ? null : emp.id)} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Personal Info */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Personal</div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div><strong>Employment:</strong> {emp.employmentType.replace('_', ' ')}</div>
                            <div><strong>Overtime:</strong> {emp.overtimeEligible ? 'Eligible' : 'Exempt'}</div>
                            {emp.birthDate && <div><strong>DOB:</strong> {formatDate(emp.birthDate)}</div>}
                            {emp.address && (
                              <div><strong>Address:</strong> {emp.address.street}, {emp.address.city}, {emp.address.state} {emp.address.zip}</div>
                            )}
                            {emp.emergencyContact && (
                              <div className="pt-1">
                                <strong>Emergency:</strong> {emp.emergencyContact.name} ({emp.emergencyContact.relationship}) — {emp.emergencyContact.phone}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Certifications & Skills */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Certifications & Skills</div>
                          {emp.certifications.length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs text-gray-500 mb-1">Certifications:</div>
                              <div className="flex flex-wrap gap-1">
                                {emp.certifications.map(c => (
                                  <span key={c} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {emp.skills.length > 0 && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Skills:</div>
                              <div className="flex flex-wrap gap-1">
                                {emp.skills.map(s => (
                                  <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Training Summary */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Training Records</div>
                          <div className="space-y-1">
                            {trainItems.slice(0, 4).map(t => (
                              <div key={t.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 truncate max-w-[140px]" title={t.trainingTitle}>{t.trainingTitle}</span>
                                <span className={clsx('px-1.5 py-0.5 rounded text-xs flex-shrink-0', TRAIN_STATUS_BADGE[t.status])}>
                                  {t.status}
                                </span>
                              </div>
                            ))}
                            {trainItems.length > 4 && <div className="text-xs text-gray-400">+{trainItems.length - 4} more</div>}
                            {trainItems.length === 0 && <div className="text-xs text-gray-400">No training records.</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="text-center text-gray-400 py-8">No employees found.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Attendance ── */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <input
                type="date"
                value={attDateFilter}
                onChange={e => setAttDateFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => setAttDateFilter(today)}
                className="text-xs text-brand-600 hover:underline"
              >
                Today
              </button>
            </div>
            <Button size="sm" onClick={() => setAttModal({ open: true, rec: null })}>
              <Plus size={15} className="mr-1" /> Log Attendance
            </Button>
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3">
            {(['present','late','absent','sick'] as AttendanceStatus[]).map(s => {
              const count = filteredAttendance.filter(a => a.status === s).length;
              return (
                <div key={s} className={clsx('rounded-lg px-4 py-3 text-center', ATT_STATUS_BADGE[s])}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs font-medium capitalize">{s}</div>
                </div>
              );
            })}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee','Status','Clock In','Clock Out','Break','Hours','OT Hrs','Notes','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAttendance.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{a.employeeName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ATT_STATUS_BADGE[a.status])}>
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{a.clockIn ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{a.clockOut ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.breakMinutes > 0 ? `${a.breakMinutes}m` : '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.totalHours > 0 ? `${a.totalHours.toFixed(2)}h` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.overtimeHours > 0 ? `${a.overtimeHours.toFixed(2)}h` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{a.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setAttModal({ open: true, rec: a })} className="text-gray-400 hover:text-brand-600 p-1 rounded">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAttendance.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No attendance records for this date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Training & Certs ── */}
      {tab === 'training' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <select
              value={trainEmpFilter}
              onChange={e => setTrainEmpFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
            <Button size="sm" onClick={() => setTrainModal({ open: true, rec: null })}>
              <Plus size={15} className="mr-1" /> Add Training
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee','Training','Category','Provider','Delivery','Completed','Expires','Hours','Score','Status','Cert #','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTraining.map(t => (
                    <tr key={t.id} className={clsx('hover:bg-gray-50', t.status === 'expired' && 'bg-red-50 hover:bg-red-100')}>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{t.employeeName}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 max-w-[200px]">{t.trainingTitle}</div>
                        {t.notes && <div className="text-xs text-gray-400 truncate max-w-[200px]">{t.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{t.category.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-gray-600">{t.provider ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{t.deliveryMethod.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.completedDate ? formatDate(t.completedDate) : '—'}</td>
                      <td className={clsx('px-4 py-3 whitespace-nowrap', t.expiryDate && new Date(t.expiryDate) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-700')}>
                        {t.expiryDate ? formatDate(t.expiryDate) : 'No expiry'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.durationHours ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{t.score != null ? `${t.score}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TRAIN_STATUS_BADGE[t.status])}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.certificateRef ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setTrainModal({ open: true, rec: t })} className="text-gray-400 hover:text-brand-600 p-1 rounded">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTraining.length === 0 && (
                    <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">No training records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Documents ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
                <FileText size={28} className="text-brand-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-lg">Employee Document Storage</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Store offer letters, signed acknowledgments, performance reviews, disciplinary actions, certifications, and other HR documents securely.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: <FileText size={20} />, label: 'Offer Letters & Contracts', count: 8, color: 'text-blue-600 bg-blue-100' },
              { icon: <Award size={20} />, label: 'Certificates & Licenses', count: 13, color: 'text-green-600 bg-green-100' },
              { icon: <CheckCircle size={20} />, label: 'Policy Acknowledgments', count: 16, color: 'text-purple-600 bg-purple-100' },
              { icon: <AlertTriangle size={20} />, label: 'Disciplinary Records', count: 1, color: 'text-amber-600 bg-amber-100' },
              { icon: <BookOpen size={20} />, label: 'Performance Reviews', count: 6, color: 'text-indigo-600 bg-indigo-100' },
              { icon: <Users size={20} />, label: 'Onboarding Packets', count: 8, color: 'text-teal-600 bg-teal-100' },
            ].map(item => (
              <Card key={item.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-sm text-gray-500">{item.count} document{item.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex gap-1">
                    <button className="text-gray-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-gray-100" title="Upload">
                      <Upload size={15} />
                    </button>
                    <button className="text-gray-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-gray-100" title="View">
                      <Download size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3 text-sm text-blue-800">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Document Security Note:</strong> Employee documents contain PII and must be stored securely. For production deployments, integrate with encrypted cloud storage (e.g., AWS S3 with AES-256 encryption) or an on-premise NAS with access controls. All document access should be logged. See the Data Management section in Settings for backup procedures.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modals ── */}
      {empModal.open && (
        <EmployeeModal
          emp={empModal.emp}
          onSave={(e) => {
            dispatch({ type: empModal.emp ? 'UPDATE_EMPLOYEE' : 'ADD_EMPLOYEE', payload: e });
            setEmpModal({ open: false, emp: null });
          }}
          onClose={() => setEmpModal({ open: false, emp: null })}
        />
      )}

      {attModal.open && (
        <AttendanceModal
          rec={attModal.rec}
          employees={employees}
          onSave={(a) => {
            dispatch({ type: attModal.rec ? 'UPDATE_ATTENDANCE' : 'ADD_ATTENDANCE', payload: a });
            setAttModal({ open: false, rec: null });
          }}
          onClose={() => setAttModal({ open: false, rec: null })}
        />
      )}

      {trainModal.open && (
        <TrainingModal
          rec={trainModal.rec}
          employees={employees}
          onSave={(t) => {
            dispatch({ type: trainModal.rec ? 'UPDATE_TRAINING' : 'ADD_TRAINING', payload: t });
            setTrainModal({ open: false, rec: null });
          }}
          onClose={() => setTrainModal({ open: false, rec: null })}
        />
      )}
    </div>
  );
}

// ─── Employee Modal ───────────────────────────────────────────────────────────

function EmployeeModal({ emp, onSave, onClose }: { emp: Employee | null; onSave: (e: Employee) => void; onClose: () => void }) {
  const isNew = !emp;
  const [form, setForm] = useState<Partial<Employee>>(emp ?? {
    status: 'active', employmentType: 'full_time', payType: 'hourly',
    overtimeEligible: true, certifications: [], skills: [],
  });
  const set = (k: keyof Employee, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    const now = new Date().toISOString();
    const initials = `${(form.firstName ?? 'X')[0]}${(form.lastName ?? 'X')[0]}`.toUpperCase();
    onSave({
      ...form,
      id: emp?.id ?? `emp${Date.now()}`,
      employeeNumber: emp?.employeeNumber ?? `EMP-${String(Date.now()).slice(-3)}`,
      firstName: form.firstName ?? '',
      lastName: form.lastName ?? '',
      email: form.email ?? '',
      status: form.status ?? 'active',
      employmentType: form.employmentType ?? 'full_time',
      department: form.department ?? '',
      position: form.position ?? '',
      hireDate: form.hireDate ?? now.split('T')[0],
      payType: form.payType ?? 'hourly',
      payRate: Number(form.payRate ?? 0),
      overtimeEligible: form.overtimeEligible ?? true,
      certifications: form.certifications ?? [],
      skills: form.skills ?? [],
      avatarInitials: initials,
      createdAt: emp?.createdAt ?? now,
      updatedAt: now,
    } as Employee);
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'New Employee' : 'Edit Employee'} size="xl">
      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name" value={form.firstName ?? ''} onChange={v => set('firstName', v)} />
        <Input label="Last Name" value={form.lastName ?? ''} onChange={v => set('lastName', v)} />
        <Input label="Preferred Name" value={form.preferredName ?? ''} onChange={v => set('preferredName', v)} />
        <Input label="Email" value={form.email ?? ''} onChange={v => set('email', v)} />
        <Input label="Phone" value={form.phone ?? ''} onChange={v => set('phone', v)} />
        <Input label="Hire Date" type="date" value={form.hireDate ?? ''} onChange={v => set('hireDate', v)} />
        <Input label="Department" value={form.department ?? ''} onChange={v => set('department', v)} />
        <Input label="Position / Title" value={form.position ?? ''} onChange={v => set('position', v)} />
        <Select label="Status" value={form.status ?? 'active'} onChange={v => set('status', v as EmployeeStatus)} options={[
          { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
          { value: 'on_leave', label: 'On Leave' }, { value: 'terminated', label: 'Terminated' },
        ]} />
        <Select label="Employment Type" value={form.employmentType ?? 'full_time'} onChange={v => set('employmentType', v as EmploymentType)} options={[
          { value: 'full_time', label: 'Full Time' }, { value: 'part_time', label: 'Part Time' },
          { value: 'contract', label: 'Contract' }, { value: 'seasonal', label: 'Seasonal' },
        ]} />
        <Select label="Pay Type" value={form.payType ?? 'hourly'} onChange={v => set('payType', v as PayType)} options={[
          { value: 'hourly', label: 'Hourly' }, { value: 'salary', label: 'Salary' },
        ]} />
        <Input label={form.payType === 'salary' ? 'Annual Salary ($)' : 'Hourly Rate ($/hr)'} type="number" value={String(form.payRate ?? '')} onChange={v => set('payRate', Number(v))} />
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="ot" checked={form.overtimeEligible ?? true} onChange={e => set('overtimeEligible', e.target.checked)} className="rounded" />
          <label htmlFor="ot" className="text-sm text-gray-700">Overtime Eligible (non-exempt)</label>
        </div>
        <div className="col-span-2">
          <Input label="Certifications (comma-separated)" value={(form.certifications ?? []).join(', ')} onChange={v => set('certifications', v.split(',').map(x => x.trim()).filter(Boolean))} />
        </div>
        <div className="col-span-2">
          <Input label="Skills (comma-separated)" value={(form.skills ?? []).join(', ')} onChange={v => set('skills', v.split(',').map(x => x.trim()).filter(Boolean))} />
        </div>
        <div className="col-span-2">
          <Textarea label="Notes" value={form.notes ?? ''} onChange={v => set('notes', v)} rows={2} />
        </div>
        <div className="col-span-2 pt-2 border-t border-gray-100">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">ADP Workforce Now</div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="ADP Associate OID (AOID)"
              value={form.adpAoid ?? ''}
              onChange={v => set('adpAoid', v)}
              placeholder="e.g. G3XXXXXXXXXXX"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ADP Sync Status</label>
              <select
                value={form.adpSyncStatus ?? 'not_linked'}
                onChange={e => set('adpSyncStatus', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="not_linked">Not Linked</option>
                <option value="synced">Synced</option>
                <option value="pending">Pending</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          {!form.adpAoid && (
            <p className="text-xs text-gray-400 mt-2">
              Link this employee to ADP by entering their Associate OID. Find it in ADP Workforce Now → Reports → Employee Master.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save Employee</Button>
      </div>
    </Modal>
  );
}

// ─── Attendance Modal ─────────────────────────────────────────────────────────

function AttendanceModal({ rec, employees, onSave, onClose }: {
  rec: AttendanceRecord | null;
  employees: Employee[];
  onSave: (a: AttendanceRecord) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<AttendanceRecord>>(rec ?? {
    date: '2026-02-25', status: 'present', breakMinutes: 30, totalHours: 0, overtimeHours: 0,
  });
  const set = (k: keyof AttendanceRecord, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function calcHours(clockIn?: string, clockOut?: string, breakMins?: number): { total: number; ot: number } {
    if (!clockIn || !clockOut) return { total: 0, ot: 0 };
    const [iH, iM] = clockIn.split(':').map(Number);
    const [oH, oM] = clockOut.split(':').map(Number);
    const totalMins = (oH * 60 + oM) - (iH * 60 + iM) - (breakMins ?? 0);
    const total = Math.max(0, totalMins / 60);
    const ot = Math.max(0, total - 8);
    return { total: Math.round(total * 100) / 100, ot: Math.round(ot * 100) / 100 };
  }

  function save() {
    const emp = employees.find(e => e.id === form.employeeId);
    const { total, ot } = calcHours(form.clockIn, form.clockOut, form.breakMinutes);
    const now = new Date().toISOString();
    onSave({
      ...form,
      id: rec?.id ?? `att${Date.now()}`,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : (form.employeeName ?? ''),
      date: form.date ?? '2026-02-25',
      breakMinutes: Number(form.breakMinutes ?? 30),
      totalHours: total,
      overtimeHours: ot,
      status: form.status ?? 'present',
      createdAt: rec?.createdAt ?? now,
    } as AttendanceRecord);
  }

  return (
    <Modal open={true} onClose={onClose} title={rec ? 'Edit Attendance' : 'Log Attendance'} size="md">
      <div className="space-y-4">
        {!rec && (
          <Select label="Employee" value={form.employeeId ?? ''} onChange={v => set('employeeId', v)} options={[
            { value: '', label: 'Select employee' },
            ...employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })),
          ]} />
        )}
        {rec && <div className="text-sm font-medium text-gray-700">{rec.employeeName}</div>}
        <Input label="Date" type="date" value={form.date ?? ''} onChange={v => set('date', v)} />
        <Select label="Status" value={form.status ?? 'present'} onChange={v => set('status', v as AttendanceStatus)} options={[
          { value: 'present', label: 'Present' }, { value: 'late', label: 'Late' },
          { value: 'absent', label: 'Absent' }, { value: 'half_day', label: 'Half Day' },
          { value: 'pto', label: 'PTO' }, { value: 'sick', label: 'Sick' }, { value: 'holiday', label: 'Holiday' },
        ]} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Clock In" type="time" value={form.clockIn ?? ''} onChange={v => set('clockIn', v)} />
          <Input label="Clock Out" type="time" value={form.clockOut ?? ''} onChange={v => set('clockOut', v)} />
          <Input label="Break (minutes)" type="number" value={String(form.breakMinutes ?? 30)} onChange={v => set('breakMinutes', Number(v))} />
        </div>
        <Textarea label="Notes" value={form.notes ?? ''} onChange={v => set('notes', v)} rows={2} />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}

// ─── Training Modal ───────────────────────────────────────────────────────────

function TrainingModal({ rec, employees, onSave, onClose }: {
  rec: TrainingRecord | null;
  employees: Employee[];
  onSave: (t: TrainingRecord) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<TrainingRecord>>(rec ?? {
    status: 'scheduled', passed: false, deliveryMethod: 'classroom',
  });
  const set = (k: keyof TrainingRecord, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    const emp = employees.find(e => e.id === form.employeeId);
    const now = new Date().toISOString();
    onSave({
      ...form,
      id: rec?.id ?? `tr${Date.now()}`,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : (form.employeeName ?? ''),
      trainingTitle: form.trainingTitle ?? '',
      category: form.category ?? 'technical',
      deliveryMethod: form.deliveryMethod ?? 'classroom',
      passed: form.passed ?? false,
      status: form.status ?? 'scheduled',
      createdAt: rec?.createdAt ?? now,
    } as TrainingRecord);
  }

  return (
    <Modal open={true} onClose={onClose} title={rec ? 'Edit Training Record' : 'Add Training Record'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Select label="Employee" value={form.employeeId ?? ''} onChange={v => set('employeeId', v)} options={[
          { value: '', label: 'Select employee' },
          ...employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })),
        ]} />
        <Select label="Category" value={form.category ?? 'technical'} onChange={v => set('category', v as TrainingCategory)} options={[
          { value: 'safety', label: 'Safety' }, { value: 'equipment', label: 'Equipment' },
          { value: 'quality', label: 'Quality' }, { value: 'hr_compliance', label: 'HR Compliance' },
          { value: 'technical', label: 'Technical' }, { value: 'leadership', label: 'Leadership' }, { value: 'other', label: 'Other' },
        ]} />
        <div className="col-span-2">
          <Input label="Training Title" value={form.trainingTitle ?? ''} onChange={v => set('trainingTitle', v)} />
        </div>
        <Input label="Provider / Instructor" value={form.provider ?? ''} onChange={v => set('provider', v)} />
        <Select label="Delivery Method" value={form.deliveryMethod ?? 'classroom'} onChange={v => set('deliveryMethod', v as TrainingRecord['deliveryMethod'])} options={[
          { value: 'classroom', label: 'Classroom' }, { value: 'online', label: 'Online' },
          { value: 'on_the_job', label: 'On-the-Job' }, { value: 'external', label: 'External Course' },
        ]} />
        <Input label="Scheduled Date" type="date" value={form.scheduledDate ?? ''} onChange={v => set('scheduledDate', v)} />
        <Input label="Completed Date" type="date" value={form.completedDate ?? ''} onChange={v => set('completedDate', v)} />
        <Input label="Expiry Date" type="date" value={form.expiryDate ?? ''} onChange={v => set('expiryDate', v)} />
        <Input label="Duration (hours)" type="number" value={String(form.durationHours ?? '')} onChange={v => set('durationHours', Number(v))} />
        <Input label="Score (%)" type="number" value={String(form.score ?? '')} onChange={v => set('score', Number(v))} />
        <Select label="Status" value={form.status ?? 'scheduled'} onChange={v => set('status', v as TrainingStatus)} options={[
          { value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' }, { value: 'expired', label: 'Expired' }, { value: 'waived', label: 'Waived' },
        ]} />
        <Input label="Certificate Reference #" value={form.certificateRef ?? ''} onChange={v => set('certificateRef', v)} />
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="passed" checked={form.passed ?? false} onChange={e => set('passed', e.target.checked)} className="rounded" />
          <label htmlFor="passed" className="text-sm text-gray-700">Passed</label>
        </div>
        <div className="col-span-2">
          <Textarea label="Notes" value={form.notes ?? ''} onChange={v => set('notes', v)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save Training</Button>
      </div>
    </Modal>
  );
}
