import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Wrench, Plus, X, ChevronDown,
  ChevronRight, Flag, RotateCcw, Settings2,
} from 'lucide-react';
import { clsx, generateId } from '../../utils';
import { useApp } from '../../context/AppContext';
import type {
  CostEntry, CostCategory, MaintenanceSchedule, MaintenanceScheduleStatus,
} from '../../types';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<CostCategory, { label: string; color: string; bg: string }> = {
  material:  { label: 'Material',  color: 'text-blue-400',   bg: 'bg-blue-900/30'   },
  labor:     { label: 'Labor',     color: 'text-purple-400', bg: 'bg-purple-900/30' },
  overhead:  { label: 'Overhead',  color: 'text-gray-400',   bg: 'bg-gray-800/60'   },
  rework:    { label: 'Rework',    color: 'text-red-400',    bg: 'bg-red-900/30'    },
  other:     { label: 'Other',     color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
};

const MAINT_STATUS: Record<MaintenanceScheduleStatus, { label: string; color: string; dot: string }> = {
  ok:        { label: 'OK',        color: 'text-green-400',  dot: 'bg-green-400'  },
  due_soon:  { label: 'Due Soon',  color: 'text-yellow-400', dot: 'bg-yellow-400' },
  overdue:   { label: 'Overdue',   color: 'text-red-400',    dot: 'bg-red-400'    },
};

const EQUIPMENT_OPTIONS = [
  { id: 'e1', name: 'Horizontal Powder Line' },
  { id: 'e2', name: 'Batch Powder Line' },
  { id: 'e3', name: 'Blast Cabinet' },
  { id: 'e4', name: 'Extrusion Sub Oven' },
  { id: 'e5', name: 'Panel Sub Oven' },
  { id: 'e6', name: 'Wash System' },
  { id: 'e7', name: 'Vertical Powder Line' },
];

type TabId = 'job-costing' | 'variance' | 'overhead' | 'maintenance';

// ── Helper functions ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n);
}

function pct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

// ── Tab: Job Costing ─────────────────────────────────────────────────────────

