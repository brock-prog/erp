import React, { useState, useRef, useEffect, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import { useNavigate } from 'react-router-dom';
import {
  PackageOpen, CheckCircle, RotateCcw,
  User, Hash, Layers, FileText, AlignLeft, ArrowLeft,
  Camera, Truck, Printer, X, ImagePlus, ChevronDown,
  Check, MapPin, Search, BookOpen, Clock, Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateId } from '../../utils';
import type { IncomingShipment, SavedPart } from '../../types';
import { ProcessTimer } from '../shared/ProcessTimer';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const KIOSK_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🚪', label: 'Customer Arrives with Parts',
    description: 'Customer drops off parts for powder coating or sublimation.' },
  { type: 'action', icon: '🔍', label: 'Search or Enter Customer',
    description: 'Type in the Customer field — select from the dropdown if they exist, or type a new name.' },
  { type: 'action', icon: '📦', label: 'Enter Part Description',
    description: 'Search the parts library by name/material. Select a saved part (bumps usage count) or type a new description (auto-saved to library).' },
  { type: 'action', icon: '🔢', label: 'Fill Shipment Details',
    description: 'Enter quantity, weight, PO number, urgency level, service type, and any special notes.' },
  { type: 'action', icon: '📷', label: 'Capture Photos (optional)',
    description: 'Advance to the Photos step to photograph parts for the job record.' },
  { type: 'action', icon: '✅', label: 'Confirm Receipt',
    description: 'Click "Confirm Receipt" — a barcode is generated and printed for the package.' },
  { type: 'end', icon: '📋', label: 'Shipment Queued',
    description: 'The shipment appears in Pending Job Queue for admin review and release to production.' },
];

const KIOSK_TOUR: TourStep[] = [
  { selector: '[data-tour="kiosk-steps"]', title: 'Step Indicator',
    why: 'Shows where you are in the receiving process — details, photos, then done.',
    what: 'Complete each step in order. You cannot skip ahead until the current step is filled in.' },
  { selector: '[data-tour="kiosk-customer"]', title: 'Customer Field',
    why: 'Every shipment must be tied to a customer for billing and job tracking.',
    what: 'Start typing to search existing customers, or enter a new name. The system auto-saves new customers.' },
  { selector: '[data-tour="kiosk-part"]', title: 'Part Description',
    why: 'Identifying the part type helps operators know what they are coating and pulls up saved specs.',
    what: 'Search the parts library or type a new description. Saved parts track usage count and last-used date.' },
  { selector: '[data-tour="kiosk-details"]', title: 'Shipment Details',
    why: 'Quantity, weight, PO number, and urgency drive scheduling, pricing, and priority on the shop floor.',
    what: 'Fill in all fields. Rush/urgent shipments get flagged in the Pending Job Queue.' },
  { selector: '[data-tour="kiosk-confirm"]', title: 'Confirm Receipt',
    why: 'Confirming generates a barcode label and creates the shipment record for admin review.',
    what: 'Click "Confirm Receipt" when all info is entered. Print the barcode and attach it to the package.' },
];

// ── Types & constants ────────────────────────────────────────────────────────

type Step = 'form' | 'photos' | 'done';

interface SlipForm {
  customerName: string;
  customerPO: string;
  partDescription: string;
  quantity: string;
  rackCount: string;
  weightLbs: string;
  conditionNotes: string;
  notes: string;
  driverName: string;
  driverCompany: string;
}

const BLANK: SlipForm = {
  customerName: '', customerPO: '', partDescription: '',
  quantity: '', rackCount: '', weightLbs: '',
  conditionNotes: '', notes: '',
  driverName: '', driverCompany: '',
};

const ACCENT = '#1f355e';

const STEPS: { id: Step; label: string }[] = [
  { id: 'form',   label: 'Shipment Details' },
  { id: 'photos', label: 'Photos' },
  { id: 'done',   label: 'Done' },
];

