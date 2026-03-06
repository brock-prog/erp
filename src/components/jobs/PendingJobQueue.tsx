import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CheckCircle, Clock, AlertTriangle, ChevronRight,
  X, Save, Zap, Package, MapPin, FileText, Image,
  Truck, ShieldCheck, Send, Paperclip, Search, Palette,
  Calendar, PackageCheck, Box, ScanLine, ExternalLink,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { useApp } from '../../context/AppContext';
import { generateId } from '../../utils';
import type { PendingJobOrder, Job, ProductionLine, IncomingShipment, PJOAttachment, MaterialRequirement, JobPhase, JobPhaseType, JobPhaseStatus } from '../../types';
import { PRODUCTION_LINE_LABELS } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const PJQ_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '📦', label: 'Shipment Arrives',
    description: 'Customer drops off parts at the Receiving Kiosk. A shipment record is created.' },
  { type: 'action', icon: '🔍', label: 'Admin Reviews Shipment',
    description: 'Open the shipment card in the "New" tab to begin the review process.' },
  { type: 'action', icon: '📎', label: 'Upload Profile Drawings',
    description: 'Attach CAD files, PDFs, or photos of the parts for the operators to reference.' },
  { type: 'action', icon: '🔴', label: 'Mark Critical Surface Areas',
    description: 'Add red-flagged notes for surfaces that require special care or masking.' },
  { type: 'action', icon: '🎨', label: 'Select Paint / Powder',
    description: 'Search inventory for the correct powder colour. Enter required kg. System warns if stock is insufficient.' },
  { type: 'decision', icon: '📊', label: 'Sufficient Stock?',
    branches: [
      { label: '✓ Yes — Proceed', color: 'green',
        steps: [{ label: 'Set staging location + admin notes' }, { label: 'Click Mark as Reviewed' }]},
      { label: '✗ No — Source Powder', color: 'red',
        steps: [{ label: 'Flag for reorder in Inventory' }, { label: 'Hold shipment until stock arrives' }]},
    ]},
  { type: 'action', icon: '✅', label: 'Release Job',
    description: 'Click "Release for Production" to create a Job / Work Order on the production floor.' },
  { type: 'end', icon: '🏭', label: 'Job on Production Floor',
    description: 'The job appears in Jobs / Work Orders and is scheduled for production.' },
];

const PJQ_TOUR: TourStep[] = [
  { selector: '[data-tour="pjq-tabs"]', title: 'Queue Tabs',
    why: 'Shipments move through stages: New (just received), Reviewed (admin checked), Released (on production floor).',
    what: 'Click a tab to see shipments in that stage. The badge count shows how many are waiting.' },
  { selector: '[data-tour="pjq-list"]', title: 'Shipment Cards',
    why: 'Each card shows customer, part description, quantity, priority, and paint status.',
    what: 'Click a card to open the review panel where you attach drawings, mark critical surfaces, and select paint.' },
  { selector: '[data-tour="pjq-nav"]', title: 'Quick Links',
    why: 'Jump to the Receiving Kiosk to log new shipments or the Inspection Kiosk for QC.',
    what: 'Click "Receiving" to open the kiosk in a new view.' },
];

const LINE_COLORS: Record<ProductionLine, string> = {
  'vertical':      '#1f355e',
  'horizontal':    '#009877',
  'batch':         '#7c3aed',
  'sub-extrusion': '#ea580c',
  'sub-panel':     '#0891b2',
};

const PRIORITY_CONFIG = {
  normal:  { label: 'Normal',  color: 'bg-gray-100 text-gray-700' },
  rush:    { label: 'Rush',    color: 'bg-orange-100 text-orange-700' },
  urgent:  { label: 'Urgent',  color: 'bg-red-100 text-red-700' },
};

const PAINT_ARRIVAL_CONFIG = {
  not_ordered: { label: 'Not Ordered', color: 'bg-red-100 text-red-700',    icon: '✗' },
  ordered:     { label: 'Ordered',     color: 'bg-amber-100 text-amber-700', icon: '⟳' },
  arrived:     { label: 'Arrived',     color: 'bg-green-100 text-green-700', icon: '✓' },
};

interface EditForm {
  colorSpec: string;
  finishType: string;
  powderProduct: string;
  substrate: string;
  requestedDueDate: string;
  priority: 'normal' | 'rush' | 'urgent';
  specialInstructions: string;
  maskingRequired: boolean;
  sandblastRequired: boolean;
  estimatedPrice: string;
  adminNotes: string;
  // Paint / material fields
  paintInventoryItemId: string;
  paintArrivalStatus: 'not_ordered' | 'ordered' | 'arrived';
  paintExpectedDate: string;
  paintRequiredKg: string;
  packagingNotes: string;
  // Sublimation phase
  requiresSublimation: boolean;
  sublimationFilmItemId: string;
  sublimationFilmRequiredM: string;
}

interface ReceiveReviewForm {
  stagingLocation: string;
  adminNotes: string;
  attachmentNotes: string;
  criticalSurfaces: string;
  paintInventoryItemId: string;
  paintRequiredKg: string;
}

type Tab = 'received' | 'pending' | 'converted';

// ── Small barcode graphic (CODE128) ─────────────────────────────────────────

function PJOBarcodeGraphic({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 1.6,
        height: 36,
        displayValue: true,
        fontSize: 10,
        fontOptions: 'bold',
        textMargin: 4,
        margin: 6,
        background: '#f8fafc',
        lineColor: '#1f355e',
      });
    }
  }, [value]);
  return <svg ref={svgRef} className="w-full max-w-[220px]" />;
}

