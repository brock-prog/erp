import React, { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, BarChart3, Plus, X,
  CheckCircle, XCircle, AlertCircle, ClipboardList, TrendingUp,
  Thermometer, Droplets, Award, Wrench, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { StatCard } from '../ui/StatCard';
import { formatDate, formatCurrency, generateId, clsx } from '../../utils';
import type {
  QCInspection, NCR, NCRStatus, NCRSeverity, DefectType, InspectionResult,
  OvenCureLog, ChemicalBathLog, CertificateOfConformance,
  ComplianceStandard, ChemicalBathType,
} from '../../types';
import { COMPLIANCE_STANDARD_LABELS, BATH_TYPE_LABELS } from '../../types';
import { PhotoCapture } from '../ui/PhotoCapture';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
const QUALITY_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🔍', label: 'Job Reaches QC Stage',
    description: 'After curing, the job status advances to QC. An inspector is assigned.' },
  { type: 'action', icon: '📋', label: 'Log Inspection',
    description: 'Click "New Inspection" — select the job, inspector, and inspection criteria.' },
  { type: 'action', icon: '📸', label: 'Capture Photos & Notes',
    description: 'Photograph any defects, surface anomalies, or critical surface areas. Add detailed notes.' },
  { type: 'decision', icon: '✅', label: 'Inspection Result?',
    branches: [
      { label: '✓ Pass', color: 'green',
        steps: [{ label: 'Job advances to Shipping' }, { label: 'QC certificate generated' }]},
      { label: '⚠ Conditional', color: 'amber',
        steps: [{ label: 'Minor issues noted, proceed with approval' }, { label: 'Customer notified of condition' }]},
      { label: '✗ Fail', color: 'red',
        steps: [{ label: 'Create NCR (Non-Conformance Report)' }, { label: 'Job sent back for rework' }]},
    ]},
  { type: 'action', icon: '📄', label: 'Manage NCRs',
    description: 'Track non-conformance reports through Open → Under Review → Resolved workflow.' },
  { type: 'end', icon: '🏆', label: 'Quality Record Archived',
    description: 'All inspection records and NCRs are stored for traceability and compliance.' },
];

const DEFECT_LABELS: Record<DefectType, string> = {
  runs: 'Runs', sags: 'Sags', fish_eyes: 'Fish Eyes', orange_peel: 'Orange Peel',
  contamination: 'Contamination', improper_coverage: 'Improper Coverage',
  adhesion_failure: 'Adhesion Failure', color_mismatch: 'Color Mismatch',
  mil_out_of_spec: 'Mil Out of Spec', bleed_through: 'Bleed Through',
  fading: 'Fading', ghosting: 'Ghosting', substrate_damage: 'Substrate Damage', other: 'Other',
};

const NCR_STATUS_LABELS: Record<NCRStatus, string> = {
  open: 'Open', under_investigation: 'Investigating',
  corrective_action: 'Corrective Action', verification: 'Verification', closed: 'Closed',
};

const NCR_STATUS_COLORS: Record<NCRStatus, string> = {
  open: 'bg-red-100 text-red-800',
  under_investigation: 'bg-orange-100 text-orange-800',
  corrective_action: 'bg-yellow-100 text-yellow-800',
  verification: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
};

