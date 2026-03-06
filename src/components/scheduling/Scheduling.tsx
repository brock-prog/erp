import React, { useState, useMemo } from 'react';
import {
  CalendarDays, Flame, Clock, Plus, CheckCircle, AlertCircle,
  LayoutGrid, Calendar, Monitor, ChevronLeft, ChevronRight,
  GripVertical, MoveRight, AlertTriangle, Palette, List,
  Package, ArrowRight, Layers,
} from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { formatDate, formatDateTime, generateId, clsx } from '../../utils';
import type { Batch, EquipmentType, Job, JobStatus } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const SCHEDULING_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '📋', label: 'Jobs Released to Production',
    description: 'Reviewed jobs from Pending Job Queue appear in the scheduling pool, ready to be batched.' },
  { type: 'action', icon: '🏷️', label: 'Create a Batch',
    description: 'Group compatible jobs together into a batch — same powder colour and production line saves time.' },
  { type: 'action', icon: '📅', label: 'Assign to Time Slot',
    description: 'Drag or assign the batch to an available slot on the production calendar.' },
  { type: 'action', icon: '👷', label: 'Assign Operators',
    description: 'Assign one or more operators to the batch for accountability and capacity planning.' },
  { type: 'decision', icon: '⚡', label: 'Capacity Conflict?',
    branches: [
      { label: '✓ No Conflict', color: 'green',
        steps: [{ label: 'Confirm the schedule' }, { label: 'Operators notified' }]},
      { label: '⚠ Conflict', color: 'amber',
        steps: [{ label: 'Reprioritise jobs by due date or rush flag' }, { label: 'Adjust batch size or split runs' }]},
    ]},
  { type: 'end', icon: '🏭', label: 'Production Starts',
    description: 'Operators work the scheduled batches. Progress is tracked in Jobs / Work Orders.' },
];

const SCHEDULING_TOUR: TourStep[] = [
  { selector: '[data-tour="sched-header"]', title: 'Schedule Header',
    why: 'Shows the current date and view mode. Switch between calendar, Gantt, and list views.',
    what: 'Use the view tabs to pick the layout that works best. "Floor Display" opens a full-screen production board.' },
  { selector: '[data-tour="sched-batch"]', title: 'Schedule Batch Button',
    why: 'Batching groups compatible jobs (same colour, same line) to reduce changeovers and save time.',
    what: 'Click "Schedule Batch" to create a new batch. Select jobs, assign a line and date, then confirm.' },
  { selector: '[data-tour="sched-calendar"]', title: 'Production Calendar',
    why: 'Visual timeline of all scheduled batches across production lines.',
    what: 'Click a batch to see details. Drag batches to reschedule. Colour codes match production lines.' },
];

// ── Drag-and-drop types ──────────────────────────────────────────────────────

type DragKind = 'job' | 'batch';
interface DragState {
  id: string;
  kind: DragKind;
  fromStatus?: string;
  fromDate?: string;
}

// ── Kanban column definitions ─────────────────────────────────────────────────

const KANBAN_COLS: Array<{
  id: string;
  label: string;
  targetStatus: JobStatus;
  statuses: JobStatus[];
  color: string;
  headerBg: string;
}> = [
  { id: 'incoming',  label: 'Incoming',    targetStatus: 'rack',     statuses: ['received','prep','blast','rack'] as JobStatus[], color: 'border-blue-200',   headerBg: 'bg-blue-50'   },
  { id: 'pretreat',  label: 'Pre-Treat',   targetStatus: 'pretreat', statuses: ['pretreat'] as JobStatus[],                       color: 'border-purple-200', headerBg: 'bg-purple-50' },
  { id: 'coat',      label: 'Coating',     targetStatus: 'coat',     statuses: ['coat'] as JobStatus[],                           color: 'border-orange-200', headerBg: 'bg-orange-50' },
  { id: 'cure',      label: 'Curing',      targetStatus: 'cure',     statuses: ['cure'] as JobStatus[],                           color: 'border-red-200',    headerBg: 'bg-red-50'    },
  { id: 'qc',        label: 'QC / Unrack', targetStatus: 'qc',       statuses: ['qc','unrack'] as JobStatus[],                    color: 'border-green-200',  headerBg: 'bg-green-50'  },
  { id: 'shipping',  label: 'Dispatch',    targetStatus: 'shipping', statuses: ['shipping'] as JobStatus[],                       color: 'border-teal-200',   headerBg: 'bg-teal-50'   },
];

const COL_BADGE: Record<string, string> = {
  incoming: 'bg-blue-100 text-blue-700',
  pretreat: 'bg-purple-100 text-purple-700',
  coat:     'bg-orange-100 text-orange-700',
  cure:     'bg-red-100 text-red-700',
  qc:       'bg-green-100 text-green-700',
  shipping: 'bg-teal-100 text-teal-700',
};

const BATCH_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  loading:   'bg-yellow-100 text-yellow-700',
  curing:    'bg-red-100 text-red-700',
  cooling:   'bg-cyan-100 text-cyan-700',
  complete:  'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const BATCH_STATUS_BAR: Record<string, string> = {
  scheduled: 'bg-brand-500',
  loading:   'bg-yellow-500',
  curing:    'bg-red-500',
  cooling:   'bg-cyan-500',
  complete:  'bg-accent-500',
  cancelled: 'bg-gray-400',
};

const BATCH_STATUS_BG: Record<string, string> = {
  scheduled: 'bg-brand-500',
  loading:   'bg-yellow-500',
  curing:    'bg-red-500',
  cooling:   'bg-cyan-500',
  complete:  'bg-accent-500',
  cancelled: 'bg-gray-400',
};

const JOB_STATUS_BG: Record<string, string> = {
  received: 'bg-blue-400',   prep: 'bg-blue-400',
  blast:    'bg-slate-500',  rack: 'bg-slate-400',
  pretreat: 'bg-purple-500', coat: 'bg-orange-500',
  cure:     'bg-red-500',    qc:   'bg-accent-500',
  unrack:   'bg-teal-500',   shipping: 'bg-teal-600',
};

// ── Equipment icons ──────────────────────────────────────────────────────────