export function PendingJobQueue() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('received');

  // Pending job order drawer state
  const [selectedPjoId, setSelectedPjoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  // Attachment state (local to drawer session)
  const [attachments, setAttachments] = useState<PJOAttachment[]>([]);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // Paint search state
  const [paintQuery, setPaintQuery] = useState('');
  const [paintDropdownOpen, setPaintDropdownOpen] = useState(false);

  // Sublimation film search state
  const [filmQuery, setFilmQuery] = useState('');
  const [filmDropdownOpen, setFilmDropdownOpen] = useState(false);

  // Received shipment drawer state
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReceiveReviewForm | null>(null);
  // Drawing attachments + paint search for the received shipment panel
  const [shipDrawings, setShipDrawings] = useState<PJOAttachment[]>([]);
  const shipDrawingInputRef = useRef<HTMLInputElement>(null);
  const [shipPaintQuery, setShipPaintQuery] = useState('');
  const [shipPaintDropdownOpen, setShipPaintDropdownOpen] = useState(false);

  // Data
  const received = state.incomingShipments.filter(s => s.status === 'received');
  const pending = state.pendingJobOrders.filter(p => p.status === 'pending_admin');
  const converted = state.pendingJobOrders.filter(p => p.status === 'converted');

  const selectedPjo = selectedPjoId ? state.pendingJobOrders.find(p => p.id === selectedPjoId) : null;
  const selectedShipment = selectedShipmentId ? state.incomingShipments.find(s => s.id === selectedShipmentId) : null;

  const anyPanelOpen = !!(selectedPjo || selectedShipment);

  // Powder inventory items
  const powderItems = state.inventory.filter(i => i.category === 'powder' && i.active !== false);
  const selectedPaintItem = editForm?.paintInventoryItemId
    ? powderItems.find(p => p.id === editForm.paintInventoryItemId)
    : null;

  // Filtered paint results
  const paintResults = paintQuery.trim().length > 0
    ? powderItems.filter(p => {
        const q = paintQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.colorCode ?? '').toLowerCase().includes(q) ||
          (p.supplier ?? '').toLowerCase().includes(q) ||
          (p.manufacturer ?? '').toLowerCase().includes(q)
        );
      }).slice(0, 12)
    : powderItems.slice(0, 12);

  // Sublimation film / transfer paper inventory items
  const filmItems = state.inventory.filter(
    i => (i.category === 'transfer_paper' || i.category === 'sublimation_ink') && i.active !== false
  );
  const selectedFilmItem = editForm?.sublimationFilmItemId
    ? filmItems.find(f => f.id === editForm.sublimationFilmItemId)
    : null;
  const filmResults = filmQuery.trim().length > 0
    ? filmItems.filter(f => f.name.toLowerCase().includes(filmQuery.toLowerCase()) ||
        (f.sku ?? '').toLowerCase().includes(filmQuery.toLowerCase())).slice(0, 10)
    : filmItems.slice(0, 10);

  // ── Received shipment actions ──────────────────────────────────────────────

  function openShipment(s: IncomingShipment) {
    setSelectedPjoId(null);
    setEditForm(null);
    setAttachments([]);
    setPaintQuery('');
    setSelectedShipmentId(s.id);
    setShipDrawings(s.drawingAttachments ?? []);
    setShipPaintQuery('');
    setShipPaintDropdownOpen(false);
    setReviewForm({
      stagingLocation: s.stagingLocation ?? '',
      adminNotes: s.adminNotes ?? '',
      attachmentNotes: '',
      criticalSurfaces: s.criticalSurfaces ?? '',
      paintInventoryItemId: s.paintInventoryItemId ?? '',
      paintRequiredKg: s.paintRequiredKg != null ? String(s.paintRequiredKg) : '',
    });
  }

  function buildShipmentPayload(s: IncomingShipment, rf: ReceiveReviewForm): Partial<IncomingShipment> {
    return {
      stagingLocation:      rf.stagingLocation.trim()   || undefined,
      adminNotes:           rf.adminNotes.trim()        || undefined,
      criticalSurfaces:     rf.criticalSurfaces.trim()  || undefined,
      drawingAttachments:   shipDrawings.length > 0 ? shipDrawings : undefined,
      paintInventoryItemId: rf.paintInventoryItemId      || undefined,
      paintRequiredKg:      rf.paintRequiredKg ? parseFloat(rf.paintRequiredKg) : undefined,
    };
  }

  function handleSaveShipmentDraft() {
    if (!selectedShipment || !reviewForm) return;
    dispatch({
      type: 'UPDATE_INCOMING_SHIPMENT',
      payload: { ...selectedShipment, ...buildShipmentPayload(selectedShipment, reviewForm) },
    });
    dispatch({ type: 'ADD_NOTIFICATION', payload: {
      id: generateId(), type: 'info',
      message: `Shipment ${selectedShipment.barcodeId} review info saved`,
      timestamp: new Date().toISOString(), read: false,
    }});
  }

  function handleReleaseForInspection() {
    if (!selectedShipment || !reviewForm) return;
    const now = new Date().toISOString();
    dispatch({
      type: 'UPDATE_INCOMING_SHIPMENT',
      payload: {
        ...selectedShipment,
        ...buildShipmentPayload(selectedShipment, reviewForm),
        status: 'awaiting_inspection',
        releasedBy: state.currentUser.name,
        releasedAt: now,
      },
    });
    dispatch({ type: 'ADD_NOTIFICATION', payload: {
      id: generateId(), type: 'success',
      message: `${selectedShipment.barcodeId} released for inspection — ${selectedShipment.customerName}`,
      timestamp: now, read: false,
    }});
    setSelectedShipmentId(null);
    setReviewForm(null);
    setShipDrawings([]);
  }

  // Drawing attachments for the received shipment review
  function handleShipDrawingFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const data = e.target?.result as string;
        const att: PJOAttachment = {
          id: generateId(), name: file.name, type: file.type, data,
          uploadedAt: new Date().toISOString(), uploadedBy: state.currentUser.name,
        };
        setShipDrawings(prev => [...prev, att]);
      };
      reader.readAsDataURL(file);
    });
  }

  function selectShipPaint(itemId: string) {
    setReviewForm(f => f && ({ ...f, paintInventoryItemId: itemId }));
    setShipPaintQuery('');
    setShipPaintDropdownOpen(false);
  }

  // Filtered powder items for the shipment paint search
  const shipPaintResults = shipPaintQuery.trim().length > 0
    ? powderItems.filter(p => {
        const q = shipPaintQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.colorCode ?? '').toLowerCase().includes(q) ||
          (p.supplier ?? '').toLowerCase().includes(q) ||
          (p.manufacturer ?? '').toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : powderItems.slice(0, 10);

  const selectedShipPaintItem = reviewForm?.paintInventoryItemId
    ? powderItems.find(p => p.id === reviewForm.paintInventoryItemId)
    : null;

  // ── Pending job order actions ──────────────────────────────────────────────

  function openJob(pjo: PendingJobOrder) {
    setSelectedShipmentId(null);
    setReviewForm(null);
    setSelectedPjoId(pjo.id);
    setPaintQuery('');
    setPaintDropdownOpen(false);
    setFilmQuery('');
    setFilmDropdownOpen(false);
    setAttachments(pjo.attachments ?? []);
    setEditForm({
      colorSpec: pjo.colorSpec ?? '',
      finishType: pjo.finishType ?? '',
      powderProduct: pjo.powderProduct ?? '',
      substrate: pjo.substrate ?? '',
      requestedDueDate: pjo.requestedDueDate ?? '',
      priority: pjo.priority,
      specialInstructions: pjo.specialInstructions ?? '',
      maskingRequired: pjo.maskingRequired ?? false,
      sandblastRequired: pjo.sandblastRequired ?? false,
      estimatedPrice: pjo.estimatedPrice ? String(pjo.estimatedPrice) : '',
      adminNotes: pjo.adminNotes ?? '',
      paintInventoryItemId: pjo.paintInventoryItemId ?? '',
      paintArrivalStatus: pjo.paintArrivalStatus ?? 'not_ordered',
      paintExpectedDate: pjo.paintExpectedDate ?? '',
      paintRequiredKg: pjo.paintRequiredKg != null ? String(pjo.paintRequiredKg) : '',
      packagingNotes: pjo.packagingNotes ?? '',
      requiresSublimation: pjo.requiresSublimation ?? false,
      sublimationFilmItemId: pjo.sublimationFilmItemId ?? '',
      sublimationFilmRequiredM: pjo.sublimationFilmRequiredM != null ? String(pjo.sublimationFilmRequiredM) : '',
    });
  }

  // File attachment handler
  function handleAttachFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const data = e.target?.result as string;
        const att: PJOAttachment = {
          id: generateId(),
          name: file.name,
          type: file.type,
          data,
          uploadedAt: new Date().toISOString(),
          uploadedBy: state.currentUser.name,
        };
        setAttachments(prev => [...prev, att]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function selectPaint(itemId: string) {
    const item = powderItems.find(p => p.id === itemId);
    if (!item || !editForm) return;
    setEditForm(f => f && ({
      ...f,
      paintInventoryItemId: itemId,
      colorSpec: f.colorSpec || item.name,
      finishType: f.finishType || item.finish || '',
      powderProduct: f.powderProduct || item.sku || item.partNumber || '',
    }));
    setPaintQuery('');
    setPaintDropdownOpen(false);
  }

  function clearPaint() {
    setEditForm(f => f && ({ ...f, paintInventoryItemId: '', paintArrivalStatus: 'not_ordered', paintExpectedDate: '' }));
  }

  function selectFilm(itemId: string) {
    const item = filmItems.find(f => f.id === itemId);
    setEditForm(f => f && ({ ...f, sublimationFilmItemId: itemId,
      sublimationFilmRequiredM: f.sublimationFilmRequiredM || (item?.quantityOnHand ? '' : '') }));
    setFilmQuery('');
    setFilmDropdownOpen(false);
  }

  function clearFilm() {
    setEditForm(f => f && ({ ...f, sublimationFilmItemId: '', sublimationFilmRequiredM: '' }));
  }

  function buildPjoPayload(pjo: PendingJobOrder, form: EditForm): PendingJobOrder {
    return {
      ...pjo,
      colorSpec: form.colorSpec || undefined,
      finishType: form.finishType || undefined,
      powderProduct: form.powderProduct || undefined,
      substrate: form.substrate || undefined,
      requestedDueDate: form.requestedDueDate || undefined,
      priority: form.priority,
      specialInstructions: form.specialInstructions || undefined,
      maskingRequired: form.maskingRequired,
      sandblastRequired: form.sandblastRequired,
      estimatedPrice: form.estimatedPrice ? parseFloat(form.estimatedPrice) : undefined,
      adminNotes: form.adminNotes || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      paintInventoryItemId: form.paintInventoryItemId || undefined,
      paintArrivalStatus: form.paintInventoryItemId ? form.paintArrivalStatus : undefined,
      paintExpectedDate: form.paintExpectedDate || undefined,
      paintRequiredKg: form.paintRequiredKg ? parseFloat(form.paintRequiredKg) : undefined,
      packagingNotes: form.packagingNotes || undefined,
      requiresSublimation: form.requiresSublimation || undefined,
      sublimationFilmItemId: form.requiresSublimation && form.sublimationFilmItemId ? form.sublimationFilmItemId : undefined,
      sublimationFilmRequiredM: form.requiresSublimation && form.sublimationFilmRequiredM ? parseFloat(form.sublimationFilmRequiredM) : undefined,
    };
  }

  function handleSaveDraft() {
    if (!selectedPjo || !editForm) return;
    dispatch({ type: 'UPDATE_PENDING_JOB_ORDER', payload: buildPjoPayload(selectedPjo, editForm) });
    setSelectedPjoId(null);
    setEditForm(null);
    setAttachments([]);
  }

  function handleConvertToJob() {
    if (!selectedPjo || !editForm) return;

    const jobId = generateId();
    const jobNumber = `WO-${new Date().getFullYear()}-${String(state.jobs.length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const salePrice = parseFloat(editForm.estimatedPrice) || 0;

    const requiresSub = editForm.requiresSublimation;

    // Build production phases
    const phases: JobPhase[] = [
      { type: 'powder_coating' as JobPhaseType, status: 'in_progress' as JobPhaseStatus },
      ...(requiresSub ? [{ type: 'sublimation' as JobPhaseType, status: 'pending' as JobPhaseStatus }] : []),
    ];

    // Build material requirements
    const materialReqs: MaterialRequirement[] = [];
    const paintKg = parseFloat(editForm.paintRequiredKg) || 0;
    if (editForm.paintInventoryItemId && paintKg > 0) {
      materialReqs.push({
        id: generateId(),
        type: 'paint',
        inventoryItemId: editForm.paintInventoryItemId,
        itemName: selectedPaintItem?.name ?? editForm.colorSpec ?? 'Paint',
        quantityRequired: paintKg,
        unit: 'kg',
        confirmed: false,
      });
    }
    if (requiresSub) {
      const filmM = parseFloat(editForm.sublimationFilmRequiredM) || 0;
      materialReqs.push({
        id: generateId(),
        type: 'sublimation_film',
        inventoryItemId: editForm.sublimationFilmItemId || undefined,
        itemName: selectedFilmItem?.name ?? 'Sublimation Film',
        quantityRequired: filmM,
        unit: 'm',
        confirmed: false,
      });
    }

    const newJob: Job = {
      id: jobId,
      jobNumber,
      customerId: selectedPjo.customerId ?? 'unknown',
      customerName: selectedPjo.customerName,
      status: 'received',
      priority: editForm.priority === 'urgent' ? 'rush' : (editForm.priority as 'normal' | 'rush'),
      serviceType: requiresSub ? 'both' : 'powder_coating',
      parts: [{
        id: generateId(),
        description: selectedPjo.partDescription,
        material: editForm.substrate || 'Steel',
        quantity: selectedPjo.quantity,
        color: editForm.colorSpec,
        finish: editForm.finishType,
      }],
      powderSpec: {
        powderManufacturer: selectedPaintItem?.manufacturer ?? '',
        powderProduct: editForm.powderProduct || '',
        colorCode: selectedPaintItem?.colorCode ?? '',
        colorName: editForm.colorSpec || '',
        finish: (editForm.finishType as any) || 'gloss',
        mil: 2.5,
        cure: { tempF: 400, minutes: 20 },
        pretreatment: editForm.sandblastRequired ? ['sandblast', 'degreasing'] : ['degreasing', 'iron_phosphate'],
        substrate: editForm.substrate || 'Steel',
        maskingRequired: editForm.maskingRequired,
        maskingNotes: editForm.specialInstructions || undefined,
        sandblastRequired: editForm.sandblastRequired,
        chemicalWashRequired: true,
      },
      phases,
      currentPhaseIndex: 0,
      materialRequirements: materialReqs.length > 0 ? materialReqs : undefined,
      materialsReadyForScheduling: materialReqs.length === 0,
      estimatedHours: requiresSub ? 8 : 4,
      laborCost: 0,
      materialCost: 0,
      totalCost: 0,
      salePrice,
      receivedDate: now.slice(0, 10),
      dueDate: editForm.requestedDueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: editForm.specialInstructions || undefined,
      internalNotes: editForm.adminNotes || `Converted from pending job ${selectedPjo.barcodeId}`,
      attachments: [],
      statusHistory: [{
        status: 'received', timestamp: now,
        userId: state.currentUser.id, userName: state.currentUser.name,
        notes: `Job created from inspection ticket ${selectedPjo.barcodeId}`,
      }],
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: 'ADD_JOB', payload: newJob });
    dispatch({ type: 'UPDATE_PENDING_JOB_ORDER', payload: {
      ...buildPjoPayload(selectedPjo, editForm),
      status: 'converted',
      convertedToJobId: jobId,
      convertedAt: now,
      convertedBy: state.currentUser.name,
    }});
    dispatch({ type: 'ADD_NOTIFICATION', payload: {
      id: generateId(), type: 'success',
      message: `Job ${jobNumber} created from ${selectedPjo.barcodeId} — ${selectedPjo.customerName}`,
      timestamp: now, read: false,
    }});

    setSelectedPjoId(null);
    setEditForm(null);
    setAttachments([]);
    navigate(`/jobs/${jobId}`);
  }

  const EF = editForm!;
  const RF = reviewForm!;

  const TAB_CONFIG: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'received', label: 'Received',        count: received.length,  color: '#f59e0b' },
    { key: 'pending',  label: 'Post-Inspection', count: pending.length,   color: '#3b82f6' },
    { key: 'converted',label: 'Converted',       count: converted.length, color: '#10b981' },
  ];

  return (
    <div className="flex h-full gap-0">
      {/* ── Left panel — list ─────────────────────────────────────────────── */}
      <div className="flex flex-col" style={{ width: anyPanelOpen ? '420px' : '100%', flexShrink: 0 }}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={24} className="text-blue-600" />
                Job Management
                <WorkflowHelp title="Pending Job Queue Workflow" description="How shipments are reviewed and released to the production floor." steps={PJQ_WORKFLOW} />
                <GuidedTourButton steps={PJQ_TOUR} />
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Review received shipments, release for inspection, and create work orders
              </p>
            </div>

            <div data-tour="pjq-nav" className="flex gap-2">
              <button onClick={() => navigate('/receiving-kiosk')} className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
                Receiving
              </button>
              <button onClick={() => navigate('/inspection-kiosk')} className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
                Inspection
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div data-tour="pjq-tabs" className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-xl w-fit">
            {TAB_CONFIG.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelectedPjoId(null); setEditForm(null); setSelectedShipmentId(null); setReviewForm(null); setAttachments([]); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 text-white leading-none"
                    style={{ background: tab === t.key ? t.color : '#9ca3af' }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Lists */}
        <div data-tour="pjq-list" className="space-y-3 flex-1 overflow-y-auto">

          {/* ── Received tab ─────────────────────────────────────────────── */}
          {tab === 'received' && (
            received.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
                <CheckCircle size={40} className="text-green-400 mb-3" />
                <div className="font-semibold text-gray-700">Nothing pending review</div>
                <p className="text-sm text-gray-400 mt-1">All received shipments have been released for inspection.</p>
              </div>
            ) : (
              received.map(s => (
                <ReceivedCard
                  key={s.id}
                  shipment={s}
                  selected={selectedShipmentId === s.id}
                  onClick={() => openShipment(s)}
                />
              ))
            )
          )}

          {/* ── Post-inspection (Pending Admin) tab ──────────────────────── */}
          {tab === 'pending' && (
            pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
                <CheckCircle size={40} className="text-green-400 mb-3" />
                <div className="font-semibold text-gray-700">All jobs are processed!</div>
                <p className="text-sm text-gray-400 mt-1">No inspected jobs awaiting work order creation.</p>
              </div>
            ) : (
              pending.map(pjo => (
                <JobCard key={pjo.id} pjo={pjo} selected={selectedPjoId === pjo.id} onClick={() => openJob(pjo)} />
              ))
            )
          )}

          {/* ── Converted tab ────────────────────────────────────────────── */}
          {tab === 'converted' && (
            converted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
                <Package size={40} className="text-gray-300 mb-3" />
                <div className="font-semibold text-gray-700">No converted jobs yet</div>
              </div>
            ) : (
              converted.map(pjo => (
                <JobCard
                  key={pjo.id} pjo={pjo}
                  selected={selectedPjoId === pjo.id}
                  onClick={() => selectedPjoId === pjo.id ? setSelectedPjoId(null) : setSelectedPjoId(pjo.id)}
                  converted
                />
              ))
            )
          )}
        </div>
      </div>

      {/* ── Right panel — Received shipment review ──────────────────────────── */}
      {selectedShipment && reviewForm && (
        <div className="flex-1 ml-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-widest text-amber-600">
                  {selectedShipment.barcodeId}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Received</span>
              </div>
              <div className="text-sm text-gray-500 mt-0.5">{selectedShipment.customerName} — {selectedShipment.partDescription}</div>
            </div>
            <button onClick={() => { setSelectedShipmentId(null); setReviewForm(null); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* From receiving */}
            <section>
              <SectionHeader title="From Receiving" />
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <InfoRow label="Customer" value={selectedShipment.customerName} />
                {selectedShipment.customerPO && <InfoRow label="Customer PO" value={selectedShipment.customerPO} />}
                <InfoRow label="Parts" value={selectedShipment.partDescription} />
                <InfoRow label="Quantity" value={`${selectedShipment.quantity} pcs`} />
                {selectedShipment.rackCount && <InfoRow label="Racks" value={String(selectedShipment.rackCount)} />}
                {selectedShipment.weightLbs && <InfoRow label="Weight" value={`${selectedShipment.weightLbs} lbs`} />}
                <InfoRow label="Received By" value={selectedShipment.receivedBy} />
                <InfoRow label="Received At" value={new Date(selectedShipment.receivedAt).toLocaleString()} />
              </div>
            </section>

            {/* Driver */}
            {(selectedShipment.driverName || selectedShipment.driverCompany) && (
              <>
                <hr className="border-gray-100" />
                <section>
                  <SectionHeader title="Driver / Delivery" />
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    {selectedShipment.driverName && <InfoRow label="Driver" value={selectedShipment.driverName} icon={<Truck size={12} />} />}
                    {selectedShipment.driverCompany && <InfoRow label="Company" value={selectedShipment.driverCompany} />}
                  </div>
                </section>
              </>
            )}

            {/* Condition */}
            {selectedShipment.conditionNotes && (
              <>
                <hr className="border-gray-100" />
                <section>
                  <SectionHeader title="Condition on Arrival" />
                  <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    {selectedShipment.conditionNotes}
                  </div>
                </section>
              </>
            )}

            {/* Photos */}
            {selectedShipment.photos && selectedShipment.photos.length > 0 && (
              <>
                <hr className="border-gray-100" />
                <section>
                  <SectionHeader title={`Photos (${selectedShipment.photos.length})`} />
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {selectedShipment.photos.map((src, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                        <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            <hr className="border-gray-100" />

            {/* Admin fills in */}
            <section>
              <SectionHeader title="Admin Review" subtitle="Assign staging, attach drawings, link powder, then release for inspection" />
              <div className="mt-3 space-y-5">

                <FormField
                  label="Staging Location"
                  icon={<MapPin size={12} />}
                  value={RF.stagingLocation}
                  onChange={v => setReviewForm(f => f && ({ ...f, stagingLocation: v }))}
                  placeholder="e.g. Rack A3, Bay 2, Floor Section C"
                />

                {/* ── Profile Drawings / CAD Files ─────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <Image size={12} className="text-blue-500" /> Profile Drawings &amp; Documents
                    {shipDrawings.length > 0 && (
                      <span className="ml-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 rounded-full">
                        {shipDrawings.length}
                      </span>
                    )}
                  </label>

                  {/* Attached drawings list */}
                  {shipDrawings.length > 0 && (
                    <div className="mb-2 space-y-1.5">
                      {shipDrawings.map(att => (
                        <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                          <AttachmentIcon type={att.type} />
                          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{att.name}</span>
                          <a href={att.data} download={att.name} className="text-blue-600 hover:underline text-[11px] flex-shrink-0">View</a>
                          <button onClick={() => setShipDrawings(prev => prev.filter(a => a.id !== att.id))} className="text-gray-400 hover:text-red-500">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  <input
                    ref={shipDrawingInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.dwg,.dxf,.step,.stp,.iges,.igs"
                    onChange={e => handleShipDrawingFiles(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => shipDrawingInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-xs font-semibold hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Paperclip size={13} />
                    {shipDrawings.length === 0 ? 'Attach Profile Drawing / CAD / Spec' : 'Add Another File'}
                  </button>
                </div>

                {/* ── Critical Surface Areas ────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-red-500" /> Critical Surface Areas
                  </label>
                  <textarea
                    rows={2}
                    value={RF.criticalSurfaces}
                    onChange={e => setReviewForm(f => f && ({ ...f, criticalSurfaces: e.target.value }))}
                    placeholder="e.g. Face A (bottom flange) — no masking marks. Top holes must be free of powder build-up."
                    className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm resize-none focus:outline-none focus:border-red-400 placeholder-red-300 text-gray-800"
                  />
                  <p className="mt-1 text-[10px] text-red-500 font-medium">These notes will be visible on the inspection ticket and job card.</p>
                </div>

                <hr className="border-gray-100" />

                {/* ── Paint / Powder Code ───────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <Palette size={12} className="text-purple-500" /> Powder / Paint Code
                    {selectedShipPaintItem && (
                      <span className="ml-auto text-[10px] font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Linked
                      </span>
                    )}
                  </label>

                  {selectedShipPaintItem ? (
                    /* Paint selected — show chip + stock info */
                    <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {selectedShipPaintItem.colorHex && (
                          <div className="w-8 h-8 rounded-lg border-2 border-white shadow-sm flex-shrink-0"
                            style={{ background: selectedShipPaintItem.colorHex }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-800 truncate">{selectedShipPaintItem.name}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {[selectedShipPaintItem.manufacturer, selectedShipPaintItem.colorCode].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <button onClick={() => setReviewForm(f => f && ({ ...f, paintInventoryItemId: '' }))} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      {/* Stock level + required */}
                      <div className="px-3 py-2.5 bg-white border-t border-purple-100 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">In Stock</div>
                          <div className={`text-lg font-black ${
                            (selectedShipPaintItem.quantityOnHand ?? 0) < (selectedShipPaintItem.reorderPoint ?? 5)
                              ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {selectedShipPaintItem.quantityOnHand?.toFixed(1) ?? '—'}
                            <span className="text-xs font-medium ml-1 text-gray-400">
                              {selectedShipPaintItem.unit ?? 'kg'}
                            </span>
                          </div>
                          {(selectedShipPaintItem.quantityOnHand ?? 0) < (selectedShipPaintItem.reorderPoint ?? 5) && (
                            <div className="text-[10px] text-red-500 font-semibold mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={9} /> Low stock
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                            Required for Job
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={RF.paintRequiredKg}
                              onChange={e => setReviewForm(f => f && ({ ...f, paintRequiredKg: e.target.value }))}
                              placeholder="0.0"
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:border-purple-400"
                            />
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {selectedShipPaintItem.unit ?? 'kg'}
                            </span>
                          </div>
                          {RF.paintRequiredKg && selectedShipPaintItem.quantityOnHand != null && parseFloat(RF.paintRequiredKg) > selectedShipPaintItem.quantityOnHand && (
                            <div className="text-[10px] text-red-500 font-semibold mt-0.5">
                              ⚠ Insufficient stock
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Paint search combobox */
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={shipPaintQuery}
                          onChange={e => { setShipPaintQuery(e.target.value); setShipPaintDropdownOpen(true); }}
                          onFocus={() => setShipPaintDropdownOpen(true)}
                          placeholder="Search powder by name, colour code, or manufacturer…"
                          className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
                        />
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      {shipPaintDropdownOpen && shipPaintResults.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-h-56 overflow-y-auto">
                          {shipPaintResults.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={e => { e.preventDefault(); selectShipPaint(p.id); }}
                              className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-center gap-2.5 transition-colors border-b border-gray-50 last:border-0"
                            >
                              {p.colorHex && (
                                <div className="w-6 h-6 rounded-md border border-gray-200 flex-shrink-0"
                                  style={{ background: p.colorHex }} />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                                <div className="text-[11px] text-gray-400 truncate">
                                  {[p.manufacturer, p.colorCode].filter(Boolean).join(' · ')}
                                  {p.quantityOnHand != null && (
                                    <span className={`ml-2 font-semibold ${
                                      p.quantityOnHand < (p.reorderPoint ?? 5) ? 'text-red-500' : 'text-green-600'
                                    }`}>
                                      {p.quantityOnHand.toFixed(1)} {p.unit ?? 'kg'} in stock
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <hr className="border-gray-100" />

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Admin Notes (internal only)</label>
                  <textarea
                    rows={2}
                    value={RF.adminNotes}
                    onChange={e => setReviewForm(f => f && ({ ...f, adminNotes: e.target.value }))}
                    placeholder="Pricing context, customer history, scheduling priority, special handling..."
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={handleSaveShipmentDraft}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50"
            >
              <Save size={16} /> Save Draft
            </button>
            <button
              onClick={handleReleaseForInspection}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm"
              style={{ background: '#009877' }}
            >
              <ShieldCheck size={16} /> Release for Inspection
            </button>
          </div>
        </div>
      )}

      {/* ── Right panel — PJO edit drawer ──────────────────────────────────── */}
      {selectedPjo && editForm && (
        <div className="flex-1 ml-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          {/* Header with barcode */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 bg-slate-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-black tracking-widest" style={{ color: selectedPjo.productionLine ? LINE_COLORS[selectedPjo.productionLine] : '#6b7280' }}>
                  {selectedPjo.barcodeId}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_CONFIG[EF.priority].color}`}>
                  {PRIORITY_CONFIG[EF.priority].label}
                </span>
                {/* Open Inspection Kiosk button */}
                <a
                  href="/inspection-kiosk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition-colors"
                  title="Open Inspection Kiosk — scan barcode to pull up this job"
                >
                  <ScanLine size={10} /> Inspection Kiosk
                  <ExternalLink size={9} />
                </a>
              </div>
              <div className="text-sm text-gray-500 mt-0.5 truncate">{selectedPjo.customerName} — {selectedPjo.partDescription}</div>
              {/* Scannable barcode */}
              <div className="mt-2">
                <PJOBarcodeGraphic value={selectedPjo.barcodeId} />
              </div>
            </div>
            <button onClick={() => { setSelectedPjoId(null); setEditForm(null); setAttachments([]); }} className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 ml-3 flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <section>
              <SectionHeader title="From Inspection" />
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <InfoRow label="Customer" value={selectedPjo.customerName} />
                {selectedPjo.customerPO && <InfoRow label="Customer PO" value={selectedPjo.customerPO} />}
                <InfoRow label="Parts" value={selectedPjo.partDescription} />
                <InfoRow label="Quantity" value={`${selectedPjo.quantity} pcs`} />
                {selectedPjo.rackCount && <InfoRow label="Racks" value={String(selectedPjo.rackCount)} />}
                <InfoRow label="Line" value={selectedPjo.productionLine ? PRODUCTION_LINE_LABELS[selectedPjo.productionLine] : 'TBD at scheduling'} />
                {selectedPjo.inspectionNotes && <InfoRow label="Inspection Notes" value={selectedPjo.inspectionNotes} />}
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* ── File Attachments ──────────────────────────────────────── */}
            <section>
              <SectionHeader title="File Attachments" subtitle="Profile drawings, CAD files, customer specs" />
              <div className="mt-3 space-y-2">
                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 group">
                        <AttachmentIcon type={att.type} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{att.name}</div>
                          <div className="text-xs text-gray-400">{att.uploadedBy} · {new Date(att.uploadedAt).toLocaleDateString()}</div>
                        </div>
                        {att.type.startsWith('image/') && (
                          <a href={att.data} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hidden group-hover:block">View</a>
                        )}
                        {att.type === 'application/pdf' && (
                          <a href={att.data} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hidden group-hover:block">Open</a>
                        )}
                        <button onClick={() => removeAttachment(att.id)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.svg,.dxf,.dwg,.step,.stp,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={e => handleAttachFiles(e.target.files)}
                />
                <button
                  onClick={() => attachInputRef.current?.click()}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium"
                >
                  <Paperclip size={15} />
                  {attachments.length === 0 ? 'Attach drawings, specs, CAD files…' : 'Add more files'}
                </button>
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* ── Paint Inventory Link ───────────────────────────────────── */}
            <section>
              <SectionHeader title="Paint / Powder Link" subtitle="Connect to inventory item by supplier, colour, or code" />
              <div className="mt-3 space-y-3">

                {/* Selected paint chip */}
                {selectedPaintItem ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-green-200 bg-green-50">
                    {selectedPaintItem.colorHex && (
                      <div
                        className="w-8 h-8 rounded-lg border border-white shadow-sm flex-shrink-0"
                        style={{ background: selectedPaintItem.colorHex }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-800 truncate">{selectedPaintItem.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                        {selectedPaintItem.colorCode && <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">{selectedPaintItem.colorCode}</span>}
                        {selectedPaintItem.supplier && <span>{selectedPaintItem.supplier}</span>}
                        {selectedPaintItem.finish && <span className="capitalize">{selectedPaintItem.finish}</span>}
                        <span className="text-gray-400">{selectedPaintItem.quantityOnHand} {selectedPaintItem.unit} on hand</span>
                      </div>
                    </div>
                    <button onClick={clearPaint} className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-lg transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  /* Paint search input */
                  <div className="relative">
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:border-blue-400">
                      <Search size={14} className="text-gray-400 flex-shrink-0" />
                      <input
                        value={paintQuery}
                        onChange={e => { setPaintQuery(e.target.value); setPaintDropdownOpen(true); }}
                        onFocus={() => setPaintDropdownOpen(true)}
                        placeholder="Search by supplier, colour name, or code…"
                        className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
                      />
                      {paintQuery && (
                        <button onClick={() => { setPaintQuery(''); setPaintDropdownOpen(false); }} className="text-gray-400 hover:text-gray-600">
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {paintDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                        {paintResults.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400 text-center">No powder products found</div>
                        ) : (
                          paintResults.map(item => (
                            <button
                              key={item.id}
                              onClick={() => selectPaint(item.id)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0"
                            >
                              <div
                                className="w-6 h-6 rounded flex-shrink-0 border border-gray-200"
                                style={{ background: item.colorHex ?? '#e5e7eb' }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-800 truncate">{item.name}</div>
                                <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                                  {item.colorCode && <span className="font-mono">{item.colorCode}</span>}
                                  {item.supplier && <span>·  {item.supplier}</span>}
                                  {item.finish && <span className="capitalize">· {item.finish}</span>}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 flex-shrink-0">{item.quantityOnHand} {item.unit}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Paint required kg */}
                {EF.paintInventoryItemId && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Paint Required (kg)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={EF.paintRequiredKg}
                        onChange={e => setEditForm(f => f && ({ ...f, paintRequiredKg: e.target.value }))}
                        placeholder="0.0"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    {selectedPaintItem && EF.paintRequiredKg && (
                      <div className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
                        parseFloat(EF.paintRequiredKg) > selectedPaintItem.quantityOnHand
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-green-50 border-green-200 text-green-700'
                      }`}>
                        {parseFloat(EF.paintRequiredKg) > selectedPaintItem.quantityOnHand
                          ? `Insufficient — only ${selectedPaintItem.quantityOnHand} ${selectedPaintItem.unit} on hand`
                          : `Stock OK — ${selectedPaintItem.quantityOnHand} ${selectedPaintItem.unit} available`
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Paint arrival status */}
                {EF.paintInventoryItemId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                        <PackageCheck size={12} /> Paint Arrival Status
                      </label>
                      <div className="flex gap-1.5">
                        {(['not_ordered', 'ordered', 'arrived'] as const).map(status => (
                          <button
                            key={status}
                            onClick={() => setEditForm(f => f && ({ ...f, paintArrivalStatus: status }))}
                            className={`flex-1 py-2 text-xs rounded-xl font-semibold border-2 transition-all ${
                              EF.paintArrivalStatus === status
                                ? PAINT_ARRIVAL_CONFIG[status].color + ' border-current'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {PAINT_ARRIVAL_CONFIG[status].icon} {PAINT_ARRIVAL_CONFIG[status].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {EF.paintArrivalStatus === 'ordered' && (
                      <FormField
                        label="Expected Date"
                        icon={<Calendar size={12} />}
                        value={EF.paintExpectedDate}
                        onChange={v => setEditForm(f => f && ({ ...f, paintExpectedDate: v }))}
                        type="date"
                      />
                    )}
                  </div>
                )}
              </div>
            </section>

            <hr className="border-gray-100" />

            <section>
              <SectionHeader title="Job Specification" subtitle="Fill in before creating official work order" />
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Colour / Shade" value={EF.colorSpec} onChange={v => setEditForm(f => f && ({ ...f, colorSpec: v }))} placeholder="e.g. Tiger Drylac Matte Black" />
                  <FormField label="Finish Type" value={EF.finishType} onChange={v => setEditForm(f => f && ({ ...f, finishType: v }))} placeholder="e.g. Matte, Gloss, Textured" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Powder Product" value={EF.powderProduct} onChange={v => setEditForm(f => f && ({ ...f, powderProduct: v }))} placeholder="e.g. 049-90002" />
                  <FormField label="Substrate / Material" value={EF.substrate} onChange={v => setEditForm(f => f && ({ ...f, substrate: v }))} placeholder="e.g. Steel, Aluminum" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                    <select value={EF.priority} onChange={e => setEditForm(f => f && ({ ...f, priority: e.target.value as any }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
                      <option value="normal">Normal</option>
                      <option value="rush">Rush</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <FormField label="Requested Due Date" value={EF.requestedDueDate} type="date" onChange={v => setEditForm(f => f && ({ ...f, requestedDueDate: v }))} />
                </div>
                <FormField label="Estimated Price ($)" value={EF.estimatedPrice} type="number" onChange={v => setEditForm(f => f && ({ ...f, estimatedPrice: v }))} placeholder="0.00" />
              </div>
            </section>

            <section>
              <SectionHeader title="Process Requirements" />
              <div className="mt-3 flex gap-4 flex-wrap">
                <CheckboxField label="Masking Required" checked={EF.maskingRequired} onChange={v => setEditForm(f => f && ({ ...f, maskingRequired: v }))} />
                <CheckboxField label="Sandblast Required" checked={EF.sandblastRequired} onChange={v => setEditForm(f => f && ({ ...f, sandblastRequired: v }))} />
              </div>
            </section>

            {/* ── Sublimation Phase ──────────────────────────────────────────── */}
            <section className={`rounded-xl border-2 p-4 transition-colors ${EF.requiresSublimation ? 'border-cyan-300 bg-cyan-50/50' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setEditForm(f => f && ({ ...f, requiresSublimation: !f.requiresSublimation }))}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${EF.requiresSublimation ? 'bg-cyan-600 border-cyan-600' : 'border-gray-300 bg-white'}`}
                >
                  {EF.requiresSublimation && <span className="text-white text-xs font-bold">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800">Requires Sublimation Phase</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Parts go directly from powder coating to temporary storage, then to sublimation press. Job stays open until sublimation is complete.
                  </div>
                </div>
              </div>

              {EF.requiresSublimation && (
                <div className="mt-4 space-y-3 border-t border-cyan-200 pt-4">
                  {/* Film inventory picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <Palette size={12} className="text-cyan-600" /> Sublimation Film / Transfer Paper
                    </label>
                    {selectedFilmItem ? (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cyan-100 border border-cyan-200">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-cyan-900 truncate">{selectedFilmItem.name}</div>
                          <div className="text-xs text-cyan-600 flex items-center gap-2">
                            <span>{selectedFilmItem.sku}</span>
                            <span>· {selectedFilmItem.quantityOnHand} {selectedFilmItem.unit} on hand</span>
                          </div>
                        </div>
                        <button onClick={clearFilm} className="text-cyan-500 hover:text-cyan-700 p-1">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:border-cyan-400">
                          <Search size={14} className="text-gray-400 flex-shrink-0" />
                          <input
                            value={filmQuery}
                            onChange={e => { setFilmQuery(e.target.value); setFilmDropdownOpen(true); }}
                            onFocus={() => setFilmDropdownOpen(true)}
                            placeholder="Search transfer paper or sublimation film…"
                            className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
                          />
                          {filmQuery && (
                            <button onClick={() => { setFilmQuery(''); setFilmDropdownOpen(false); }} className="text-gray-400 hover:text-gray-600">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        {filmDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                            {filmResults.length === 0 ? (
                              <div className="p-3 text-sm text-gray-400 text-center">No sublimation film items found — add them in Inventory</div>
                            ) : (
                              filmResults.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => selectFilm(item.id)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-cyan-50 transition-colors text-left border-b border-gray-50 last:border-0"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-800 truncate">{item.name}</div>
                                    <div className="text-xs text-gray-400">{item.sku} · {item.quantityOnHand} {item.unit}</div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Film required metres + stock check */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Film Required (metres)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={EF.sublimationFilmRequiredM}
                        onChange={e => setEditForm(f => f && ({ ...f, sublimationFilmRequiredM: e.target.value }))}
                        placeholder="0.0"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    {selectedFilmItem && EF.sublimationFilmRequiredM && (
                      <div className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
                        parseFloat(EF.sublimationFilmRequiredM) > selectedFilmItem.quantityOnHand
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-green-50 border-green-200 text-green-700'
                      }`}>
                        {parseFloat(EF.sublimationFilmRequiredM) > selectedFilmItem.quantityOnHand
                          ? `Insufficient — only ${selectedFilmItem.quantityOnHand} ${selectedFilmItem.unit} on hand`
                          : `Stock OK — ${selectedFilmItem.quantityOnHand} ${selectedFilmItem.unit} available`
                        }
                      </div>
                    )}
                  </div>

                  {/* Two-phase info banner */}
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-600" />
                    <span>This job will have <strong>two phases</strong>: <strong>Powder Coating</strong> then <strong>Sublimation</strong>. After powder coating is complete the job enters "Awaiting Sublimation" status and is stored until scheduled for the sublimation press.</span>
                  </div>
                </div>
              )}
            </section>

            <section>
              <SectionHeader title="Instructions & Notes" />
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Special Instructions</label>
                  <textarea rows={2} value={EF.specialInstructions} onChange={e => setEditForm(f => f && ({ ...f, specialInstructions: e.target.value }))} placeholder="Masking details, areas to avoid, customer requirements..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-blue-400" />
                </div>
                {/* ── Packaging Notes ────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Box size={12} /> Packaging Notes / Requests
                  </label>
                  <textarea
                    rows={2}
                    value={EF.packagingNotes}
                    onChange={e => setEditForm(f => f && ({ ...f, packagingNotes: e.target.value }))}
                    placeholder="Wrapping requirements, pallet instructions, fragile parts, custom labelling…"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Admin Notes (internal only)</label>
                  <textarea rows={2} value={EF.adminNotes} onChange={e => setEditForm(f => f && ({ ...f, adminNotes: e.target.value }))} placeholder="Pricing notes, scheduling priority, customer history..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </section>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            {/* Scan to Inspection Kiosk hint */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <ScanLine size={13} />
              <span>Scan the barcode above at the <strong>Inspection Kiosk</strong> to pull up this job directly</span>
              <a
                href="/inspection-kiosk"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto font-semibold flex items-center gap-1 hover:text-blue-900"
              >
                Open <ExternalLink size={11} />
              </a>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveDraft} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50">
                <Save size={16} /> Save Draft
              </button>
              <button onClick={handleConvertToJob} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm" style={{ background: '#1f355e' }}>
                <Zap size={16} /> Create Work Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attachment icon helper ───────────────────────────────────────────────────

function AttachmentIcon({ type }: { type: string }) {
  if (type.startsWith('image/'))
    return <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0"><Image size={14} className="text-blue-600" /></div>;
  if (type === 'application/pdf')
    return <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0"><FileText size={14} className="text-red-600" /></div>;
  return <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Paperclip size={14} className="text-gray-500" /></div>;
}

// ── Received shipment card ───────────────────────────────────────────────────

function ReceivedCard({ shipment, selected, onClick }: { shipment: IncomingShipment; selected: boolean; onClick: () => void }) {
  const age = Math.floor((Date.now() - new Date(shipment.receivedAt).getTime()) / 3600000);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border-l-4 transition-all hover:shadow-md ${selected ? 'ring-2 ring-amber-400' : ''}`}
      style={{ borderLeftColor: '#f59e0b' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-black text-sm tracking-widest text-amber-600">{shipment.barcodeId}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Received</span>
            {shipment.photos && shipment.photos.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold flex items-center gap-1">
                <Image size={10} /> {shipment.photos.length}
              </span>
            )}
          </div>
          <div className="font-semibold text-gray-800 text-sm truncate">{shipment.customerName}</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{shipment.partDescription}</div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">{shipment.quantity} pcs</span>
            {shipment.stagingLocation ? (
              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <MapPin size={10} /> {shipment.stagingLocation}
              </span>
            ) : (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle size={10} /> No staging assigned
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} /> {age < 1 ? 'Just now' : `${age}h ago`}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-400 flex-shrink-0 ml-2 mt-1" />
      </div>
    </button>
  );
}

// ── Post-inspection job card ─────────────────────────────────────────────────

function JobCard({ pjo, selected, onClick, converted }: { pjo: PendingJobOrder; selected: boolean; onClick: () => void; converted?: boolean }) {
  const lineColor = pjo.productionLine ? LINE_COLORS[pjo.productionLine] : '#9ca3af';
  const age = Math.floor((Date.now() - new Date(pjo.createdAt).getTime()) / 3600000);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border-l-4 transition-all hover:shadow-md ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{ borderLeftColor: lineColor }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black text-sm tracking-widest" style={{ color: lineColor }}>{pjo.barcodeId}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_CONFIG[pjo.priority].color}`}>
              {PRIORITY_CONFIG[pjo.priority].label}
            </span>
            {converted && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Converted</span>}
            {pjo.attachments && pjo.attachments.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold flex items-center gap-1">
                <Paperclip size={9} /> {pjo.attachments.length}
              </span>
            )}
            {pjo.paintInventoryItemId && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pjo.paintArrivalStatus ? PAINT_ARRIVAL_CONFIG[pjo.paintArrivalStatus].color : 'bg-gray-100 text-gray-600'}`}>
                <Palette size={9} className="inline mr-0.5" />
                {pjo.paintArrivalStatus ? PAINT_ARRIVAL_CONFIG[pjo.paintArrivalStatus].label : 'Paint Linked'}
              </span>
            )}
          </div>
          <div className="font-semibold text-gray-800 text-sm truncate">{pjo.customerName}</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{pjo.partDescription}</div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-white px-2 py-0.5 rounded-full font-medium" style={{ background: lineColor }}>
              {pjo.productionLine ? PRODUCTION_LINE_LABELS[pjo.productionLine] : 'Line TBD'}
            </span>
            <span className="text-xs text-gray-400">{pjo.quantity} pcs</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} /> {age < 1 ? 'Just now' : `${age}h ago`}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-400 flex-shrink-0 ml-2 mt-1" />
      </div>
      {!converted && !pjo.colorSpec && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle size={12} /> Missing colour spec — needs admin review
        </div>
      )}
    </button>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <div className="text-xs text-gray-400 font-medium flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm text-gray-800 font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text', icon }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">{icon}{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}
