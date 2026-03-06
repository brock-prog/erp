import React, { useState } from 'react';
import {
  Target, BarChart2, AlertCircle, Users, Plus, CheckCircle,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Edit3, Trash2, Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { clsx, generateId } from '../../utils';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const EOS_TOUR: TourStep[] = [
  { selector: '[data-tour="eos-header"]',  title: 'EOS Overview',       why: 'The Entrepreneurial Operating System keeps your leadership team aligned on rocks, metrics, and issues.',   what: 'This header reminds you of the four EOS pillars. Each tab below maps to a weekly L10 agenda item.' },
  { selector: '[data-tour="eos-tabs"]',    title: 'EOS Pillars',        why: 'Rocks (90-day goals), Scorecard (weekly metrics), Issues (problem solving), and L10 Meeting notes.',    what: 'Start with Rocks each quarter. Review Scorecard weekly. Drop new issues into Issues as they arise.' },
  { selector: '[data-tour="eos-content"]', title: 'Working Area',       why: 'Each tab has its own cards, tables, and actions to manage that EOS pillar.',                            what: 'Add rocks, update scorecard targets, log issues, and record L10 meeting notes here.' },
];

type EOSTab = 'rocks' | 'scorecard' | 'issues' | 'l10';

// ── Types ────────────────────────────────────────────────────────────────────

interface Rock {
  id: string;
  title: string;
  owner: string;
  department: string;
  quarter: string;  // e.g. "Q1 2026"
  dueDate: string;
  progress: number; // 0-100
  status: 'on_track' | 'off_track' | 'complete' | 'at_risk';
  description: string;
}

interface ScorecardRow {
  id: string;
  measurable: string;
  owner: string;
  goal: number;
  unit: string;  // e.g. "%", "jobs", "$", "hrs"
  values: { week: string; value: number }[];
}

interface Issue {
  id: string;
  title: string;
  description: string;
  owner: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

interface L10Todo {
  id: string;
  text: string;
  owner: string;
  dueDate: string;
  done: boolean;
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_ROCKS: Rock[] = [
  { id: 'r1', title: 'Implement ERP system across all departments', owner: 'Brock', department: 'Admin', quarter: 'Q1 2026', dueDate: '2026-03-31', progress: 75, status: 'on_track', description: 'Full rollout of DECORA ERP including costing, scheduling, and HR modules.' },
  { id: 'r2', title: 'Reduce rework rate to below 2%', owner: 'Production Manager', department: 'Production', quarter: 'Q1 2026', dueDate: '2026-03-31', progress: 40, status: 'at_risk', description: 'Implement QC checkpoints at each stage of the powder coating process.' },
  { id: 'r3', title: 'Onboard 5 new commercial accounts', owner: 'Sales', department: 'Sales', quarter: 'Q1 2026', dueDate: '2026-03-31', progress: 60, status: 'on_track', description: 'Target extrusion fabricators and architectural aluminium companies.' },
  { id: 'r4', title: 'Document all SOPs for horizontal line', owner: 'Ops Manager', department: 'Operations', quarter: 'Q1 2026', dueDate: '2026-03-31', progress: 20, status: 'off_track', description: 'Standard operating procedures for the automated horizontal powder coating line.' },
];

const SEED_SCORECARD: ScorecardRow[] = [
  { id: 's1', measurable: 'Jobs Completed / Week', owner: 'Production', goal: 25, unit: 'jobs', values: [{ week: 'W1', value: 22 }, { week: 'W2', value: 26 }, { week: 'W3', value: 24 }, { week: 'W4', value: 28 }] },
  { id: 's2', measurable: 'On-Time Delivery %', owner: 'Production', goal: 95, unit: '%', values: [{ week: 'W1', value: 91 }, { week: 'W2', value: 94 }, { week: 'W3', value: 96 }, { week: 'W4', value: 93 }] },
  { id: 's3', measurable: 'Rework Rate %', owner: 'QC', goal: 2, unit: '%', values: [{ week: 'W1', value: 3.2 }, { week: 'W2', value: 2.8 }, { week: 'W3', value: 2.5 }, { week: 'W4', value: 2.1 }] },
  { id: 's4', measurable: 'New Quotes Sent', owner: 'Sales', goal: 10, unit: 'quotes', values: [{ week: 'W1', value: 8 }, { week: 'W2', value: 12 }, { week: 'W3', value: 9 }, { week: 'W4', value: 11 }] },
  { id: 's5', measurable: 'Revenue Collected', owner: 'Finance', goal: 80000, unit: '$', values: [{ week: 'W1', value: 72000 }, { week: 'W2', value: 84000 }, { week: 'W3', value: 79000 }, { week: 'W4', value: 91000 }] },
  { id: 's6', measurable: 'Equipment Uptime %', owner: 'Maintenance', goal: 97, unit: '%', values: [{ week: 'W1', value: 98 }, { week: 'W2', value: 95 }, { week: 'W3', value: 97 }, { week: 'W4', value: 96 }] },
];

const SEED_ISSUES: Issue[] = [
  { id: 'i1', title: 'Pre-treatment chemical wash not consistent across shifts', description: 'Some operators are reducing wash time during busy periods, leading to adhesion failures.', owner: 'Production Manager', priority: 'high', status: 'in_progress', createdAt: '2026-02-10' },
  { id: 'i2', title: 'Quoting turnaround time too slow', description: 'Customers are waiting 3-5 days for quotes. Target is 24 hours.', owner: 'Sales', priority: 'high', status: 'open', createdAt: '2026-02-15' },
  { id: 'i3', title: 'Horizontal line throughput below capacity on Fridays', description: 'Friday afternoon throughput drops significantly. Need to investigate scheduling.', owner: 'Ops Manager', priority: 'medium', status: 'open', createdAt: '2026-02-18' },
  { id: 'i4', title: 'Inventory reorder points not updated for Q1 demand', description: 'Several powder colors are running low due to outdated reorder points.', owner: 'Warehouse', priority: 'medium', status: 'open', createdAt: '2026-02-20' },
];

const SEED_TODOS: L10Todo[] = [
  { id: 't1', text: 'Update reorder points in ERP inventory module', owner: 'Warehouse', dueDate: '2026-03-05', done: false },
  { id: 't2', text: 'Schedule SOP training for horizontal line operators', owner: 'Ops Manager', dueDate: '2026-03-07', done: false },
  { id: 't3', text: 'Send follow-up to Apex Extrusions quote', owner: 'Sales', dueDate: '2026-03-04', done: true },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROCK_STATUS: Record<Rock['status'], { label: string; color: string }> = {
  on_track:  { label: 'On Track',  color: 'bg-accent-100 text-accent-700' },
  off_track: { label: 'Off Track', color: 'bg-red-100 text-red-700' },
  at_risk:   { label: 'At Risk',   color: 'bg-amber-100 text-amber-700' },
  complete:  { label: 'Complete',  color: 'bg-gray-100 text-gray-600' },
};

const ISSUE_PRIORITY: Record<Issue['priority'], string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
};

const ISSUE_STATUS: Record<Issue['status'], string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  resolved:    'bg-accent-100 text-accent-700',
};

function formatGoalValue(value: number, unit: string): string {
  if (unit === '$') return `$${value.toLocaleString()}`;
  return `${value}${unit === '%' ? '%' : ' ' + unit}`;
}

// ── Rocks Tab ────────────────────────────────────────────────────────────────

function RocksTab() {
  const [rocks, setRocks] = useState<Rock[]>(SEED_ROCKS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Rock>>({});
  const f = (k: keyof Rock, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const byDept = rocks.reduce<Record<string, Rock[]>>((acc, r) => {
    (acc[r.department] ??= []).push(r);
    return acc;
  }, {});

  function saveRock() {
    const rock: Rock = {
      id: generateId(), title: form.title ?? '', owner: form.owner ?? '',
      department: form.department ?? 'General', quarter: form.quarter ?? 'Q1 2026',
      dueDate: form.dueDate ?? '', progress: Number(form.progress ?? 0),
      status: (form.status as Rock['status']) ?? 'on_track',
      description: form.description ?? '',
    };
    setRocks(prev => [...prev, rock]);
    setForm({});
    setShowModal(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Quarterly Rocks</h3>
          <p className="text-xs text-gray-400 mt-0.5">3–7 most important company priorities this quarter</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} icon={<Plus size={13} />}>Add Rock</Button>
      </div>

      {Object.entries(byDept).map(([dept, deptRocks]) => (
        <div key={dept}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{dept}</div>
          <div className="space-y-3">
            {deptRocks.map(rock => (
              <Card key={rock.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">{rock.title}</span>
                      <Badge className={ROCK_STATUS[rock.status].color}>{ROCK_STATUS[rock.status].label}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mb-3">{rock.description}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={clsx('h-2 rounded-full transition-all', rock.status === 'off_track' ? 'bg-red-500' : rock.status === 'at_risk' ? 'bg-amber-500' : rock.status === 'complete' ? 'bg-accent-500' : 'bg-brand-500')}
                          style={{ width: `${rock.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-9 text-right">{rock.progress}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 text-xs text-gray-500">
                    <div className="font-semibold text-gray-700">{rock.owner}</div>
                    <div className="mt-0.5">{rock.quarter}</div>
                    <div className="text-gray-400">Due {rock.dueDate}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Rock" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={saveRock} disabled={!form.title}>Save Rock</Button></>}>
        <div className="space-y-3">
          <Input label="Rock Title *" value={form.title ?? ''} onChange={e => f('title', e.target.value)} placeholder="What must get done this quarter?" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Owner" value={form.owner ?? ''} onChange={e => f('owner', e.target.value)} />
            <Input label="Department" value={form.department ?? ''} onChange={e => f('department', e.target.value)} />
            <Input label="Quarter" value={form.quarter ?? 'Q1 2026'} onChange={e => f('quarter', e.target.value)} />
            <Input label="Due Date" type="date" value={form.dueDate ?? ''} onChange={e => f('dueDate', e.target.value)} />
            <Input label="Progress %" type="number" min={0} max={100} value={form.progress ?? 0} onChange={e => f('progress', e.target.value)} suffix="%" />
            <Select label="Status" value={form.status ?? 'on_track'} onChange={e => f('status', e.target.value)}>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="off_track">Off Track</option>
              <option value="complete">Complete</option>
            </Select>
          </div>
          <Textarea label="Description" rows={3} value={form.description ?? ''} onChange={e => f('description', e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

// ── Scorecard Tab ─────────────────────────────────────────────────────────────

function ScorecardTab() {
  const [rows, setRows] = useState<ScorecardRow[]>(SEED_SCORECARD);
  const weeks = ['W1', 'W2', 'W3', 'W4'];

  function getStatus(row: ScorecardRow): 'on_track' | 'off_track' | 'at_risk' {
    const latest = row.values[row.values.length - 1]?.value ?? 0;
    // For rework rate, lower is better
    const isLowerBetter = row.measurable.toLowerCase().includes('rework') || row.measurable.toLowerCase().includes('error');
    const ratio = isLowerBetter ? row.goal / latest : latest / row.goal;
    if (ratio >= 0.95) return 'on_track';
    if (ratio >= 0.85) return 'at_risk';
    return 'off_track';
  }

  const statusConfig = {
    on_track:  { icon: <TrendingUp size={13} className="text-accent-600" />,  label: 'On Track', cls: 'text-accent-600' },
    off_track: { icon: <TrendingDown size={13} className="text-red-500" />,    label: 'Off Track', cls: 'text-red-500' },
    at_risk:   { icon: <Minus size={13} className="text-amber-500" />,         label: 'At Risk',  cls: 'text-amber-500' },
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-800">Weekly Scorecard</h3>
        <p className="text-xs text-gray-400 mt-0.5">Track measurables weekly — every number has a goal and an owner</p>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-48">Measurable</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-28">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-20">Goal</th>
                {weeks.map(w => <th key={w} className="px-3 py-3 text-center text-xs font-bold text-gray-400 w-16">{w}</th>)}
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 w-24">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const status = getStatus(row);
                const sc = statusConfig[status];
                const latest = row.values[row.values.length - 1]?.value;
                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-xs text-gray-800">{row.measurable}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.owner}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{formatGoalValue(row.goal, row.unit)}</td>
                    {weeks.map(w => {
                      const entry = row.values.find(v => v.week === w);
                      const val = entry?.value;
                      return (
                        <td key={w} className="px-3 py-3 text-center text-xs">
                          {val !== undefined ? (
                            <span className={clsx('font-semibold', w === 'W4' ? sc.cls : 'text-gray-600')}>
                              {row.unit === '$' ? `$${(val / 1000).toFixed(0)}k` : `${val}${row.unit === '%' ? '%' : ''}`}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className={clsx('flex items-center justify-center gap-1 text-xs font-semibold', sc.cls)}>
                        {sc.icon} {sc.label}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Issues Tab ────────────────────────────────────────────────────────────────

function IssuesTab() {
  const [issues, setIssues] = useState<Issue[]>(SEED_ISSUES);
  const [filter, setFilter] = useState<'all' | Issue['status']>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Issue>>({});
  const f = (k: keyof Issue, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter);

  function saveIssue() {
    const issue: Issue = {
      id: generateId(), title: form.title ?? '', description: form.description ?? '',
      owner: form.owner ?? '', priority: (form.priority as Issue['priority']) ?? 'medium',
      status: 'open', createdAt: new Date().toISOString().split('T')[0],
    };
    setIssues(prev => [...prev, issue]);
    setForm({});
    setShowModal(false);
  }

  function advance(id: string) {
    setIssues(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next: Issue['status'] = i.status === 'open' ? 'in_progress' : 'resolved';
      return { ...i, status: next, resolvedAt: next === 'resolved' ? new Date().toISOString().split('T')[0] : undefined };
    }));
  }

  const counts = { open: issues.filter(i => i.status === 'open').length, in_progress: issues.filter(i => i.status === 'in_progress').length, resolved: issues.filter(i => i.status === 'resolved').length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Issues List (IDS)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Identify · Discuss · Solve — never leave an issue unresolved</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['all','open','in_progress','resolved'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} className={clsx('px-3 py-1.5 font-semibold transition-colors border-r border-gray-200 last:border-0', filter === s ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {s === 'all' ? `All (${issues.length})` : s === 'in_progress' ? `Active (${counts.in_progress})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowModal(true)} icon={<Plus size={13} />}>Add Issue</Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <div className="text-center py-10 text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No issues — great work!</p>
            </div>
          </Card>
        )}
        {filtered.map(issue => (
          <Card key={issue.id}>
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className={clsx('mt-0.5 flex-shrink-0', issue.priority === 'high' ? 'text-red-500' : issue.priority === 'medium' ? 'text-amber-500' : 'text-gray-400')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{issue.title}</span>
                  <Badge className={ISSUE_PRIORITY[issue.priority]}>{issue.priority}</Badge>
                  <Badge className={ISSUE_STATUS[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-2">{issue.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Owner: <strong className="text-gray-600">{issue.owner}</strong></span>
                  <span>Opened: {issue.createdAt}</span>
                  {issue.resolvedAt && <span className="text-accent-600">Resolved: {issue.resolvedAt}</span>}
                </div>
              </div>
              {issue.status !== 'resolved' && (
                <Button size="sm" variant="secondary" onClick={() => advance(issue.id)}>
                  {issue.status === 'open' ? 'Start IDS' : 'Resolve'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Issue" size="md"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={saveIssue} disabled={!form.title}>Add Issue</Button></>}>
        <div className="space-y-3">
          <Input label="Issue *" value={form.title ?? ''} onChange={e => f('title', e.target.value)} placeholder="Describe the issue in one line" />
          <Textarea label="Detail" rows={3} value={form.description ?? ''} onChange={e => f('description', e.target.value)} placeholder="What is happening, why does it matter?" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Owner" value={form.owner ?? ''} onChange={e => f('owner', e.target.value)} />
            <Select label="Priority" value={form.priority ?? 'medium'} onChange={e => f('priority', e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── L10 Meeting Tab ───────────────────────────────────────────────────────────

function L10Tab() {
  const [todos, setTodos] = useState<L10Todo[]>(SEED_TODOS);
  const [newTodo, setNewTodo] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newDue, setNewDue] = useState('');
  const [segueTimer, setSegueTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  React.useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setSegueTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function addTodo() {
    if (!newTodo.trim()) return;
    setTodos(prev => [...prev, { id: generateId(), text: newTodo, owner: newOwner, dueDate: newDue, done: false }]);
    setNewTodo(''); setNewOwner(''); setNewDue('');
  }

  const AGENDA = [
    { time: '5 min',  item: 'Segue',              desc: 'Personal & professional good news' },
    { time: '5 min',  item: 'Scorecard Review',   desc: 'Review measurables — identify off-track items as Issues' },
    { time: '5 min',  item: 'Rock Review',         desc: 'Each rock owner reports on-track / off-track' },
    { time: '5 min',  item: 'Customer Headlines',  desc: 'Good news & bad news from customers and employees' },
    { time: '5 min',  item: 'To-Do List Review',   desc: 'Review last week\'s to-dos — done or not done' },
    { time: '60 min', item: 'IDS',                 desc: 'Identify, Discuss, Solve issues from the list' },
    { time: '5 min',  item: 'Conclude',            desc: 'Cascading messages, rating the meeting 1–10' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Level 10 Meeting Agenda</h3>
          <p className="text-xs text-gray-400 mt-0.5">90 minutes · Same time, same day, every week · Rate it 10 or fix it</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="font-mono text-lg font-bold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200">
            {formatTime(segueTimer)}
          </div>
          <Button size="sm" variant={timerRunning ? 'danger' : 'accent'} onClick={() => setTimerRunning(t => !t)}>
            {timerRunning ? 'Pause' : 'Start Timer'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setSegueTimer(0); setTimerRunning(false); }}>Reset</Button>
        </div>
      </div>

      {/* Agenda */}
      <Card padding={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 w-16">Time</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-400">Agenda Item</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-400">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {AGENDA.map(a => (
              <tr key={a.item} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-bold text-brand-600 whitespace-nowrap">{a.time}</td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-800">{a.item}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{a.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* To-do list */}
      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-3">To-Do List (7-day actions)</h4>
        <div className="space-y-2 mb-3">
          {todos.map(todo => (
            <div key={todo.id} className={clsx('flex items-center gap-3 p-3 rounded-xl border transition-all', todo.done ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200')}>
              <input type="checkbox" checked={todo.done} onChange={() => setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))} className="w-4 h-4 rounded border-gray-300 accent-accent-500" />
              <span className={clsx('flex-1 text-sm', todo.done && 'line-through text-gray-400')}>{todo.text}</span>
              <span className="text-xs text-gray-500">{todo.owner}</span>
              {todo.dueDate && <span className="text-xs text-gray-400 font-medium">{todo.dueDate}</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400" placeholder="New to-do item…" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTodo(); }} />
          <input className="w-28 rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400" placeholder="Owner" value={newOwner} onChange={e => setNewOwner(e.target.value)} />
          <input type="date" className="w-36 rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400" value={newDue} onChange={e => setNewDue(e.target.value)} />
          <Button size="sm" onClick={addTodo} disabled={!newTodo.trim()} icon={<Plus size={13} />}>Add</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────

const TABS: { id: EOSTab; label: string; icon: React.ReactNode }[] = [
  { id: 'rocks',     label: 'Rocks',     icon: <Target size={15} /> },
  { id: 'scorecard', label: 'Scorecard', icon: <BarChart2 size={15} /> },
  { id: 'issues',    label: 'Issues',    icon: <AlertCircle size={15} /> },
  { id: 'l10',       label: 'L10 Meeting', icon: <Users size={15} /> },
];

export function EOS() {
  const [tab, setTab] = useState<EOSTab>('rocks');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div data-tour="eos-header" className="bg-brand-gradient text-white rounded-xl px-5 py-4 shadow-brand">
        <div className="flex items-center gap-3">
          <Target size={22} />
          <div>
            <div className="font-bold tracking-tight">EOS Operating System</div>
            <div className="text-white/60 text-xs mt-0.5">Rocks · Scorecard · Issues · Level 10 Meetings</div>
          </div>
          <div className="ml-auto"><GuidedTourButton steps={EOS_TOUR} /></div>
        </div>
      </div>

      {/* Tabs */}
      <div data-tour="eos-tabs" className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div data-tour="eos-content">
        {tab === 'rocks'     && <RocksTab />}
        {tab === 'scorecard' && <ScorecardTab />}
        {tab === 'issues'    && <IssuesTab />}
        {tab === 'l10'       && <L10Tab />}
      </div>
    </div>
  );
}