const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, React.ReactNode> = {
  oven:                    <Flame size={16} className="text-red-500" />,
  heat_press:              <Clock size={16} className="text-orange-500" />,
  blast_cabinet:           <AlertCircle size={16} className="text-gray-500" />,
  washer:                  <CheckCircle size={16} className="text-blue-500" />,
  spray_booth:             <AlertCircle size={16} className="text-purple-500" />,
  horizontal_powder_line:  <Flame size={16} className="text-brand-500" />,
  batch_powder_line:       <Flame size={16} className="text-amber-500" />,
  vertical_powder_line:    <Flame size={16} className="text-orange-400" />,
  extrusion_sublimation:   <Clock size={16} className="text-purple-500" />,
  panel_sublimation_oven:  <Clock size={16} className="text-indigo-500" />,
  compressor:              <AlertCircle size={16} className="text-gray-400" />,
  other:                   <AlertCircle size={16} className="text-gray-400" />,
};

// ── Color utilities ──────────────────────────────────────────────────────────

const RAL_HEX: Record<string, string> = {
  // Whites / near-whites
  '9001': '#E3DDCC', '9002': '#E0DDD5', '9003': '#ECE9E1', '9010': '#F7F4EF', '9016': '#F1F0EA',
  // Blacks / near-blacks
  '9004': '#282C2E', '9005': '#1A1A1A', '9011': '#1C2327', '9017': '#282C2B',
  // Grays
  '7004': '#9EA0A1', '7015': '#49535C', '7016': '#3E4347', '7021': '#2F3234',
  '7024': '#454954', '7035': '#C8CAC7', '7037': '#7A7B7C', '7040': '#9DA3A6',
  '7045': '#8F9695', '9006': '#A3A5A6', '9007': '#8E8E90',
  // Blues
  '5002': '#1A3E6F', '5005': '#1657A5', '5010': '#0D4C8B', '5015': '#2D7AB8',
  '5018': '#2E7D8D', '5019': '#1A5E87', '5021': '#107B8C',
  // Greens
  '6003': '#515943', '6005': '#1F4F2B', '6010': '#3D6A30', '6011': '#587840', '6018': '#5A8A3E',
  // Reds
  '3000': '#A52828', '3002': '#A11818', '3003': '#8B1A1A', '3005': '#641526',
  '3016': '#A53620', '3020': '#CC2222',
  // Yellows
  '1021': '#F4B400', '1023': '#F9C31B', '1028': '#F77A00',
  // Oranges
  '2003': '#F07626', '2004': '#E25217', '2009': '#E05A1E',
  // Browns
  '8001': '#915022', '8011': '#5A2D18', '8014': '#3C2B1A', '8017': '#442624',
};

