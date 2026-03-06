/**
 * ScanStation.tsx
 * Full-screen kiosk interface for shop-floor barcode scanning.
 * Route: /scan  (placed OUTSIDE <Layout> wrapper in App.tsx)
 *
 * Modes:
 *  - IDLE: waiting for scan
 *  - RECEIVE: scanned RCV: receipt → ReceiveItemModal
 *  - CONSUME: scanned INV: item → ConsumeWeightModal
 *  - SHIP: scanned SHP: shipment → ShipPickupModal
 *  - JOB: scanned JOB: job → creates job order in queue
 *  - LOOKUP: shows entity info
 */

import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ScanLine, Package, Minus, Truck, ClipboardList,
  ArrowLeft, CheckCircle, XCircle, Info, LayoutGrid,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { decodeBarcode } from '../../barcode/BarcodeUtils';
import { useBarcodeScanner } from '../../barcode/useBarcodeScanner';
import { ScanInput } from './ScanInput';
import { ScanLog } from './ScanLog';
import { ReceiveItemModal } from './ReceiveItemModal';
import { ConsumeWeightModal } from './ConsumeWeightModal';
import { ShipPickupModal } from './ShipPickupModal';
import type { ScanEvent, InventoryTransaction, JobOrder } from '../../types';
import { generateOrderNumber } from '../../barcode/BarcodeUtils';

type ModalMode = 'none' | 'receive' | 'consume' | 'ship' | 'lookup_job' | 'lookup_item';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

let _toastId = 0;

