import React, { useState, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, CheckCircle, XCircle, Clock, ChevronRight,
  Package, RotateCcw, Printer, ArrowLeft, AlertTriangle, MapPin,
  ImagePlus, X, Bell, ScanLine, FileText, Eye, ZoomIn,
  AlertCircle, Hash, MinusCircle, PlusCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateId } from '../../utils';
import type { IncomingShipment, PendingJobOrder, PJOAttachment } from '../../types';
import { ProcessTimer } from '../shared/ProcessTimer';

type InspectView = 'list' | 'scan_in' | 'no_drawings' | 'inspect' | 'scan_out' | 'done';

function getPrio(s: IncomingShipment) {
  const p = (s as unknown as { priority?: string }).priority ?? 'normal';
  const color = p === 'high' ? '#ef4444' : p === 'low' ? '#6b7280' : '#009877';
  const label = p === 'high' ? 'HIGH' : p === 'low' ? 'LOW' : 'NORMAL';
  return { p, color, label };
}

function hasDrawings(s: IncomingShipment) {
  return (s.drawingAttachments?.length ?? 0) > 0;
}

export function InspectionKiosk() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [view, setView]                       = useState<InspectView>('list');
  const [selected, setSelected]               = useState<IncomingShipment | null>(null);
  const [decision, setDecision]               = useState<'passed' | 'failed' | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectedQty, setInspectedQty]       = useState<number>(0);
  const [resultJob, setResultJob]             = useState<PendingJobOrder | null>(null);
  const [sessionDone, setSessionDone]         = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<PJOAttachment | null>(null);

  // Scan-out / damage report state
  const [hasIssues, setHasIssues]             = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [issuePhotos, setIssuePhotos]         = useState<string[]>([]);
  const [issueNotified, setIssueNotified]     = useState(false);
  const issuePhotoRef                          = useRef<HTMLInputElement>(null);

  // Sort: priority (high → normal → low) then FIFO
  const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };
  const awaiting = [...state.incomingShipments.filter(s => s.status === 'awaiting_inspection')]
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[(a as { priority?: string }).priority ?? 'normal'] ?? 1;
      const pb = PRIORITY_ORDER[(b as { priority?: string }).priority ?? 'normal'] ?? 1;
      if (pa !== pb) return pa - pb;
      return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    });

  function startInspection(s: IncomingShipment) {
    setSelected(s);
    setDecision(null);
    setInspectionNotes('');
    setInspectedQty(s.quantity);    // default to received qty, inspector adjusts if needed
    setResultJob(null);
    setSessionDone(false);
    setHasIssues(false);
    setIssueDescription('');
    setIssuePhotos([]);
    setIssueNotified(false);
    // Gate: require drawings before inspection begins
    setView(hasDrawings(s) ? 'scan_in' : 'no_drawings');
  }

  function backToList() {
    setView('list');
    setSelected(null);
    setDecision(null);
    setInspectionNotes('');
    setInspectedQty(0);
    setResultJob(null);
    setSessionDone(false);
    setHasIssues(false);
    setIssueDescription('');
    setIssuePhotos([]);
    setIssueNotified(false);
    setPreviewAttachment(null);
  }

  function handleConfirmScanIn() {
    if (!selected) return;
    const now = new Date().toISOString();
    const updated: IncomingShipment = {
      ...selected,
      scannedInAt: now,
      scannedInBy: state.currentUser.name,
    };
    dispatch({ type: 'UPDATE_INCOMING_SHIPMENT', payload: updated });
    setSelected(updated);
    setView('inspect');
  }

  function handleSubmitInspection() {
    if (!selected || !decision || inspectedQty < 1) return;
    if (decision === 'failed' && !inspectionNotes.trim()) return;

    const now = new Date().toISOString();
    const updatedShipment: IncomingShipment = {
      ...selected,
      status: decision,
      inspectedBy: state.currentUser.name,
      inspectedAt: now,
      inspectionNotes: inspectionNotes.trim() || undefined,
      inspectedQuantity: inspectedQty,
    };

    if (decision === 'passed') {
      const pjo: PendingJobOrder = {
        id: generateId(),
        barcodeId: selected.barcodeId,
        shipmentId: selected.id,
        createdAt: now,
        customerName: selected.customerName,
        customerId: selected.customerId,
        customerPO: selected.customerPO,
        partDescription: selected.partDescription,
        quantity: selected.quantity,
        inspectedQuantity: inspectedQty,
        rackCount: selected.rackCount,
        inspectionNotes: inspectionNotes.trim() || undefined,
        criticalSurfaces: selected.criticalSurfaces,
        // Carry drawings forward so schedulers/operators don't need to re-attach
        attachments: selected.drawingAttachments?.length
          ? selected.drawingAttachments
          : undefined,
        priority: 'normal',
        status: 'pending_admin',
      };
      const finalShipment: IncomingShipment = { ...updatedShipment, pendingJobOrderId: pjo.id };
      dispatch({ type: 'UPDATE_INCOMING_SHIPMENT', payload: finalShipment });
      dispatch({ type: 'ADD_PENDING_JOB_ORDER', payload: pjo });
      setSelected(finalShipment);
      setResultJob(pjo);
    } else {
      dispatch({ type: 'UPDATE_INCOMING_SHIPMENT', payload: updatedShipment });
      setSelected(updatedShipment);
      setResultJob(null);
    }

    setView('scan_out');
  }

  function handleIssuePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) setIssuePhotos(prev => [...prev, ev.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  }

  function handleScanOut() {
    if (!selected) return;
    const now = new Date().toISOString();
    const issues = hasIssues
      ? {
          inspectionIssues: {
            hasIssues: true,
            description: issueDescription.trim() || undefined,
            photos: issuePhotos.length > 0 ? issuePhotos : undefined,
            notifiedAt: now,
            notifiedBy: state.currentUser.name,
          },
        }
      : { inspectionIssues: { hasIssues: false as const } };

    const updated: IncomingShipment = {
      ...selected,
      scannedOutAt: now,
      scannedOutBy: state.currentUser.name,
      ...issues,
    };
    dispatch({ type: 'UPDATE_INCOMING_SHIPMENT', payload: updated });
    setSelected(updated);
    if (hasIssues) setIssueNotified(true);
    setView('done');
  }

  const canSubmit = !!decision && inspectedQty >= 1 &&
    (decision !== 'failed' || !!inspectionNotes.trim());
  const passed = decision === 'passed';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f6fa' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-8 py-5"
        style={{ background: '#0b1424', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-4">
          <ShieldCheck size={28} className="text-white" />
          <div>
            <div className="text-white font-bold text-xl tracking-tight">INCOMING INSPECTION</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>DECORA Powder Coatings</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== 'list' && (
            <button
              onClick={backToList}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)' }}
            >
              <ArrowLeft size={15} /> Back to List
            </button>
          )}
          <button
            onClick={() => navigate('/receiving-kiosk')}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)' }}
          >
            Receiving
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)' }}
          >
            ERP Dashboard
          </button>
        </div>
      </div>

      {/* ProcessTimer — mounted for scan_in → inspect → scan_out → done */}
      {(view === 'scan_in' || view === 'inspect' || view === 'scan_out' || view === 'done') && selected && (
        <div className="max-w-xl mx-auto w-full px-8 pt-5">
          <ProcessTimer
            key={selected.id}
            processType="incoming_inspection"
            referenceId={selected.id}
            referenceLabel={selected.barcodeId}
            onComplete={() => setSessionDone(true)}
          />
        </div>
      )}

      {/* ── LIST VIEW ───────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatPill label="Awaiting Inspection" value={awaiting.length} color="#f59e0b" />
              <StatPill
                label="Passed Today"
                value={state.incomingShipments.filter(
                  s => s.status === 'passed' && s.inspectedAt?.startsWith(new Date().toISOString().slice(0, 10)),
                ).length}
                color="#10b981"
              />
              <StatPill
                label="Failed Today"
                value={state.incomingShipments.filter(
                  s => s.status === 'failed' && s.inspectedAt?.startsWith(new Date().toISOString().slice(0, 10)),
                ).length}
                color="#ef4444"
              />
            </div>

            {awaiting.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl shadow-sm">
                <CheckCircle size={56} className="text-green-400 mb-4" />
                <div className="text-xl font-bold text-gray-700">All Clear!</div>
                <p className="text-gray-400 mt-1">No shipments awaiting inspection.</p>
                <button
                  onClick={() => navigate('/receiving-kiosk')}
                  className="mt-6 px-6 py-3 rounded-xl text-white font-semibold"
                  style={{ background: '#1f355e' }}
                >
                  Go to Receiving
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-700 text-lg">Awaiting Inspection ({awaiting.length})</h2>
                  <span className="text-xs text-gray-400 font-medium">Sorted: Priority → FIFO</span>
                </div>
                {awaiting.map((s, idx) => (
                  <InspectionCard key={s.id} s={s} idx={idx} onSelect={startInspection} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NO DRAWINGS BLOCKER ─────────────────────────────────────────────── */}
      {view === 'no_drawings' && selected && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="px-8 py-6 text-center" style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
              <AlertCircle size={48} className="text-amber-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-amber-900">Drawings Required</h2>
              <p className="text-sm text-amber-700 mt-1">
                Inspection cannot begin until profile drawings are attached to this job order.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Row2 label="Customer" value={selected.customerName} />
                <Row2 label="Parts" value={selected.partDescription} />
                <Row2 label="Barcode" value={selected.barcodeId} />
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-800">What needs to be done:</p>
                <p>1. Admin must open the <strong>Pending Job Queue</strong></p>
                <p>2. Find this shipment and open the received shipment drawer</p>
                <p>3. Attach profile drawings / customer specs</p>
                <p>4. This job will then be ready for inspection</p>
              </div>
              <button
                onClick={() => navigate('/job-queue')}
                className="w-full py-3 rounded-2xl font-bold text-white"
                style={{ background: '#1f355e' }}
              >
                Go to Admin Queue
              </button>
              <button
                onClick={backToList}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-medium hover:bg-gray-50 transition-colors"
              >
                Back to Inspection List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCAN-IN VIEW ────────────────────────────────────────────────────── */}
      {view === 'scan_in' && selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-8 py-6 space-y-5">

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-bold text-gray-700 mb-1">
                <ScanLine size={20} className="text-brand-600" /> Confirm Scan-In
              </div>
              <p className="text-sm text-gray-400">Verify the barcode below matches the label on the skid</p>
            </div>

            {/* Barcode card */}
            <div className="bg-white rounded-2xl overflow-hidden border-2" style={{ borderColor: '#1f355e' }}>
              <div className="px-6 py-4" style={{ background: '#1f355e' }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">DECORA Job Barcode</div>
                <div className="text-2xl font-black tracking-[0.2em] text-white">{selected.barcodeId}</div>
                <div className="mt-1 text-xs text-white/50">
                  {selected.customerName} · {selected.partDescription}
                </div>
              </div>
              <div className="px-6 py-4 bg-white">
                <InspBarcodeGraphic value={selected.barcodeId} />
              </div>
            </div>

            {/* Drawings preview — compact */}
            {(selected.drawingAttachments?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1">
                  <FileText size={11} /> {selected.drawingAttachments!.length} Drawing{selected.drawingAttachments!.length > 1 ? 's' : ''} Attached
                </p>
                <div className="flex gap-2 flex-wrap">
                  {selected.drawingAttachments!.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setPreviewAttachment(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium hover:bg-brand-100 transition-colors"
                    >
                      <Eye size={12} /> {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Condition note from receiving */}
            {selected.conditionNotes && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Condition Noted on Arrival</div>
                  <p className="text-sm text-amber-700">{selected.conditionNotes}</p>
                </div>
              </div>
            )}

            {/* Quick summary */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Shipment Summary</p>
              <Row2 label="Customer" value={selected.customerName} />
              <Row2 label="Parts" value={selected.partDescription} />
              <Row2 label="Qty (received)" value={`${selected.quantity} pcs`} />
              {selected.rackCount ? <Row2 label="Racks" value={String(selected.rackCount)} /> : null}
              <Row2 label="Received" value={new Date(selected.receivedAt).toLocaleString()} />
            </div>

            <div className="px-4 py-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700">
              Scanning in as <strong>{state.currentUser.name}</strong>
            </div>

            <button
              onClick={handleConfirmScanIn}
              className="w-full py-5 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-all hover:brightness-110 active:scale-[0.99]"
              style={{ background: '#1f355e' }}
            >
              <ScanLine size={22} /> Confirm Scan-In — Begin Inspection
            </button>

            <button
              onClick={() => { setView('list'); setSelected(null); }}
              className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── INSPECT VIEW ────────────────────────────────────────────────────── */}
      {view === 'inspect' && selected && (
        <div className="flex-1 flex flex-col items-center justify-start px-8 py-6 overflow-y-auto">
          {/* Sub-header */}
          <div className="w-full max-w-2xl mb-4 p-4 rounded-2xl" style={{ background: '#0b1424' }}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-white font-bold text-lg">Inspecting: {selected.customerName}</div>
              <span className="text-xs font-black tracking-widest text-emerald-400">{selected.barcodeId}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {selected.partDescription} — {selected.quantity} pcs received
              </span>
              {selected.stagingLocation && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <MapPin size={11} /> {selected.stagingLocation}
                </span>
              )}
            </div>
          </div>

          <div className="w-full max-w-2xl space-y-6">

            {/* ── Drawings & Profile Specs ─────────────────────────────────── */}
            {(selected.drawingAttachments?.length ?? 0) > 0 && (
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2"
                  style={{ background: '#1f355e' }}>
                  <FileText size={13} /> Profile Drawings &amp; Specifications
                </div>
                <div className="p-6 space-y-4">
                  {/* Drawing thumbnails / download links */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selected.drawingAttachments!.map(a => {
                      const isImage = a.type.startsWith('image/');
                      return (
                        <button
                          key={a.id}
                          onClick={() => setPreviewAttachment(a)}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-gray-100 hover:border-brand-300 hover:bg-brand-50 transition-all group text-left"
                        >
                          {isImage ? (
                            <div className="w-full aspect-video rounded-lg overflow-hidden bg-gray-100 relative">
                              <img src={a.data} alt={a.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn size={20} className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full aspect-video rounded-lg bg-red-50 flex items-center justify-center">
                              <FileText size={28} className="text-red-400" />
                            </div>
                          )}
                          <span className="text-[10px] font-semibold text-gray-600 text-center truncate w-full">{a.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Critical surfaces */}
                  {selected.criticalSurfaces && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                      <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Critical Surfaces — No Masking Marks</div>
                        <p className="text-sm text-red-700">{selected.criticalSurfaces}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Shipment Details ─────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white bg-slate-600">
                Shipment Details
              </div>
              <div className="p-6 space-y-3">
                <Row2 label="Customer" value={selected.customerName} />
                {selected.customerPO && <Row2 label="Customer PO" value={selected.customerPO} />}
                <Row2 label="Parts" value={selected.partDescription} />
                <Row2 label="Qty (received)" value={`${selected.quantity} pieces`} />
                {selected.rackCount ? <Row2 label="Racks" value={String(selected.rackCount)} /> : null}
                {selected.weightLbs ? <Row2 label="Weight" value={`${selected.weightLbs} lbs`} /> : null}
                {selected.conditionNotes && <Row2 label="Condition on Arrival" value={selected.conditionNotes} />}
                {selected.adminNotes && <Row2 label="Admin Notes" value={selected.adminNotes} />}
                {selected.notes && <Row2 label="Notes" value={selected.notes} />}
                <Row2 label="Received By" value={selected.receivedBy} />
                <Row2 label="Received At" value={new Date(selected.receivedAt).toLocaleString()} />
                {selected.scannedInAt && (
                  <Row2
                    label="Scanned In"
                    value={`${new Date(selected.scannedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by ${selected.scannedInBy}`}
                  />
                )}
              </div>
            </div>

            {/* ── Quantity Verification ────────────────────────────────────── */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2"
                style={{ background: '#7c3aed' }}>
                <Hash size={13} /> Count Verification
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">Quantity on PO / received:</span>
                  <span className="font-bold text-gray-800">{selected.quantity} pcs</span>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-3 block">
                    Physically Counted Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setInspectedQty(q => Math.max(0, q - 1))}
                      className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <MinusCircle size={24} className="text-gray-500" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={inspectedQty}
                      onChange={e => setInspectedQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="flex-1 text-center text-3xl font-black border-2 border-gray-200 rounded-2xl py-3 focus:outline-none focus:border-brand-500 bg-white"
                    />
                    <button
                      onClick={() => setInspectedQty(q => q + 1)}
                      className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <PlusCircle size={24} className="text-gray-500" />
                    </button>
                  </div>

                  {/* Variance indicator */}
                  {inspectedQty !== selected.quantity && inspectedQty > 0 && (
                    <div className={`mt-2 flex items-center gap-2 p-3 rounded-xl text-sm font-semibold ${
                      inspectedQty < selected.quantity
                        ? 'bg-red-50 border border-red-200 text-red-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}>
                      <AlertTriangle size={14} />
                      {inspectedQty < selected.quantity
                        ? `Shortage: ${selected.quantity - inspectedQty} pcs short — note this in inspection notes`
                        : `Overage: ${inspectedQty - selected.quantity} pcs over`
                      }
                    </div>
                  )}
                  {inspectedQty === selected.quantity && inspectedQty > 0 && (
                    <div className="mt-2 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
                      <CheckCircle size={14} /> Count matches — {inspectedQty} pcs confirmed
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Pass / Fail ──────────────────────────────────────────────── */}
            <div>
              <p className="text-center text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                Inspection Decision
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDecision('passed')}
                  className="py-6 rounded-2xl flex flex-col items-center gap-2 font-bold text-lg transition-all"
                  style={{
                    border: `3px solid ${decision === 'passed' ? '#22c55e' : '#e5e7eb'}`,
                    background: decision === 'passed' ? '#f0fdf4' : '#fff',
                    color: decision === 'passed' ? '#15803d' : '#9ca3af',
                    transform: decision === 'passed' ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  <CheckCircle size={36} style={{ color: decision === 'passed' ? '#22c55e' : '#d1d5db' }} />
                  PASS
                </button>
                <button
                  onClick={() => setDecision('failed')}
                  className="py-6 rounded-2xl flex flex-col items-center gap-2 font-bold text-lg transition-all"
                  style={{
                    border: `3px solid ${decision === 'failed' ? '#ef4444' : '#e5e7eb'}`,
                    background: decision === 'failed' ? '#fef2f2' : '#fff',
                    color: decision === 'failed' ? '#b91c1c' : '#9ca3af',
                    transform: decision === 'failed' ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  <XCircle size={36} style={{ color: decision === 'failed' ? '#ef4444' : '#d1d5db' }} />
                  FAIL
                </button>
              </div>
            </div>

            {/* ── Inspector Notes ───────────────────────────────────────────── */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Inspector Notes {decision === 'failed' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                rows={3}
                value={inspectionNotes}
                onChange={e => setInspectionNotes(e.target.value)}
                placeholder={
                  decision === 'failed'
                    ? 'Describe the issue — damage, wrong part, contamination, etc.'
                    : 'Optional — note any observations, discrepancies, special handling required…'
                }
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 bg-white text-base outline-none resize-none"
              />
            </div>

            {decision === 'failed' && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Failing this shipment will <strong>not</strong> create a job order. The shipment will be flagged for return to the customer.
                </p>
              </div>
            )}

            <button
              onClick={handleSubmitInspection}
              disabled={!canSubmit}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ background: decision === 'failed' ? '#ef4444' : '#009877' }}
            >
              {inspectedQty < 1
                ? 'Enter counted quantity above'
                : !decision
                  ? 'Select a decision above'
                  : decision === 'passed'
                    ? `✓ Pass — ${inspectedQty} pcs confirmed — Continue to Scan Out`
                    : '✗ Fail — Continue to Scan Out'
              }
            </button>
          </div>
        </div>
      )}

      {/* ── SCAN-OUT VIEW ───────────────────────────────────────────────────── */}
      {view === 'scan_out' && selected && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-8 py-6 space-y-5">

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-bold text-gray-700 mb-1">
                <ScanLine size={20} className="text-accent-500" /> Scan Out &amp; Issue Report
              </div>
              <p className="text-sm text-gray-400">Complete your inspection and report any physical damage found</p>
            </div>

            {/* Inspection result banner */}
            <div className={`p-4 rounded-xl flex items-center gap-3 ${passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {passed
                ? <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                : <XCircle   size={20} className="text-red-600 flex-shrink-0" />
              }
              <div>
                <div className={`font-bold text-sm ${passed ? 'text-green-700' : 'text-red-700'}`}>
                  {passed
                    ? `Inspection Passed${resultJob ? ` — Job ${resultJob.barcodeId} created` : ''}`
                    : 'Inspection Failed'
                  }
                </div>
                {passed && inspectedQty !== selected.quantity && (
                  <div className="text-xs text-amber-600 mt-0.5 font-medium">
                    ⚠ Quantity variance noted: {inspectedQty} counted vs {selected.quantity} on PO
                  </div>
                )}
                {!passed && (
                  <div className="text-xs text-red-600 mt-0.5">
                    Shipment flagged for return to {selected.customerName}
                  </div>
                )}
              </div>
            </div>

            {/* Issues toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-gray-700">Physical Damage or Issues Found?</div>
                  <div className="text-xs text-gray-400 mt-0.5">Report damage to parts, packaging, or skid</div>
                </div>
                <button
                  onClick={() => setHasIssues(v => !v)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${hasIssues ? 'bg-red-500' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${hasIssues ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {hasIssues && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={3}
                    value={issueDescription}
                    onChange={e => setIssueDescription(e.target.value)}
                    placeholder="Describe the damage — scratches, dents, wrong parts, contamination, missing items…"
                    className="w-full px-4 py-3 rounded-xl border-2 border-red-200 focus:border-red-400 bg-red-50 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none"
                  />
                  {issuePhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {issuePhotos.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                          <img src={src} alt={`Damage ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setIssuePhotos(p => p.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input ref={issuePhotoRef} type="file" accept="image/*" multiple onChange={handleIssuePhoto} className="hidden" />
                  <button
                    onClick={() => issuePhotoRef.current?.click()}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-red-200 flex items-center justify-center gap-2 text-red-500 font-medium text-sm hover:border-red-400 transition-colors"
                  >
                    <ImagePlus size={18} />
                    {issuePhotos.length === 0 ? 'Add Damage Photos' : `Add More Photos (${issuePhotos.length} taken)`}
                  </button>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <Bell size={13} className="flex-shrink-0 mt-0.5" />
                    <span>Quality Control &amp; Operations will be notified automatically when you submit.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700">
              Scanning out as <strong>{state.currentUser.name}</strong>
            </div>

            <button
              onClick={handleScanOut}
              className="w-full py-5 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-all hover:brightness-110 active:scale-[0.99]"
              style={{ background: hasIssues ? '#ef4444' : '#009877' }}
            >
              <ScanLine size={22} />
              {hasIssues ? '⚠️  Report Issues & Scan Out' : '✓  All Clear — Confirm Scan Out'}
            </button>
          </div>
        </div>
      )}

      {/* ── DONE VIEW ───────────────────────────────────────────────────────── */}
      {view === 'done' && (
        <div className="flex-1 flex flex-col items-center p-8 space-y-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${passed ? 'bg-green-500' : 'bg-red-500'}`}>
            {passed ? <CheckCircle size={40} className="text-white" /> : <XCircle size={40} className="text-white" />}
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">{passed ? 'Inspection Passed!' : 'Inspection Failed'}</h1>
            <p className="mt-2 text-gray-500">
              {passed
                ? <>Job order <strong>{resultJob?.barcodeId}</strong> created and sent to <strong>Admin Queue</strong>.</>
                : <>Shipment flagged for return to <strong>{selected?.customerName}</strong>.</>
              }
            </p>
            {passed && inspectedQty !== selected?.quantity && (
              <p className="mt-1 text-sm text-amber-600 font-medium">
                Quantity variance recorded — {inspectedQty} counted vs {selected?.quantity} on PO
              </p>
            )}
          </div>

          {issueNotified && (
            <div className="w-full max-w-md flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <Bell size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-red-700">Quality &amp; Operations Notified</div>
                <p className="text-xs text-red-600 mt-0.5">
                  Damage report submitted
                  {issuePhotos.length > 0 && ` with ${issuePhotos.length} photo${issuePhotos.length > 1 ? 's' : ''}`}.
                  {issueDescription && ` "${issueDescription.slice(0, 60)}${issueDescription.length > 60 ? '…' : ''}"`}
                </p>
              </div>
            </div>
          )}

          {passed && resultJob && (
            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm overflow-hidden border border-green-200">
              <div className="bg-green-600 px-6 py-3 text-white">
                <div className="text-xs font-bold uppercase tracking-widest mb-1">Job Barcode</div>
                <div className="text-3xl font-black tracking-[0.2em]">{resultJob.barcodeId}</div>
                <div className="mt-1 text-xs text-white/70">
                  {resultJob.customerName} · {inspectedQty} pcs verified
                </div>
              </div>
              <div className="p-4 space-y-2 text-left">
                <Row2 label="Status" value="⏳ Pending Admin Review" />
                <Row2 label="Part" value={resultJob.partDescription} />
                {resultJob.customerPO && <Row2 label="Customer PO" value={resultJob.customerPO} />}
                {resultJob.attachments && resultJob.attachments.length > 0 && (
                  <Row2 label="Drawings" value={`${resultJob.attachments.length} file${resultJob.attachments.length > 1 ? 's' : ''} attached`} />
                )}
              </div>
              <div className="px-4 pb-4">
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
                >
                  <Printer size={16} /> Print Job Label
                </button>
              </div>
            </div>
          )}

          {!sessionDone && (
            <div className="w-full max-w-md p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 text-center font-medium">
              ↑ Complete your session timer above before moving to the next job
            </div>
          )}

          <div className="w-full max-w-md grid grid-cols-2 gap-4">
            <button
              onClick={backToList}
              disabled={!sessionDone}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-white border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={18} /> Next Job
            </button>
            <button
              onClick={() => navigate('/pending-jobs')}
              className="py-4 rounded-2xl text-white font-bold"
              style={{ background: '#1f355e' }}
            >
              Admin Queue →
            </button>
          </div>
        </div>
      )}

      {/* ── Drawing Preview Modal ─────────────────────────────────────────────── */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <span className="font-semibold text-sm text-gray-800 truncate">{previewAttachment.name}</span>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors flex-shrink-0 ml-4"
              >
                <X size={14} />
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh] p-4 flex items-center justify-center bg-gray-100">
              {previewAttachment.type.startsWith('image/') ? (
                <img
                  src={previewAttachment.data}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow"
                />
              ) : previewAttachment.type === 'application/pdf' ? (
                <iframe
                  src={previewAttachment.data}
                  title={previewAttachment.name}
                  className="w-full h-[75vh] rounded-lg"
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">{previewAttachment.name}</p>
                  <p className="text-sm mt-1">Preview not available for this file type</p>
                  <a
                    href={previewAttachment.data}
                    download={previewAttachment.name}
                    className="mt-4 inline-block px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InspectionCard({
  s, idx, onSelect,
}: {
  s: IncomingShipment;
  idx: number;
  onSelect: (s: IncomingShipment) => void;
}) {
  const { color, label } = getPrio(s);
  const drawingsReady = hasDrawings(s);
  return (
    <button
      onClick={() => onSelect(s)}
      className="w-full bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow text-left border-l-4"
      style={{ borderLeftColor: drawingsReady ? color : '#f59e0b' }}
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
            <Package size={20} style={{ color }} />
          </div>
          <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm tracking-widest text-emerald-700">{s.barcodeId}</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ background: `${color}18`, color }}
            >
              {label}
            </span>
            {s.scannedInAt && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                ✓ Scanned In
              </span>
            )}
            {/* Drawing status badge */}
            {drawingsReady ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100 flex items-center gap-1">
                <FileText size={9} /> {s.drawingAttachments!.length} drawing{s.drawingAttachments!.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200 flex items-center gap-1">
                <AlertTriangle size={9} /> Drawings required
              </span>
            )}
          </div>
          <div className="font-bold text-gray-800">{s.customerName}</div>
          <div className="text-sm text-gray-500 mt-0.5">{s.partDescription}</div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-400">{s.quantity} pcs</span>
            {s.customerPO && <span className="text-xs text-gray-400">PO: {s.customerPO}</span>}
            {s.stagingLocation ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <MapPin size={10} /> {s.stagingLocation}
              </span>
            ) : (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <MapPin size={10} /> No staging set
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={11} /> {new Date(s.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
          {s.scannedInAt ? 'Resume' : 'Start'} <ChevronRight size={18} />
        </div>
        {!drawingsReady && (
          <span className="text-[10px] text-amber-600 font-semibold">Admin action needed</span>
        )}
      </div>
    </button>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500 mt-1 font-medium">{label}</div>
    </div>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-gray-500 font-medium flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-semibold text-right">{value}</span>
    </div>
  );
}

function InspBarcodeGraphic({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 56,
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