function getColorHex(colorCode?: string, colorName?: string): string {
  if (!colorCode && !colorName) return '#9CA3AF';
  if (colorCode?.startsWith('#')) return colorCode;
  const num = (colorCode ?? '').replace(/^RAL[\s-]*/i, '').trim();
  if (RAL_HEX[num]) return RAL_HEX[num];
  // Hash color name to a deterministic hue
  const str = colorName ?? colorCode ?? 'gray';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue},42%,38%)`;
}

function isColorLight(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function getDueUrgency(dueDate: string, status: string) {
  if (['complete', 'cancelled', 'shipping'].includes(status)) return 'done';
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  if (due < now) return 'late';
  if (due - now < 86_400_000) return 'today'; // within 24h
  return 'ok';
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar() {
  const { state } = useApp();
  const now = Date.now();

  const active  = state.jobs.filter(j => !['complete','cancelled'].includes(j.status));
  const late    = active.filter(j => new Date(j.dueDate).getTime() < now && !['shipping'].includes(j.status));
  const atRisk  = active.filter(j => {
    const t = new Date(j.dueDate).getTime();
    return t >= now && t - now < 86_400_000;
  });
  const rush    = active.filter(j => j.priority === 'rush');
  const onHold  = active.filter(j => j.status === 'on_hold');

  const tiles = [
    { label: 'Active Jobs',   value: active.length,  accent: false },
    { label: 'Late',          value: late.length,    accent: late.length   > 0, danger: true  },
    { label: 'Due Today',     value: atRisk.length,  accent: atRisk.length > 0, warn: true    },
    { label: 'Rush',          value: rush.length,    accent: rush.length   > 0, danger: true  },
    { label: 'On Hold',       value: onHold.length,  accent: onHold.length > 0, warn: true    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {tiles.map(t => (
        <div key={t.label} className={clsx(
          'rounded-xl border px-4 py-3 transition-colors',
          t.accent && t.danger ? 'bg-red-50 border-red-200' :
          t.accent && t.warn  ? 'bg-amber-50 border-amber-200' :
                                'bg-white border-gray-200',
        )}>
          <div className={clsx('text-2xl font-black leading-none',
            t.accent && t.danger ? 'text-red-600' :
            t.accent && t.warn  ? 'text-amber-600' :
                                  'text-gray-700',
          )}>{t.value}</div>
          <div className="text-xs text-gray-500 font-medium mt-1">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Batch Modal ───────────────────────────────────────────────────────────────

function BatchModal({
  open, onClose, defaultJobIds = [],
}: {
  open: boolean;
  onClose: () => void;
  defaultJobIds?: string[];
}) {
  const { state, dispatch } = useApp();
  const [ovenId, setOvenId] = useState('');
  const [jobIds, setJobIds] = useState<string[]>(defaultJobIds);
  const [scheduledStart, setScheduledStart] = useState('');
  const [cureTemp, setCureTemp] = useState(400);
  const [cureMinutes, setCureMinutes] = useState(20);
  const [colorCode, setColorCode] = useState('');
  const [colorName, setColorName] = useState('');
  const [notes, setNotes] = useState('');

  // Reset jobIds when defaultJobIds changes (modal re-opened with new defaults)
  React.useEffect(() => { if (open) setJobIds(defaultJobIds); }, [open]);

  const availableJobs = state.jobs.filter(j =>
    j.serviceType === 'powder_coating' && ['pretreat', 'coat', 'rack'].includes(j.status),
  );
  const ovens = state.equipment.filter(e => e.type === 'oven' && e.status === 'operational');

  function toggleJob(id: string) {
    setJobIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave() {
    const oven = state.equipment.find(e => e.id === ovenId);
    const start = scheduledStart || new Date().toISOString().slice(0, 16);
    const endDate = new Date(new Date(start).getTime() + cureMinutes * 60000);
    const now = new Date().toISOString().split('T')[0];
    const year = now.substring(0, 4);
    const existing = state.batches.filter(b => b.batchNumber.startsWith(`BCH-${year}`));
    const nextNum = Math.max(0, ...existing.map(b => parseInt(b.batchNumber.split('-').pop() ?? '0', 10))) + 1;
    const batch: Batch = {
      id: generateId(),
      batchNumber: `BCH-${year}-${String(nextNum).padStart(4, '0')}`,
      ovenId,
      ovenName: oven?.name ?? '',
      jobIds,
      colorCode,
      colorName,
      scheduledStart: new Date(start).toISOString(),
      scheduledEnd: endDate.toISOString(),
      status: 'scheduled',
      cure: { tempF: cureTemp, minutes: cureMinutes },
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      notes,
      createdAt: now,
    };
    dispatch({ type: 'ADD_BATCH', payload: batch });
    setOvenId(''); setJobIds([]); setScheduledStart('');
    setColorCode(''); setColorName(''); setNotes('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule New Oven Batch" size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!ovenId || jobIds.length === 0}>Schedule Batch</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Oven *" value={ovenId} onChange={e => setOvenId(e.target.value)}>
            <option value="">Select oven…</option>
            {ovens.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Input label="Scheduled Start" type="datetime-local" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} />
          <Input label="Color Code" value={colorCode} onChange={e => setColorCode(e.target.value)} />
          <Input label="Color Name" value={colorName} onChange={e => setColorName(e.target.value)} />
          <Input label="Cure Temp (°F)" type="number" value={cureTemp} onChange={e => setCureTemp(Number(e.target.value))} />
          <Input label="Cure Time (min)" type="number" value={cureMinutes} onChange={e => setCureMinutes(Number(e.target.value))} />
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Select Jobs *</div>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
            {availableJobs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No jobs ready for batching</p>}
            {availableJobs.map(job => {
              const hex = getColorHex(job.powderSpec?.colorCode, job.powderSpec?.colorName);
              return (
                <label key={job.id} className={clsx('flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border', jobIds.includes(job.id) ? 'bg-accent-50 border-accent-200' : 'bg-white border-gray-200 hover:border-gray-300')}>
                  <input type="checkbox" checked={jobIds.includes(job.id)} onChange={() => toggleJob(job.id)} className="rounded" />
                  <div className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10" style={{ backgroundColor: hex }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800">{job.jobNumber} — {job.customerName}</div>
                    <div className="text-xs text-gray-500">{job.powderSpec?.colorName ?? '—'} ({job.powderSpec?.colorCode ?? '—'}) · {job.parts.reduce((s, p) => s + p.quantity, 0)} parts</div>
                  </div>
                  {job.priority === 'rush' && <Badge className="bg-red-100 text-red-600 text-[10px]">RUSH</Badge>}
                </label>
              );
            })}
          </div>
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

// ── DraggableJobCard ──────────────────────────────────────────────────────────

function DraggableJobCard({
  job, drag, onDragStart, onDragEnd, compact = false,
}: {
  job: Job;
  drag: DragState | null;
  onDragStart: (d: DragState) => void;
  onDragEnd: () => void;
  compact?: boolean;
}) {
  const urgency   = getDueUrgency(job.dueDate, job.status);
  const isDragging = drag?.id === job.id;
  const colorHex   = getColorHex(job.powderSpec?.colorCode, job.powderSpec?.colorName);
  const partCount  = job.parts?.reduce((s, p) => s + p.quantity, 0) ?? 0;

  const stripe =
    urgency === 'late' ? 'bg-red-500' :
    urgency === 'today' ? 'bg-amber-400' :
    job.priority === 'rush' ? 'bg-red-400' : 'bg-gray-200';

  const border =
    urgency === 'late'  ? 'border-red-200 hover:border-red-300' :
    urgency === 'today' ? 'border-amber-200 hover:border-amber-300' :
                          'border-gray-200 hover:border-brand-200';

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', job.id);
        onDragStart({ id: job.id, kind: 'job', fromStatus: job.status });
      }}
      onDragEnd={onDragEnd}
      className={clsx(
        'bg-white rounded-xl border overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none group flex hover:shadow-sm',
        isDragging ? 'opacity-40 ring-2 ring-brand-400 border-brand-300' : border,
      )}
    >
      {/* Status stripe */}
      <div className={clsx('w-1 flex-shrink-0', stripe)} />

      <div className="flex-1 p-2.5 min-w-0">
        {/* Top row: job number + rush */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical size={11} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
            <span className="font-mono text-[11px] font-bold text-brand-700 leading-none">{job.jobNumber}</span>
          </div>
          {job.priority === 'rush' && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 leading-tight flex-shrink-0">
              <Flame size={8} /> RUSH
            </span>
          )}
        </div>

        {/* Customer name */}
        <div className="text-[11px] text-gray-800 font-semibold truncate mb-1">{job.customerName}</div>

        {!compact && (
          <>
            {/* Color chip */}
            {(job.powderSpec?.colorName || job.powderSpec?.colorCode) && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10 shadow-sm"
                  style={{ backgroundColor: colorHex }} />
                <span className="text-[10px] text-gray-500 truncate">
                  {job.powderSpec?.colorName ?? job.powderSpec?.colorCode}
                </span>
              </div>
            )}

            {/* Due date + parts */}
            <div className="flex items-center justify-between gap-1">
              <div className={clsx('text-[10px] flex items-center gap-0.5 font-medium',
                urgency === 'late'  ? 'text-red-500' :
                urgency === 'today' ? 'text-amber-500' : 'text-gray-400',
              )}>
                {urgency === 'late'  && <AlertTriangle size={8} />}
                {urgency === 'today' && <Clock size={8} />}
                Due {formatDate(job.dueDate)}
              </div>
              {partCount > 0 && (
                <span className="text-[10px] text-gray-400">{partCount} pc{partCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col, jobs, drag, dragOver, onDragStart, onDragEnd, onDrop, setDragOver,
}: {
  col: typeof KANBAN_COLS[number];
  jobs: Job[];
  drag: DragState | null;
  dragOver: string | null;
  onDragStart: (d: DragState) => void;
  onDragEnd: () => void;
  onDrop: (colId: string) => void;
  setDragOver: (v: string | null) => void;
}) {
  const isDropTarget = dragOver === col.id && drag?.kind === 'job';
  // Sort: rush jobs first, then by due date
  const sorted = [...jobs].sort((a, b) => {
    if (a.priority === 'rush' && b.priority !== 'rush') return -1;
    if (b.priority === 'rush' && a.priority !== 'rush') return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div
      className={clsx(
        'flex flex-col rounded-xl border-2 min-h-[300px] transition-all duration-150',
        isDropTarget ? 'border-brand-400 bg-brand-50 shadow-brand' :
        drag         ? 'border-dashed border-gray-300 bg-gray-50/50' :
                       col.color + ' bg-white',
      )}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(col.id); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
      onDrop={e => { e.preventDefault(); onDrop(col.id); }}
    >
      <div className={clsx('px-3 py-2.5 rounded-t-xl border-b flex items-center justify-between', isDropTarget ? 'bg-brand-100 border-brand-200' : col.headerBg + ' border-transparent')}>
        <Badge className={COL_BADGE[col.id]}>{col.label}</Badge>
        <span className={clsx('text-xs font-black w-6 h-6 rounded-full flex items-center justify-center', jobs.length > 0 ? 'bg-white text-gray-700 shadow-sm' : 'bg-white/60 text-gray-400')}>
          {jobs.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 420 }}>
        {jobs.length === 0 && (
          <div className={clsx('flex flex-col items-center justify-center py-6 text-center', isDropTarget ? 'opacity-100' : 'opacity-40')}>
            <MoveRight size={20} className="text-gray-400 mb-1" />
            <span className="text-[10px] text-gray-400">Drop jobs here</span>
          </div>
        )}
        {sorted.map(job => (
          <DraggableJobCard key={job.id} job={job} drag={drag} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
      </div>
    </div>
  );
}

// ── Board View ────────────────────────────────────────────────────────────────

function BoardView({ onScheduleBatch }: { onScheduleBatch: () => void }) {
  const { state, dispatch } = useApp();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function handleDrop(colId: string) {
    if (!drag || drag.kind !== 'job') { setDrag(null); setDragOver(null); return; }
    const col = KANBAN_COLS.find(c => c.id === colId);
    const job = state.jobs.find(j => j.id === drag.id);
    if (col && job && job.status !== col.targetStatus) {
      dispatch({
        type: 'UPDATE_JOB',
        payload: {
          ...job,
          status: col.targetStatus,
          updatedAt: new Date().toISOString(),
          statusHistory: [...(job.statusHistory ?? []), {
            status: col.targetStatus,
            timestamp: new Date().toISOString(),
            userId: state.currentUser.id,
            userName: state.currentUser.name,
          }],
        },
      });
    }
    setDrag(null);
    setDragOver(null);
  }

  const colJobs = useMemo(() => {
    const map = new Map<string, Job[]>();
    KANBAN_COLS.forEach(c => map.set(c.id, []));
    state.jobs
      .filter(j => !['complete','cancelled','on_hold'].includes(j.status))
      .forEach(job => {
        const col = KANBAN_COLS.find(c => c.statuses.includes(job.status as JobStatus));
        if (col) map.get(col.id)!.push(job);
      });
    return map;
  }, [state.jobs]);

  const rushActive = state.jobs.filter(j => j.priority === 'rush' && !['complete','cancelled'].includes(j.status));
  const onHoldJobs = state.jobs.filter(j => j.status === 'on_hold');
  const activeBatches = state.batches.filter(b => b.status !== 'cancelled' && b.status !== 'complete');
  const completedBatches = state.batches.filter(b => b.status === 'complete').slice(0, 5);

  function advanceBatch(batch: Batch) {
    const order: Batch['status'][] = ['scheduled','loading','curing','cooling','complete'];
    const idx = order.indexOf(batch.status);
    if (idx < order.length - 1) {
      const updated = { ...batch, status: order[idx + 1] };
      if (updated.status === 'curing')  updated.actualStart = new Date().toISOString();
      if (updated.status === 'complete') updated.actualEnd  = new Date().toISOString();
      dispatch({ type: 'UPDATE_BATCH', payload: updated });
    }
  }

  return (
    <div className="space-y-6">
      {/* Drag tooltip */}
      {drag && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-brand flex items-center gap-2 pointer-events-none animate-fade-in">
          <GripVertical size={13} /> Drop on a stage column to move the job
        </div>
      )}

      {/* Rush alert strip */}
      {rushActive.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={14} className="text-red-500 flex-shrink-0" />
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
              {rushActive.length} Rush Job{rushActive.length !== 1 ? 's' : ''} in Production
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {rushActive.map(job => {
              const col = KANBAN_COLS.find(c => c.statuses.includes(job.status as JobStatus));
              return (
                <div key={job.id} className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <Flame size={9} className="text-red-500" />
                  <span className="font-mono font-bold text-brand-700">{job.jobNumber}</span>
                  <span className="text-gray-500">{job.customerName}</span>
                  {col && <Badge className={clsx('text-[9px]', COL_BADGE[col.id])}>{col.label}</Badge>}
                  <ArrowRight size={9} className="text-gray-300" />
                  <span className="text-gray-400">Due {formatDate(job.dueDate)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Production Floor</h3>
          <span className="text-xs text-gray-400">
            {state.jobs.filter(j => !['complete','cancelled'].includes(j.status)).length} active · drag cards to advance stages
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {KANBAN_COLS.map(col => (
            <KanbanColumn
              key={col.id} col={col} jobs={colJobs.get(col.id) ?? []}
              drag={drag} dragOver={dragOver}
              onDragStart={setDrag}
              onDragEnd={() => { setDrag(null); setDragOver(null); }}
              onDrop={handleDrop} setDragOver={setDragOver}
            />
          ))}
        </div>

        {onHoldJobs.length > 0 && (
          <div className="mt-3 border border-amber-200 rounded-xl bg-amber-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-700">On Hold ({onHoldJobs.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {onHoldJobs.map(job => (
                <div key={job.id} className="bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="font-mono font-bold text-brand-700">{job.jobNumber}</span>
                  <span className="text-gray-500 ml-1.5">{job.customerName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Equipment & line utilization */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Equipment & Line Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {state.equipment.map(e => {
            const activeJobs = state.jobs.filter(j =>
              (e.type === 'oven' ? j.powderSpec?.ovenId === e.id : j.sublimationSpec?.heatPressId === e.id)
              && !['complete','cancelled'].includes(j.status),
            );
            const utilPct = Math.min(100, Math.round((activeJobs.length / Math.max(1, 3)) * 100));
            return (
              <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-card p-3">
                <div className="flex justify-center mb-1.5">{EQUIPMENT_TYPE_ICONS[e.type]}</div>
                <div className="text-[11px] font-semibold text-gray-800 leading-tight mb-1.5 text-center truncate" title={e.name}>{e.name}</div>
                <div className="flex justify-center mb-2">
                  <Badge className={e.status === 'operational' ? 'bg-accent-100 text-accent-700' : e.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                    {e.status}
                  </Badge>
                </div>
                {activeJobs.length > 0 && (
                  <>
                    <div className="bg-gray-100 rounded-full h-1.5 mb-1 overflow-hidden">
                      <div className={clsx('h-1.5 rounded-full transition-all',
                        utilPct > 90 ? 'bg-red-500' : utilPct > 65 ? 'bg-amber-500' : 'bg-accent-500',
                      )} style={{ width: `${utilPct}%` }} />
                    </div>
                    <div className="text-[10px] text-brand-600 font-semibold text-center">{activeJobs.length} job{activeJobs.length > 1 ? 's' : ''}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Racks */}
      {state.racks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Rack Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {state.racks.map(rack => {
              const utilPct = rack.capacity > 0 ? Math.round((rack.usedCapacity / rack.capacity) * 100) : 0;
              return (
                <Card key={rack.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-gray-800">{rack.name}</span>
                    <Badge className={rack.status === 'in_use' ? 'bg-orange-100 text-orange-700' : rack.status === 'available' ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-700'}>
                      {rack.status.replace('_',' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{rack.location} · {rack.capacity} sq ft</div>
                  <div className="bg-gray-100 rounded-full h-1.5 mb-1 overflow-hidden">
                    <div className={clsx('h-1.5 rounded-full transition-all', utilPct > 80 ? 'bg-red-500' : utilPct > 50 ? 'bg-amber-500' : 'bg-accent-500')} style={{ width: `${utilPct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500">{rack.usedCapacity}/{rack.capacity} sq ft ({utilPct}%)</div>
                  {rack.currentJobIds.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {rack.currentJobIds.map(jid => {
                        const j = state.jobs.find(x => x.id === jid);
                        return j ? <div key={jid} className="text-[11px] text-brand-600 font-semibold">{j.jobNumber}</div> : null;
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active batches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Active Oven Batches</h3>
          <Button size="sm" variant="secondary" onClick={onScheduleBatch} icon={<Plus size={13} />}>Schedule Batch</Button>
        </div>
        {activeBatches.length === 0 ? (
          <Card>
            <div className="text-center py-10 text-gray-400">
              <Flame size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No active batches</p>
              <button onClick={onScheduleBatch} className="mt-2 text-xs text-accent-600 hover:underline">Schedule one now</button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeBatches.map(batch => {
              const batchJobs = batch.jobIds.map(id => state.jobs.find(j => j.id === id)).filter(Boolean);
              const statusOrder = ['scheduled','loading','curing','cooling','complete'];
              const progress = ((statusOrder.indexOf(batch.status) + 1) / statusOrder.length) * 100;
              const hex = getColorHex(batch.colorCode, batch.colorName);
              return (
                <Card key={batch.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono font-bold text-brand-700 text-sm">{batch.batchNumber}</span>
                        <Badge className={BATCH_STATUS_COLORS[batch.status]}>{batch.status}</Badge>
                        {batch.colorCode && (
                          <div className="flex items-center gap-1.5 border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50">
                            <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                            <span className="text-xs text-gray-500">{batch.colorName} · {batch.colorCode}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-800">{batch.ovenName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Cure: {batch.cure.tempF}°F / {batch.cure.minutes} min · by {batch.operatorName}</div>
                      <div className="mt-2 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={clsx('h-1.5 rounded-full transition-all', BATCH_STATUS_BAR[batch.status])} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 flex-shrink-0">
                      <div>Scheduled: {formatDateTime(batch.scheduledStart)}</div>
                      {batch.actualStart && <div className="text-accent-600 font-medium">Started: {formatDateTime(batch.actualStart)}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {batchJobs.map(job => job && (
                      <div key={job.id} className="bg-brand-50 rounded-lg px-2.5 py-1.5 border border-brand-100 text-xs">
                        <span className="font-mono font-semibold text-brand-700">{job.jobNumber}</span>
                        <span className="text-brand-500 ml-1">— {job.customerName}</span>
                      </div>
                    ))}
                  </div>
                  {batch.status !== 'complete' && (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => advanceBatch(batch)}>
                        {batch.status === 'scheduled' ? 'Start Loading' :
                         batch.status === 'loading'   ? 'Begin Curing' :
                         batch.status === 'curing'    ? 'Mark Cooling' : 'Mark Complete'}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed batches */}
      {completedBatches.length > 0 && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Recent Completed Batches</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Batch #','Oven','Color','Scheduled','Completed','Jobs'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {completedBatches.map(batch => (
                <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-brand-700">{batch.batchNumber}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">{batch.ovenName}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: getColorHex(batch.colorCode, batch.colorName) }} />
                      <span className="text-xs text-gray-600">{batch.colorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{formatDateTime(batch.scheduledStart)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{batch.actualEnd ? formatDateTime(batch.actualEnd) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-gray-700">{batch.jobIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Color Batch View ──────────────────────────────────────────────────────────

function ColorBatchView({ onScheduleBatch }: { onScheduleBatch: (jobIds: string[]) => void }) {
  const { state } = useApp();

  const readyJobs = useMemo(() =>
    state.jobs.filter(j =>
      j.serviceType === 'powder_coating' &&
      ['rack', 'pretreat', 'coat'].includes(j.status),
    ),
  [state.jobs]);

  const colorGroups = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      colorCode: string;
      colorName: string;
      hex: string;
      jobs: Job[];
    }>();
    readyJobs.forEach(job => {
      const key = job.powderSpec?.colorCode ?? job.powderSpec?.colorName ?? '__none__';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          colorCode: job.powderSpec?.colorCode ?? '',
          colorName: job.powderSpec?.colorName ?? 'No Color Specified',
          hex: getColorHex(job.powderSpec?.colorCode, job.powderSpec?.colorName),
          jobs: [],
        });
      }
      groups.get(key)!.jobs.push(job);
    });
    return Array.from(groups.values()).sort((a, b) => b.jobs.length - a.jobs.length);
  }, [readyJobs]);

  if (colorGroups.length === 0) {
    return (
      <Card>
        <div className="text-center py-16 text-gray-400">
          <Palette size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No jobs ready for color batching</p>
          <p className="text-xs mt-1 text-gray-400">Jobs in Rack, Pre-Treat, or Coat stages will appear here grouped by color</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Color Batch Optimizer</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {readyJobs.length} job{readyJobs.length !== 1 ? 's' : ''} across {colorGroups.length} color{colorGroups.length !== 1 ? 's' : ''} ready for batching — group same colors to minimize changeovers
          </p>
        </div>
        <Button size="sm" onClick={() => onScheduleBatch([])} icon={<Plus size={13} />}>Schedule Batch</Button>
      </div>

      {/* Tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700">
          <span className="font-semibold">Changeover tip:</span> Run light colors before dark. Each card below shows a color group — batch all jobs in the same color together, then sequence light → dark to reduce cleaning time between runs.
        </div>
      </div>

      {/* Color group cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {colorGroups.map(group => {
          const rush     = group.jobs.filter(j => j.priority === 'rush').length;
          const overdue  = group.jobs.filter(j => getDueUrgency(j.dueDate, j.status) === 'late').length;
          const atRisk   = group.jobs.filter(j => getDueUrgency(j.dueDate, j.status) === 'today').length;
          const partCount = group.jobs.reduce((s, j) => s + (j.parts?.reduce((ps, p) => ps + p.quantity, 0) ?? 0), 0);
          const light     = isColorLight(group.hex);

          return (
            <div key={group.key} className="rounded-xl border border-gray-200 shadow-card overflow-hidden bg-white">
              {/* Color header */}
              <div className="px-4 py-5 flex items-start gap-3" style={{ backgroundColor: group.hex }}>
                <div className={clsx('flex-1 min-w-0', light ? 'text-gray-900' : 'text-white')}>
                  <div className="font-bold text-lg leading-tight">{group.colorName}</div>
                  {group.colorCode && group.colorCode !== group.colorName && (
                    <div className={clsx('text-xs mt-0.5 font-mono', light ? 'text-gray-600' : 'text-white/70')}>{group.colorCode}</div>
                  )}
                </div>
                <div className={clsx('text-right flex-shrink-0', light ? 'text-gray-800' : 'text-white')}>
                  <div className="text-3xl font-black leading-none">{group.jobs.length}</div>
                  <div className="text-[10px] font-semibold opacity-70">{group.jobs.length === 1 ? 'job' : 'jobs'}</div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex border-b border-gray-100 divide-x divide-gray-100">
                <div className="flex-1 text-center py-2">
                  <div className="text-sm font-bold text-gray-700">{partCount}</div>
                  <div className="text-[10px] text-gray-400">parts</div>
                </div>
                {rush > 0 && (
                  <div className="flex-1 text-center py-2">
                    <div className="text-sm font-bold text-red-600 flex items-center justify-center gap-0.5"><Flame size={11} />{rush}</div>
                    <div className="text-[10px] text-gray-400">rush</div>
                  </div>
                )}
                {overdue > 0 && (
                  <div className="flex-1 text-center py-2">
                    <div className="text-sm font-bold text-red-500">{overdue}</div>
                    <div className="text-[10px] text-gray-400">late</div>
                  </div>
                )}
                {atRisk > 0 && (
                  <div className="flex-1 text-center py-2">
                    <div className="text-sm font-bold text-amber-500">{atRisk}</div>
                    <div className="text-[10px] text-gray-400">today</div>
                  </div>
                )}
              </div>

              {/* Job list */}
              <div className="p-3 space-y-1 max-h-36 overflow-y-auto">
                {group.jobs
                  .sort((a, b) => {
                    if (a.priority === 'rush' && b.priority !== 'rush') return -1;
                    if (b.priority === 'rush' && a.priority !== 'rush') return 1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  })
                  .map(job => {
                    const urgency = getDueUrgency(job.dueDate, job.status);
                    const col = KANBAN_COLS.find(c => c.statuses.includes(job.status as JobStatus));
                    return (
                      <div key={job.id} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {job.priority === 'rush' && <Flame size={9} className="text-red-500 flex-shrink-0" />}
                          <span className="font-mono font-bold text-brand-700 flex-shrink-0">{job.jobNumber}</span>
                          <span className="text-gray-500 truncate">{job.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {col && <Badge className={clsx('text-[9px]', COL_BADGE[col.id])}>{col.label}</Badge>}
                          <span className={clsx('text-[10px]',
                            urgency === 'late'  ? 'text-red-500 font-semibold' :
                            urgency === 'today' ? 'text-amber-500 font-semibold' : 'text-gray-400',
                          )}>{formatDate(job.dueDate)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Batch button */}
              <div className="p-3 border-t border-gray-100 bg-gray-50/80">
                <button
                  onClick={() => onScheduleBatch(group.jobs.map(j => j.id))}
                  className="w-full text-xs font-semibold text-brand-700 bg-white hover:bg-brand-50 border border-brand-200 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers size={11} />
                  Batch these {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Priority Queue View ───────────────────────────────────────────────────────

function PriorityQueueView() {
  const { state } = useApp();
  const now = Date.now();

  const sorted = useMemo(() => {
    const active = state.jobs.filter(j => !['complete','cancelled'].includes(j.status));
    return active.sort((a, b) => {
      // Rush first
      if (a.priority === 'rush' && b.priority !== 'rush') return -1;
      if (b.priority === 'rush' && a.priority !== 'rush') return 1;
      // Then overdue (earliest first)
      const aLate = new Date(a.dueDate).getTime() < now;
      const bLate = new Date(b.dueDate).getTime() < now;
      if (aLate && !bLate) return -1;
      if (bLate && !aLate) return 1;
      // Then by due date ascending
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [state.jobs]);

  if (sorted.length === 0) {
    return (
      <Card>
        <div className="text-center py-16 text-gray-400">
          <List size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No active jobs</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Priority Dispatch Queue</h3>
        <p className="text-xs text-gray-500 mt-0.5">All active jobs ranked by urgency — rush jobs first, then by due date</p>
      </div>

      <Card padding={false}>
        <div className="divide-y divide-gray-100">
          {sorted.map((job, idx) => {
            const urgency   = getDueUrgency(job.dueDate, job.status);
            const colorHex  = getColorHex(job.powderSpec?.colorCode, job.powderSpec?.colorName);
            const col       = KANBAN_COLS.find(c => c.statuses.includes(job.status as JobStatus));
            const partCount = job.parts?.reduce((s, p) => s + p.quantity, 0) ?? 0;
            const isRush    = job.priority === 'rush';

            return (
              <div key={job.id} className={clsx(
                'flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors',
                isRush && 'bg-red-50/60 hover:bg-red-50',
              )}>
                {/* Rank */}
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
                  isRush           ? 'bg-red-500 text-white' :
                  urgency === 'late'  ? 'bg-red-100 text-red-600' :
                  urgency === 'today' ? 'bg-amber-100 text-amber-600' :
                                       'bg-gray-100 text-gray-500',
                )}>
                  {isRush ? <Flame size={12} /> : idx + 1}
                </div>

                {/* Job info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-bold text-brand-700">{job.jobNumber}</span>
                    {isRush && (
                      <span className="text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded px-1.5 py-0.5">RUSH</span>
                    )}
                    {col && <Badge className={clsx('text-[9px]', COL_BADGE[col.id])}>{col.label}</Badge>}
                  </div>
                  <div className="text-sm font-medium text-gray-700 truncate">{job.customerName}</div>
                </div>

                {/* Color chip */}
                {(job.powderSpec?.colorName || job.powderSpec?.colorCode) && (
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: colorHex }} />
                    <span className="text-xs text-gray-500 max-w-[80px] truncate">
                      {job.powderSpec?.colorName ?? job.powderSpec?.colorCode}
                    </span>
                  </div>
                )}

                {/* Parts */}
                {partCount > 0 && (
                  <div className="hidden md:flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Package size={11} />
                    {partCount} pc{partCount !== 1 ? 's' : ''}
                  </div>
                )}

                {/* Due date */}
                <div className={clsx(
                  'text-xs font-semibold flex-shrink-0 flex items-center gap-1',
                  urgency === 'late'  ? 'text-red-500' :
                  urgency === 'today' ? 'text-amber-500' : 'text-gray-400',
                )}>
                  {urgency === 'late'  && <AlertTriangle size={11} />}
                  {urgency === 'today' && <Clock size={11} />}
                  {formatDate(job.dueDate)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView() {
  const { state, dispatch } = useApp();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const batchesByDay = useMemo(() => {
    const map = new Map<string, Batch[]>();
    days.forEach(d => map.set(format(d, 'yyyy-MM-dd'), []));
    state.batches.forEach(b => {
      const key = b.scheduledStart.split('T')[0];
      if (map.has(key)) map.get(key)!.push(b);
    });
    return map;
  }, [state.batches, days]);

  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    days.forEach(d => map.set(format(d, 'yyyy-MM-dd'), []));
    state.jobs.filter(j => !['complete','cancelled'].includes(j.status)).forEach(j => {
      if (map.has(j.dueDate)) map.get(j.dueDate)!.push(j);
    });
    return map;
  }, [state.jobs, days]);

  const weekKeys = days.map(d => format(d, 'yyyy-MM-dd'));
  const queueJobs = useMemo(() =>
    state.jobs.filter(j => !['complete','cancelled'].includes(j.status) && !weekKeys.includes(j.dueDate)),
  [state.jobs, weekKeys]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  function handleDrop(dateKey: string) {
    if (!drag) return;
    if (drag.kind === 'job') {
      const job = state.jobs.find(j => j.id === drag.id);
      if (job && job.dueDate !== dateKey) {
        dispatch({ type: 'UPDATE_JOB', payload: { ...job, dueDate: dateKey, updatedAt: new Date().toISOString() } });
      }
    } else if (drag.kind === 'batch') {
      const batch = state.batches.find(b => b.id === drag.id);
      if (batch) {
        const oldStart = new Date(batch.scheduledStart);
        const newStart = new Date(dateKey + 'T' + format(oldStart, 'HH:mm'));
        const duration = new Date(batch.scheduledEnd).getTime() - oldStart.getTime();
        dispatch({ type: 'UPDATE_BATCH', payload: { ...batch, scheduledStart: newStart.toISOString(), scheduledEnd: new Date(newStart.getTime() + duration).toISOString() } });
      }
    }
    setDrag(null); setDragOver(null);
  }

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center gap-2">
        <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-brand-300 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700 flex-1 text-center">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-brand-300 transition-colors">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="text-xs font-semibold text-accent-600 hover:text-accent-700 px-3 py-1.5 rounded-lg border border-accent-200 hover:bg-accent-50 transition-colors">
          Today
        </button>
      </div>

      <div className="flex gap-4">
        {/* 7-day grid */}
        <div className="flex-1 grid grid-cols-7 gap-2">
          {days.map(day => {
            const key       = format(day, 'yyyy-MM-dd');
            const isT       = key === todayStr;
            const dayBatches = batchesByDay.get(key) ?? [];
            const dayJobs   = jobsByDay.get(key) ?? [];
            const isWeekend = [0, 6].includes(day.getDay());
            const isDrop    = dragOver === key;
            return (
              <div
                key={key}
                className={clsx(
                  'rounded-xl border-2 flex flex-col min-h-[160px] transition-all duration-100',
                  isDrop     ? 'border-brand-400 bg-brand-50 shadow-brand' :
                  drag       ? 'border-dashed border-gray-300' :
                  isT        ? 'border-brand-300 bg-brand-50/60' :
                  isWeekend  ? 'border-gray-100 bg-gray-50' :
                               'border-gray-200 bg-white',
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(key); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={e => { e.preventDefault(); handleDrop(key); }}
              >
                <div className={clsx('px-2 py-1.5 rounded-t-xl flex items-center gap-1', isDrop ? 'bg-brand-200' : isT ? 'bg-brand-600' : isWeekend ? 'bg-gray-100' : 'bg-gray-50')}>
                  <span className={clsx('text-[11px] font-semibold', isT ? 'text-brand-100' : 'text-gray-400')}>{format(day, 'EEE')}</span>
                  <span className={clsx('text-sm font-black ml-auto', isT ? 'text-white' : 'text-gray-700')}>{format(day, 'd')}</span>
                </div>
                <div className="flex-1 p-1.5 space-y-1 overflow-hidden">
                  {dayBatches.map(b => (
                    <div
                      key={b.id} draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: b.id, kind: 'batch', fromDate: key }); }}
                      onDragEnd={() => { setDrag(null); setDragOver(null); }}
                      className={clsx('rounded-lg px-1.5 py-1 text-white text-[10px] leading-tight cursor-grab active:cursor-grabbing', BATCH_STATUS_BG[b.status] ?? 'bg-gray-400', drag?.id === b.id && 'opacity-40')}
                    >
                      <div className="font-bold truncate">{b.batchNumber}</div>
                      <div className="opacity-80 truncate">{b.ovenName}</div>
                    </div>
                  ))}
                  {dayJobs.map(j => {
                    const hex = getColorHex(j.powderSpec?.colorCode, j.powderSpec?.colorName);
                    return (
                      <div
                        key={j.id} draggable
                        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: j.id, kind: 'job', fromDate: key }); }}
                        onDragEnd={() => { setDrag(null); setDragOver(null); }}
                        className={clsx('rounded-lg px-1.5 py-1 text-white text-[10px] leading-tight cursor-grab active:cursor-grabbing flex items-center gap-1', JOB_STATUS_BG[j.status] ?? 'bg-gray-400', drag?.id === j.id && 'opacity-40')}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0 border border-white/30" style={{ backgroundColor: hex }} />
                        <div className="min-w-0">
                          <div className="font-bold truncate">{j.jobNumber}</div>
                          <div className="opacity-80 truncate">{j.customerName}</div>
                        </div>
                        {j.priority === 'rush' && <Flame size={8} className="flex-shrink-0 opacity-90" />}
                      </div>
                    );
                  })}
                  {isDrop && drag && dayBatches.length === 0 && dayJobs.length === 0 && (
                    <div className="text-[10px] text-brand-500 font-semibold text-center pt-3">Release to schedule</div>
                  )}
                  {!isDrop && !drag && dayBatches.length === 0 && dayJobs.length === 0 && (
                    <div className="text-[10px] text-gray-300 text-center pt-3">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Job queue sidebar */}
        {queueJobs.length > 0 && (
          <div className="w-44 flex-shrink-0">
            <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1">
              <span>Queue</span>
              <span className="bg-gray-200 text-gray-600 rounded-full px-1.5 text-[10px] font-bold">{queueJobs.length}</span>
            </div>
            <div className="text-[10px] text-gray-400 mb-2">Drag to a day to reschedule</div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {queueJobs.slice(0, 20).map(job => (
                <DraggableJobCard key={job.id} job={job} drag={drag}
                  onDragStart={setDrag} onDragEnd={() => { setDrag(null); setDragOver(null); }} compact />
              ))}
              {queueJobs.length > 20 && <div className="text-[10px] text-gray-400 text-center pt-1">+{queueJobs.length - 20} more</div>}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="font-semibold text-gray-600">Legend:</span>
        {[
          { color: 'bg-brand-500', label: 'Batch scheduled' },
          { color: 'bg-red-500',   label: 'Curing' },
          { color: 'bg-accent-500',label: 'Complete' },
          { color: 'bg-orange-500',label: 'Job due (coat)' },
          { color: 'bg-purple-500',label: 'Job due (pretreat)' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={clsx('w-3 h-3 rounded inline-block', l.color)} /> {l.label}
          </span>
        ))}
        <span className="text-gray-400 italic ml-auto">Drag pills or queue cards to reschedule</span>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

type ViewMode = 'board' | 'calendar' | 'color-batch' | 'queue';

const VIEW_TABS: Array<{ id: ViewMode; label: string; icon: React.ReactNode; description: string }> = [
  { id: 'board',       label: 'Kanban',       icon: <LayoutGrid size={13} />,  description: 'Drag-and-drop stage board' },
  { id: 'calendar',    label: 'Calendar',     icon: <Calendar size={13} />,    description: 'Weekly job & batch view' },
  { id: 'color-batch', label: 'Color Batch',  icon: <Palette size={13} />,     description: 'Group by powder color' },
  { id: 'queue',       label: 'Priority Queue', icon: <List size={13} />,      description: 'Urgency-ranked dispatch' },
];

export function Scheduling() {
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchDefaultJobs, setBatchDefaultJobs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  function openBatchModal(jobIds: string[] = []) {
    setBatchDefaultJobs(jobIds);
    setBatchModalOpen(true);
  }

  return (
    <div className="space-y-5">
      <BatchModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        defaultJobIds={batchDefaultJobs}
      />

      {/* Header */}
      <div data-tour="sched-header" className="bg-brand-gradient text-white rounded-xl px-5 py-4 flex items-center gap-3 flex-wrap shadow-brand">
        <CalendarDays size={20} />
        <div>
          <div className="font-bold tracking-tight">Production Schedule</div>
          <div className="text-white/60 text-xs mt-0.5">{today}</div>
          <div className="flex items-center gap-1">
            <WorkflowHelp title="Scheduling Workflow" description="How jobs are batched, scheduled, and assigned to the production calendar." steps={SCHEDULING_WORKFLOW} variant="dark" />
            <GuidedTourButton steps={SCHEDULING_TOUR} />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex rounded-lg border border-white/25 overflow-hidden bg-white/10">
            {VIEW_TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                title={tab.description}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                  i > 0 && 'border-l border-white/25',
                  viewMode === tab.id ? 'bg-white text-brand-700' : 'text-white/80 hover:bg-white/10',
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <a href="/production-board" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-lg px-3 py-1.5 transition-colors border border-white/20">
            <Monitor size={13} /> Floor Display ↗
          </a>
          <span data-tour="sched-batch">
          <Button variant="secondary" size="sm" onClick={() => openBatchModal()} icon={<Plus size={13} />}>
            Schedule Batch
          </Button>
          </span>
        </div>
      </div>

      {/* Stats bar — always visible */}
      <StatsBar />

      {/* Views */}
      <div data-tour="sched-calendar">
      {viewMode === 'board'       && <BoardView onScheduleBatch={() => openBatchModal()} />}
      {viewMode === 'calendar'    && <CalendarView />}
      {viewMode === 'color-batch' && <ColorBatchView onScheduleBatch={openBatchModal} />}
      {viewMode === 'queue'       && <PriorityQueueView />}
      </div>
    </div>
  );
}