export function ScanStation() {
  const { state, dispatch } = useApp();
  const [scanValue, setScanValue] = useState('');
  const [mode, setMode] = useState<ModalMode>('none');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Resolved entities for modals
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  function addToast(type: Toast['type'], message: string) {
    const id = String(++_toastId);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  function recordScanEvent(partial: Omit<ScanEvent, 'id' | 'operatorId' | 'operatorName' | 'createdAt'>) {
    const ev: ScanEvent = {
      ...partial,
      id: `se-${Date.now()}`,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_SCAN_EVENT', payload: ev });
    return ev;
  }

  const handleScan = useCallback((raw: string) => {
    const decoded = decodeBarcode(raw);

    if (!decoded) {
      recordScanEvent({ action: 'lookup_item', scannedCode: raw, success: false, errorMessage: 'Unrecognised barcode format' });
      addToast('error', `Unrecognised code: ${raw}`);
      return;
    }

    const { prefix, entityId } = decoded;

    if (prefix === 'RCV') {
      const receipt = state.receipts.find(r => r.id === entityId);
      if (!receipt) {
        recordScanEvent({ action: 'receive_inventory', scannedCode: raw, success: false, errorMessage: 'Receipt not found' });
        addToast('error', `Receipt not found: ${entityId}`);
        return;
      }
      if (receipt.status === 'accepted') {
        addToast('info', `Receipt ${receipt.receiptNumber} already accepted`);
        return;
      }
      setActiveReceiptId(entityId);
      setMode('receive');
      return;
    }

    if (prefix === 'INV') {
      const item = state.inventory.find(i => i.id === entityId);
      if (!item) {
        recordScanEvent({ action: 'consume_material', scannedCode: raw, success: false, errorMessage: 'Inventory item not found' });
        addToast('error', `Inventory item not found: ${entityId}`);
        return;
      }
      setActiveItemId(entityId);
      setMode('consume');
      return;
    }

    if (prefix === 'SHP') {
      const shipment = state.shipments.find(s => s.id === entityId);
      if (!shipment) {
        recordScanEvent({ action: 'ship_pickup', scannedCode: raw, success: false, errorMessage: 'Shipment not found' });
        addToast('error', `Shipment not found: ${entityId}`);
        return;
      }
      if (shipment.status === 'picked_up') {
        addToast('info', `Shipment ${shipment.shipmentNumber} already picked up`);
        return;
      }
      setActiveShipmentId(entityId);
      setMode('ship');
      return;
    }

    if (prefix === 'JOB') {
      const job = state.jobs.find(j => j.id === entityId);
      if (!job) {
        recordScanEvent({ action: 'create_job_order', scannedCode: raw, success: false, errorMessage: 'Job not found' });
        addToast('error', `Job not found: ${entityId}`);
        return;
      }
      setActiveJobId(entityId);
      setMode('lookup_job');
      return;
    }

    if (prefix === 'JO') {
      const order = state.jobOrders.find(o => o.id === entityId);
      if (order) {
        addToast('info', `Job Order ${order.orderNumber} — Status: ${order.status}`);
        recordScanEvent({ action: 'lookup_job', scannedCode: raw, resolvedEntityId: entityId, resolvedEntityType: 'job_order', success: true });
      } else {
        addToast('error', `Job order not found: ${entityId}`);
        recordScanEvent({ action: 'lookup_job', scannedCode: raw, success: false, errorMessage: 'Job order not found' });
      }
      return;
    }

    addToast('error', `Unknown barcode prefix: ${prefix}`);
  }, [state, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useBarcodeScanner({ onScan: handleScan, inputRef: scanInputRef, enabled: mode === 'none' });

  // ── Modal Handlers ──────────────────────────────────────────────────────────

  function closeModal() {
    setMode('none');
    setActiveReceiptId(null);
    setActiveItemId(null);
    setActiveShipmentId(null);
    setActiveJobId(null);
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }

  function handleReceiveConfirm(data: { locationAssigned: string; weights: Record<string, number>; notes?: string }) {
    const receipt = state.receipts.find(r => r.id === activeReceiptId)!;
    // Update receipt status
    dispatch({ type: 'UPDATE_RECEIPT', payload: { ...receipt, status: 'accepted', acceptedDate: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    // Add inventory transactions for each item
    receipt.items.forEach(item => {
      if (!item.inventoryItemId) return;
      const invItem = state.inventory.find(i => i.id === item.inventoryItemId);
      if (!invItem) return;
      const before = invItem.quantityOnHand;
      const after = before + item.quantityReceived;
      // Update item on hand + location
      dispatch({
        type: 'UPDATE_INVENTORY_ITEM',
        payload: { ...invItem, quantityOnHand: after, location: data.locationAssigned, lastReceivedDate: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
      const tx: InventoryTransaction = {
        id: `tx-${Date.now()}-${item.id}`,
        itemId: item.inventoryItemId,
        itemName: item.description,
        type: 'received',
        quantity: item.quantityReceived,
        balanceBefore: before,
        balanceAfter: after,
        referenceNumber: receipt.receiptNumber,
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        notes: data.notes,
        weightLbs: data.weights[item.id],
        weightUnit: 'lbs',
        scanSource: 'barcode_scan',
        locationAssigned: data.locationAssigned,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_INV_TRANSACTION', payload: tx });
    });
    recordScanEvent({
      action: 'receive_inventory',
      scannedCode: `RCV:${activeReceiptId}`,
      resolvedEntityId: activeReceiptId!,
      resolvedEntityType: 'receipt',
      locationAssigned: data.locationAssigned,
      notes: data.notes,
      success: true,
    });
    addToast('success', `Receipt ${receipt.receiptNumber} accepted → ${data.locationAssigned}`);
    closeModal();
  }

  function handleConsumeConfirm(data: { weightLbs: number; quantity: number; jobId?: string; jobNumber?: string; notes?: string }) {
    const item = state.inventory.find(i => i.id === activeItemId)!;
    const before = item.quantityOnHand;
    const after = Math.max(0, before - data.quantity);
    dispatch({
      type: 'UPDATE_INVENTORY_ITEM',
      payload: { ...item, quantityOnHand: after, lastUsedDate: new Date().toISOString(), updatedAt: new Date().toISOString() },
    });
    const tx: InventoryTransaction = {
      id: `tx-${Date.now()}-cons`,
      itemId: item.id,
      itemName: item.name,
      type: 'consumed',
      quantity: -data.quantity,
      balanceBefore: before,
      balanceAfter: after,
      jobId: data.jobId,
      jobNumber: data.jobNumber,
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      notes: data.notes,
      weightLbs: data.weightLbs || undefined,
      weightUnit: 'lbs',
      scanSource: 'barcode_scan',
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_INV_TRANSACTION', payload: tx });
    recordScanEvent({
      action: 'consume_material',
      scannedCode: `INV:${activeItemId}`,
      resolvedEntityId: activeItemId!,
      resolvedEntityType: 'inventory',
      weightLbs: data.weightLbs || undefined,
      jobId: data.jobId,
      jobNumber: data.jobNumber,
      notes: data.notes,
      success: true,
    });
    const wStr = data.weightLbs ? ` (${data.weightLbs.toFixed(2)} lbs)` : '';
    addToast('success', `${data.quantity} ${item.unit} consumed from ${item.name}${wStr}`);
    closeModal();
  }

  function handleShipPickupConfirm(data: { signedBy: string; driverName?: string; notes?: string }) {
    const shipment = state.shipments.find(s => s.id === activeShipmentId)!;
    dispatch({
      type: 'UPDATE_SHIPMENT',
      payload: { ...shipment, status: 'picked_up', shipDate: new Date().toISOString(), signedBy: data.signedBy, updatedAt: new Date().toISOString() },
    });
    recordScanEvent({
      action: 'ship_pickup',
      scannedCode: `SHP:${activeShipmentId}`,
      resolvedEntityId: activeShipmentId!,
      resolvedEntityType: 'shipment',
      notes: data.notes,
      success: true,
    });
    addToast('success', `Shipment ${shipment.shipmentNumber} marked as picked up`);
    closeModal();
  }

  function handleJobOrderCreate() {
    const job = state.jobs.find(j => j.id === activeJobId)!;
    const seq = state.jobOrders.length + 1;
    const orderNumber = generateOrderNumber('JO', new Date().getFullYear(), seq);

    // Build material checks from job's powder spec
    const materialChecks: JobOrder['materialChecks'] = [];
    if (job.powderSpec?.colorCode) {
      const powderItem = state.inventory.find(i => i.colorCode === job.powderSpec!.colorCode);
      if (powderItem) {
        materialChecks.push({
          inventoryItemId: powderItem.id,
          itemName: powderItem.name,
          colorCode: powderItem.colorCode,
          requiredQty: 0, // unknown until admin confirms
          availableQty: powderItem.quantityOnHand,
          unit: powderItem.unit,
          confirmed: false,
        });
      }
    }

    const jobOrder: JobOrder = {
      id: `jo-${Date.now()}`,
      orderNumber,
      status: 'pending_review',
      scannedJobId: job.id,
      scannedJobNumber: job.jobNumber,
      customerId: job.customerId,
      customerName: job.customerName,
      partDescription: job.parts.map(p => p.description).join(', ') || 'See job details',
      partCount: job.parts.reduce((s, p) => s + p.quantity, 0) || 1,
      serviceType: job.serviceType,
      colorCode: job.powderSpec?.colorCode,
      colorName: job.powderSpec?.colorName,
      finish: job.powderSpec?.finish,
      notes: job.notes,
      materialChecks,
      materialsConfirmed: false,
      attachments: [],
      priority: job.priority,
      dueDate: job.dueDate,
      scannedById: state.currentUser.id,
      scannedByName: state.currentUser.name,
      receivedDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_JOB_ORDER', payload: jobOrder });
    recordScanEvent({
      action: 'create_job_order',
      scannedCode: `JOB:${activeJobId}`,
      resolvedEntityId: jobOrder.id,
      resolvedEntityType: 'job_order',
      jobId: job.id,
      jobNumber: job.jobNumber,
      success: true,
    });
    addToast('success', `Job Order ${orderNumber} created for ${job.jobNumber} → pending admin review`);
    closeModal();
  }

  // ── Resolved entities ───────────────────────────────────────────────────────
  const activeReceipt = activeReceiptId ? state.receipts.find(r => r.id === activeReceiptId) : null;
  const activeItem = activeItemId ? state.inventory.find(i => i.id === activeItemId) : null;
  const activeShipment = activeShipmentId ? state.shipments.find(s => s.id === activeShipmentId) : null;
  const activeJob = activeJobId ? state.jobs.find(j => j.id === activeJobId) : null;
  const inventoryMap = new Map(state.inventory.map(i => [i.id, i]));

  // ── Stats ───────────────────────────────────────────────────────────────────
  const todayStr = new Date().toDateString();
  const todayScans = state.scanEvents.filter(e => new Date(e.createdAt).toDateString() === todayStr);
  const pendingOrders = state.jobOrders.filter(o => o.status === 'pending_review').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} /> ERP
          </Link>
          <div className="flex items-center gap-2">
            <ScanLine size={22} className="text-brand-400" />
            <span className="text-lg font-bold">CoatPro Scan Station</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-brand-400">{todayScans.length}</p>
            <p className="text-xs text-gray-500">Today</p>
          </div>
          {pendingOrders > 0 && (
            <Link to="/job-queue" className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
              <ClipboardList size={15} />
              {pendingOrders} pending
            </Link>
          )}
          <Link to="/" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
            <LayoutGrid size={16} /> Dashboard
          </Link>
        </div>
      </header>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
        {/* Scan input */}
        <ScanInput
          value={scanValue}
          onChange={setScanValue}
          onSubmit={handleScan}
          disabled={mode !== 'none'}
        />

        {/* Mode hints */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { prefix: 'RCV:', label: 'Receive', icon: Package, color: 'bg-green-900 border-green-700 text-green-300' },
            { prefix: 'INV:', label: 'Consume', icon: Minus, color: 'bg-blue-900 border-blue-700 text-blue-300' },
            { prefix: 'SHP:', label: 'Pickup', icon: Truck, color: 'bg-purple-900 border-purple-700 text-purple-300' },
            { prefix: 'JOB:', label: 'Job Order', icon: ClipboardList, color: 'bg-orange-900 border-orange-700 text-orange-300' },
          ].map(({ prefix, label, icon: Icon, color }) => (
            <div key={prefix} className={`border rounded-xl p-3 text-center ${color}`}>
              <Icon size={20} className="mx-auto mb-1" />
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs opacity-60 font-mono">{prefix}</p>
            </div>
          ))}
        </div>

        {/* Today's scan log */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Info size={14} /> Today's Scans
          </h3>
          <ScanLog events={state.scanEvents} />
        </div>
      </main>

      {/* ── Toast notifications ─────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs animate-slide-in ${
              t.type === 'success' ? 'bg-green-700 text-white' :
              t.type === 'error' ? 'bg-red-700 text-white' :
              'bg-blue-700 text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={16} /> :
             t.type === 'error' ? <XCircle size={16} /> :
             <Info size={16} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {mode === 'receive' && activeReceipt && (
        <ReceiveItemModal
          receipt={activeReceipt}
          inventoryMap={inventoryMap}
          onConfirm={handleReceiveConfirm}
          onClose={closeModal}
        />
      )}

      {mode === 'consume' && activeItem && (
        <ConsumeWeightModal
          item={activeItem}
          jobs={state.jobs}
          onConfirm={handleConsumeConfirm}
          onClose={closeModal}
        />
      )}

      {mode === 'ship' && activeShipment && (
        <ShipPickupModal
          shipment={activeShipment}
          onConfirm={handleShipPickupConfirm}
          onClose={closeModal}
        />
      )}

      {/* Job order creation dialog */}
      {mode === 'lookup_job' && activeJob && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md text-gray-900" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 bg-orange-50 rounded-t-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <ClipboardList size={20} className="text-orange-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Create Job Order</h2>
                <p className="text-sm text-gray-500">{activeJob.jobNumber} – {activeJob.customerName}</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Service</span><span className="font-medium capitalize">{activeJob.serviceType.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Parts</span><span className="font-medium">{activeJob.parts.reduce((s, p) => s + p.quantity, 0)} pcs</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className={`font-medium capitalize ${activeJob.priority === 'rush' ? 'text-red-600' : 'text-gray-900'}`}>{activeJob.priority}</span></div>
                {activeJob.powderSpec?.colorCode && (
                  <div className="flex justify-between"><span className="text-gray-500">Color</span><span className="font-medium">{activeJob.powderSpec.colorCode} – {activeJob.powderSpec.colorName}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">Due</span><span className="font-medium">{new Date(activeJob.dueDate).toLocaleDateString()}</span></div>
              </div>
              <p className="text-sm text-gray-600">
                This will create a <strong>Job Order</strong> in the admin queue. An administrator will verify materials, attach drawings, and approve before scheduling.
              </p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleJobOrderCreate} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2">
                <ClipboardList size={16} /> Create Job Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
