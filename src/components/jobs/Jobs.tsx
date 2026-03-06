import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Briefcase, Flame, AlertTriangle,
  Clock, CheckCircle, Filter, Layers, Zap, BookOpen, Camera,
  Package, Palette, ArrowRight, Circle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { PhotoCapture } from '../ui/PhotoCapture';
import { WorkInstructionModal } from '../work-instructions/WorkInstructionViewer';
import {
  formatCurrency, formatDate, jobStatusConfig, priorityConfig,
  serviceTypeLabel, isOverdue, generateId, generateJobNumber, clsx,
} from '../../utils';
import type { Job, JobStatus, Priority, ServiceType, MaterialRequirement } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const JOBS_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🏭', label: 'Job Created from Shipment',
    description: 'After admin review in Pending Job Queue, the job is released to the production floor.' },
  { type: 'action', icon: '🔧', label: 'Pre-treatment & Blasting',
    description: 'Parts move through pre-treatment (degreasing, sanding, or blasting) before coating.' },
  { type: 'action', icon: '🎨', label: 'Powder Application',
    description: 'Operator applies the specified powder colour using electrostatic spray or dip method.' },
  { type: 'action', icon: '🔥', label: 'Cure Oven',
    description: 'Parts are cured at the correct temperature and dwell time for the powder specification.' },
  { type: 'decision', icon: '🔍', label: 'QC Inspection Pass?',
    branches: [
      { label: '✓ Pass', color: 'green',
        steps: [{ label: 'Mark job QC passed' }, { label: 'Move to Shipping stage' }]},
      { label: '✗ Fail / Rework', color: 'red',
        steps: [{ label: 'Log NCR in Quality module' }, { label: 'Strip and re-coat parts' }]},
    ]},
  { type: 'action', icon: '📦', label: 'Pack & Ship',
    description: 'Parts are packaged, labelled, and handed to the Shipping module for BOL generation.' },
  { type: 'end', icon: '💰', label: 'Job Complete — Invoice Generated',
    description: 'Marking the job complete triggers invoice creation in the Invoicing module.' },
];

const JOBS_TOUR: TourStep[] = [
  { selector: '[data-tour="jobs-search"]', title: 'Search & Filter Jobs',
    why: 'Find any job by number, customer name, or PO. Filter by status or service type to focus on what matters.',
    what: 'Type in the search box. Click status chips to filter. Use service type buttons to show only powder, sublimation, or both.' },
  { selector: '[data-tour="jobs-summary"]', title: 'Job Summary Stats',
    why: 'Quick counts of active, rush, overdue, and completed jobs — tells you shop floor health instantly.',
    what: 'Red numbers mean attention needed. Rush and overdue jobs should be prioritized.' },
  { selector: '[data-tour="jobs-table"]', title: 'Job List',
    why: 'Every job on the production floor is listed here with its current status, priority, and customer.',
    what: 'Click any job row to see full details. Use the status column to track where the job is in the coating process.' },
  { selector: '[data-tour="jobs-new"]', title: 'Create New Job',
    why: 'Manually create a job when it does not come through the normal receiving queue.',
    what: 'Click "New Job" to open the form. Select customer, service type, and enter part details.' },
];

const JOB_STATUSES: JobStatus[] = [
  'received', 'prep', 'blast', 'rack', 'pretreat', 'coat', 'cure', 'qc', 'unrack',
  'awaiting_sublimation', 'shipping', 'complete', 'on_hold', 'cancelled',
];

// ─── Helper: get active items from a custom dropdown by systemKey ────────────
function useDropdown(systemKey: string) {
  const { state } = useApp();
  const list = state.customDropdowns.find(d => d.systemKey === systemKey);
  return list ? list.items.filter(i => i.active).sort((a, b) => a.sortOrder - b.sortOrder) : [];
}

function NewJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const finishTypes = useDropdown('finishTypes');
  const paperTypes = useDropdown('paperTypes');
  const powderMfrs = useDropdown('powderManufacturers');
  const partMaterials = useDropdown('partMaterials');
  const serviceTypes = useDropdown('serviceTypes');

  const [form, setForm] = useState({
    customerId: '', poNumber: '', serviceType: 'powder_coating' as ServiceType,
    priority: 'normal' as Priority, dueDate: '', estimatedHours: 4,
    salePrice: 0, notes: '', assignedOperator: '',
    partDesc: '', partMaterial: 'Steel', partQty: 1, partWeight: 0,
    // Powder spec
    powderManufacturer: 'Tiger Drylac', powderProduct: '', colorCode: '', colorName: '',
    finish: 'matte', milTarget: 3.5, cureTemp: 400, cureMinutes: 20,
    sandblast: false, chemWash: true, maskingRequired: false, maskingNotes: '',
    // Sublimation spec
    substrate: '', substrateColor: 'White', tempF: 400, seconds: 180,
    pressureLevel: 'medium', paperType: 'TexPrint-R',
  });

  function handleSave() {
    const now = new Date().toISOString().split('T')[0];
    const customer = state.customers.find(c => c.id === form.customerId);
    const job: Job = {
      id: generateId(),
      jobNumber: generateJobNumber(state.jobs.map(j => j.jobNumber)),
      customerId: form.customerId,
      customerName: customer?.name ?? '',
      poNumber: form.poNumber,
      serviceType: form.serviceType,
      status: 'received',
      priority: form.priority,
      parts: form.partDesc ? [{
        id: generateId(), description: form.partDesc, material: form.partMaterial,
        quantity: form.partQty, weight: form.partWeight || undefined,
      }] : [],
      powderSpec: (form.serviceType === 'powder_coating' || form.serviceType === 'both') ? {
        powderManufacturer: form.powderManufacturer, powderProduct: form.powderProduct,
        colorCode: form.colorCode, colorName: form.colorName,
        finish: form.finish as any, mil: form.milTarget,
        cure: { tempF: form.cureTemp, minutes: form.cureMinutes },
        pretreatment: [form.chemWash ? 'degreasing' : '', form.sandblast ? 'sandblast' : ''].filter(Boolean) as any,
        substrate: form.partMaterial,
        maskingRequired: form.maskingRequired, maskingNotes: form.maskingNotes,
        sandblastRequired: form.sandblast, chemicalWashRequired: form.chemWash,
      } : undefined,
      sublimationSpec: (form.serviceType === 'sublimation' || form.serviceType === 'both') ? {
        substrate: form.substrate, substrateColor: form.substrateColor,
        tempF: form.tempF, seconds: form.seconds,
        pressureLevel: form.pressureLevel as any, paperType: form.paperType,
        inkProfile: 'Standard', proofApproved: false,
      } : undefined,
      dueDate: form.dueDate || now,
      receivedDate: now,
      estimatedHours: form.estimatedHours,
      assignedOperator: form.assignedOperator,
      laborCost: 0, materialCost: 0, totalCost: 0, salePrice: form.salePrice,
      notes: form.notes, internalNotes: '',
      statusHistory: [{ status: 'received', timestamp: new Date().toISOString(), userId: state.currentUser.id, userName: state.currentUser.name }],
      attachments: [],
      createdAt: now, updatedAt: now,
    };
    dispatch({ type: 'ADD_JOB', payload: job });
    onClose();
  }

  const f = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  return (
    <Modal open={open} onClose={onClose} title="New Work Order" size="2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!form.customerId}>Create Job</Button></>}>
      <div className="space-y-5">
        {/* Header fields */}
        <div className="grid grid-cols-3 gap-3">
          <Select label="Customer *" value={form.customerId} onChange={e => f('customerId', e.target.value)}>
            <option value="">Select customer...</option>
            {state.customers.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="PO Number" value={form.poNumber} onChange={e => f('poNumber', e.target.value)} />
          <Input label="Due Date" type="date" value={form.dueDate} onChange={e => f('dueDate', e.target.value)} />
          <Select label="Service Type" value={form.serviceType} onChange={e => f('serviceType', e.target.value)}>
            {serviceTypes.length > 0
              ? serviceTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
              : (<>
                  <option value="powder_coating">Powder Coating</option>
                  <option value="sublimation">Sublimation</option>
                  <option value="both">Both</option>
                  <option value="other">Other</option>
                </>)
            }
          </Select>
          <Select label="Priority" value={form.priority} onChange={e => f('priority', e.target.value)}>
            <option value="low">Low</option><option value="normal">Normal</option>
            <option value="high">High</option><option value="rush">Rush</option>
          </Select>
          <Select label="Assigned Operator" value={form.assignedOperator} onChange={e => f('assignedOperator', e.target.value)}>
            <option value="">Unassigned</option>
            {state.users.filter(u => u.role === 'operator').map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </Select>
        </div>

        {/* Parts */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-xs font-semibold text-gray-600 px-1">Parts / Items</legend>
          <div className="grid grid-cols-4 gap-3 mt-2">
            <Input label="Description" value={form.partDesc} onChange={e => f('partDesc', e.target.value)} className="col-span-2" />
            <Select label="Material" value={form.partMaterial} onChange={e => f('partMaterial', e.target.value)}>
              {partMaterials.length > 0
                ? partMaterials.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                : ['Steel','Aluminum','Stainless Steel','Galvanized','Cast Iron','Other'].map(v => <option key={v} value={v}>{v}</option>)
              }
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Qty" type="number" value={form.partQty} onChange={e => f('partQty', Number(e.target.value))} />
              <Input label="Weight (lbs)" type="number" value={form.partWeight} onChange={e => f('partWeight', Number(e.target.value))} />
            </div>
          </div>
        </fieldset>

        {/* Powder spec */}
        {(form.serviceType === 'powder_coating' || form.serviceType === 'both') && (
          <fieldset className="border border-brand-200 rounded-lg p-4 bg-brand-50">
            <legend className="text-xs font-semibold text-brand-700 px-1">Powder Coating Specification</legend>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <Select label="Manufacturer" value={form.powderManufacturer} onChange={e => f('powderManufacturer', e.target.value)}>
                {powderMfrs.length > 0
                  ? powderMfrs.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                  : <option>{form.powderManufacturer}</option>
                }
              </Select>
              <Input label="Product Name" value={form.powderProduct} onChange={e => f('powderProduct', e.target.value)} />
              <Select label="Finish" value={form.finish} onChange={e => f('finish', e.target.value)}>
                {finishTypes.length > 0
                  ? finishTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                  : ['gloss','semi-gloss','satin','matte','flat','textured','metallic','candy'].map(v => <option key={v} value={v}>{v}</option>)
                }
              </Select>
              <Input label="Color Code (RAL/Custom)" value={form.colorCode} onChange={e => f('colorCode', e.target.value)} />
              <Input label="Color Name" value={form.colorName} onChange={e => f('colorName', e.target.value)} />
              <Input label="Target Mil Thickness" type="number" step="0.1" value={form.milTarget} onChange={e => f('milTarget', Number(e.target.value))} />
              <Input label="Cure Temp (°F)" type="number" value={form.cureTemp} onChange={e => f('cureTemp', Number(e.target.value))} />
              <Input label="Cure Time (min)" type="number" value={form.cureMinutes} onChange={e => f('cureMinutes', Number(e.target.value))} />
            </div>
            <div className="flex gap-4 mt-3">
              {[['sandblast', 'Sandblast Required'], ['chemWash', 'Chemical Wash'], ['maskingRequired', 'Masking Required']].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!(form as any)[key]} onChange={e => f(key, e.target.checked)} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
            {form.maskingRequired && (
              <Input label="Masking Notes" value={form.maskingNotes} onChange={e => f('maskingNotes', e.target.value)} className="mt-2" />
            )}
          </fieldset>
        )}

        {/* Sublimation spec */}
        {(form.serviceType === 'sublimation' || form.serviceType === 'both') && (
          <fieldset className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
            <legend className="text-xs font-semibold text-emerald-700 px-1">Sublimation Specification</legend>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <Input label="Substrate" value={form.substrate} onChange={e => f('substrate', e.target.value)} />
              <Input label="Substrate Color" value={form.substrateColor} onChange={e => f('substrateColor', e.target.value)} />
              <Select label="Paper Type" value={form.paperType} onChange={e => f('paperType', e.target.value)}>
                {paperTypes.length > 0
                  ? paperTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                  : (<><option>TexPrint-R</option><option>TexPrint-DT</option><option>TexPrint-XPRES</option><option>Other</option></>)
                }
              </Select>
              <Input label="Press Temp (°F)" type="number" value={form.tempF} onChange={e => f('tempF', Number(e.target.value))} />
              <Input label="Press Time (sec)" type="number" value={form.seconds} onChange={e => f('seconds', Number(e.target.value))} />
              <Select label="Pressure" value={form.pressureLevel} onChange={e => f('pressureLevel', e.target.value)}>
                <option value="light">Light</option><option value="medium">Medium</option><option value="heavy">Heavy</option>
              </Select>
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input label="Sale Price ($)" type="number" step="0.01" value={form.salePrice} onChange={e => f('salePrice', Number(e.target.value))} />
          <Input label="Est. Hours" type="number" step="0.5" value={form.estimatedHours} onChange={e => f('estimatedHours', Number(e.target.value))} />
        </div>
        <Textarea label="Notes / Special Instructions" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} />
      </div>
    </Modal>
  );
}

export function Jobs() {
  const { state, dispatch, can } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [showNew, setShowNew] = useState(params.get('new') === '1');

  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, [params]);

  const filtered = state.jobs.filter(j => {
    const ms = !search || j.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
      j.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (j.poNumber ?? '').toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all' ? true :
      statusFilter === 'active' ? !['complete', 'cancelled'].includes(j.status) :
      statusFilter === 'complete' ? j.status === 'complete' :
      j.status === statusFilter;
    const msvc = serviceFilter === 'all' || j.serviceType === serviceFilter;
    return ms && mf && msvc;
  }).sort((a, b) => {
    const prioOrder = { rush: 0, high: 1, normal: 2, low: 3 };
    return prioOrder[a.priority] - prioOrder[b.priority] || a.dueDate.localeCompare(b.dueDate);
  });

  // Kanban-style status groups for active jobs
  const kanbanGroups: { status: JobStatus; label: string }[] = [
    { status: 'received', label: 'Received' },
    { status: 'pretreat', label: 'Pretreat' },
    { status: 'coat', label: 'Coating' },
    { status: 'cure', label: 'Curing' },
    { status: 'qc', label: 'QC' },
    { status: 'shipping', label: 'Shipping' },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-2 -mb-2">
        <Briefcase size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Jobs / Work Orders</h1>
        <WorkflowHelp title="Jobs & Work Orders Workflow" description="How a job moves through the production floor from received to complete." steps={JOBS_WORKFLOW} />
        <GuidedTourButton steps={JOBS_TOUR} />
      </div>
      <NewJobModal open={showNew} onClose={() => setShowNew(false)} />

      {/* Filters */}
      <div data-tour="jobs-search" className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, customers, PO#..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['active', 'all', 'received', 'pretreat', 'coat', 'cure', 'qc', 'shipping', 'complete', 'on_hold', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['all', 'powder_coating', 'sublimation', 'both'].map(s => (
            <button key={s} onClick={() => setServiceFilter(s)}
              className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                serviceFilter === s ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50')}>
              {s === 'all' ? 'All Services' : s === 'powder_coating' ? 'Powder' : s === 'sublimation' ? 'Sublimation' : 'Both'}
            </button>
          ))}
        </div>
        <span data-tour="jobs-new" className="ml-auto">
        {can(3)
          ? <Button icon={<Plus size={14} />} onClick={() => setShowNew(true)}>New Job</Button>
          : <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">View Only</span>
        }
        </span>
      </div>

      {/* Summary bar */}
      <div data-tour="jobs-summary" className="grid grid-cols-4 gap-3">
        {[
          { icon: Briefcase, label: 'Active', value: state.jobs.filter(j => !['complete','cancelled'].includes(j.status)).length, color: 'text-brand-700' },
          { icon: Flame, label: 'Rush', value: state.jobs.filter(j => j.priority === 'rush' && !['complete','cancelled'].includes(j.status)).length, color: 'text-red-600' },
          { icon: AlertTriangle, label: 'Overdue', value: state.jobs.filter(j => isOverdue(j.dueDate, j.status)).length, color: 'text-amber-600' },
          { icon: CheckCircle, label: 'Done (Feb)', value: state.jobs.filter(j => j.status === 'complete' && j.completedDate?.startsWith('2026-02')).length, color: 'text-green-700' },
        ].map(stat => (
          <Card key={stat.label} className="flex items-center gap-3">
            <stat.icon size={20} className={stat.color} />
            <div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Job table */}
      <Card padding={false} data-tour="jobs-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Job #', 'Customer', 'PO #', 'Service', 'Status', 'Priority', 'Due Date', 'Parts', 'Sale Price', 'Operator', 'Progress'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(job => {
              const sc = jobStatusConfig(job.status);
              const pc = priorityConfig(job.priority);
              const overdue = isOverdue(job.dueDate, job.status);
              const totalParts = job.parts.reduce((s, p) => s + p.quantity, 0);
              // Progress calc
              const progress: Partial<Record<JobStatus, number>> = {
                received: 5, prep: 15, blast: 25, rack: 35, pretreat: 45, coat: 60,
                cure: 75, qc: 85, unrack: 90, awaiting_sublimation: 92, shipping: 95, complete: 100, on_hold: 0, cancelled: 0, quote: 0,
              };
              const jobProgress = progress[job.status] ?? 0;

              return (
                <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-bold text-brand-700">{job.jobNumber}</div>
                    {job.priority === 'rush' && <div className="text-xs text-red-500 font-bold flex items-center gap-0.5"><Flame size={10} />RUSH</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">{job.customerName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{job.poNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <Badge className={job.serviceType === 'powder_coating' ? 'bg-brand-100 text-brand-700' : job.serviceType === 'sublimation' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}>
                      {serviceTypeLabel(job.serviceType)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3"><Badge className={sc.color}>{sc.label}</Badge></td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs font-semibold ${pc.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />{pc.label}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium whitespace-nowrap ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                    {overdue && '⚠ '}{formatDate(job.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{totalParts}</td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-900">{formatCurrency(job.salePrice)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{job.assignedOperator ?? '—'}</td>
                  <td className="px-4 py-3 min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${jobProgress}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{jobProgress}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">No jobs match the current filters</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// Job Detail
export function JobDetail() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const id = window.location.pathname.split('/').pop();
  const job = state.jobs.find(j => j.id === id);
  const [showWI, setShowWI] = useState(false);

  if (!job) return (
    <div className="text-center py-24 text-gray-400">
      <Briefcase size={48} className="mx-auto mb-4 opacity-30" />
      <p>Job not found</p>
      <Button variant="ghost" onClick={() => navigate('/jobs')} className="mt-3">Back to Jobs</Button>
    </div>
  );

  const isMultiPhase = (job.phases?.length ?? 0) > 1;

  // For multi-phase jobs: powder coat → awaiting_sublimation → sub statuses → shipping → complete
  // For single-phase jobs: standard flow without awaiting_sublimation
  const orderStatuses: JobStatus[] = isMultiPhase
    ? ['received','prep','blast','rack','pretreat','coat','cure','qc','unrack','awaiting_sublimation','shipping','complete']
    : ['received','prep','blast','rack','pretreat','coat','cure','qc','unrack','shipping','complete'];

  function advanceStatus() {
    if (!job) return;
    const idx = orderStatuses.indexOf(job.status as JobStatus);
    if (idx < orderStatuses.length - 1) {
      const nextStatus = orderStatuses[idx + 1];
      const now = new Date().toISOString();
      // When transitioning out of awaiting_sublimation, advance the phase
      let updatedPhases = job.phases;
      let updatedPhaseIndex = job.currentPhaseIndex ?? 0;
      if (job.status === 'awaiting_sublimation' && job.phases) {
        updatedPhaseIndex = 1;
        updatedPhases = job.phases.map((p, i) =>
          i === 0 ? { ...p, status: 'complete' as const, completedAt: now }
          : i === 1 ? { ...p, status: 'in_progress' as const, startedAt: now }
          : p
        );
      } else if (nextStatus === 'awaiting_sublimation' && job.phases) {
        updatedPhases = job.phases.map((p, i) =>
          i === 0 ? { ...p, status: 'complete' as const, completedAt: now } : p
        );
      }
      const updated: Job = {
        ...job,
        status: nextStatus,
        phases: updatedPhases,
        currentPhaseIndex: updatedPhaseIndex,
        completedDate: nextStatus === 'complete' ? now.split('T')[0] : job.completedDate,
        updatedAt: now.split('T')[0],
        statusHistory: [...job.statusHistory, {
          status: nextStatus, timestamp: now,
          userId: state.currentUser.id, userName: state.currentUser.name,
        }],
      };
      dispatch({ type: 'UPDATE_JOB', payload: updated });
    }
  }

  const sc = jobStatusConfig(job.status);
  const pc = priorityConfig(job.priority);
  const currentIdx = orderStatuses.indexOf(job.status as JobStatus);
  const progress = Math.round(((currentIdx + 1) / orderStatuses.length) * 100);

  return (
    <div className="space-y-5">
      <WorkInstructionModal open={showWI} onClose={() => setShowWI(false)} filterStage={job.status} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate('/jobs')} className="text-sm text-gray-500 hover:text-brand-600">Jobs</button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">{job.jobNumber}</span>
        <Badge className={sc.color + ' ml-2'}>{sc.label}</Badge>
        {job.priority === 'rush' && <Badge className="bg-red-100 text-red-700 ml-1"><Flame size={10} className="inline mr-1" />RUSH</Badge>}
        <Button
          size="sm"
          variant="secondary"
          icon={<BookOpen size={14} />}
          onClick={() => setShowWI(true)}
          className="ml-auto"
        >
          Work Instructions
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: job info */}
        <div className="space-y-4">
          <Card>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Job #</span><span className="font-mono font-bold text-brand-700">{job.jobNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><button onClick={() => navigate(`/customers/${job.customerId}`)} className="font-semibold text-brand-600 hover:underline">{job.customerName}</button></div>
              {job.poNumber && <div className="flex justify-between"><span className="text-gray-500">PO #</span><span className="font-medium">{job.poNumber}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Service</span><Badge className="bg-brand-100 text-brand-700">{serviceTypeLabel(job.serviceType)}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className={`font-semibold ${pc.color}`}>{pc.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Received</span><span>{formatDate(job.receivedDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span className={isOverdue(job.dueDate, job.status) ? 'text-red-600 font-bold' : ''}>{formatDate(job.dueDate)}</span></div>
              {job.completedDate && <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="text-green-700">{formatDate(job.completedDate)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Operator</span><span>{job.assignedOperator ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Est. Hours</span><span>{job.estimatedHours}h {job.actualHours ? `(actual: ${job.actualHours}h)` : ''}</span></div>
            </div>
          </Card>

          {/* Financials */}
          <Card>
            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Financials</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Labor</span><span>{formatCurrency(job.laborCost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Material</span><span>{formatCurrency(job.materialCost)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-gray-500">Total Cost</span><span className="font-semibold">{formatCurrency(job.totalCost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Sale Price</span><span className="font-bold text-green-700">{formatCurrency(job.salePrice)}</span></div>
              {job.margin !== undefined && (
                <div className="flex justify-between"><span className="text-gray-500">Margin</span><span className="font-bold text-brand-700">{job.margin.toFixed(1)}%</span></div>
              )}
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Production Progress</span>
              {!['complete','cancelled','on_hold'].includes(job.status) && (
                <Button size="sm" onClick={advanceStatus} icon={<Zap size={13} />}>Advance Status</Button>
              )}
            </div>
            <div className="relative">
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {orderStatuses.map((s, i) => {
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  const sc2 = jobStatusConfig(s);
                  return (
                    <div key={s} className="flex items-center">
                      <div className={clsx('flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-center min-w-[64px]',
                        current ? 'bg-brand-600 text-white' : done ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400')}>
                        <div className={clsx('w-2 h-2 rounded-full', current ? 'bg-white' : done ? 'bg-brand-500' : 'bg-gray-300')} />
                        <span className="text-xs font-medium leading-tight">{sc2.label}</span>
                      </div>
                      {i < orderStatuses.length - 1 && <div className={clsx('h-0.5 w-3 flex-shrink-0', i < currentIdx ? 'bg-brand-400' : 'bg-gray-200')} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Parts */}
          <Card>
            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Parts</div>
            {job.parts.length === 0 ? <p className="text-sm text-gray-400">No parts recorded.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">{['Description','Material','Qty','Weight','Part #'].map(h => <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold text-gray-400">{h}</th>)}</tr></thead>
                <tbody>{job.parts.map(p => <tr key={p.id}><td className="px-3 py-2 text-gray-800">{p.description}</td><td className="px-3 py-2 text-gray-600">{p.material}</td><td className="px-3 py-2 font-bold">{p.quantity}</td><td className="px-3 py-2 text-gray-600">{p.weight ? `${p.weight} lbs` : '—'}</td><td className="px-3 py-2 text-gray-500 font-mono text-xs">{p.partNumber ?? '—'}</td></tr>)}</tbody>
              </table>
            )}
          </Card>

          {/* ── Phase Tracker (multi-phase jobs) ─────────────────────── */}
          {isMultiPhase && job.phases && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Production Phases</div>
                {job.status === 'awaiting_sublimation' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-semibold">
                    Stored — Awaiting Sublimation Schedule
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {job.phases.map((phase, i) => {
                  const isActive = i === (job.currentPhaseIndex ?? 0) && phase.status !== 'complete';
                  const isDone = phase.status === 'complete';
                  const phaseLabel = phase.type === 'powder_coating' ? 'Powder Coating' : phase.type === 'sublimation' ? 'Sublimation' : phase.type;
                  return (
                    <React.Fragment key={phase.type}>
                      <div className={clsx(
                        'flex-1 rounded-xl p-3 border-2 text-center',
                        isDone ? 'border-green-300 bg-green-50' :
                        isActive ? 'border-brand-400 bg-brand-50' :
                        'border-gray-200 bg-gray-50'
                      )}>
                        <div className={clsx('text-sm font-bold',
                          isDone ? 'text-green-700' : isActive ? 'text-brand-700' : 'text-gray-400'
                        )}>
                          {isDone ? '✓ ' : ''}{phaseLabel}
                        </div>
                        <div className={clsx('text-xs mt-0.5 capitalize',
                          isDone ? 'text-green-600' : isActive ? 'text-brand-500' : 'text-gray-400'
                        )}>
                          {isDone ? 'Complete' : isActive ? 'In Progress' : 'Pending'}
                        </div>
                      </div>
                      {i < job.phases!.length - 1 && (
                        <ArrowRight size={16} className={clsx(
                          'flex-shrink-0',
                          job.phases![0].status === 'complete' ? 'text-green-500' : 'text-gray-300'
                        )} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              {job.status === 'awaiting_sublimation' && (
                <div className="mt-3 text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
                  Powder coating complete. Parts in storage. Schedule sublimation to advance this job.
                </div>
              )}
            </Card>
          )}

          {/* ── Material Requirements ─────────────────────────────────── */}
          {job.materialRequirements && job.materialRequirements.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={13} /> Material Requirements
                </div>
                {job.materialsReadyForScheduling ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                    <CheckCircle size={10} /> Ready to Schedule
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1">
                    <AlertTriangle size={10} /> Materials Pending
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {job.materialRequirements.map(req => {
                  const inv = state.inventory.find(i => i.id === req.inventoryItemId);
                  const shortfall = inv ? req.quantityRequired - inv.quantityOnHand : null;
                  return (
                    <div key={req.id} className={clsx(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 border',
                      req.confirmed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    )}>
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                        req.type === 'paint' ? 'bg-brand-100' : 'bg-cyan-100'
                      )}>
                        {req.type === 'paint' ? <Palette size={13} className="text-brand-600" /> : <Package size={13} className="text-cyan-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{req.itemName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{req.quantityRequired} {req.unit} required</span>
                          {inv && (
                            <span className={clsx('font-medium', shortfall && shortfall > 0 ? 'text-red-600' : 'text-green-600')}>
                              · {inv.quantityOnHand} {inv.unit} on hand{shortfall && shortfall > 0 ? ` (short ${shortfall.toFixed(1)})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const now = new Date().toISOString();
                          const updatedReqs = job.materialRequirements!.map(r =>
                            r.id === req.id
                              ? { ...r, confirmed: !r.confirmed, confirmedAt: !r.confirmed ? now : undefined, confirmedBy: !r.confirmed ? state.currentUser.name : undefined }
                              : r
                          );
                          const allConfirmed = updatedReqs.every(r => r.confirmed);
                          dispatch({ type: 'UPDATE_JOB', payload: {
                            ...job,
                            materialRequirements: updatedReqs,
                            materialsReadyForScheduling: allConfirmed,
                            updatedAt: now.split('T')[0],
                          }});
                        }}
                        className={clsx(
                          'flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors',
                          req.confirmed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white hover:border-green-400'
                        )}
                        title={req.confirmed ? `Confirmed by ${req.confirmedBy}` : 'Click to confirm material is on hand'}
                      >
                        {req.confirmed && <CheckCircle size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
              {!job.materialsReadyForScheduling && (
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                  <AlertTriangle size={11} /> Confirm all materials before scheduling this job.
                </p>
              )}
            </Card>
          )}

          {/* Powder Spec */}
          {job.powderSpec && (
            <Card>
              <div className="text-xs font-semibold text-brand-600 mb-3 uppercase tracking-wider">Powder Coating Spec</div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Manufacturer', job.powderSpec.powderManufacturer],
                  ['Product', job.powderSpec.powderProduct],
                  ['Finish', job.powderSpec.finish],
                  ['Color Code', job.powderSpec.colorCode],
                  ['Color Name', job.powderSpec.colorName],
                  ['Target Mil', `${job.powderSpec.mil} mil`],
                  ['Cure Temp', `${job.powderSpec.cure.tempF}°F`],
                  ['Cure Time', `${job.powderSpec.cure.minutes} min`],
                  ['Substrate', job.powderSpec.substrate],
                  ['Sandblast', job.powderSpec.sandblastRequired ? 'Yes' : 'No'],
                  ['Chem Wash', job.powderSpec.chemicalWashRequired ? 'Yes' : 'No'],
                  ['Masking', job.powderSpec.maskingRequired ? 'Yes' : 'No'],
                ].map(([label, val]) => (
                  <div key={label as string}><span className="text-gray-400 text-xs">{label}</span><div className="font-medium text-gray-800">{val}</div></div>
                ))}
              </div>
              {job.powderSpec.colorCode && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Color preview:</span>
                  <div className="w-8 h-8 rounded-lg border border-gray-200 shadow-inner" style={{ backgroundColor: job.powderSpec.colorCode.startsWith('#') ? job.powderSpec.colorCode : '#999' }} />
                </div>
              )}
            </Card>
          )}

          {/* Sublimation Spec */}
          {job.sublimationSpec && (
            <Card>
              <div className="text-xs font-semibold text-emerald-600 mb-3 uppercase tracking-wider">Sublimation Spec</div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Substrate', job.sublimationSpec.substrate],
                  ['Sub. Color', job.sublimationSpec.substrateColor],
                  ['Paper Type', job.sublimationSpec.paperType],
                  ['Press Temp', `${job.sublimationSpec.tempF}°F`],
                  ['Press Time', `${job.sublimationSpec.seconds}s`],
                  ['Pressure', job.sublimationSpec.pressureLevel],
                  ['Ink Profile', job.sublimationSpec.inkProfile],
                  ['Proof OK', job.sublimationSpec.proofApproved ? 'Yes' : 'Pending'],
                ].map(([label, val]) => (
                  <div key={label as string}><span className="text-gray-400 text-xs">{label}</span><div className="font-medium text-gray-800">{val}</div></div>
                ))}
              </div>
            </Card>
          )}

          {/* QC */}
          {(job.qcInspector || job.qcPassed !== undefined) && (
            <Card>
              <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Quality Control</div>
              <div className="flex items-center gap-4">
                <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg',
                  job.qcPassed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                  {job.qcPassed ? '✓' : '✗'}
                </div>
                <div>
                  <div className="font-semibold">{job.qcPassed ? 'Passed QC' : 'QC Pending / Failed'}</div>
                  {job.qcInspector && <div className="text-xs text-gray-500">Inspector: {job.qcInspector}</div>}
                  {job.qcNotes && <div className="text-xs text-gray-500 mt-1">{job.qcNotes}</div>}
                </div>
              </div>
            </Card>
          )}

          {/* Job Photos */}
          <Card>
            <PhotoCapture
              photos={job.attachments?.filter(a => a.startsWith('data:image')) ?? []}
              onChange={photos => {
                const nonImages = (job.attachments ?? []).filter(a => !a.startsWith('data:image'));
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, attachments: [...nonImages, ...photos], updatedAt: new Date().toISOString().split('T')[0] } });
              }}
              label="Job Photos"
              maxPhotos={20}
            />
          </Card>

          {/* Status history */}
          <Card>
            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Status History</div>
            <div className="space-y-2">
              {[...job.statusHistory].reverse().map((event, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
                  <span className="text-gray-500 whitespace-nowrap">{new Date(event.timestamp).toLocaleString()}</span>
                  <Badge className={jobStatusConfig(event.status as JobStatus)?.color ?? 'bg-gray-100 text-gray-600'}>
                    {jobStatusConfig(event.status as JobStatus)?.label ?? event.status}
                  </Badge>
                  <span className="text-gray-500">by {event.userName}</span>
                </div>
              ))}
            </div>
          </Card>

          {job.notes && (
            <Card>
              <div className="text-xs font-semibold text-gray-500 mb-2">Notes</div>
              <p className="text-sm text-gray-700">{job.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
