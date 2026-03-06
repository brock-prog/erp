import React, { useState, useMemo } from 'react';
import {
  Wrench, CheckCircle, AlertTriangle, XCircle, Plus, Clock,
  Package, FileText, Truck, Star, ChevronDown, ChevronUp, Search,
  Edit2, Trash2, ExternalLink, AlertCircle, BookOpen, Users, CalendarClock,
  Archive, RotateCcw, Eye, EyeOff, Zap, ScanLine,
} from 'lucide-react';
import { MaintenanceScheduler } from './MaintenanceScheduler';
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
  Equipment as EquipmentType, EquipmentType as ET,
  SparePart, SparePartCriticality, WorkInstruction, WorkInstructionType,
  CriticalSupplier, SupplierCategory, VisicoatRecipe, PowderCharacteristic,
} from '../../types';
import { generateId } from '../../utils';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const EQUIPMENT_TOUR: TourStep[] = [
  { selector: '[data-tour="eq-kpis"]', title: 'Equipment KPIs',
    why: 'Operational lines, down/maintenance count, and low-stock spare parts show asset health.',
    what: 'Red numbers mean equipment or parts need attention. Click a tab to dig deeper.' },
  { selector: '[data-tour="eq-tabs"]', title: 'Module Tabs',
    why: 'Equipment cards, spare parts, work instructions, critical suppliers, and VISICOAT recipes each have a tab.',
    what: 'Equipment = asset registry. Spare Parts = inventory of replacement components. Suppliers = vendor contacts.' },
  { selector: '[data-tour="eq-content"]', title: 'Tab Content',
    why: 'Each tab shows a different asset management view with full CRUD capabilities.',
    what: 'Click any equipment card to expand details. Use "Add" buttons to create new records (manager+ access).' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  operational: 'border-l-green-500',
  maintenance:  'border-l-amber-500',
  down:         'border-l-red-500',
  retired:      'border-l-gray-400',
};

const STATUS_BADGE: Record<string, string> = {
  operational: 'bg-green-100 text-green-700',
  maintenance:  'bg-amber-100 text-amber-700',
  down:         'bg-red-100 text-red-700',
  retired:      'bg-gray-100 text-gray-500',
};

const TYPE_LABELS: Record<ET, string> = {
  horizontal_powder_line: 'Horizontal Powder Line',
  batch_powder_line:      'Batch Powder Line',
  vertical_powder_line:   'Vertical Powder Line',
  extrusion_sublimation:  'Extrusion Sublimation',
  panel_sublimation_oven: 'Panel Sublimation Oven',
  oven:                   'Cure Oven',
  heat_press:             'Heat Press',
  blast_cabinet:          'Blast Cabinet',
  washer:                 'Wash System',
  spray_booth:            'Spray Booth',
  compressor:             'Compressor',
  other:                  'Other',
};

const CRIT_COLOR: Record<SparePartCriticality, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  normal:   'bg-blue-100 text-blue-700',
  low:      'bg-gray-100 text-gray-600',
};

const STAR_COLOR = (n: number, i: number) => i < n ? 'text-yellow-400' : 'text-gray-300';

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} size={13} fill="currentColor" className={STAR_COLOR(value, i-1)} />)}
    </span>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'assets' | 'parts' | 'maintenance' | 'instructions' | 'suppliers' | 'visicoat';

// ─── Main component ───────────────────────────────────────────────────────────