const NCR_SEVERITY_COLORS: Record<NCRSeverity, string> = {
  minor: 'bg-yellow-100 text-yellow-800',
  major: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const RESULT_ICON = {
  pass: <CheckCircle size={14} className="text-green-500" />,
  fail: <XCircle size={14} className="text-red-500" />,
  conditional: <AlertCircle size={14} className="text-yellow-500" />,
};

const NCR_FLOW: NCRStatus[] = ['open', 'under_investigation', 'corrective_action', 'verification', 'closed'];

export function Quality() {
  const { state, dispatch } = useApp();
  const { qcInspections, ncrs, jobs, equipment, batches, ovenCureLogs, chemicalBathLogs, certificates } = state;
  const [tab, setTab] = useState<'inspections' | 'ncr' | 'analytics' | 'cure_logs' | 'bath_logs' | 'certificates'>('inspections');
  const [showInspModal, setShowInspModal] = useState(false);
  const [showNCRModal, setShowNCRModal] = useState(false);
  const [editNCR, setEditNCR] = useState<NCR | null>(null);
  const [showCureLogModal, setShowCureLogModal] = useState(false);
  const [showBathLogModal, setShowBathLogModal] = useState(false);
  const [showCocModal, setShowCocModal] = useState(false);

  const totalInsp = qcInspections.length;
  const passed = qcInspections.filter(q => q.result === 'pass').length;
  const failed = qcInspections.filter(q => q.result === 'fail').length;
  const rework = qcInspections.filter(q => q.reworkRequired).length;
  const passRate = totalInsp > 0 ? Math.round((passed / totalInsp) * 100) : 0;
  const firstPassYield = totalInsp > 0 ? Math.round(((totalInsp - rework) / totalInsp) * 100) : 0;
  const openNCRs = ncrs.filter(n => n.status !== 'closed').length;
  const criticalNCRs = ncrs.filter(n => n.severity === 'critical' && n.status !== 'closed').length;

  const awaitingQC = jobs.filter(j => j.status === 'qc' && !j.qcPassed);

  const allDefects = qcInspections.flatMap(q => q.defects);
  const defectsByType: Record<string, number> = {};
  allDefects.forEach(d => { defectsByType[d.type] = (defectsByType[d.type] ?? 0) + 1; });
  const defectChartData = Object.entries(defectsByType)
    .map(([type, count]) => ({ type: DEFECT_LABELS[type as DefectType] ?? type, count }))
    .sort((a, b) => b.count - a.count).slice(0, 8);

  const resultDist = [
    { name: 'Pass', value: passed, color: '#10b981' },
    { name: 'Fail', value: failed, color: '#ef4444' },
    { name: 'Conditional', value: qcInspections.filter(q => q.result === 'conditional').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const ncrBySeverity = [
    { name: 'Minor', value: ncrs.filter(n => n.severity === 'minor').length, color: '#f59e0b' },
    { name: 'Major', value: ncrs.filter(n => n.severity === 'major').length, color: '#f97316' },
    { name: 'Critical', value: ncrs.filter(n => n.severity === 'critical').length, color: '#ef4444' },
  ];

  const TABS = [
    { key: 'inspections' as const, label: 'Inspections', icon: <ShieldCheck size={14} /> },
    { key: 'ncr' as const, label: 'NCRs', icon: <ClipboardList size={14} /> },
    { key: 'analytics' as const, label: 'Analytics', icon: <BarChart3 size={14} /> },
    { key: 'cure_logs' as const, label: 'Cure Logs', icon: <Thermometer size={14} /> },
    { key: 'bath_logs' as const, label: 'Bath Logs', icon: <Droplets size={14} /> },
    { key: 'certificates' as const, label: 'Certificates', icon: <Award size={14} /> },
  ];

  function advanceNCR(ncr: NCR) {
    const idx = NCR_FLOW.indexOf(ncr.status);
    if (idx < NCR_FLOW.length - 1)
      dispatch({ type: 'UPDATE_NCR', payload: { ...ncr, status: NCR_FLOW[idx + 1], updatedAt: new Date().toISOString() } });
  }

  function handleSaveNCR(ncr: NCR) {
    if (editNCR) dispatch({ type: 'UPDATE_NCR', payload: ncr });
    else dispatch({ type: 'ADD_NCR', payload: ncr });
    setShowNCRModal(false); setEditNCR(null);
  }

  function handleSaveInspection(insp: QCInspection) {
    dispatch({ type: 'ADD_QC', payload: insp });
    const job = jobs.find(j => j.id === insp.jobId);
    if (job) dispatch({ type: 'UPDATE_JOB', payload: { ...job, qcPassed: insp.result === 'pass', qcNotes: insp.notes } });
    setShowInspModal(false);
  }

  const QUALITY_TOUR: TourStep[] = [
    { selector: '[data-tour="qc-stats"]', title: 'QC Stats',
      why: 'Pass rate, first-pass yield, and open NCR counts tell you if quality is on track or slipping.',
      what: 'Red numbers mean quality issues need attention. Click "New Inspection" in the alert bar to start.' },
    { selector: '[data-tour="qc-tabs"]', title: 'Quality Tabs',
      why: 'Inspections, NCRs, cure logs, bath logs, and certificates each have their own tab.',
      what: 'Inspections = QC checks. NCR = non-conformance reports. Cure/Bath Logs = process compliance data. Certificates = CoCs.' },
    { selector: '[data-tour="qc-actions"]', title: 'Quick Actions',
      why: 'Each tab has its own "New" button — log inspections, NCRs, cure data, bath readings, or issue CoCs.',
      what: 'The button label changes by tab. Click it to open the relevant form.' },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Quality Control</h1>
        <WorkflowHelp title="Quality Control Workflow" description="Inspection process from QC stage through pass/fail and NCR management." steps={QUALITY_WORKFLOW} />
        <GuidedTourButton steps={QUALITY_TOUR} />
      </div>
      <div data-tour="qc-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pass Rate" value={`${passRate}%`} change={passRate - 90} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="First Pass Yield" value={`${firstPassYield}%`} icon={<TrendingUp size={18} />} color="blue" />
        <StatCard label="Open NCRs" value={openNCRs} icon={<ClipboardList size={18} />} color={openNCRs > 0 ? 'red' : 'green'} />
        <StatCard label="Critical NCRs" value={criticalNCRs} icon={<AlertTriangle size={18} />} color={criticalNCRs > 0 ? 'red' : 'green'} />
      </div>

      {awaitingQC.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            <span className="font-semibold">{awaitingQC.length} job{awaitingQC.length > 1 ? 's' : ''} awaiting inspection:</span>{' '}
            {awaitingQC.map(j => j.jobNumber).join(', ')}
          </span>
          <Button size="sm" variant="secondary" className="ml-auto flex-shrink-0" onClick={() => setShowInspModal(true)}>New Inspection</Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div data-tour="qc-tabs" className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <div data-tour="qc-actions" className="flex gap-2">
          {tab === 'inspections' && <Button icon={<Plus size={15} />} onClick={() => setShowInspModal(true)}>New Inspection</Button>}
          {tab === 'ncr' && <Button icon={<Plus size={15} />} onClick={() => { setEditNCR(null); setShowNCRModal(true); }}>New NCR</Button>}
          {tab === 'cure_logs' && <Button icon={<Plus size={15} />} onClick={() => setShowCureLogModal(true)}>Log Cure</Button>}
          {tab === 'bath_logs' && <Button icon={<Plus size={15} />} onClick={() => setShowBathLogModal(true)}>Log Bath</Button>}
          {tab === 'certificates' && <Button icon={<Plus size={15} />} onClick={() => setShowCocModal(true)}>Issue CoC</Button>}
        </div>
      </div>

      {tab === 'inspections' && (
        <Card padding={false}>
          <div className="p-5 pb-2">
            <CardHeader title="QC Inspection Log" subtitle={`${totalInsp} total · ${passed} passed · ${rework} rework · ${failed} failed`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Job #', 'Customer', 'Line / Equipment', 'Date', 'Inspector', 'Result', 'Mil (act/spec)', 'Adhesion', 'Gloss', 'Defects', 'Rework', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...qcInspections].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(insp => {
                  const job = jobs.find(j => j.id === insp.jobId);
                  const lineId = job?.powderSpec?.ovenId ?? job?.sublimationSpec?.heatPressId;
                  const lineName = equipment.find(e => e.id === lineId)?.name ?? '—';
                  return (
                    <tr key={insp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{insp.jobNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-800 max-w-[120px] truncate">{insp.customerName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{lineName}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(insp.inspectionDate)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{insp.inspectorName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {RESULT_ICON[insp.result]}
                          <span className={clsx('text-xs font-semibold', insp.result === 'pass' ? 'text-green-700' : insp.result === 'fail' ? 'text-red-700' : 'text-yellow-700')}>
                            {insp.result.charAt(0).toUpperCase() + insp.result.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {insp.milThickness != null
                          ? <span className={insp.milSpec && Math.abs(insp.milThickness - insp.milSpec) > 0.5 ? 'text-orange-600 font-semibold' : 'text-gray-700'}>{insp.milThickness} / {insp.milSpec ?? '—'}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {insp.adhesionTest ? (insp.adhesionTest === 'pass' ? <span className="text-green-600">Pass</span> : <span className="text-red-600">Fail</span>) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{insp.gloss ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-center">
                        {insp.defects.length > 0
                          ? <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">{insp.defects.length}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {insp.reworkRequired ? <span className="text-orange-600 font-semibold">Yes</span> : <span className="text-gray-400">No</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{insp.notes ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {qcInspections.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">No inspections recorded</div>}
          </div>
        </Card>
      )}

      {tab === 'ncr' && (
        <div className="space-y-4">
          {criticalNCRs > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-800 font-semibold">{criticalNCRs} critical NCR{criticalNCRs > 1 ? 's' : ''} require immediate attention.</span>
            </div>
          )}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['NCR #', 'Title', 'Severity', 'Job', 'Customer', 'Line', 'Raised', 'Parts', 'Cost Impact', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...ncrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(ncr => (
                    <tr key={ncr.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setEditNCR(ncr); setShowNCRModal(true); }}>
                      <td className="px-4 py-3 font-mono text-xs text-brand-700">{ncr.ncrNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-800 max-w-[200px] truncate">{ncr.title}</td>
                      <td className="px-4 py-3"><Badge className={NCR_SEVERITY_COLORS[ncr.severity]}>{ncr.severity}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{ncr.jobNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate">{ncr.customerName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[130px] truncate">{ncr.lineName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(ncr.dateRaised)}</td>
                      <td className="px-4 py-3 text-xs text-center text-gray-700">{ncr.partsAffected}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{ncr.costImpact ? formatCurrency(ncr.costImpact) : '—'}</td>
                      <td className="px-4 py-3"><Badge className={NCR_STATUS_COLORS[ncr.status]}>{NCR_STATUS_LABELS[ncr.status]}</Badge></td>
                      <td className="px-4 py-3">
                        {ncr.status !== 'closed' && (
                          <button onClick={e => { e.stopPropagation(); advanceNCR(ncr); }} className="text-xs text-brand-600 hover:underline whitespace-nowrap">Advance →</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ncrs.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">No NCRs on record</div>}
            </div>
          </Card>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader title="Inspection Results" />
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={resultDist} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {resultDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardHeader title="NCRs by Severity" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ncrBySeverity} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="NCRs" radius={[4, 4, 0, 0]}>
                    {ncrBySeverity.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <CardHeader title="Quality Summary" />
              <div className="space-y-3">
                {[
                  { label: 'Total Inspections', value: String(totalInsp) },
                  { label: 'Pass Rate', value: `${passRate}%` },
                  { label: 'First Pass Yield', value: `${firstPassYield}%` },
                  { label: 'Rework Required', value: String(rework) },
                  { label: 'Total Defects Found', value: String(allDefects.length) },
                  { label: 'Open NCRs', value: String(openNCRs) },
                  { label: 'NCR Cost Impact', value: formatCurrency(ncrs.reduce((s, n) => s + (n.costImpact ?? 0), 0)) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-semibold text-gray-800">{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {defectChartData.length > 0 && (
            <Card padding={false}>
              <div className="p-5 pb-2">
                <CardHeader title="Defect Pareto" subtitle="Top defect types across all inspections" />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={defectChartData} margin={{ left: 10, right: 16, top: 5, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ── Cure Logs ─────────────────────────────────────────────────────── */}
      {tab === 'cure_logs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Logged" value={ovenCureLogs.length} icon={<Thermometer size={18} />} color="blue" />
            <StatCard label="Passed Cure Window" value={ovenCureLogs.filter(l => l.curvePassed === true).length} icon={<CheckCircle size={18} />} color="green" />
            <StatCard label="Failed / Out-of-Spec" value={ovenCureLogs.filter(l => l.curvePassed === false).length} icon={<XCircle size={18} />} color="red" />
          </div>
          <Card padding={false}>
            <div className="p-5 pb-2">
              <CardHeader title="Oven Cure Log" subtitle="Peak metal temperature & time-at-temperature records per batch" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Batch #', 'Oven', 'Date', 'Target Temp / Time', 'Peak Metal Temp', 'Time @ Temp', 'Result', 'Logger', 'Operator', 'Notes'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...ovenCureLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{log.batchNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{log.ovenName}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(log.startTime.slice(0, 10))}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{log.targetTempF}°F / {log.targetDurationMin} min</td>
                      <td className="px-4 py-3 text-xs font-semibold">
                        {log.peakMetalTempF != null
                          ? <span className={log.peakMetalTempF < log.targetTempF - 10 ? 'text-red-600' : 'text-gray-800'}>{log.peakMetalTempF}°F</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.timeAtMinTempMin != null ? `${log.timeAtMinTempMin} min` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.curvePassed == null
                          ? <Badge className="bg-gray-100 text-gray-600">Pending</Badge>
                          : log.curvePassed
                            ? <Badge className="bg-green-100 text-green-800">Pass</Badge>
                            : <Badge className="bg-red-100 text-red-800">Fail</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.loggerModel ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.operatorName}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{log.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ovenCureLogs.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Thermometer size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No cure logs recorded yet.</p>
                  <p className="text-xs mt-1 text-gray-300">Log oven cure profiles per batch for AAMA / Qualicoat compliance traceability.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Chemical Bath Logs ─────────────────────────────────────────────── */}
      {tab === 'bath_logs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Entries" value={chemicalBathLogs.length} icon={<Droplets size={18} />} color="blue" />
            <StatCard label="Pass" value={chemicalBathLogs.filter(l => l.overallPass).length} icon={<CheckCircle size={18} />} color="green" />
            <StatCard label="Out of Spec" value={chemicalBathLogs.filter(l => !l.overallPass).length} icon={<AlertTriangle size={18} />} color="red" />
          </div>
          <Card padding={false}>
            <div className="p-5 pb-2">
              <CardHeader title="Pretreatment Bath Log" subtitle="Daily chemistry records — pH, conductivity, concentration per shift" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Date', 'Shift', 'Bath', 'Type', 'pH', 'Conductivity (µS/cm)', 'Temp (°F)', 'Conc. (%)', 'Replenishment', 'Result', 'Operator', 'Notes'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...chemicalBathLogs].sort((a, b) => b.logDate.localeCompare(a.logDate)).map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{formatDate(log.logDate)}</td>
                      <td className="px-4 py-3 text-xs capitalize text-gray-600">{log.shift}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-800">{log.bathName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{BATH_TYPE_LABELS[log.bathType]}</td>
                      <td className="px-4 py-3 text-xs">
                        {log.pH != null
                          ? <span className={log.pH < 3 || log.pH > 12 ? 'text-orange-600 font-semibold' : 'text-gray-700'}>{log.pH.toFixed(1)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {log.conductivityUScm != null
                          ? <span className={log.bathType === 'rinse' && log.conductivityUScm > 30 ? 'text-red-600 font-semibold' : 'text-gray-700'}>{log.conductivityUScm}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{log.temperatureF ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{log.concentrationPct != null ? `${log.concentrationPct}%` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{log.replenishmentAdded ?? '—'}</td>
                      <td className="px-4 py-3">
                        {log.overallPass
                          ? <Badge className="bg-green-100 text-green-800">Pass</Badge>
                          : <Badge className="bg-red-100 text-red-800">Fail</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.operatorName}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[140px] truncate">{log.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {chemicalBathLogs.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Droplets size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No bath logs recorded yet.</p>
                  <p className="text-xs mt-1 text-gray-300">Record daily pH, conductivity and concentration checks for each pretreatment stage.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Certificates of Conformance ────────────────────────────────────── */}
      {tab === 'certificates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Issued" value={certificates.length} icon={<Award size={18} />} color="blue" />
            <StatCard label="This Month" value={certificates.filter(c => c.issuedDate.startsWith(new Date().toISOString().slice(0, 7))).length} icon={<FileText size={18} />} color="green" />
            <StatCard label="With Failures" value={certificates.filter(c => c.adhesionResult === 'fail' || c.curvePassed === false).length} icon={<AlertTriangle size={18} />} color="red" />
          </div>
          <Card padding={false}>
            <div className="p-5 pb-2">
              <CardHeader title="Certificate of Conformance Register" subtitle="CoC documents issued to customers as proof of specification compliance" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['CoC #', 'Job #', 'Customer', 'Date', 'Finish Specification', 'Standards', 'Color', 'Powder Lot', 'DFT (µm)', 'Gloss', 'Adhesion', 'Cure', 'Issued By'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...certificates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(coc => (
                    <tr key={coc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{coc.cocNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{coc.jobNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-800 max-w-[120px] truncate">{coc.customerName}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(coc.issuedDate)}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-[160px] truncate">{coc.finishSpecification}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {(coc.complianceStandards ?? []).map(s => (
                            <span key={s} className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {COMPLIANCE_STANDARD_LABELS[s]?.split(' – ')[0] ?? s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-[100px] truncate">{coc.colorName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{coc.powderLotNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {coc.dftMeanUm != null
                          ? <span className="text-gray-700">{coc.dftMeanUm} <span className="text-gray-400">({coc.dftMinUm ?? '?'}–{coc.dftMaxUm ?? '?'})</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{coc.glossMean ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {coc.adhesionResult
                          ? coc.adhesionResult === 'pass'
                            ? <span className="text-green-600 font-semibold">Pass</span>
                            : <span className="text-red-600 font-semibold">Fail</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {coc.curvePassed != null
                          ? coc.curvePassed
                            ? <span className="text-green-600 font-semibold">✓</span>
                            : <span className="text-red-600 font-semibold">✗</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{coc.issuedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {certificates.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Award size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No certificates issued yet.</p>
                  <p className="text-xs mt-1 text-gray-300">Issue a Certificate of Conformance from a passed QC inspection — customers require this for AAMA / Qualicoat / GSB jobs.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {showInspModal && (
        <InspectionModal jobs={jobs} equipment={equipment} onSave={handleSaveInspection} onClose={() => setShowInspModal(false)} />
      )}
      {showNCRModal && (
        <NCRModal ncr={editNCR} jobs={jobs} equipment={equipment} onSave={handleSaveNCR} onClose={() => { setShowNCRModal(false); setEditNCR(null); }} />
      )}
      {showCureLogModal && (
        <CureLogModal
          batches={batches}
          equipment={equipment}
          onSave={log => { dispatch({ type: 'ADD_OVEN_CURE_LOG', payload: log }); setShowCureLogModal(false); }}
          onClose={() => setShowCureLogModal(false)}
        />
      )}
      {showBathLogModal && (
        <BathLogModal
          onSave={log => { dispatch({ type: 'ADD_CHEMICAL_BATH_LOG', payload: log }); setShowBathLogModal(false); }}
          onClose={() => setShowBathLogModal(false)}
        />
      )}
      {showCocModal && (
        <CocModal
          jobs={jobs}
          qcInspections={qcInspections}
          ovenCureLogs={ovenCureLogs}
          existingCount={certificates.length}
          onSave={coc => { dispatch({ type: 'ADD_CERTIFICATE', payload: coc }); setShowCocModal(false); }}
          onClose={() => setShowCocModal(false)}
        />
      )}
    </div>
  );
}

function InspectionModal({ jobs, equipment, onSave, onClose }: {
  jobs: ReturnType<typeof useApp>['state']['jobs'];
  equipment: ReturnType<typeof useApp>['state']['equipment'];
  onSave: (i: QCInspection) => void;
  onClose: () => void;
}) {
  const qcJobs = jobs.filter(j => j.serviceType !== 'other');
  const [jobId, setJobId] = useState(qcJobs[0]?.id ?? '');
  const [result, setResult] = useState<InspectionResult>('pass');
  const [adhesionTest, setAdhesionTest] = useState<'pass' | 'fail'>('pass');
  const [milThickness, setMilThickness] = useState('');
  const [gloss, setGloss] = useState('');
  const [reworkRequired, setReworkRequired] = useState(false);
  const [reworkNotes, setReworkNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [defects, setDefects] = useState<{ type: DefectType; severity: 'minor' | 'major' | 'critical'; location: string; description: string }[]>([]);
  const [newDefect, setNewDefect] = useState({ type: 'orange_peel' as DefectType, severity: 'minor' as 'minor' | 'major' | 'critical', location: '', description: '' });
  const [photos, setPhotos] = useState<string[]>([]);

  const selectedJob = qcJobs.find(j => j.id === jobId);
  const isPowder = selectedJob?.serviceType === 'powder_coating' || selectedJob?.serviceType === 'both';

  function addDefect() {
    if (!newDefect.location) return;
    setDefects(d => [...d, { ...newDefect }]);
    setNewDefect({ type: 'orange_peel', severity: 'minor', location: '', description: '' });
  }

  function handleSave() {
    if (!selectedJob) return;
    const now = new Date().toISOString();
    onSave({
      id: generateId(),
      jobId: selectedJob.id, jobNumber: selectedJob.jobNumber,
      customerId: selectedJob.customerId, customerName: selectedJob.customerName,
      serviceType: selectedJob.serviceType as QCInspection['serviceType'],
      inspectorId: 'u6', inspectorName: 'Drew Williams',
      inspectionDate: now.slice(0, 10),
      result,
      adhesionTest: isPowder ? adhesionTest : undefined,
      milThickness: milThickness ? Number(milThickness) : undefined,
      milSpec: selectedJob.powderSpec?.mil,
      gloss: gloss ? Number(gloss) : undefined,
      visualInspection: defects.length === 0 ? 'pass' : 'fail',
      defects: defects.map(d => ({ ...d, id: generateId(), resolved: false })),
      reworkRequired, reworkNotes: reworkNotes || undefined,
      notes: notes || undefined, photos, createdAt: now,
    });
  }

  return (
    <Modal open={true} onClose={onClose} title="New QC Inspection" size="xl"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>Record Inspection</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Job" value={jobId} onChange={e => setJobId(e.target.value)} className="col-span-2">
          {qcJobs.map(j => <option key={j.id} value={j.id}>{j.jobNumber} — {j.customerName}</option>)}
        </Select>
        <Select label="Overall Result" value={result} onChange={e => setResult(e.target.value as InspectionResult)}>
          <option value="pass">Pass</option><option value="fail">Fail</option><option value="conditional">Conditional</option>
        </Select>
        {isPowder && (
          <>
            <Select label="Adhesion Test" value={adhesionTest} onChange={e => setAdhesionTest(e.target.value as 'pass' | 'fail')}>
              <option value="pass">Pass</option><option value="fail">Fail</option>
            </Select>
            <Input label="Mil Thickness (actual)" type="number" step="0.1" value={milThickness} onChange={e => setMilThickness(e.target.value)} placeholder={`Spec: ${selectedJob?.powderSpec?.mil ?? '—'}`} />
            <Input label="Gloss Reading" type="number" step="1" value={gloss} onChange={e => setGloss(e.target.value)} />
          </>
        )}
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="rework" checked={reworkRequired} onChange={e => setReworkRequired(e.target.checked)} className="rounded" />
          <label htmlFor="rework" className="text-sm text-gray-700">Rework Required</label>
        </div>
        {reworkRequired && <Textarea label="Rework Notes" value={reworkNotes} onChange={e => setReworkNotes(e.target.value)} rows={2} className="col-span-2" />}
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="col-span-2" />
      </div>
      <div className="mt-4">
        <PhotoCapture photos={photos} onChange={setPhotos} label="Inspection Photos" compact />
      </div>
      <div className="mt-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">Defects Found</div>
        {defects.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs mb-1.5 bg-red-50 rounded-lg px-3 py-2">
            <Badge className="bg-orange-100 text-orange-800">{d.severity}</Badge>
            <span className="font-medium">{DEFECT_LABELS[d.type]}</span>
            <span className="text-gray-500">@ {d.location}</span>
            <button onClick={() => setDefects(ds => ds.filter((_, j) => j !== i))} className="ml-auto text-red-400"><X size={12} /></button>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Select label="Type" value={newDefect.type} onChange={e => setNewDefect(d => ({ ...d, type: e.target.value as DefectType }))}>
            {Object.entries(DEFECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Severity" value={newDefect.severity} onChange={e => setNewDefect(d => ({ ...d, severity: e.target.value as 'minor' | 'major' | 'critical' }))}>
            <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
          </Select>
          <Input label="Location" value={newDefect.location} onChange={e => setNewDefect(d => ({ ...d, location: e.target.value }))} placeholder="e.g. top edge" />
          <Button variant="secondary" onClick={addDefect} className="self-end">Add</Button>
        </div>
      </div>
    </Modal>
  );
}

function NCRModal({ ncr, jobs, equipment, onSave, onClose }: {
  ncr: NCR | null;
  jobs: ReturnType<typeof useApp>['state']['jobs'];
  equipment: ReturnType<typeof useApp>['state']['equipment'];
  onSave: (n: NCR) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<NCR>>(ncr ?? {
    status: 'open', severity: 'major', partsAffected: 1, photos: [],
    dateRaised: new Date().toISOString().slice(0, 10),
    raisedById: 'u6', raisedByName: 'Drew Williams',
  });

  function set(k: keyof NCR, v: unknown) { setForm(f => ({ ...f, [k]: v })); }

  function handleSave() {
    const now = new Date().toISOString();
    const job = jobs.find(j => j.id === form.jobId);
    const line = equipment.find(e => e.id === form.lineId);
    onSave({
      id: ncr?.id ?? generateId(),
      ncrNumber: ncr?.ncrNumber ?? `NCR-2026-${String(Date.now()).slice(-4)}`,
      title: form.title ?? '', description: form.description ?? '',
      status: form.status ?? 'open', severity: form.severity ?? 'major',
      jobId: form.jobId, jobNumber: job?.jobNumber,
      customerId: job?.customerId, customerName: job?.customerName,
      lineId: form.lineId, lineName: line?.name,
      dateRaised: form.dateRaised ?? now.slice(0, 10),
      raisedById: form.raisedById ?? 'u6', raisedByName: form.raisedByName ?? 'Drew Williams',
      assignedToId: form.assignedToId, assignedToName: form.assignedToName,
      dueDate: form.dueDate,
      partsAffected: Number(form.partsAffected) || 0,
      costImpact: form.costImpact ? Number(form.costImpact) : undefined,
      rootCause: form.rootCause, correctiveAction: form.correctiveAction,
      preventiveAction: form.preventiveAction,
      closedDate: form.closedDate, closedByName: form.closedByName,
      photos: form.photos ?? [],
      createdAt: ncr?.createdAt ?? now, updatedAt: now,
    });
  }

  return (
    <Modal open={true} onClose={onClose} title={ncr ? `NCR: ${ncr.ncrNumber}` : 'New Non-Conformance Report'} size="xl"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>{ncr ? 'Save Changes' : 'Create NCR'}</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Title" value={form.title ?? ''} onChange={e => set('title', e.target.value)} className="col-span-2" />
        <Textarea label="Description" value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2} className="col-span-2" />
        <Select label="Severity" value={form.severity ?? 'major'} onChange={e => set('severity', e.target.value)}>
          <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
        </Select>
        <Select label="Status" value={form.status ?? 'open'} onChange={e => set('status', e.target.value)}>
          {Object.entries(NCR_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select label="Job" value={form.jobId ?? ''} onChange={e => set('jobId', e.target.value)}>
          <option value="">— Not linked —</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.jobNumber} — {j.customerName}</option>)}
        </Select>
        <Select label="Production Line" value={form.lineId ?? ''} onChange={e => set('lineId', e.target.value)}>
          <option value="">— Not linked —</option>
          {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <Input label="Parts Affected" type="number" min="1" value={String(form.partsAffected ?? '')} onChange={e => set('partsAffected', e.target.value)} />
        <Input label="Cost Impact ($)" type="number" min="0" value={String(form.costImpact ?? '')} onChange={e => set('costImpact', e.target.value)} />
        <Input label="Date Raised" type="date" value={form.dateRaised ?? ''} onChange={e => set('dateRaised', e.target.value)} />
        <Input label="Due Date" type="date" value={form.dueDate ?? ''} onChange={e => set('dueDate', e.target.value)} />
        <Textarea label="Root Cause" value={form.rootCause ?? ''} onChange={e => set('rootCause', e.target.value)} rows={2} className="col-span-2" />
        <Textarea label="Corrective Action" value={form.correctiveAction ?? ''} onChange={e => set('correctiveAction', e.target.value)} rows={2} className="col-span-2" />
        <Textarea label="Preventive Action" value={form.preventiveAction ?? ''} onChange={e => set('preventiveAction', e.target.value)} rows={2} className="col-span-2" />
        {form.status === 'closed' && (
          <>
            <Input label="Closed Date" type="date" value={form.closedDate ?? ''} onChange={e => set('closedDate', e.target.value)} />
            <Input label="Closed By" value={form.closedByName ?? ''} onChange={e => set('closedByName', e.target.value)} />
          </>
        )}
      </div>
      <div className="mt-4">
        <PhotoCapture
          photos={form.photos ?? []}
          onChange={v => set('photos', v)}
          label="NCR Photos"
          compact
        />
      </div>
    </Modal>
  );
}

// ─── Cure Log Modal ───────────────────────────────────────────────────────────

function CureLogModal({ batches, equipment, onSave, onClose }: {
  batches: ReturnType<typeof useApp>['state']['batches'];
  equipment: ReturnType<typeof useApp>['state']['equipment'];
  onSave: (log: OvenCureLog) => void;
  onClose: () => void;
}) {
  const ovens = equipment.filter(e => e.type === 'oven');
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');
  const [ovenId, setOvenId] = useState(ovens[0]?.id ?? '');
  const [targetTempF, setTargetTempF] = useState('390');
  const [targetDurationMin, setTargetDurationMin] = useState('20');
  const [peakMetalTempF, setPeakMetalTempF] = useState('');
  const [timeAtMinTempMin, setTimeAtMinTempMin] = useState('');
  const [curvePassed, setCurvePassed] = useState<'yes' | 'no' | 'pending'>('pending');
  const [loggerModel, setLoggerModel] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));

  function handleSave() {
    const batch = batches.find(b => b.id === batchId);
    const oven = ovens.find(o => o.id === ovenId);
    const now = new Date().toISOString();
    onSave({
      id: generateId(),
      batchId: batchId || 'none',
      batchNumber: batch?.batchNumber ?? 'N/A',
      ovenId: ovenId || 'none',
      ovenName: oven?.name ?? 'Unknown Oven',
      startTime: startTime ? new Date(startTime).toISOString() : now,
      targetTempF: Number(targetTempF) || 390,
      targetDurationMin: Number(targetDurationMin) || 20,
      readings: [],
      peakMetalTempF: peakMetalTempF ? Number(peakMetalTempF) : undefined,
      timeAtMinTempMin: timeAtMinTempMin ? Number(timeAtMinTempMin) : undefined,
      curvePassed: curvePassed === 'yes' ? true : curvePassed === 'no' ? false : undefined,
      loggerModel: loggerModel || undefined,
      operatorId: 'u1',
      operatorName: 'Production Operator',
      notes: notes || undefined,
      createdAt: now,
    });
  }

  return (
    <Modal open={true} onClose={onClose} title="Log Oven Cure" size="lg"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>Save Cure Log</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Batch" value={batchId} onChange={e => setBatchId(e.target.value)} className="col-span-2">
          <option value="">— No linked batch —</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} — {b.colorName}</option>)}
        </Select>
        <Select label="Oven" value={ovenId} onChange={e => setOvenId(e.target.value)}>
          <option value="">— Select oven —</option>
          {ovens.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
        <Input label="Cure Start Time" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <Input label="Target Temp (°F)" type="number" value={targetTempF} onChange={e => setTargetTempF(e.target.value)} />
        <Input label="Target Duration (min)" type="number" value={targetDurationMin} onChange={e => setTargetDurationMin(e.target.value)} />
        <Input label="Peak Metal Temp Achieved (°F)" type="number" value={peakMetalTempF} onChange={e => setPeakMetalTempF(e.target.value)} placeholder="From data logger" />
        <Input label="Time at Cure Temp (min)" type="number" value={timeAtMinTempMin} onChange={e => setTimeAtMinTempMin(e.target.value)} placeholder="Minutes above min. temp" />
        <Select label="Cure Window Result" value={curvePassed} onChange={e => setCurvePassed(e.target.value as 'yes' | 'no' | 'pending')}>
          <option value="pending">Pending / Not Yet Assessed</option>
          <option value="yes">Pass — within cure window</option>
          <option value="no">Fail — outside cure window</option>
        </Select>
        <Input label="Logger Model" value={loggerModel} onChange={e => setLoggerModel(e.target.value)} placeholder="e.g. Datapaq Oven Tracker" />
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="col-span-2" />
      </div>
      <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
        <strong>Industry note:</strong> Per AAMA 2604/2605, Qualicoat, and GSB standards, the cure profile (peak metal temperature and time-at-temperature) must be documented for every production batch. A data logger attached to the heaviest and lightest cross-section parts is recommended.
      </div>
    </Modal>
  );
}

// ─── Bath Log Modal ───────────────────────────────────────────────────────────

function BathLogModal({ onSave, onClose }: {
  onSave: (log: ChemicalBathLog) => void;
  onClose: () => void;
}) {
  const [bathName, setBathName] = useState('');
  const [bathType, setBathType] = useState<ChemicalBathType>('iron_phosphate');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<'day' | 'afternoon' | 'night'>('day');
  const [pH, setPH] = useState('');
  const [conductivity, setConductivity] = useState('');
  const [temperature, setTemperature] = useState('');
  const [concentration, setConcentration] = useState('');
  const [replenishment, setReplenishment] = useState('');
  const [overallPass, setOverallPass] = useState(true);
  const [notes, setNotes] = useState('');

  function handleSave() {
    const now = new Date().toISOString();
    onSave({
      id: generateId(),
      bathName: bathName || BATH_TYPE_LABELS[bathType],
      bathType,
      logDate,
      shift,
      pH: pH ? Number(pH) : undefined,
      conductivityUScm: conductivity ? Number(conductivity) : undefined,
      temperatureF: temperature ? Number(temperature) : undefined,
      concentrationPct: concentration ? Number(concentration) : undefined,
      replenishmentAdded: replenishment || undefined,
      overallPass,
      operatorId: 'u1',
      operatorName: 'Production Operator',
      notes: notes || undefined,
      createdAt: now,
    });
  }

  const conductivityWarn = bathType === 'rinse' && conductivity && Number(conductivity) > 30;

  return (
    <Modal open={true} onClose={onClose} title="Log Pretreatment Bath" size="lg"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>Save Bath Log</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Bath Type" value={bathType} onChange={e => { setBathType(e.target.value as ChemicalBathType); setBathName(''); }}>
          {(Object.entries(BATH_TYPE_LABELS) as [ChemicalBathType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Input label="Bath Name / Stage" value={bathName} onChange={e => setBathName(e.target.value)} placeholder={`e.g. Stage 2 – ${BATH_TYPE_LABELS[bathType]}`} />
        <Input label="Log Date" type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
        <Select label="Shift" value={shift} onChange={e => setShift(e.target.value as 'day' | 'afternoon' | 'night')}>
          <option value="day">Day</option>
          <option value="afternoon">Afternoon</option>
          <option value="night">Night</option>
        </Select>
        <Input label="pH" type="number" step="0.1" min="0" max="14" value={pH} onChange={e => setPH(e.target.value)} placeholder="e.g. 5.2" />
        <div>
          <Input label="Conductivity (µS/cm)" type="number" step="1" value={conductivity} onChange={e => setConductivity(e.target.value)} placeholder="Final rinse target < 30" />
          {conductivityWarn && <p className="text-xs text-red-600 mt-1">⚠ Final rinse conductivity exceeds 30 µS/cm — risk of coating contamination.</p>}
        </div>
        <Input label="Bath Temperature (°F)" type="number" value={temperature} onChange={e => setTemperature(e.target.value)} />
        <Input label="Concentration (%)" type="number" step="0.1" value={concentration} onChange={e => setConcentration(e.target.value)} placeholder="Titration result" />
        <Textarea label="Replenishment Added" value={replenishment} onChange={e => setReplenishment(e.target.value)} rows={1} className="col-span-2" placeholder="e.g. 2 L Bonderite LC-S, 0.5 L accelerator" />
        <div className="col-span-2 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Overall Result:</span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" checked={overallPass} onChange={() => setOverallPass(true)} className="accent-green-600" />
            <span className="text-green-700 font-medium">Pass</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" checked={!overallPass} onChange={() => setOverallPass(false)} className="accent-red-600" />
            <span className="text-red-700 font-medium">Fail / Out of Spec</span>
          </label>
        </div>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="col-span-2" />
      </div>
      <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
        <strong>Industry note:</strong> Record bath chemistry at least once per shift. Final rinse conductivity must stay below 30 µS/cm (ISO/EN requirements) to prevent residual salts from causing early coating failure. Failed bath logs trigger corrective action.
      </div>
    </Modal>
  );
}

// ─── Certificate of Conformance Modal ────────────────────────────────────────

function CocModal({ jobs, qcInspections, ovenCureLogs, existingCount, onSave, onClose }: {
  jobs: ReturnType<typeof useApp>['state']['jobs'];
  qcInspections: ReturnType<typeof useApp>['state']['qcInspections'];
  ovenCureLogs: OvenCureLog[];
  existingCount: number;
  onSave: (coc: CertificateOfConformance) => void;
  onClose: () => void;
}) {
  const passedInspections = qcInspections.filter(q => q.result === 'pass' || q.result === 'conditional');
  const [jobId, setJobId] = useState(passedInspections[0] ? jobs.find(j => j.id === passedInspections[0].jobId)?.id ?? '' : '');
  const [qcId, setQcId] = useState(passedInspections[0]?.id ?? '');
  const [standards, setStandards] = useState<ComplianceStandard[]>([]);
  const [finishSpec, setFinishSpec] = useState('');
  const [powderLot, setPowderLot] = useState('');
  const [quantityShipped, setQuantityShipped] = useState('1');
  const [ovenLogId, setOvenLogId] = useState('');
  const [notes, setNotes] = useState('');

  const selectedJob = jobs.find(j => j.id === jobId);
  const selectedInsp = qcInspections.find(q => q.id === qcId);
  const jobInspections = passedInspections.filter(q => q.jobId === jobId);
  const jobOvenLogs = ovenCureLogs.filter(l => {
    const batch = selectedJob?.powderSpec?.batchId;
    return l.batchId === batch;
  });

  function toggleStandard(s: ComplianceStandard) {
    setStandards(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function handleSave() {
    if (!selectedJob) return;
    const now = new Date().toISOString();
    const cocNum = `COC-${now.slice(0, 4)}-${String(existingCount + 1).padStart(4, '0')}`;
    const ovenLog = ovenCureLogs.find(l => l.id === ovenLogId);
    const ps = selectedJob.powderSpec;
    onSave({
      id: generateId(),
      cocNumber: cocNum,
      jobId: selectedJob.id,
      jobNumber: selectedJob.jobNumber,
      customerId: selectedJob.customerId,
      customerName: selectedJob.customerName,
      customerPoNumber: selectedJob.poNumber,
      issuedDate: now.slice(0, 10),
      issuedById: 'u1',
      issuedByName: 'Quality Inspector',
      partDescriptions: selectedJob.parts.map(p => p.description),
      quantityShipped: Number(quantityShipped) || 1,
      finishSpecification: finishSpec || `Powder coated — ${ps?.colorName ?? ''} ${ps?.finish ?? ''}`.trim(),
      complianceStandards: standards,
      colorName: ps?.colorName ?? '',
      colorCode: ps?.colorCode ?? '',
      powderManufacturer: ps?.powderManufacturer ?? '',
      powderProduct: ps?.powderProduct ?? '',
      powderLotNumber: powderLot || undefined,
      dftMeanUm: selectedInsp?.milThickness,
      dftSpecUm: selectedInsp?.milSpec,
      glossMean: selectedInsp?.gloss,
      glossSpec: selectedInsp?.glossSpec,
      adhesionResult: selectedInsp?.adhesionTest,
      curvePassed: ovenLog?.curvePassed,
      peakMetalTempF: ovenLog?.peakMetalTempF,
      timeAtTempMin: ovenLog?.timeAtMinTempMin,
      qcInspectionId: qcId || undefined,
      ovenCureLogId: ovenLogId || undefined,
      notes: notes || undefined,
      createdAt: now,
    });
  }

  return (
    <Modal open={true} onClose={onClose} title="Issue Certificate of Conformance" size="xl"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!jobId}>Issue CoC</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Job" value={jobId} onChange={e => { setJobId(e.target.value); setQcId(''); }} className="col-span-2">
          <option value="">— Select job —</option>
          {jobs.filter(j => j.status === 'complete' || j.status === 'shipping' || j.status === 'qc').map(j => (
            <option key={j.id} value={j.id}>{j.jobNumber} — {j.customerName}</option>
          ))}
        </Select>
        <Select label="Linked QC Inspection" value={qcId} onChange={e => setQcId(e.target.value)}>
          <option value="">— None —</option>
          {jobInspections.map(q => <option key={q.id} value={q.id}>{q.jobNumber} — {q.result.toUpperCase()} — {formatDate(q.inspectionDate)}</option>)}
        </Select>
        <Select label="Linked Oven Cure Log" value={ovenLogId} onChange={e => setOvenLogId(e.target.value)}>
          <option value="">— None —</option>
          {(jobOvenLogs.length > 0 ? jobOvenLogs : ovenCureLogs).map(l => <option key={l.id} value={l.id}>{l.batchNumber} — {l.ovenName} — {formatDate(l.startTime.slice(0, 10))}</option>)}
        </Select>
        <Input label="Quantity Shipped" type="number" min="1" value={quantityShipped} onChange={e => setQuantityShipped(e.target.value)} />
        <Input label="Powder Lot Number" value={powderLot} onChange={e => setPowderLot(e.target.value)} placeholder="From powder bag / box label" />
        <Textarea label="Finish Specification Statement" value={finishSpec} onChange={e => setFinishSpec(e.target.value)} rows={2} className="col-span-2"
          placeholder="e.g. Powder coated to AAMA 2604 — RAL 7016 Anthracite Grey, Semi-Gloss, 60–80 µm" />
        <div className="col-span-2">
          <div className="text-sm font-semibold text-gray-700 mb-2">Compliance Standards Claimed</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COMPLIANCE_STANDARD_LABELS) as ComplianceStandard[]).map(s => (
              <label key={s} className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors',
                standards.includes(s) ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100')}>
                <input type="checkbox" checked={standards.includes(s)} onChange={() => toggleStandard(s)} className="accent-blue-600" />
                {COMPLIANCE_STANDARD_LABELS[s]}
              </label>
            ))}
          </div>
        </div>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="col-span-2" />
      </div>
    </Modal>
  );
}