function JobCostingTab() {
  const { state, dispatch } = useApp();
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    category: 'material' as CostCategory,
    subcategory: '',
    description: '',
    plannedAmount: '',
    actualAmount: '',
    createdByName: 'Admin',
  });

  const selectedJob = state.jobs.find(j => j.id === selectedJobId);
  const jobEntries = state.costEntries.filter(e => e.jobId === selectedJobId);

  // Aggregate by category for the selected job
  const categoryTotals = useMemo(() => {
    const cats = Object.keys(CATEGORY_CONFIG) as CostCategory[];
    return cats.map(cat => {
      const entries = jobEntries.filter(e => e.category === cat);
      const planned = entries.reduce((s, e) => s + e.plannedAmount, 0);
      const actual  = entries.reduce((s, e) => s + e.actualAmount,  0);
      return { cat, entries, planned, actual, variance: actual - planned };
    });
  }, [jobEntries]);

  const totalPlanned = jobEntries.reduce((s, e) => s + e.plannedAmount, 0);
  const totalActual  = jobEntries.reduce((s, e) => s + e.actualAmount, 0);
  const totalVar     = totalActual - totalPlanned;

  function handleAddEntry() {
    if (!selectedJobId || !form.description || !form.plannedAmount) return;
    const planned = parseFloat(form.plannedAmount) || 0;
    const actual  = parseFloat(form.actualAmount)  || 0;
    const variance = actual - planned;
    const variancePct = planned !== 0 ? (variance / planned) * 100 : 0;
    const entry: CostEntry = {
      id: generateId(),
      jobId: selectedJobId,
      jobNumber: selectedJob?.jobNumber ?? '',
      customerName: selectedJob?.customerName ?? '',
      category: form.category,
      subcategory: form.subcategory || undefined,
      description: form.description,
      plannedAmount: planned,
      actualAmount: actual,
      variance,
      variancePct,
      flagged: Math.abs(variancePct) > 20,
      flagReason: Math.abs(variancePct) > 20 ? 'Auto-flagged: variance > 20%' : undefined,
      correctionStatus: Math.abs(variancePct) > 20 ? 'open' : undefined,
      createdById: 'user_1',
      createdByName: form.createdByName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_COST_ENTRY', payload: entry });
    setShowAddForm(false);
    setForm({ category: 'material', subcategory: '', description: '', plannedAmount: '', actualAmount: '', createdByName: 'Admin' });
  }

  function handleFlagToggle(entry: CostEntry) {
    dispatch({
      type: 'UPDATE_COST_ENTRY',
      payload: { ...entry, flagged: !entry.flagged, updatedAt: new Date().toISOString() },
    });
  }

  function handleCorrectionStatus(entry: CostEntry, status: 'open' | 'in_progress' | 'resolved') {
    dispatch({
      type: 'UPDATE_COST_ENTRY',
      payload: { ...entry, correctionStatus: status, updatedAt: new Date().toISOString() },
    });
  }

  return (
    <div className="space-y-5">
      {/* Job selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-400 whitespace-nowrap">Select Job:</label>
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm flex-1 max-w-xs outline-none focus:border-brand-500"
        >
          <option value="">— pick a job —</option>
          {state.jobs.map(j => (
            <option key={j.id} value={j.id}>{j.jobNumber} · {j.customerName}</option>
          ))}
        </select>
        {selectedJobId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
          >
            <Plus size={14} /> Add Entry
          </button>
        )}
      </div>

      {!selectedJobId ? (
        <div className="text-center text-gray-600 py-16 text-sm">Select a job to view cost breakdown</div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Planned Cost', value: fmt(totalPlanned), color: 'text-gray-200' },
              { label: 'Actual Cost',  value: fmt(totalActual),  color: 'text-gray-200' },
              {
                label: 'Variance',
                value: fmt(totalVar),
                color: totalVar > 0 ? 'text-red-400' : totalVar < 0 ? 'text-green-400' : 'text-gray-400',
              },
            ].map(card => (
              <div key={card.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className={clsx('text-2xl font-bold', card.color)}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {categoryTotals.map(({ cat, entries, planned, actual, variance }) => {
            if (planned === 0 && actual === 0 && entries.length === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            const isExpanded = expandedEntry === cat;
            const varPct = planned !== 0 ? (variance / planned) * 100 : 0;
            return (
              <div key={cat} className={clsx('rounded-xl border border-gray-700 overflow-hidden', cfg.bg)}>
                <button
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedEntry(isExpanded ? null : cat)}
                >
                  <span className={clsx('text-xs font-bold uppercase tracking-wide w-20', cfg.color)}>{cfg.label}</span>
                  <span className="text-sm text-gray-400 flex-1 text-left">{entries.length} entries</span>
                  <span className="text-sm text-gray-300 w-24 text-right">{fmt(planned)}</span>
                  <span className="text-sm text-gray-200 font-semibold w-24 text-right">{fmt(actual)}</span>
                  <span className={clsx('text-sm font-bold w-24 text-right', variance > 0 ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-gray-500')}>
                    {variance !== 0 ? pct(varPct) : '—'}
                  </span>
                  {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                </button>
                {isExpanded && entries.length > 0 && (
                  <div className="border-t border-gray-700/60 divide-y divide-gray-700/40">
                    {entries.map(entry => {
                      const eVarPct = entry.plannedAmount !== 0 ? (entry.variance / entry.plannedAmount) * 100 : 0;
                      return (
                        <div key={entry.id} className={clsx('px-5 py-3 flex items-start gap-4', entry.flagged && 'bg-red-950/20')}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-white truncate">{entry.description}</span>
                              {entry.subcategory && <span className="text-xs text-gray-500 bg-gray-700 rounded px-1.5">{entry.subcategory}</span>}
                              {entry.flagged && <Flag size={11} className="text-red-400 flex-shrink-0" />}
                            </div>
                            {entry.flagged && entry.flagReason && (
                              <div className="text-xs text-red-400 mb-1">{entry.flagReason}</div>
                            )}
                            {entry.flagged && entry.correctionStatus && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">Correction:</span>
                                {(['open', 'in_progress', 'resolved'] as const).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleCorrectionStatus(entry, s)}
                                    className={clsx(
                                      'text-xs px-2 py-0.5 rounded-full border transition-colors',
                                      entry.correctionStatus === s
                                        ? s === 'resolved' ? 'bg-green-700 border-green-600 text-green-200'
                                          : s === 'in_progress' ? 'bg-yellow-700 border-yellow-600 text-yellow-200'
                                          : 'bg-red-800 border-red-700 text-red-200'
                                        : 'border-gray-700 text-gray-500 hover:border-gray-500',
                                    )}
                                  >
                                    {s.replace('_', ' ')}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                            <div className="text-right">
                              <div className="text-gray-500 text-xs">Planned</div>
                              <div className="text-gray-300">{fmt(entry.plannedAmount)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-gray-500 text-xs">Actual</div>
                              <div className="text-white font-semibold">{fmt(entry.actualAmount)}</div>
                            </div>
                            <div className={clsx('text-right w-16', entry.variance > 0 ? 'text-red-400' : entry.variance < 0 ? 'text-green-400' : 'text-gray-500')}>
                              <div className="text-xs">Var</div>
                              <div className="font-bold">{pct(eVarPct)}</div>
                            </div>
                            <button
                              onClick={() => handleFlagToggle(entry)}
                              className={clsx('p-1 rounded hover:bg-white/10 transition-colors', entry.flagged ? 'text-red-400' : 'text-gray-600 hover:text-red-400')}
                              title={entry.flagged ? 'Remove flag' : 'Flag this entry'}
                            >
                              <Flag size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {jobEntries.length === 0 && !showAddForm && (
            <div className="text-center text-gray-600 py-8 text-sm">No cost entries yet — click "Add Entry" to start tracking</div>
          )}
        </>
      )}

      {/* Add entry form */}
      {showAddForm && selectedJob && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-lg font-bold text-white">Add Cost Entry</div>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">{selectedJob.jobNumber} · {selectedJob.customerName}</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as CostCategory }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500">
                  {(Object.keys(CATEGORY_CONFIG) as CostCategory[]).map(c => (
                    <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subcategory (optional)</label>
                <input value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                  placeholder="e.g. Powder, Primer, Masking…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description *</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What is this cost?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Planned Amount ($)</label>
                  <input type="number" step="0.01" value={form.plannedAmount} onChange={e => setForm(f => ({ ...f, plannedAmount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Actual Amount ($)</label>
                  <input type="number" step="0.01" value={form.actualAmount} onChange={e => setForm(f => ({ ...f, actualAmount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Added by</label>
                <input value={form.createdByName} onChange={e => setForm(f => ({ ...f, createdByName: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleAddEntry} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2 text-sm font-medium transition-colors">Add Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Variance Analysis ───────────────────────────────────────────────────

function VarianceTab() {
  const { state } = useApp();
  const [filterCat, setFilterCat] = useState<CostCategory | 'all'>('all');
  const [filterFlag, setFilterFlag] = useState<'all' | 'flagged' | 'ok'>('all');

  const filtered = state.costEntries.filter(e => {
    if (filterCat !== 'all' && e.category !== filterCat) return false;
    if (filterFlag === 'flagged' && !e.flagged) return false;
    if (filterFlag === 'ok' && e.flagged) return false;
    return true;
  });

  // Sort by absolute variance descending
  const sorted = [...filtered].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  // Department rollup
  const catRollup = (Object.keys(CATEGORY_CONFIG) as CostCategory[]).map(cat => {
    const entries = state.costEntries.filter(e => e.category === cat);
    const planned = entries.reduce((s, e) => s + e.plannedAmount, 0);
    const actual  = entries.reduce((s, e) => s + e.actualAmount,  0);
    const variance = actual - planned;
    const varPct = planned !== 0 ? (variance / planned) * 100 : 0;
    const flagged = entries.filter(e => e.flagged).length;
    return { cat, planned, actual, variance, varPct, flagged, count: entries.length };
  });

  return (
    <div className="space-y-6">
      {/* Category rollup cards */}
      <div className="grid grid-cols-5 gap-3">
        {catRollup.map(({ cat, planned, actual, variance, varPct, flagged, count }) => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <div key={cat} className={clsx('rounded-xl border border-gray-700 p-4', cfg.bg)}>
              <div className={clsx('text-xs font-bold uppercase tracking-wide mb-2', cfg.color)}>{cfg.label}</div>
              <div className="text-xl font-black text-white">{fmt(actual)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Planned: {fmt(planned)}</div>
              <div className={clsx('text-sm font-bold mt-1', variance > 0 ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-gray-500')}>
                {variance !== 0 ? pct(varPct) : 'On budget'}
              </div>
              {flagged > 0 && <div className="text-xs text-red-400 mt-1 flex items-center gap-1"><Flag size={10} /> {flagged} flagged</div>}
              <div className="text-xs text-gray-600 mt-0.5">{count} entries</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value as CostCategory | 'all')}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-brand-500">
          <option value="all">All Categories</option>
          {(Object.keys(CATEGORY_CONFIG) as CostCategory[]).map(c => (
            <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
          ))}
        </select>
        <select value={filterFlag} onChange={e => setFilterFlag(e.target.value as 'all' | 'flagged' | 'ok')}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-brand-500">
          <option value="all">All Entries</option>
          <option value="flagged">Flagged Only</option>
          <option value="ok">No Flag</option>
        </select>
        <span className="text-xs text-gray-500">{sorted.length} entries</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Job</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Planned</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actual</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Variance</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-600 py-10">No cost entries found</td></tr>
            ) : sorted.map(entry => {
              const cfg = CATEGORY_CONFIG[entry.category];
              return (
                <tr key={entry.id} className={clsx('hover:bg-gray-800/50 transition-colors', entry.flagged && 'bg-red-950/10')}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{entry.jobNumber}</div>
                    <div className="text-xs text-gray-500">{entry.customerName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-200">{entry.description}</div>
                    {entry.subcategory && <div className="text-xs text-gray-500">{entry.subcategory}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmt(entry.plannedAmount)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(entry.actualAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className={clsx('font-bold', entry.variance > 0 ? 'text-red-400' : entry.variance < 0 ? 'text-green-400' : 'text-gray-500')}>
                      {entry.variance !== 0 ? pct(entry.variancePct) : '—'}
                    </div>
                    <div className={clsx('text-xs', entry.variance > 0 ? 'text-red-500' : 'text-green-500')}>
                      {entry.variance > 0 ? '+' : ''}{fmt(entry.variance)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {entry.flagged ? (
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs text-red-400"><Flag size={10} /> Flagged</span>
                        {entry.correctionStatus && (
                          <span className={clsx(
                            'text-xs px-2 py-0.5 rounded-full w-fit',
                            entry.correctionStatus === 'resolved' ? 'bg-green-900/50 text-green-400'
                              : entry.correctionStatus === 'in_progress' ? 'bg-yellow-900/50 text-yellow-400'
                              : 'bg-red-900/50 text-red-400',
                          )}>
                            {entry.correctionStatus.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 size={10} /> OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Overhead Rates (read-only config display) ───────────────────────────

function OverheadTab() {
  // Static sample overhead rates for display (in a real app these would be in state)
  const sampleRates = [
    { id: '1', name: 'Facility Rent',       category: 'Facilities', monthlyAmount: 8500,  allocationMethod: 'per_labor_hour', rate: 4.25, active: true, notes: 'Monthly lease divided by avg 2000 hours' },
    { id: '2', name: 'Utilities',           category: 'Facilities', monthlyAmount: 1800,  allocationMethod: 'per_labor_hour', rate: 0.90, active: true, notes: 'Electricity, gas, water' },
    { id: '3', name: 'Insurance',           category: 'Admin',      monthlyAmount: 650,   allocationMethod: 'per_job',        rate: 6.50, active: true, notes: 'Commercial liability + property' },
    { id: '4', name: 'Equipment Deprec.',   category: 'Equipment',  monthlyAmount: 2200,  allocationMethod: 'per_labor_hour', rate: 1.10, active: true, notes: 'Ovens, guns, blast cabinet SL depreciation' },
    { id: '5', name: 'Admin Salaries',      category: 'Admin',      monthlyAmount: 5500,  allocationMethod: 'per_labor_hour', rate: 2.75, active: true, notes: 'Office and management overhead' },
    { id: '6', name: 'Sales Commission',    category: 'Sales',      monthlyAmount: 0,     allocationMethod: 'percentage_of_sale', rate: 5.0, active: true, notes: '5% of sale price on commissioned jobs' },
    { id: '7', name: 'Waste Disposal',      category: 'Operations', monthlyAmount: 320,   allocationMethod: 'per_job',        rate: 3.20, active: true, notes: 'Chemical waste disposal and environmental fees' },
    { id: '8', name: 'Software / ERP',      category: 'Admin',      monthlyAmount: 150,   allocationMethod: 'per_job',        rate: 1.50, active: false, notes: 'CoatPro ERP subscription' },
  ];

  const totalMonthly = sampleRates.filter(r => r.active).reduce((s, r) => s + r.monthlyAmount, 0);

  const methodLabel: Record<string, string> = {
    per_labor_hour:     'Per Labor Hour',
    per_job:            'Per Job',
    percentage_of_sale: '% of Sale',
    per_sq_ft:          'Per Sq Ft',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Total active monthly overhead</div>
          <div className="text-3xl font-black text-white">{fmt(totalMonthly)}<span className="text-gray-500 text-base font-normal">/mo</span></div>
        </div>
        <div className="text-xs text-gray-600 max-w-xs text-right">
          Overhead rates define how indirect costs are allocated to jobs. Configure these with your accountant.
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Monthly</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Method</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sampleRates.map(rate => (
              <tr key={rate.id} className={clsx('hover:bg-gray-800/40 transition-colors', !rate.active && 'opacity-40')}>
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{rate.name}</div>
                  {rate.notes && <div className="text-xs text-gray-500">{rate.notes}</div>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{rate.category}</td>
                <td className="px-4 py-3 text-right text-gray-300">{rate.monthlyAmount > 0 ? fmt(rate.monthlyAmount) : '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{methodLabel[rate.allocationMethod]}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">
                  {rate.allocationMethod === 'percentage_of_sale' ? `${rate.rate}%` : fmt(rate.rate)}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', rate.active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-600')}>
                    {rate.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-600 text-center">
        Contact your system administrator to modify overhead rates. Changes take effect on the next billing period.
      </div>
    </div>
  );
}

// ── Tab: Maintenance Schedules ───────────────────────────────────────────────

function MaintenanceTab() {
  const { state, dispatch } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultForm = {
    equipmentId: 'e1',
    equipmentName: 'Horizontal Powder Line',
    taskName: '',
    description: '',
    intervalHours: '',
    intervalDays: '',
    currentHours: '0',
    warnWithinHours: '10',
    warnWithinDays: '7',
    assignedToName: '',
  };
  const [form, setForm] = useState(defaultForm);

  // Compute status from session hours for each schedule
  const schedulesWithStatus = useMemo((): MaintenanceSchedule[] => {
    return state.maintenanceSchedules.map(sched => {
      // Accumulate hours from completed workstation sessions for this equipment
      const sessionHours = state.workstationSessions
        .filter(s => s.equipmentId === sched.equipmentId && s.status === 'completed' && s.durationMinutes)
        .reduce((sum, s) => sum + ((s.durationMinutes ?? 0) / 60), 0);
      const currentHours = sched.currentHours + sessionHours;

      let computedStatus: MaintenanceScheduleStatus = 'ok';
      if (sched.nextDueHours !== undefined) {
        const remaining = sched.nextDueHours - currentHours;
        if (remaining <= 0) computedStatus = 'overdue';
        else if (remaining <= (sched.warnWithinHours ?? 10)) computedStatus = 'due_soon';
      }
      if (sched.nextDueDateCalc) {
        const daysRemaining = Math.ceil(
          (new Date(sched.nextDueDateCalc).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        if (daysRemaining <= 0) computedStatus = 'overdue';
        else if (daysRemaining <= (sched.warnWithinDays ?? 7) && computedStatus !== 'overdue') computedStatus = 'due_soon';
      }
      return { ...sched, currentHours, status: computedStatus };
    });
  }, [state.maintenanceSchedules, state.workstationSessions]);

  function computeNextDue(f: typeof form) {
    const h = parseFloat(f.intervalHours) || 0;
    const d = parseFloat(f.intervalDays) || 0;
    const lastDate = new Date().toISOString().split('T')[0];
    return {
      nextDueHours: h > 0 ? (parseFloat(f.currentHours) || 0) + h : undefined,
      nextDueDateCalc: d > 0 ? new Date(Date.now() + d * 86400000).toISOString().split('T')[0] : undefined,
      lastServiceDate: lastDate,
    };
  }

  function handleSave() {
    if (!form.taskName.trim()) return;
    const eqOpt = EQUIPMENT_OPTIONS.find(e => e.id === form.equipmentId);
    const { nextDueHours, nextDueDateCalc, lastServiceDate } = computeNextDue(form);
    const intervalHours = parseFloat(form.intervalHours) || undefined;
    const intervalDays  = parseFloat(form.intervalDays)  || undefined;

    const schedule: MaintenanceSchedule = {
      id: editingId ?? generateId(),
      equipmentId: form.equipmentId,
      equipmentName: eqOpt?.name ?? form.equipmentId,
      taskName: form.taskName,
      description: form.description || undefined,
      intervalHours,
      intervalDays,
      currentHours: parseFloat(form.currentHours) || 0,
      lastServiceDate,
      nextDueHours,
      nextDueDateCalc,
      status: 'ok',
      warnWithinHours: parseFloat(form.warnWithinHours) || 10,
      warnWithinDays: parseFloat(form.warnWithinDays) || 7,
      assignedToName: form.assignedToName || undefined,
      notifyUserIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (editingId) {
      dispatch({ type: 'UPDATE_MAINTENANCE_SCHEDULE', payload: schedule });
    } else {
      dispatch({ type: 'ADD_MAINTENANCE_SCHEDULE', payload: schedule });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm);
  }

  function handleMarkServiced(sched: MaintenanceSchedule) {
    const { nextDueHours, nextDueDateCalc, lastServiceDate } = computeNextDue({
      ...form,
      equipmentId: sched.equipmentId,
      intervalHours: String(sched.intervalHours ?? ''),
      intervalDays: String(sched.intervalDays ?? ''),
      currentHours: String(sched.currentHours),
    });
    dispatch({
      type: 'UPDATE_MAINTENANCE_SCHEDULE',
      payload: {
        ...sched,
        lastServiceDate,
        lastServiceHours: sched.currentHours,
        nextDueHours,
        nextDueDateCalc,
        status: 'ok',
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          {(['ok', 'due_soon', 'overdue'] as MaintenanceScheduleStatus[]).map(s => {
            const count = schedulesWithStatus.filter(sc => sc.status === s).length;
            const cfg = MAINT_STATUS[s];
            return (
              <span key={s} className="flex items-center gap-1.5 text-gray-400">
                <span className={clsx('w-2 h-2 rounded-full', cfg.dot)} />
                <span className={cfg.color}>{cfg.label}:</span>
                <span className="text-white font-bold">{count}</span>
              </span>
            );
          })}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); }}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
        >
          <Plus size={14} /> Add Schedule
        </button>
      </div>

      {schedulesWithStatus.length === 0 ? (
        <div className="text-center text-gray-600 py-16 text-sm">
          No maintenance schedules yet.<br />
          <span className="text-gray-700">Add schedules to track equipment service intervals and receive reminders.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {schedulesWithStatus
            .sort((a, b) => {
              const order = { overdue: 0, due_soon: 1, ok: 2 };
              return order[a.status] - order[b.status];
            })
            .map(sched => {
              const cfg = MAINT_STATUS[sched.status];
              const hoursRemaining = sched.nextDueHours !== undefined
                ? sched.nextDueHours - sched.currentHours : null;
              return (
                <div
                  key={sched.id}
                  className={clsx(
                    'rounded-xl border-2 p-4 flex items-start gap-4',
                    sched.status === 'overdue'  ? 'border-red-700 bg-red-950/20'
                    : sched.status === 'due_soon' ? 'border-yellow-700 bg-yellow-950/20'
                    : 'border-gray-700 bg-gray-800/50',
                  )}
                >
                  <div className="flex-shrink-0 pt-1">
                    <div className={clsx('w-3 h-3 rounded-full', cfg.dot)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="font-bold text-white">{sched.taskName}</span>
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full ml-auto flex-shrink-0',
                        sched.status === 'overdue'  ? 'bg-red-800 text-red-200'
                        : sched.status === 'due_soon' ? 'bg-yellow-800 text-yellow-200'
                        : 'bg-gray-700 text-gray-300',
                      )}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 font-medium">{sched.equipmentName}</div>
                    {sched.description && <div className="text-xs text-gray-500 mt-0.5">{sched.description}</div>}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                      <span>Current hours: <span className="text-gray-300">{sched.currentHours.toFixed(1)}h</span></span>
                      {sched.intervalHours && <span>Interval: <span className="text-gray-300">every {sched.intervalHours}h</span></span>}
                      {sched.intervalDays  && <span>Interval: <span className="text-gray-300">every {sched.intervalDays}d</span></span>}
                      {hoursRemaining !== null && (
                        <span className={clsx(hoursRemaining < 0 ? 'text-red-400' : hoursRemaining < 10 ? 'text-yellow-400' : 'text-gray-300')}>
                          {hoursRemaining < 0 ? `${Math.abs(hoursRemaining).toFixed(1)}h overdue` : `${hoursRemaining.toFixed(1)}h remaining`}
                        </span>
                      )}
                      {sched.nextDueDateCalc && (
                        <span>Due date: <span className="text-gray-300">{format(new Date(sched.nextDueDateCalc + 'T00:00:00'), 'MMM d, yyyy')}</span></span>
                      )}
                      {sched.assignedToName && <span>Assigned: <span className="text-gray-300">{sched.assignedToName}</span></span>}
                      {sched.lastServiceDate && <span>Last service: <span className="text-gray-300">{format(new Date(sched.lastServiceDate + 'T00:00:00'), 'MMM d, yyyy')}</span></span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-2">
                    <button
                      onClick={() => handleMarkServiced(sched)}
                      className="flex items-center gap-1 text-xs bg-green-800/60 hover:bg-green-700/60 text-green-300 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      <RotateCcw size={11} /> Mark Serviced
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_MAINTENANCE_SCHEDULE', payload: sched.id })}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      <X size={11} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-lg font-bold text-white">{editingId ? 'Edit' : 'Add'} Maintenance Schedule</div>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Equipment *</label>
                <select value={form.equipmentId}
                  onChange={e => {
                    const eq = EQUIPMENT_OPTIONS.find(o => o.id === e.target.value);
                    setForm(f => ({ ...f, equipmentId: e.target.value, equipmentName: eq?.name ?? '' }));
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500">
                  {EQUIPMENT_OPTIONS.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Task Name *</label>
                <input value={form.taskName} onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))}
                  placeholder="e.g. Clean spray guns, Inspect conveyor chain…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="What needs to be done?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none outline-none focus:border-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Interval (hours)</label>
                  <input type="number" value={form.intervalHours} onChange={e => setForm(f => ({ ...f, intervalHours: e.target.value }))}
                    placeholder="e.g. 100"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Interval (days)</label>
                  <input type="number" value={form.intervalDays} onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value }))}
                    placeholder="e.g. 30"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Current hours on unit</label>
                  <input type="number" value={form.currentHours} onChange={e => setForm(f => ({ ...f, currentHours: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Warn within (hours)</label>
                  <input type="number" value={form.warnWithinHours} onChange={e => setForm(f => ({ ...f, warnWithinHours: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assigned to</label>
                <input value={form.assignedToName} onChange={e => setForm(f => ({ ...f, assignedToName: e.target.value }))}
                  placeholder="Technician or supervisor name"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2 text-sm font-medium transition-colors">Save Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'job-costing', label: 'Job Costing',       icon: <DollarSign size={15} /> },
  { id: 'variance',    label: 'Variance Analysis',  icon: <TrendingDown size={15} /> },
  { id: 'overhead',    label: 'Overhead Rates',     icon: <Settings2 size={15} /> },
  { id: 'maintenance', label: 'Maintenance',        icon: <Wrench size={15} /> },
];

const COSTING_TOUR: TourStep[] = [
  { selector: '[data-tour="cost-alerts"]', title: 'Cost Alerts',        why: 'Flagged cost issues and overdue maintenance are highlighted so you can act before they grow.',   what: 'Red badges mean items need immediate attention. Click through to the relevant tab to investigate.' },
  { selector: '[data-tour="cost-tabs"]',   title: 'Analysis Tabs',      why: 'Separates job costing, variance analysis, overhead rates, and maintenance cost tracking.',     what: 'Start with Job Costing to see per-job profitability. Use Variance to spot cost overruns.' },
  { selector: '[data-tour="cost-content"]',title: 'Tab Content',        why: 'Each tab shows detailed tables and charts for that costing area.',                              what: 'Filter, sort, and flag entries. Flagged items appear in the alerts badge above.' },
];

export function Costing() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('job-costing');

  const overdueCount = state.maintenanceSchedules.filter(s => s.status === 'overdue').length;
  const dueSoonCount = state.maintenanceSchedules.filter(s => s.status === 'due_soon').length;
  const flaggedCount = state.costEntries.filter(e => e.flagged && e.correctionStatus !== 'resolved').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 bg-gray-950 rounded-2xl">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">Costing & Analysis <GuidedTourButton steps={COSTING_TOUR} /></h1>
          <p className="text-gray-400 text-sm mt-0.5">Track costs, analyse variances, manage overhead and equipment maintenance</p>
        </div>
        <div data-tour="cost-alerts" className="flex gap-3">
          {flaggedCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
              <Flag size={12} /> {flaggedCount} cost issues open
            </div>
          )}
          {(overdueCount > 0 || dueSoonCount > 0) && (
            <div className={clsx(
              'flex items-center gap-1.5 border rounded-lg px-3 py-2 text-xs',
              overdueCount > 0
                ? 'bg-red-900/40 border-red-700/50 text-red-300'
                : 'bg-yellow-900/40 border-yellow-700/50 text-yellow-300',
            )}>
              <Wrench size={12} />
              {overdueCount > 0 ? `${overdueCount} maintenance overdue` : `${dueSoonCount} due soon`}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div data-tour="cost-tabs" className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {TABS.map(tab => {
          const hasBadge = (tab.id === 'maintenance' && (overdueCount + dueSoonCount) > 0)
            || (tab.id === 'variance' && flaggedCount > 0);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'relative flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-gray-800 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50',
              )}
            >
              {tab.icon} {tab.label}
              {hasBadge && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div data-tour="cost-content">
        {activeTab === 'job-costing' && <JobCostingTab />}
        {activeTab === 'variance'    && <VarianceTab />}
        {activeTab === 'overhead'    && <OverheadTab />}
        {activeTab === 'maintenance' && <MaintenanceTab />}
      </div>
    </div>
  );
}