export function Equipment() {
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  const isAdmin = currentUser?.role === 'admin';
  const isManagerPlus = ['admin', 'manager'].includes(currentUser?.role ?? '');

  const [tab, setTab] = useState<Tab>('assets');
  const [eqModal, setEqModal] = useState<{ open: boolean; eq: EquipmentType | null }>({ open: false, eq: null });
  const [archiveConfirm, setArchiveConfirm] = useState<EquipmentType | null>(null);
  const [partDeleteConfirm, setPartDeleteConfirm] = useState<SparePart | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [partModal, setPartModal] = useState<{ open: boolean; part: SparePart | null }>({ open: false, part: null });
  const [instrModal, setInstrModal] = useState<{ open: boolean; instr: WorkInstruction | null }>({ open: false, instr: null });
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier: CriticalSupplier | null }>({ open: false, supplier: null });
  const [partSearch, setPartSearch] = useState('');
  const [partEquipFilter, setPartEquipFilter] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [expandedEquip, setExpandedEquip] = useState<string | null>(null);
  const [recipeModal, setRecipeModal] = useState<{ open: boolean; recipe: VisicoatRecipe | null }>({ open: false, recipe: null });
  const [recipeDeleteConfirm, setRecipeDeleteConfirm] = useState<VisicoatRecipe | null>(null);
  const [recipeSearch, setRecipeSearch] = useState('');

  const { equipment, spareParts, workInstructions, criticalSuppliers, maintenanceTasks, visicoatRecipes, savedParts } = state;

  // Filter out retired unless admin with showRetired on
  const visibleEquipment = useMemo(
    () => equipment.filter(e => (isAdmin && showRetired) || e.status !== 'retired'),
    [equipment, isAdmin, showRetired],
  );

  // KPIs
  const operational = equipment.filter(e => e.status === 'operational').length;
  const down = equipment.filter(e => e.status === 'down').length;
  const lowStockParts = spareParts.filter(p => p.quantityOnHand <= p.reorderPoint).length;
  const criticalLowStock = spareParts.filter(p => p.quantityOnHand <= p.reorderPoint && p.criticality === 'critical').length;

  const filteredParts = useMemo(() => spareParts.filter(p => {
    const q = partSearch.toLowerCase();
    if (partEquipFilter && p.equipmentId !== partEquipFilter) return false;
    if (!q) return true;
    return p.description.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q) || (p.supplierName ?? '').toLowerCase().includes(q);
  }), [spareParts, partSearch, partEquipFilter]);

  const filteredSuppliers = useMemo(() => criticalSuppliers.filter(s => {
    const q = supplierSearch.toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || (s.contactName ?? '').toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  }), [criticalSuppliers, supplierSearch]);

  function getEquipMaintHistory(equipId: string) {
    return maintenanceTasks.filter(m => m.equipmentId === equipId && m.status === 'complete').slice(0, 3);
  }

  // Overdue + due-soon counts for Maintenance tab badge
  const { maintenanceSchedules, equipmentRuntime } = state;
  const maintenanceAlerts = useMemo(() => {
    return maintenanceSchedules.filter(s => {
      const lh = (() => {
        const entry = equipmentRuntime[s.equipmentId];
        if (!entry) return 0;
        const base = entry.runtimeHoursTotal;
        if (!entry.runtimeSessionStart) return base;
        return base + (Date.now() - new Date(entry.runtimeSessionStart).getTime()) / 3_600_000;
      })();
      const hrs = lh - (s.lastServiceHours ?? 0);
      if (s.intervalHours != null) {
        const remaining = s.intervalHours - hrs;
        if (remaining < 0 || remaining <= (s.warnWithinHours ?? 50)) return true;
      }
      if (s.intervalDays != null && s.lastServiceDate) {
        const daysSince = (Date.now() - new Date(s.lastServiceDate).getTime()) / 86_400_000;
        const dayRemaining = s.intervalDays - daysSince;
        if (dayRemaining < 0 || dayRemaining <= (s.warnWithinDays ?? 5)) return true;
      }
      return false;
    }).length;
  }, [maintenanceSchedules, equipmentRuntime]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'assets',       label: 'Asset Registry',      icon: <Wrench size={15} /> },
    { id: 'parts',        label: 'Spare Parts',          icon: <Package size={15} /> },
    { id: 'maintenance',  label: 'Maintenance',          icon: <CalendarClock size={15} />, badge: maintenanceAlerts },
    { id: 'instructions', label: 'Work Instructions',    icon: <BookOpen size={15} /> },
    { id: 'suppliers',    label: 'Critical Suppliers',   icon: <Truck size={15} /> },
    { id: 'visicoat',     label: 'VISICOAT Recipes',     icon: <ScanLine size={15} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Equipment & Asset Management</h1>
            <GuidedTourButton steps={EQUIPMENT_TOUR} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Production lines, spare parts, work instructions, and suppliers</p>
        </div>
      </div>

      {/* KPIs */}
      <div data-tour="eq-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Operational Lines" value={operational} color="green" icon={<CheckCircle size={20} />} />
        <StatCard label="Down / Maintenance" value={equipment.filter(e => e.status !== 'operational' && e.status !== 'retired').length} color="yellow" icon={<AlertTriangle size={20} />} />
        <StatCard label="Low Stock Parts" value={lowStockParts} color={lowStockParts > 0 ? 'red' : 'green'} icon={<Package size={20} />} />
        <StatCard label="Critical Low Stock" value={criticalLowStock} color={criticalLowStock > 0 ? 'red' : 'green'} icon={<AlertCircle size={20} />} />
      </div>

      {criticalLowStock > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          <strong>{criticalLowStock} critical spare part{criticalLowStock > 1 ? 's' : ''}</strong> below reorder point — order immediately to avoid downtime.
        </div>
      )}

      {/* Tabs */}
      <div data-tour="eq-tabs" className="border-b border-gray-200 flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative',
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon}{t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Asset Registry ── */}
      {tab === 'assets' && (
        <div className="space-y-3">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowRetired(v => !v)}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium',
                    showRetired
                      ? 'bg-gray-100 border-gray-300 text-gray-700'
                      : 'border-gray-200 text-gray-500 hover:text-gray-700',
                  )}
                >
                  {showRetired ? <Eye size={13} /> : <EyeOff size={13} />}
                  {showRetired ? 'Showing Retired' : 'Show Retired'}
                </button>
              )}
            </div>
            {isManagerPlus && (
              <Button size="sm" onClick={() => setEqModal({ open: true, eq: null })}>
                <Plus size={15} className="mr-1" /> Add Equipment
              </Button>
            )}
          </div>

          {visibleEquipment.map(e => {
            const expanded = expandedEquip === e.id;
            const parts = spareParts.filter(p => p.equipmentId === e.id);
            const history = getEquipMaintHistory(e.id);
            const instrs = workInstructions.filter(w => w.equipmentId === e.id);
            return (
              <Card key={e.id} className={clsx('border-l-4', STATUS_COLOR[e.status] ?? 'border-l-gray-300')}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Wrench size={18} className="text-gray-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{e.name}</span>
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[e.status])}>
                            {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {TYPE_LABELS[e.type]} · {e.location}
                          {e.model && <span> · <span className="text-gray-700">{e.model}</span></span>}
                          {e.serialNumber && <span> · S/N: {e.serialNumber}</span>}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          {e.lastMaintenanceDate && <span>Last PM: <strong>{formatDate(e.lastMaintenanceDate)}</strong></span>}
                          {e.nextMaintenanceDate && <span>Next PM: <strong className={
                            new Date(e.nextMaintenanceDate) < new Date() ? 'text-red-600' : 'text-gray-700'
                          }>{formatDate(e.nextMaintenanceDate)}</strong></span>}
                          <span>{parts.length} spare part{parts.length !== 1 ? 's' : ''}</span>
                          <span>{instrs.length} instruction{instrs.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isManagerPlus && (
                        <button
                          onClick={() => setEqModal({ open: true, eq: e })}
                          className="text-gray-400 hover:text-brand-600 p-1 rounded"
                          title="Edit equipment"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {isAdmin && e.status !== 'retired' && (
                        <button
                          onClick={() => setArchiveConfirm(e)}
                          className="text-gray-400 hover:text-amber-600 p-1 rounded"
                          title="Archive / retire equipment"
                        >
                          <Archive size={15} />
                        </button>
                      )}
                      {isAdmin && e.status === 'retired' && (
                        <button
                          onClick={() => dispatch({ type: 'UPDATE_EQUIPMENT', payload: { ...e, status: 'operational' } })}
                          className="text-gray-400 hover:text-green-600 p-1 rounded"
                          title="Restore to operational"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedEquip(expanded ? null : e.id)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded"
                      >
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Spare Parts */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Package size={12} /> Spare Parts
                        </div>
                        {parts.length === 0 ? <p className="text-xs text-gray-400">No parts on file.</p> : (
                          <div className="space-y-1.5">
                            {parts.map(p => (
                              <div key={p.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 truncate max-w-[140px]" title={p.description}>{p.description}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', CRIT_COLOR[p.criticality])}>
                                    {p.criticality}
                                  </span>
                                  <span className={clsx('font-medium', p.quantityOnHand <= p.reorderPoint ? 'text-red-600' : 'text-gray-600')}>
                                    {p.quantityOnHand} ea
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Work Instructions */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BookOpen size={12} /> Work Instructions
                        </div>
                        {instrs.length === 0 ? <p className="text-xs text-gray-400">No instructions on file.</p> : (
                          <div className="space-y-1.5">
                            {instrs.map(w => (
                              <div key={w.id} className="text-xs">
                                <button
                                  onClick={() => setInstrModal({ open: true, instr: w })}
                                  className="text-brand-600 hover:underline text-left"
                                >
                                  {w.title}
                                </button>
                                <div className="text-gray-400">{w.type} · {w.revision} · {w.steps.length} steps</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Maintenance History */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Clock size={12} /> Recent Maintenance
                        </div>
                        {history.length === 0 ? <p className="text-xs text-gray-400">No history.</p> : (
                          <div className="space-y-1.5">
                            {history.map(h => (
                              <div key={h.id} className="text-xs">
                                <div className="text-gray-700">{h.title}</div>
                                <div className="text-gray-400">{formatDate(h.completedDate ?? '')} · ${(h.laborCost + h.partsCost).toFixed(0)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Spare Parts ── */}
      {tab === 'parts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={partSearch}
                  onChange={e => setPartSearch(e.target.value)}
                  placeholder="Search parts…"
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <select
                value={partEquipFilter}
                onChange={e => setPartEquipFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All Equipment</option>
                {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            {isManagerPlus && (
              <Button size="sm" onClick={() => setPartModal({ open: true, part: null })}>
                <Plus size={15} className="mr-1" /> Add Part
              </Button>
            )}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Part Number','Description','Equipment','Criticality','On Hand','Re-order Pt','Unit Cost','Lead (days)','Location','Supplier','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredParts.map(p => (
                    <tr key={p.id} className={clsx('hover:bg-gray-50', p.quantityOnHand <= p.reorderPoint && 'bg-red-50 hover:bg-red-100')}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{p.partNumber}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{p.description}</div>
                        {p.drawingRef && <div className="text-xs text-brand-600">{p.drawingRef}</div>}
                        {p.unitMeasure && p.unitMeasure !== 'PZ' && (
                          <div className="text-xs text-gray-400">Unit: {p.unitMeasure}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.equipmentName}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', CRIT_COLOR[p.criticality])}>
                          {p.criticality}
                        </span>
                      </td>
                      <td className={clsx('px-4 py-3 font-semibold', p.quantityOnHand <= p.reorderPoint ? 'text-red-600' : 'text-gray-900')}>
                        {p.quantityOnHand}
                        {p.quantityOnHand <= p.reorderPoint && <AlertTriangle size={13} className="inline ml-1 text-red-500" />}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.reorderPoint}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-semibold">${p.unitCost.toFixed(2)} CAD</div>
                        {p.priceEUR != null && (
                          <div className="text-[11px] text-gray-400">€{p.priceEUR.toFixed(2)} EUR</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.leadTimeDays ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.satSection ? <div className="text-xs font-medium text-brand-700">{p.satSection}</div> : null}
                        <div className="text-xs text-gray-500">{p.location ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.supplierName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {isManagerPlus && (
                            <button onClick={() => setPartModal({ open: true, part: p })} className="text-gray-400 hover:text-brand-600 p-1 rounded" title="Edit part"><Edit2 size={14} /></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setPartDeleteConfirm(p)} className="text-gray-400 hover:text-red-600 p-1 rounded" title="Delete part"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredParts.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No parts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Maintenance Scheduler ── */}
      {tab === 'maintenance' && (
        <MaintenanceScheduler />
      )}

      {/* ── Work Instructions ── */}
      {tab === 'instructions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setInstrModal({ open: true, instr: null })}>
              <Plus size={15} className="mr-1" /> New Instruction
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workInstructions.map(w => {
              const typeColors: Record<string, string> = {
                operation: 'bg-blue-100 text-blue-700',
                maintenance: 'bg-amber-100 text-amber-700',
                safety: 'bg-red-100 text-red-700',
                calibration: 'bg-purple-100 text-purple-700',
                assembly: 'bg-green-100 text-green-700',
              };
              return (
                <Card key={w.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', typeColors[w.type] ?? 'bg-gray-100 text-gray-600')}>
                          {w.type}
                        </span>
                        <span className="text-xs text-gray-400">{w.revision}</span>
                        {w.approvedBy && <span className="text-xs text-green-600">✓ Approved</span>}
                      </div>
                      <h3 className="font-semibold text-gray-900 mt-1.5 text-sm leading-snug">{w.title}</h3>
                      {w.equipmentName && <div className="text-xs text-gray-500 mt-0.5">{w.equipmentName}</div>}
                      <div className="text-xs text-gray-400 mt-1.5 flex gap-3">
                        <span>{w.steps.length} steps</span>
                        {w.estimatedMinutes && <span>~{w.estimatedMinutes} min</span>}
                        {w.requiredPPE && w.requiredPPE.length > 0 && <span>{w.requiredPPE.length} PPE items</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        By {w.createdBy} · Updated {formatDate(w.updatedAt)}
                      </div>
                    </div>
                    <button onClick={() => setInstrModal({ open: true, instr: w })} className="text-brand-600 hover:text-brand-700 p-1 rounded ml-2 flex-shrink-0">
                      <ExternalLink size={15} />
                    </button>
                  </div>
                  {/* Steps preview */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {w.steps.slice(0, 2).map(s => (
                      <div key={s.id} className="flex gap-2 text-xs text-gray-600">
                        <span className="font-semibold text-gray-400 flex-shrink-0">{s.stepNumber}.</span>
                        <span className="truncate">{s.description}</span>
                      </div>
                    ))}
                    {w.steps.length > 2 && <div className="text-xs text-gray-400">+ {w.steps.length - 2} more steps…</div>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Critical Suppliers ── */}
      {tab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center justify-between">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                placeholder="Search suppliers…"
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Button size="sm" onClick={() => setSupplierModal({ open: true, supplier: null })}>
              <Plus size={15} className="mr-1" /> Add Supplier
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSuppliers.map(s => {
              const catColors: Record<SupplierCategory, string> = {
                parts: 'bg-blue-100 text-blue-700',
                consumables: 'bg-green-100 text-green-700',
                services: 'bg-purple-100 text-purple-700',
                raw_material: 'bg-amber-100 text-amber-700',
                chemicals: 'bg-red-100 text-red-700',
                other: 'bg-gray-100 text-gray-600',
              };
              return (
                <Card key={s.id} className={clsx('p-4', s.critical && 'ring-1 ring-red-200')}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', catColors[s.category])}>
                          {s.category.replace('_', ' ')}
                        </span>
                        {s.critical && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Critical</span>}
                      </div>
                      <h3 className="font-semibold text-gray-900 mt-1.5">{s.name}</h3>
                      {s.accountNumber && <div className="text-xs text-gray-500">Acct: {s.accountNumber}</div>}
                    </div>
                    <Stars value={s.rating} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    {s.contactName && <div><strong>Contact:</strong> {s.contactName}</div>}
                    {s.phone && <div><strong>Phone:</strong> {s.phone}</div>}
                    {s.email && <div><strong>Email:</strong> <a href={`mailto:${s.email}`} className="text-brand-600 hover:underline">{s.email}</a></div>}
                    {s.leadTimeDays && <div><strong>Lead Time:</strong> {s.leadTimeDays} days</div>}
                    {s.paymentTerms && <div><strong>Terms:</strong> {s.paymentTerms}</div>}
                    {s.certifications.length > 0 && (
                      <div><strong>Certs:</strong> {s.certifications.join(', ')}</div>
                    )}
                  </div>
                  {s.notes && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 italic">{s.notes}</div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => setSupplierModal({ open: true, supplier: s })} className="text-brand-600 hover:text-brand-700 text-xs flex items-center gap-1">
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>
                </Card>
              );
            })}
            {filteredSuppliers.length === 0 && (
              <div className="col-span-3 text-center text-gray-400 py-8">No suppliers found.</div>
            )}
          </div>
        </div>
      )}

      {/* ── VISICOAT Recipes ── */}
      {tab === 'visicoat' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-blue-800">
            <Zap size={16} className="mt-0.5 shrink-0 text-blue-500" />
            <div>
              <strong>SAT VISICOAT Advanced ERP Integration</strong> — Recipes defined here are pushed to the SAT line when a batch barcode is scanned at the loading station. Each recipe links a profile type + RAL colour + powder characteristic to specific gun parameters, enabling automatic recipe selection with no manual operator input.
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                placeholder="Search recipes..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {isManagerPlus && (
              <Button size="sm" onClick={() => setRecipeModal({ open: true, recipe: null })}>
                <Plus size={14} className="mr-1" /> New Recipe
              </Button>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{visicoatRecipes.filter(r => r.isActive).length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Active Recipes</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{new Set(visicoatRecipes.map(r => r.ralCode)).size}</div>
              <div className="text-xs text-gray-500 mt-0.5">RAL Colours</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{new Set(visicoatRecipes.map(r => r.savedPartName).filter(Boolean)).size}</div>
              <div className="text-xs text-gray-500 mt-0.5">Profile Types</div>
            </div>
          </div>

          {/* Recipe table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recipe Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">RAL</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Finish</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">kV</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">µA</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">g/min</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">m/min</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    {isManagerPlus && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visicoatRecipes
                    .filter(r => {
                      const q = recipeSearch.toLowerCase();
                      return !q || r.name.toLowerCase().includes(q) || r.ralCode.includes(q)
                        || (r.savedPartName ?? '').toLowerCase().includes(q)
                        || (r.ralDescription ?? '').toLowerCase().includes(q);
                    })
                    .map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.name}</div>
                        {r.savedPartName && <div className="text-xs text-gray-400">{r.savedPartName}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">RAL {r.ralCode}</span>
                        {r.ralDescription && <div className="text-xs text-gray-400 mt-0.5">{r.ralDescription}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.powderCharacteristic}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.powderSupplier ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.voltageKV ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.currentUA ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.powderOutputGmin ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.conveyorSpeedMmin ?? 'Default'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isManagerPlus && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setRecipeModal({ open: true, recipe: r })}
                              className="p-1 rounded hover:bg-gray-100 text-gray-500"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setRecipeDeleteConfirm(r)}
                                className="p-1 rounded hover:bg-red-50 text-red-500"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {visicoatRecipes.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">No recipes yet. Click New Recipe to add the first one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* SAT Batch Logs summary */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ScanLine size={15} className="text-blue-500" /> SAT Batch Logs
              </h3>
              <span className="text-xs text-gray-400">{state.satBatchLogs.length} records imported</span>
            </div>
            {state.satBatchLogs.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                No batch logs imported yet. Use <strong>Files & Extras → File Transfer</strong> in TeamViewer to pull
                <code className="mx-1 text-xs bg-gray-100 px-1 rounded">C:\Painting\Production\orders.csv</code>
                from the SAT PC, then import it here via WI-VISICOAT-005.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Batch Code</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Job</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">RAL</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Hooks</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Profiles</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">Poly °C avg</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Imported</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.satBatchLogs.slice(0, 20).map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{l.satBatchCode}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{l.jobId ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">{l.ralCode ? `RAL ${l.ralCode}` : '—'}</td>
                        <td className="px-3 py-2 text-right text-xs">{l.hookCount ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-xs">{l.profileCount ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-xs">{l.polyTemp?.avg != null ? `${l.polyTemp.avg.toFixed(1)}°C` : '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">{l.importedAt.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Modals ── */}
      {eqModal.open && (
        <EquipmentModal
          eq={eqModal.eq}
          onSave={(eq) => {
            dispatch({ type: eqModal.eq ? 'UPDATE_EQUIPMENT' : 'ADD_EQUIPMENT', payload: eq });
            setEqModal({ open: false, eq: null });
          }}
          onClose={() => setEqModal({ open: false, eq: null })}
        />
      )}

      {archiveConfirm && (
        <Modal open={true} onClose={() => setArchiveConfirm(null)} title="Retire Equipment" size="sm">
          <p className="text-sm text-gray-700 mb-4">
            Retire <strong>{archiveConfirm.name}</strong>? It will be hidden from active views unless
            "Show Retired" is enabled. You can restore it at any time.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setArchiveConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'ARCHIVE_EQUIPMENT', payload: archiveConfirm.id });
                setArchiveConfirm(null);
              }}
            >
              <Archive size={14} className="mr-1" /> Retire
            </Button>
          </div>
        </Modal>
      )}

      {partDeleteConfirm && (
        <Modal open={true} onClose={() => setPartDeleteConfirm(null)} title="Delete Spare Part" size="sm">
          <p className="text-sm text-gray-700 mb-4">
            Delete part <strong>{partDeleteConfirm.partNumber}</strong> — {partDeleteConfirm.description}?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setPartDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'DELETE_SPARE_PART', payload: partDeleteConfirm.id });
                setPartDeleteConfirm(null);
              }}
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          </div>
        </Modal>
      )}

      {partModal.open && (
        <SparePartModal
          part={partModal.part}
          equipment={equipment}
          onSave={(p) => {
            if (partModal.part) {
              dispatch({ type: 'UPDATE_SPARE_PART', payload: p });
            } else {
              dispatch({ type: 'ADD_SPARE_PART', payload: p });
            }
            setPartModal({ open: false, part: null });
          }}
          onClose={() => setPartModal({ open: false, part: null })}
        />
      )}

      {instrModal.open && (
        <WorkInstructionModal
          instr={instrModal.instr}
          equipment={equipment}
          onSave={(w) => {
            dispatch({ type: instrModal.instr ? 'UPDATE_WORK_INSTRUCTION' : 'ADD_WORK_INSTRUCTION', payload: w });
            setInstrModal({ open: false, instr: null });
          }}
          onClose={() => setInstrModal({ open: false, instr: null })}
        />
      )}

      {supplierModal.open && (
        <SupplierModal
          supplier={supplierModal.supplier}
          onSave={(s) => {
            dispatch({ type: supplierModal.supplier ? 'UPDATE_SUPPLIER' : 'ADD_SUPPLIER', payload: s });
            setSupplierModal({ open: false, supplier: null });
          }}
          onClose={() => setSupplierModal({ open: false, supplier: null })}
        />
      )}

      {recipeModal.open && (
        <VisicoatRecipeModal
          recipe={recipeModal.recipe}
          savedParts={savedParts}
          onSave={(r) => {
            dispatch({ type: recipeModal.recipe ? 'UPDATE_VISICOAT_RECIPE' : 'ADD_VISICOAT_RECIPE', payload: r });
            setRecipeModal({ open: false, recipe: null });
          }}
          onClose={() => setRecipeModal({ open: false, recipe: null })}
        />
      )}

      {recipeDeleteConfirm && (
        <Modal open={true} onClose={() => setRecipeDeleteConfirm(null)} title="Delete VISICOAT Recipe" size="sm">
          <p className="text-sm text-gray-700 mb-4">
            Delete recipe <strong>{recipeDeleteConfirm.name}</strong>? Any jobs referencing this recipe will lose the link. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRecipeDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              dispatch({ type: 'DELETE_VISICOAT_RECIPE', payload: recipeDeleteConfirm.id });
              setRecipeDeleteConfirm(null);
            }}>
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Equipment Modal ──────────────────────────────────────────────────────────

function EquipmentModal({
  eq, onSave, onClose,
}: {
  eq: EquipmentType | null;
  onSave: (e: EquipmentType) => void;
  onClose: () => void;
}) {
  const isNew = !eq;
  const [form, setForm] = useState<Partial<EquipmentType>>(eq ?? {
    type: 'other', status: 'operational', capacity: '', location: '',
  });
  const set = (k: keyof EquipmentType, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    if (!form.name?.trim()) return;
    onSave({
      ...form,
      id: eq?.id ?? `eq-${Date.now()}`,
      name: form.name.trim(),
      type: form.type ?? 'other',
      status: form.status ?? 'operational',
      capacity: form.capacity ?? '',
      location: form.location ?? '',
    } as EquipmentType);
  }

  const STATUS_OPTIONS = [
    { value: 'operational', label: 'Operational' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'down', label: 'Down' },
    { value: 'retired', label: 'Retired' },
  ];

  const TYPE_OPTIONS = Object.entries({
    horizontal_powder_line: 'Horizontal Powder Line',
    batch_powder_line: 'Batch Powder Line',
    vertical_powder_line: 'Vertical Powder Line',
    extrusion_sublimation: 'Extrusion Sublimation',
    panel_sublimation_oven: 'Panel Sublimation Oven',
    oven: 'Cure Oven',
    heat_press: 'Heat Press',
    blast_cabinet: 'Blast Cabinet',
    washer: 'Wash System',
    spray_booth: 'Spray Booth',
    compressor: 'Compressor',
    other: 'Other',
  }).map(([value, label]) => ({ value, label }));

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Add Equipment' : 'Edit Equipment'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Equipment Name" value={form.name ?? ''} onChange={v => set('name', v)} placeholder="e.g. Main Powder Coating Line" />
        </div>
        <Select label="Type" value={form.type ?? 'other'} onChange={v => set('type', v as ET)} options={TYPE_OPTIONS} />
        <Select label="Status" value={form.status ?? 'operational'} onChange={v => set('status', v as EquipmentType['status'])} options={STATUS_OPTIONS} />
        <Input label="Location" value={form.location ?? ''} onChange={v => set('location', v)} placeholder="e.g. Building A, Bay 3" />
        <Input label="Capacity" value={form.capacity ?? ''} onChange={v => set('capacity', v)} placeholder="e.g. 24 guns" />
        <Input label="Model" value={form.model ?? ''} onChange={v => set('model', v)} placeholder="e.g. OptiCenter OC07" />
        <Input label="Serial Number" value={form.serialNumber ?? ''} onChange={v => set('serialNumber', v)} />
        <Input label="Max Temp (°F)" type="number" value={String(form.maxTempF ?? '')} onChange={v => set('maxTempF', v ? Number(v) : undefined)} />
        <Input label="Max Pressure" value={form.maxPressure ?? ''} onChange={v => set('maxPressure', v)} placeholder="e.g. 6.5 bar" />
        <div className="col-span-2">
          <Textarea label="Notes" value={form.notes ?? ''} onChange={v => set('notes', v)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!form.name?.trim()}>Save Equipment</Button>
      </div>
    </Modal>
  );
}

// ─── Spare Part Modal ─────────────────────────────────────────────────────────

function SparePartModal({
  part, equipment, onSave, onClose,
}: {
  part: SparePart | null;
  equipment: EquipmentType[];
  onSave: (p: SparePart) => void;
  onClose: () => void;
}) {
  const isNew = !part;
  const [form, setForm] = useState<Partial<SparePart>>(part ?? {
    criticality: 'normal', quantityOnHand: 0, reorderPoint: 1, unitCost: 0,
  });
  const set = (k: keyof SparePart, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    const eq = equipment.find(e => e.id === form.equipmentId);
    const now = new Date().toISOString();
    onSave({
      ...form,
      id: part?.id ?? `sp${Date.now()}`,
      equipmentName: eq?.name ?? '',
      partNumber: form.partNumber ?? '',
      description: form.description ?? '',
      criticality: form.criticality ?? 'normal',
      quantityOnHand: Number(form.quantityOnHand ?? 0),
      reorderPoint: Number(form.reorderPoint ?? 1),
      unitCost: Number(form.unitCost ?? 0),
      createdAt: part?.createdAt ?? now,
      updatedAt: now,
    } as SparePart);
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Add Spare Part' : 'Edit Spare Part'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Select label="Equipment" value={form.equipmentId ?? ''} onChange={v => set('equipmentId', v)} options={[{ value: '', label: 'Select equipment' }, ...equipment.map(e => ({ value: e.id, label: e.name }))]} />
        <Input label="Part Number" value={form.partNumber ?? ''} onChange={v => set('partNumber', v)} />
        <div className="col-span-2">
          <Input label="Description" value={form.description ?? ''} onChange={v => set('description', v)} />
        </div>
        <Input label="Manufacturer" value={form.manufacturer ?? ''} onChange={v => set('manufacturer', v)} />
        <Input label="Supplier Name" value={form.supplierName ?? ''} onChange={v => set('supplierName', v)} />
        <Input label="Drawing Reference" value={form.drawingRef ?? ''} onChange={v => set('drawingRef', v)} />
        <Input label="Storage Location" value={form.location ?? ''} onChange={v => set('location', v)} />
        <Select label="Criticality" value={form.criticality ?? 'normal'} onChange={v => set('criticality', v as SparePartCriticality)} options={[
          { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
          { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' },
        ]} />
        <Input label="Lead Time (days)" type="number" value={String(form.leadTimeDays ?? '')} onChange={v => set('leadTimeDays', Number(v))} />
        <Input label="Qty On Hand" type="number" value={String(form.quantityOnHand ?? 0)} onChange={v => set('quantityOnHand', Number(v))} />
        <Input label="Reorder Point" type="number" value={String(form.reorderPoint ?? 1)} onChange={v => set('reorderPoint', Number(v))} />
        <Input label="Unit Cost ($)" type="number" value={String(form.unitCost ?? 0)} onChange={v => set('unitCost', Number(v))} />
        <div className="col-span-2">
          <Textarea label="Notes" value={form.notes ?? ''} onChange={v => set('notes', v)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save Part</Button>
      </div>
    </Modal>
  );
}

// ─── Work Instruction Modal ───────────────────────────────────────────────────

function WorkInstructionModal({
  instr, equipment, onSave, onClose,
}: {
  instr: WorkInstruction | null;
  equipment: EquipmentType[];
  onSave: (w: WorkInstruction) => void;
  onClose: () => void;
}) {
  const isNew = !instr;
  const [form, setForm] = useState<Partial<WorkInstruction>>(instr ?? { type: 'operation', revision: 'Rev A', steps: [] });
  const set = (k: keyof WorkInstruction, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function addStep() {
    const steps = [...(form.steps ?? []), { id: `s${Date.now()}`, stepNumber: (form.steps?.length ?? 0) + 1, description: '' }];
    set('steps', steps);
  }

  function updateStep(id: string, desc: string) {
    set('steps', (form.steps ?? []).map(s => s.id === id ? { ...s, description: desc } : s));
  }

  function removeStep(id: string) {
    const steps = (form.steps ?? []).filter(s => s.id !== id).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    set('steps', steps);
  }

  function save() {
    const eq = equipment.find(e => e.id === form.equipmentId);
    const now = new Date().toISOString();
    onSave({
      ...form,
      id: instr?.id ?? `wi${Date.now()}`,
      title: form.title ?? '',
      type: form.type ?? 'operation',
      revision: form.revision ?? 'Rev A',
      description: form.description ?? '',
      steps: form.steps ?? [],
      createdBy: form.createdBy ?? 'Alex Rivera',
      equipmentName: eq?.name,
      createdAt: instr?.createdAt ?? now,
      updatedAt: now,
    } as WorkInstruction);
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'New Work Instruction' : 'Edit Work Instruction'} size="xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Title" value={form.title ?? ''} onChange={v => set('title', v)} />
        </div>
        <Select label="Type" value={form.type ?? 'operation'} onChange={v => set('type', v as WorkInstructionType)} options={[
          { value: 'operation', label: 'Operation' }, { value: 'maintenance', label: 'Maintenance' },
          { value: 'safety', label: 'Safety' }, { value: 'calibration', label: 'Calibration' },
          { value: 'assembly', label: 'Assembly' },
        ]} />
        <Input label="Revision" value={form.revision ?? 'Rev A'} onChange={v => set('revision', v)} />
        <Select label="Equipment (optional)" value={form.equipmentId ?? ''} onChange={v => set('equipmentId', v || undefined)} options={[
          { value: '', label: 'General (not equipment-specific)' }, ...equipment.map(e => ({ value: e.id, label: e.name })),
        ]} />
        <Input label="Estimated Time (min)" type="number" value={String(form.estimatedMinutes ?? '')} onChange={v => set('estimatedMinutes', Number(v))} />
        <div className="col-span-2">
          <Textarea label="Description / Purpose" value={form.description ?? ''} onChange={v => set('description', v)} rows={2} />
        </div>
        <div className="col-span-2">
          <Input label="Required Tools (comma-separated)" value={(form.requiredTools ?? []).join(', ')} onChange={v => set('requiredTools', v.split(',').map(x => x.trim()).filter(Boolean))} />
        </div>
        <div className="col-span-2">
          <Input label="Required PPE (comma-separated)" value={(form.requiredPPE ?? []).join(', ')} onChange={v => set('requiredPPE', v.split(',').map(x => x.trim()).filter(Boolean))} />
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Steps</label>
            <Button size="sm" variant="ghost" onClick={addStep}><Plus size={13} className="mr-1" /> Add Step</Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {(form.steps ?? []).map(s => (
              <div key={s.id} className="flex gap-2 items-start">
                <span className="text-xs font-semibold text-gray-400 mt-2.5 w-5 flex-shrink-0">{s.stepNumber}.</span>
                <input
                  value={s.description}
                  onChange={e => updateStep(s.id, e.target.value)}
                  placeholder={`Step ${s.stepNumber} description…`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button onClick={() => removeStep(s.id)} className="text-gray-400 hover:text-red-500 mt-2"><Trash2 size={14} /></button>
              </div>
            ))}
            {(form.steps ?? []).length === 0 && <p className="text-sm text-gray-400">No steps added yet.</p>}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save Instruction</Button>
      </div>
    </Modal>
  );
}

// ─── Supplier Modal ───────────────────────────────────────────────────────────

function SupplierModal({
  supplier, onSave, onClose,
}: {
  supplier: CriticalSupplier | null;
  onSave: (s: CriticalSupplier) => void;
  onClose: () => void;
}) {
  const isNew = !supplier;
  const [form, setForm] = useState<Partial<CriticalSupplier>>(supplier ?? { rating: 3, certifications: [], critical: false, category: 'parts' });
  const set = (k: keyof CriticalSupplier, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    const now = new Date().toISOString();
    onSave({
      ...form,
      id: supplier?.id ?? `cs${Date.now()}`,
      name: form.name ?? '',
      category: form.category ?? 'parts',
      rating: Number(form.rating ?? 3),
      certifications: form.certifications ?? [],
      critical: form.critical ?? false,
      createdAt: supplier?.createdAt ?? now,
      updatedAt: now,
    } as CriticalSupplier);
  }

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Add Supplier' : 'Edit Supplier'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Supplier Name" value={form.name ?? ''} onChange={v => set('name', v)} />
        </div>
        <Input label="Account Number" value={form.accountNumber ?? ''} onChange={v => set('accountNumber', v)} />
        <Select label="Category" value={form.category ?? 'parts'} onChange={v => set('category', v as SupplierCategory)} options={[
          { value: 'parts', label: 'Parts' }, { value: 'consumables', label: 'Consumables' },
          { value: 'services', label: 'Services' }, { value: 'raw_material', label: 'Raw Material' },
          { value: 'chemicals', label: 'Chemicals' }, { value: 'other', label: 'Other' },
        ]} />
        <Input label="Contact Name" value={form.contactName ?? ''} onChange={v => set('contactName', v)} />
        <Input label="Phone" value={form.phone ?? ''} onChange={v => set('phone', v)} />
        <div className="col-span-2">
          <Input label="Email" value={form.email ?? ''} onChange={v => set('email', v)} />
        </div>
        <Input label="Website" value={form.website ?? ''} onChange={v => set('website', v)} />
        <Input label="Lead Time (days)" type="number" value={String(form.leadTimeDays ?? '')} onChange={v => set('leadTimeDays', Number(v))} />
        <Input label="Payment Terms" value={form.paymentTerms ?? ''} onChange={v => set('paymentTerms', v)} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
          <select value={form.rating ?? 3} onChange={e => set('rating', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <Input label="Certifications (comma-separated)" value={(form.certifications ?? []).join(', ')} onChange={v => set('certifications', v.split(',').map(x => x.trim()).filter(Boolean))} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="critical" checked={form.critical ?? false} onChange={e => set('critical', e.target.checked)} className="rounded" />
          <label htmlFor="critical" className="text-sm text-gray-700">Mark as Critical Supplier (single-source or no substitute available)</label>
        </div>
        <div className="col-span-2">
          <Textarea label="Notes" value={form.notes ?? ''} onChange={v => set('notes', v)} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save Supplier</Button>
      </div>
    </Modal>
  );
}

// ─── VISICOAT Recipe Modal ────────────────────────────────────────────────────

const POWDER_CHARS: PowderCharacteristic[] = ['solid','glossy','satin','matt','metallic','texture','wrinkle','candy','hammer'];

function VisicoatRecipeModal({
  recipe, savedParts, onSave, onClose,
}: {
  recipe: VisicoatRecipe | null;
  savedParts: import('../../types').SavedPart[];
  onSave: (r: VisicoatRecipe) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<VisicoatRecipe>>(
    recipe ?? { isActive: true, powderCharacteristic: 'solid' }
  );
  const set = (k: keyof VisicoatRecipe, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    if (!form.name?.trim() || !form.ralCode?.trim()) return;
    const now = new Date().toISOString();
    onSave({
      ...form,
      id: recipe?.id ?? generateId(),
      name: form.name,
      ralCode: form.ralCode,
      powderCharacteristic: form.powderCharacteristic ?? 'solid',
      isActive: form.isActive ?? true,
      createdAt: recipe?.createdAt ?? now,
      updatedAt: now,
    } as VisicoatRecipe);
  }

  return (
    <Modal open={true} onClose={onClose} title={recipe ? 'Edit VISICOAT Recipe' : 'New VISICOAT Recipe'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Recipe Name *" value={form.name ?? ''} onChange={v => set('name', v)}
            placeholder="e.g. 6063 Casement — RAL 9016 Traffic White Gloss" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile Type (Saved Part)</label>
          <select
            value={form.savedPartId ?? ''}
            onChange={e => {
              const p = savedParts.find(s => s.id === e.target.value);
              set('savedPartId', e.target.value);
              if (p) set('savedPartName', p.description);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— Select profile type —</option>
            {savedParts.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Powder Characteristic *</label>
          <select
            value={form.powderCharacteristic ?? 'solid'}
            onChange={e => set('powderCharacteristic', e.target.value as PowderCharacteristic)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize"
          >
            {POWDER_CHARS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <Input label="RAL Code *" value={form.ralCode ?? ''} onChange={v => set('ralCode', v)} placeholder="e.g. 9016" />
        <Input label="RAL Description" value={form.ralDescription ?? ''} onChange={v => set('ralDescription', v)} placeholder="e.g. Traffic White" />
        <Input label="Powder Supplier" value={form.powderSupplier ?? ''} onChange={v => set('powderSupplier', v)} placeholder="e.g. Tiger Drylac" />
        <Input label="Linked Inventory Item ID" value={form.powderInventoryItemId ?? ''} onChange={v => set('powderInventoryItemId', v)} placeholder="Optional — inventory link" />

        <div className="col-span-2 border-t border-gray-200 pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Gun Parameters (OptiStar Settings)</p>
        </div>
        <Input label="Voltage (kV)" type="number" value={String(form.voltageKV ?? '')} onChange={v => set('voltageKV', Number(v))} placeholder="e.g. 80" />
        <Input label="Current (µA)" type="number" value={String(form.currentUA ?? '')} onChange={v => set('currentUA', Number(v))} placeholder="e.g. 10" />
        <Input label="Powder Output (g/min)" type="number" value={String(form.powderOutputGmin ?? '')} onChange={v => set('powderOutputGmin', Number(v))} placeholder="e.g. 180" />
        <Input label="Air Flow" type="number" value={String(form.airFlow ?? '')} onChange={v => set('airFlow', Number(v))} placeholder="e.g. 5.2" />
        <Input label="Conveyor Speed Override (m/min)" type="number" value={String(form.conveyorSpeedMmin ?? '')} onChange={v => set('conveyorSpeedMmin', Number(v) || undefined)} placeholder="Leave blank = use line default" />

        <div className="col-span-2 border-t border-gray-200 pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Operator Notes (shown on SAT HMI)</p>
        </div>
        <div className="col-span-2">
          <Textarea label="Booth Notes" value={form.boothNotes ?? ''} onChange={v => set('boothNotes', v)} rows={2}
            placeholder="Notes shown to coater at booth (e.g. masking instructions, grounding reminders)" />
        </div>
        <div className="col-span-2">
          <Textarea label="Packing Notes" value={form.packingNotes ?? ''} onChange={v => set('packingNotes', v)} rows={2}
            placeholder="Notes shown at unload station (e.g. packing method, bundle size, special handling)" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="recipeActive" checked={form.isActive ?? true} onChange={e => set('isActive', e.target.checked)} className="rounded" />
          <label htmlFor="recipeActive" className="text-sm text-gray-700">Recipe is Active (available for batch assignment)</label>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!form.name?.trim() || !form.ralCode?.trim()}>Save Recipe</Button>
      </div>
    </Modal>
  );
}