function generateShipmentBarcode(existing: IncomingShipment[]): string {
  const year = new Date().getFullYear();
  const count = existing.filter(s => s.barcodeId.startsWith(`DEC-${year}-`)).length + 1;
  return `DEC-${year}-${String(count).padStart(4, '0')}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReceivingKiosk() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [step, setStep]                     = useState<Step>('form');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionDone, setSessionDone]       = useState(false);
  const [form, setForm]                     = useState<SlipForm>(BLANK);
  const [errors, setErrors]                 = useState<Partial<SlipForm>>({});
  const [showDelivery, setShowDelivery]     = useState(false);
  const [showNotes, setShowNotes]           = useState(false);
  const [photos, setPhotos]                 = useState<string[]>([]);
  const [savedShipment, setSavedShipment]   = useState<IncomingShipment | null>(null);

  // ── Combobox state ──────────────────────────────────────────────────────
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId]     = useState<string | undefined>();
  const [partDropdownOpen, setPartDropdownOpen]         = useState(false);
  const [selectedPartId, setSelectedPartId]             = useState<string | undefined>();

  const photoInputRef  = useRef<HTMLInputElement>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);
  const partBoxRef     = useRef<HTMLDivElement>(null);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
      if (partBoxRef.current && !partBoxRef.current.contains(e.target as Node)) {
        setPartDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Filtered customer list ────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = form.customerName.toLowerCase().trim();
    const sorted = [...state.customers].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 8);
    return sorted
      .filter(c => {
        const primary = c.contacts.find(ct => ct.isPrimary) ?? c.contacts[0];
        return (
          c.name.toLowerCase().includes(q) ||
          (primary?.email ?? '').toLowerCase().includes(q) ||
          (primary?.phone ?? '').includes(q)
        );
      })
      .slice(0, 8);
  }, [form.customerName, state.customers]);

  // ── Filtered saved parts ──────────────────────────────────────────────────
  const filteredSavedParts = useMemo(() => {
    const q = form.partDescription.toLowerCase().trim();
    const sorted = [...state.savedParts].sort((a, b) => b.usageCount - a.usageCount);
    if (!q) return sorted.slice(0, 8);
    return sorted
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.material ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [form.partDescription, state.savedParts]);

  // ── Recent part descriptions from past shipments not already saved ─────────
  const recentDescriptions = useMemo(() => {
    const q = form.partDescription.toLowerCase().trim();
    const savedNames = new Set(state.savedParts.map(p => p.name.toLowerCase()));
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of [...state.incomingShipments].reverse()) {
      const desc = s.partDescription.trim();
      const low  = desc.toLowerCase();
      if (!seen.has(low) && !savedNames.has(low)) {
        if (!q || low.includes(q)) {
          result.push(desc);
          seen.add(low);
        }
      }
      if (result.length >= 5) break;
    }
    return result;
  }, [form.partDescription, state.savedParts, state.incomingShipments]);

  const hasPartSuggestions = filteredSavedParts.length > 0 || recentDescriptions.length > 0;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setField<K extends keyof SlipForm>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<SlipForm> = {};
    if (!form.customerName.trim())    e.customerName    = 'Required';
    if (!form.partDescription.trim()) e.partDescription = 'Required';
    if (!form.quantity.trim() || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      e.quantity = 'Enter a valid count';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) setPhotos(prev => [...prev, ev.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  }

  function handleFormNext() {
    if (!validate()) return;
    setStep('photos');
  }

  function handleConfirmReceipt() {
    const barcodeId = generateShipmentBarcode(state.incomingShipments);
    const now       = new Date().toISOString();
    const partDesc  = form.partDescription.trim();
    const custName  = form.customerName.trim();

    const shipment: IncomingShipment = {
      id: generateId(),
      barcodeId,
      receivedAt:     now,
      receivedBy:     state.currentUser.name,
      customerName:   custName,
      customerPO:     form.customerPO.trim()      || undefined,
      partDescription: partDesc,
      quantity:       Number(form.quantity),
      rackCount:      form.rackCount   ? Number(form.rackCount)  : undefined,
      weightLbs:      form.weightLbs   ? Number(form.weightLbs)  : undefined,
      conditionNotes: form.conditionNotes.trim()  || undefined,
      notes:          form.notes.trim()           || undefined,
      driverName:     form.driverName.trim()      || undefined,
      driverCompany:  form.driverCompany.trim()   || undefined,
      photos:         photos.length > 0 ? photos  : undefined,
      status:         'received',
    };
    dispatch({ type: 'ADD_INCOMING_SHIPMENT', payload: shipment });

    // ── Saved Parts library sync ──────────────────────────────────────────
    if (selectedPartId) {
      // Bump usage count on known part
      const existing = state.savedParts.find(p => p.id === selectedPartId);
      if (existing) {
        dispatch({
          type: 'UPDATE_SAVED_PART',
          payload: { ...existing, usageCount: existing.usageCount + 1, lastUsedAt: now },
        });
      }
    } else if (partDesc) {
      const matchLow = partDesc.toLowerCase();
      const existing = state.savedParts.find(p => p.name.toLowerCase() === matchLow);
      if (existing) {
        // Bump an existing part that shares this description exactly
        dispatch({
          type: 'UPDATE_SAVED_PART',
          payload: { ...existing, usageCount: existing.usageCount + 1, lastUsedAt: now },
        });
      } else {
        // Auto-save brand-new part to the library
        const newPart: SavedPart = {
          id:           generateId(),
          name:         partDesc,
          customerId:   selectedCustomerId,
          customerName: custName || undefined,
          usageCount:   1,
          lastUsedAt:   now,
          createdAt:    now,
          createdBy:    state.currentUser.name,
        };
        dispatch({ type: 'ADD_SAVED_PART', payload: newPart });
      }
    }

    setSavedShipment(shipment);
    setStep('done');
  }

  function reset() {
    setStep('form');
    setSessionStarted(false);
    setSessionDone(false);
    setForm(BLANK);
    setErrors({});
    setShowDelivery(false);
    setShowNotes(false);
    setPhotos([]);
    setSavedShipment(null);
    setCustomerDropdownOpen(false);
    setSelectedCustomerId(undefined);
    setPartDropdownOpen(false);
    setSelectedPartId(undefined);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f6fa' }}>
      <Header onBack={() => navigate('/')} currentUser={state.currentUser.name} />

      {/* Step progress + always-mounted ProcessTimer */}
      <div className="max-w-2xl mx-auto w-full px-6 pt-5 space-y-4">
        <div data-tour="kiosk-steps"><StepIndicator current={step} /></div>

        <ProcessTimer
          processType="receiving"
          referenceId={savedShipment?.id}
          referenceLabel={savedShipment?.barcodeId}
          onStart={() => setSessionStarted(true)}
          onComplete={() => setSessionDone(true)}
        />
      </div>

      {/* ── FORM STEP ─────────────────────────────────────────────────────── */}
      {step === 'form' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 pt-5 pb-10 space-y-4">

            {/* ── Shipment Details ────────────────────────────────────────── */}
            <FormSection title="Shipment Details" icon={<FileText size={14} className="text-brand-500" />}>

              {/* Customer Name — searchable combobox */}
              <div className="grid grid-cols-2 gap-4">
                <div ref={customerBoxRef} className="relative" data-tour="kiosk-customer">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <User size={13} /> Customer Name <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={e => {
                        setField('customerName', e.target.value);
                        setSelectedCustomerId(undefined);
                        setCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      placeholder="Search customers…"
                      className={`w-full pl-4 pr-9 py-3 rounded-xl border-2 text-sm text-gray-800 transition-colors outline-none ${
                        errors.customerName
                          ? 'border-red-300 bg-red-50 placeholder-red-300'
                          : 'border-gray-200 focus:border-brand-400 bg-white placeholder-gray-400'
                      }`}
                    />
                    {selectedCustomerId
                      ? <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                      : <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    }
                  </div>
                  {errors.customerName && <p className="mt-1 text-xs text-red-500">{errors.customerName}</p>}

                  {/* Customer dropdown */}
                  {customerDropdownOpen && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-h-52 overflow-y-auto">
                      <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            setField('customerName', c.name);
                            setSelectedCustomerId(c.id);
                            setCustomerDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-brand-50 flex items-center gap-2.5 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-brand-700"
                            style={{ background: 'rgba(31,53,94,0.1)' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                            {(() => { const p = c.contacts.find(ct => ct.isPrimary) ?? c.contacts[0]; return p?.email ? <div className="text-[11px] text-gray-400 truncate">{p.email}</div> : null; })()}
                          </div>
                          {selectedCustomerId === c.id && <Check size={13} className="text-brand-500 flex-shrink-0" />}
                        </button>
                      ))}
                      {/* Allow typing a new customer not in the list */}
                      {form.customerName.trim() &&
                        !state.customers.some(c => c.name.toLowerCase() === form.customerName.toLowerCase()) && (
                        <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                          <p className="text-[11px] text-amber-600 font-medium">
                            New customer — will be saved with shipment
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Customer PO — plain field */}
                <Field
                  label="Customer PO / Reference" icon={<Hash size={13} />}
                  value={form.customerPO}
                  onChange={v => setField('customerPO', v)}
                  placeholder="e.g. PO-2026-0441"
                />
              </div>

              {/* Part Description — searchable combobox with saved-parts library */}
              <div ref={partBoxRef} className="relative" data-tour="kiosk-part">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={13} /> Part / Profile Description <span className="text-red-500">*</span>
                    {state.savedParts.length > 0 && (
                      <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700">
                        <BookOpen size={9} /> {state.savedParts.length} saved
                      </span>
                    )}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.partDescription}
                    onChange={e => {
                      setField('partDescription', e.target.value);
                      setSelectedPartId(undefined);
                      setPartDropdownOpen(true);
                    }}
                    onFocus={() => setPartDropdownOpen(true)}
                    placeholder="Search saved parts or describe the part…"
                    className={`w-full pl-4 pr-9 py-3 rounded-xl border-2 text-sm text-gray-800 transition-colors outline-none ${
                      errors.partDescription
                        ? 'border-red-300 bg-red-50 placeholder-red-300'
                        : 'border-gray-200 focus:border-brand-400 bg-white placeholder-gray-400'
                    }`}
                  />
                  {selectedPartId
                    ? <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                    : <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  }
                </div>
                {errors.partDescription && <p className="mt-1 text-xs text-red-500">{errors.partDescription}</p>}

                {/* Part dropdown */}
                {partDropdownOpen && hasPartSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-h-64 overflow-y-auto">

                    {/* Saved parts section */}
                    {filteredSavedParts.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-brand-50 border-b border-brand-100 flex items-center gap-1.5">
                          <BookOpen size={11} className="text-brand-600" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">
                            Parts Library
                          </span>
                        </div>
                        {filteredSavedParts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              setField('partDescription', p.name);
                              setSelectedPartId(p.id);
                              setPartDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-brand-50 flex items-center gap-2.5 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-brand-600 bg-brand-100">
                              <Sparkles size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                              <div className="text-[11px] text-gray-400 truncate">
                                {[p.material, p.customerName].filter(Boolean).join(' · ')}
                                {p.usageCount > 1 && (
                                  <span className="ml-1 text-brand-500 font-medium">
                                    Used {p.usageCount}×
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedPartId === p.id && <Check size={13} className="text-brand-500 flex-shrink-0" />}
                          </button>
                        ))}
                      </>
                    )}

                    {/* Recent from shipments section */}
                    {recentDescriptions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                          <Clock size={11} className="text-gray-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            Recent Shipments
                          </span>
                        </div>
                        {recentDescriptions.map(desc => (
                          <button
                            key={desc}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              setField('partDescription', desc);
                              setSelectedPartId(undefined);
                              setPartDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2.5 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 bg-gray-100">
                              <Clock size={12} />
                            </div>
                            <span className="text-sm text-gray-700 truncate">{desc}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* "New part will be saved" hint */}
                    {form.partDescription.trim() && (
                      <div className="px-3 py-2 bg-green-50 border-t border-green-100">
                        <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                          <Sparkles size={10} />
                          New description will be auto-saved to the Parts Library
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Numeric fields */}
              <div data-tour="kiosk-details" className="grid grid-cols-3 gap-4">
                <Field
                  label="Piece Count" icon={<Layers size={13} />} required type="number"
                  value={form.quantity} error={errors.quantity}
                  onChange={v => setField('quantity', v)}
                  placeholder="0"
                />
                <Field
                  label="Rack Count" icon={<Layers size={13} />} type="number"
                  value={form.rackCount}
                  onChange={v => setField('rackCount', v)}
                  placeholder="optional"
                />
                <Field
                  label="Weight (lbs)" icon={<AlignLeft size={13} />} type="number"
                  value={form.weightLbs}
                  onChange={v => setField('weightLbs', v)}
                  placeholder="optional"
                />
              </div>
            </FormSection>

            {/* ── Condition on Arrival ────────────────────────────────────── */}
            <FormSection title="Condition on Arrival" icon={<MapPin size={14} className="text-brand-500" />}>
              <textarea
                rows={2}
                value={form.conditionNotes}
                onChange={e => setField('conditionNotes', e.target.value)}
                placeholder="Note any damage, open packaging, rust, missing items… (leave blank if OK)"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-400 bg-white text-sm text-gray-800 placeholder-gray-400 outline-none resize-none"
              />
            </FormSection>

            {/* ── Delivery Info (collapsible) ──────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowDelivery(v => !v)}
                className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-gray-400" />
                  Delivery Info
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  {(form.driverName || form.driverCompany) && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
                  )}
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${showDelivery ? 'rotate-180' : ''}`}
                />
              </button>
              {showDelivery && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <Field
                      label="Driver Name" icon={<User size={13} />}
                      value={form.driverName}
                      onChange={v => setField('driverName', v)}
                      placeholder="e.g. John Smith"
                    />
                    <Field
                      label="Transport Company" icon={<Truck size={13} />}
                      value={form.driverCompany}
                      onChange={v => setField('driverCompany', v)}
                      placeholder="e.g. ABC Freight"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Received by:</span>
                    <strong className="text-gray-700">{state.currentUser.name}</strong>
                    <span className="mx-1">·</span>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Additional Notes (collapsible) ──────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowNotes(v => !v)}
                className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlignLeft size={14} className="text-gray-400" />
                  Additional Notes
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  {form.notes && <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />}
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${showNotes ? 'rotate-180' : ''}`}
                />
              </button>
              {showNotes && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                    placeholder="Handling requirements, special instructions from the customer…"
                    className="w-full mt-4 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-400 bg-white text-sm text-gray-800 placeholder-gray-400 outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* ── Submit ──────────────────────────────────────────────────── */}
            {!sessionStarted && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-lg">⏱</span>
                <p className="text-sm text-amber-700 font-medium">
                  Start your session timer above before continuing
                </p>
              </div>
            )}

            <button
              onClick={handleFormNext}
              disabled={!sessionStarted}
              className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ACCENT }}
            >
              <Camera size={18} /> Continue to Photos
            </button>
          </div>
        </div>
      )}

      {/* ── PHOTOS STEP ───────────────────────────────────────────────────── */}
      {step === 'photos' && (
        <div className="flex-1 flex flex-col">
          {/* Sub-header */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
              <button
                onClick={() => setStep('form')}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="font-bold text-gray-800 text-sm">Shipment Photos</div>
                <div className="text-xs text-gray-400">Capture pallet, labels, and any damage</div>
              </div>
              <div className="ml-auto text-xs text-gray-400 font-medium">
                {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''} taken` : 'No photos yet'}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">

              {/* Photo grid */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                      <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Camera button */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoCapture}
                className="hidden"
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full py-5 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center gap-3 text-gray-500 font-semibold text-sm hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                <ImagePlus size={22} />
                {photos.length === 0 ? 'Tap to Take or Upload Photo' : 'Add Another Photo'}
              </button>

              {/* Quick summary */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Receipt Summary</p>
                <SummaryRow label="Customer" value={form.customerName} />
                {form.customerPO && <SummaryRow label="PO" value={form.customerPO} />}
                <SummaryRow label="Parts" value={form.partDescription} />
                <SummaryRow label="Qty" value={`${form.quantity} pieces`} />
                {form.conditionNotes && <SummaryRow label="Condition" value={form.conditionNotes} />}
                {form.driverName && <SummaryRow label="Driver" value={form.driverName + (form.driverCompany ? ` · ${form.driverCompany}` : '')} />}
              </div>

              {/* CTA */}
              <button
                data-tour="kiosk-confirm"
                onClick={handleConfirmReceipt}
                className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.99]"
                style={{ background: ACCENT }}
              >
                <Check size={20} />
                {photos.length === 0 ? 'Confirm Receipt (No Photos)' : `Confirm Receipt with ${photos.length} Photo${photos.length > 1 ? 's' : ''}`}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* ── DONE STEP ─────────────────────────────────────────────────────── */}
      {step === 'done' && savedShipment && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col items-center gap-6">

            {/* Success mark */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-brand" style={{ background: ACCENT }}>
              <CheckCircle size={32} className="text-white" />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800">Shipment Logged!</h1>
              <p className="mt-1 text-sm text-gray-500">
                Received for <strong>{savedShipment.customerName}</strong>. Pending admin review before inspection.
              </p>
            </div>

            {/* Barcode label */}
            <div
              id="barcode-label"
              className="w-full bg-white rounded-2xl shadow-sm overflow-hidden border-2"
              style={{ borderColor: ACCENT }}
            >
              <div className="px-6 py-4" style={{ background: ACCENT }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                  DECORA Job Barcode
                </div>
                <div className="text-3xl font-black tracking-[0.2em] text-white">
                  {savedShipment.barcodeId}
                </div>
                <div className="mt-1 text-[11px] text-white/50">
                  {new Date(savedShipment.receivedAt).toLocaleString()} · {savedShipment.receivedBy}
                </div>
              </div>
              {/* Scannable barcode */}
              <div className="px-6 py-4 border-b border-gray-100 bg-white">
                <BarcodeGraphic value={savedShipment.barcodeId} />
              </div>

              <div className="px-5 py-4 space-y-2">
                <SummaryRow label="Customer" value={savedShipment.customerName} />
                {savedShipment.customerPO && <SummaryRow label="PO" value={savedShipment.customerPO} />}
                <SummaryRow label="Parts" value={savedShipment.partDescription} />
                <SummaryRow label="Qty" value={`${savedShipment.quantity} pcs`} />
                <SummaryRow label="Status" value="📋 Pending Admin Review" />
                {photos.length > 0 && <SummaryRow label="Photos" value={`${photos.length} attached`} />}
              </div>
              <div className="px-5 pb-5">
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  <Printer size={15} /> Print Barcode Label
                </button>
              </div>
            </div>

            {/* Photos preview */}
            {photos.length > 0 && (
              <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
                  {photos.length} Photo{photos.length > 1 ? 's' : ''} Captured
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session complete gate */}
            {!sessionDone && (
              <div className="w-full p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 text-center font-medium">
                ⏱ Complete your session timer above before starting a new receipt
              </div>
            )}

            {/* Actions */}
            <div className="w-full grid grid-cols-2 gap-4">
              <button
                onClick={reset}
                disabled={!sessionDone}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw size={17} /> New Receipt
              </button>
              <button
                onClick={() => navigate('/')}
                className="py-4 rounded-2xl text-white font-bold transition-all hover:brightness-110"
                style={{ background: ACCENT }}
              >
                Back to ERP
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ onBack, currentUser }: { onBack: () => void; currentUser: string }) {
  return (
    <div
      className="flex items-center justify-between px-8 py-4"
      style={{ background: '#0b1424', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-4">
        <PackageOpen size={26} className="text-white" />
        <div>
          <div className="flex items-center gap-2">
            <div className="text-white font-bold text-lg tracking-tight">RECEIVING KIOSK</div>
            <WorkflowHelp title="Receiving Kiosk Workflow" description="Step-by-step guide to logging an incoming customer shipment." steps={KIOSK_WORKFLOW} variant="dark" />
            <GuidedTourButton steps={KIOSK_TOUR} />
          </div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>DECORA Powder Coatings</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{currentUser}</span>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)' }}
        >
          <ArrowLeft size={15} /> Back to ERP
        </button>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
              i <= idx ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {i < idx ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${
              i === idx ? 'text-brand-700' : i < idx ? 'text-brand-400' : 'text-gray-400'
            }`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 rounded-full transition-colors ${
              i < idx ? 'bg-brand-400' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function FormSection({
  title, icon, children,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-600 flex items-center gap-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label, icon, value, onChange, placeholder, type = 'text', required, error,
}: {
  label: string; icon?: React.ReactNode; value: string;
  onChange: (v: string) => void; placeholder?: string;
  type?: string; required?: boolean; error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          {icon}{label}{required && <span className="text-red-500">*</span>}
        </span>
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl border-2 text-sm text-gray-800 transition-colors outline-none ${
          error
            ? 'border-red-300 bg-red-50 placeholder-red-300'
            : 'border-gray-200 focus:border-brand-400 bg-white placeholder-gray-400'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-3">
      <span className="text-gray-500 font-medium flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-semibold text-right">{value}</span>
    </div>
  );
}

function BarcodeGraphic({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 64,
        displayValue: true,
        fontSize: 13,
        fontOptions: 'bold',
        textMargin: 6,
        margin: 8,
        background: '#ffffff',
        lineColor: '#1f355e',
      });
    }
  }, [value]);
  return <svg ref={svgRef} className="w-full" />;
}
