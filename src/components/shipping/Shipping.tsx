import React, { useState } from 'react';
import { Truck, Package, CheckCircle, Clock, Plus, MapPin, X, Printer, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { StatCard } from '../ui/StatCard';
import { formatDate, formatCurrency, generateId, clsx } from '../../utils';
import type { Shipment, ShipmentStatus, CarrierType, PackingItem, BarcodeLabel } from '../../types';
import { PhotoCapture } from '../ui/PhotoCapture';
import { LabelPrintModal } from '../../barcode/LabelPrintModal';
import { buildShipmentLabel } from '../../barcode/BarcodeUtils';
import { BOLModal } from './BOLModal';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
const SHIPPING_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '✅', label: 'Job Ready for Shipping',
    description: 'Job status reaches "Shipping" after passing QC inspection.' },
  { type: 'action', icon: '📋', label: 'Generate Bill of Lading',
    description: 'Click "Generate BOL" to create a Bill of Lading with carrier details, weight, and part count.' },
  { type: 'action', icon: '🏷️', label: 'Print Shipment Label',
    description: 'Print barcode labels to attach to each package in the shipment.' },
  { type: 'action', icon: '📦', label: 'Pack & Stage',
    description: 'Package the parts, attach labels, and stage at the dock for pickup.' },
  { type: 'decision', icon: '🚚', label: 'Delivery Method?',
    branches: [
      { label: '🚛 Carrier Pickup', color: 'blue',
        steps: [{ label: 'Assign carrier + tracking number' }, { label: 'Mark as In Transit' }]},
      { label: '🧑 Customer Pickup', color: 'green',
        steps: [{ label: 'Notify customer of readiness' }, { label: 'Mark Delivered on pickup' }]},
    ]},
  { type: 'end', icon: '🎉', label: 'Shipment Delivered',
    description: 'Mark as Delivered. The full job lifecycle is complete. Invoice is finalised.' },
];

const SHIPPING_TOUR: TourStep[] = [
  { selector: '[data-tour="ship-stats"]', title: 'Shipping Stats',
    why: 'Pending, in-transit, delivered, and exception counts tell you the status of outbound logistics.',
    what: 'Red "Exceptions" means shipments need immediate attention — delayed, damaged, or missing.' },
  { selector: '[data-tour="ship-filters"]', title: 'Status Filters',
    why: 'Filter the table by shipment status to focus on what needs action right now.',
    what: 'Click a status chip. Counts next to each label show how many shipments are in that stage.' },
  { selector: '[data-tour="ship-table"]', title: 'Shipment Table',
    why: 'Every outbound shipment with tracking, carrier, weight, and delivery estimate in one view.',
    what: 'Click a row to see full details. Use "Advance" to move a shipment to the next stage (packing → ready → transit → delivered).' },
  { selector: '[data-tour="ship-new"]', title: 'New Shipment',
    why: 'Create a shipment record when parts are ready to leave the shop floor.',
    what: 'Click "New Shipment" to select jobs, assign a carrier, and generate a BOL.' },
];

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',     color: 'bg-gray-100 text-gray-700' },
  packing:    { label: 'Packing',     color: 'bg-blue-100 text-blue-800' },
  ready:      { label: 'Ready',       color: 'bg-purple-100 text-purple-800' },
  picked_up:  { label: 'Picked Up',   color: 'bg-indigo-100 text-indigo-800' },
  in_transit: { label: 'In Transit',  color: 'bg-yellow-100 text-yellow-800' },
  delivered:  { label: 'Delivered',   color: 'bg-green-100 text-green-800' },
  exception:  { label: 'Exception',   color: 'bg-red-100 text-red-800' },
  cancelled:  { label: 'Cancelled',   color: 'bg-gray-100 text-gray-500' },
};

const CARRIER_LABELS: Record<CarrierType, string> = {
  fedex: 'FedEx', ups: 'UPS', usps: 'USPS', freight: 'Freight / LTL',
  customer_pickup: 'Customer Pickup', own_truck: 'Own Truck', other: 'Other',
};

const SHIPMENT_FLOW: ShipmentStatus[] = ['pending', 'packing', 'ready', 'in_transit', 'delivered'];

export function Shipping() {
  const { state, dispatch } = useApp();
  const { shipments, jobs, customers } = state;
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editShipment, setEditShipment] = useState<Shipment | null>(null);
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [printLabels, setPrintLabels] = useState<BarcodeLabel[] | null>(null);
  const [bolShipment, setBolShipment] = useState<Shipment | null>(null);

  // KPIs
  const pending = shipments.filter(s => ['pending', 'packing', 'ready'].includes(s.status)).length;
  const inTransit = shipments.filter(s => ['picked_up', 'in_transit'].includes(s.status)).length;
  const exceptions = shipments.filter(s => s.status === 'exception').length;
  const today = new Date().toISOString().slice(0, 10);
  const deliveredToday = shipments.filter(s => s.status === 'delivered' && s.deliveredDate === today).length;

  const filtered = shipments
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function advanceShipment(s: Shipment) {
    const idx = SHIPMENT_FLOW.indexOf(s.status);
    if (idx < 0 || idx >= SHIPMENT_FLOW.length - 1) return;
    const newStatus = SHIPMENT_FLOW[idx + 1];
    const now = new Date().toISOString();
    dispatch({
      type: 'UPDATE_SHIPMENT',
      payload: {
        ...s, status: newStatus, updatedAt: now,
        shipDate: !s.shipDate && newStatus === 'in_transit' ? now.slice(0, 10) : s.shipDate,
        deliveredDate: newStatus === 'delivered' ? now.slice(0, 10) : s.deliveredDate,
      },
    });
  }

  function handleSave(shipment: Shipment) {
    if (editShipment) dispatch({ type: 'UPDATE_SHIPMENT', payload: shipment });
    else dispatch({ type: 'ADD_SHIPMENT', payload: shipment });
    setShowModal(false); setEditShipment(null);
  }

  function handleBOLSave(updated: Shipment) {
    dispatch({ type: 'UPDATE_SHIPMENT', payload: updated });
    setBolShipment(updated); // keep modal open so user can print/email
  }

  const readyJobs = jobs.filter(j => ['qc', 'shipping', 'complete'].includes(j.status));

  return (
    <div className="space-y-5">
      {printLabels && <LabelPrintModal labels={printLabels} title="Print Shipment Label" onClose={() => setPrintLabels(null)} />}
      {bolShipment && (
        <BOLModal
          shipment={bolShipment}
          onClose={() => setBolShipment(null)}
          onSave={handleBOLSave}
        />
      )}
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Truck size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Shipping</h1>
        <WorkflowHelp title="Shipping Workflow" description="From QC-passed job to BOL generation, packing, and delivery." steps={SHIPPING_WORKFLOW} />
        <GuidedTourButton steps={SHIPPING_TOUR} />
      </div>
      <div data-tour="ship-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending / Packing" value={pending} icon={<Package size={18} />} color="blue" />
        <StatCard label="In Transit" value={inTransit} icon={<Truck size={18} />} color="yellow" />
        <StatCard label="Delivered Today" value={deliveredToday} icon={<CheckCircle size={18} />} color="green" />
        <StatCard label="Exceptions" value={exceptions} icon={<Clock size={18} />} color={exceptions > 0 ? 'red' : 'green'} />
      </div>

      {exceptions > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-sm text-red-800 font-semibold">{exceptions} shipment exception{exceptions > 1 ? 's' : ''} require attention.</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div data-tour="ship-filters" className="flex gap-2 flex-wrap">
          {['all', 'pending', 'packing', 'ready', 'in_transit', 'delivered', 'exception'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filterStatus === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300')}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s as ShipmentStatus]?.label ?? s}
              {s !== 'all' && (
                <span className="ml-1.5 opacity-70">{shipments.filter(sh => sh.status === s).length}</span>
              )}
            </button>
          ))}
        </div>
        <span data-tour="ship-new"><Button icon={<Plus size={15} />} onClick={() => { setEditShipment(null); setShowModal(true); }}>New Shipment</Button></span>
      </div>

      <Card padding={false} data-tour="ship-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Shipment #', 'Customer', 'Jobs', 'Carrier', 'Service', 'Tracking #', 'Ship Date', 'Est. Delivery', 'Boxes', 'Weight', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(ship => {
                const sc = STATUS_CONFIG[ship.status];
                const isAdvanceable = SHIPMENT_FLOW.includes(ship.status) && ship.status !== 'delivered';
                return (
                  <tr key={ship.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailShipment(ship)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{ship.shipmentNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-800 max-w-[130px] truncate">{ship.customerName}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{ship.jobIds.length} job{ship.jobIds.length > 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{CARRIER_LABELS[ship.carrier]}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{ship.serviceLevel ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{ship.trackingNumber ?? ship.bolNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{ship.shipDate ? formatDate(ship.shipDate) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{ship.estimatedDelivery ? formatDate(ship.estimatedDelivery) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-center text-gray-700">{ship.totalBoxes}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{ship.totalWeight ? `${ship.totalWeight} lbs` : '—'}</td>
                    <td className="px-4 py-3"><Badge className={sc.color}>{sc.label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {isAdvanceable && (
                          <button onClick={() => advanceShipment(ship)} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                            {ship.status === 'ready' ? '📦 Ship' : ship.status === 'in_transit' ? '✓ Deliver' : 'Advance →'}
                          </button>
                        )}
                        <button
                          onClick={() => setBolShipment(ship)}
                          className="p-1 ml-1 text-gray-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors"
                          title="Generate Bill of Lading"
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          onClick={() => setPrintLabels([buildShipmentLabel(ship)])}
                          className="p-1 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
                          title="Print shipment label"
                        >
                          <Printer size={13} />
                        </button>
                        {ship.bolSignedAt && (
                          <span className="text-green-500 text-xs" title={`BOL signed ${new Date(ship.bolSignedAt).toLocaleDateString()}`}>✓BOL</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">No shipments found</div>}
        </div>
      </Card>

      {/* Create/Edit Modal */}
      {showModal && (
        <ShipmentModal shipment={editShipment} jobs={readyJobs} customers={customers} onSave={handleSave} onClose={() => { setShowModal(false); setEditShipment(null); }} />
      )}

      {/* Detail Modal */}
      {detailShipment && (
        <ShipmentDetailModal shipment={detailShipment} jobs={jobs} onClose={() => setDetailShipment(null)}
          onEdit={() => { setEditShipment(detailShipment); setDetailShipment(null); setShowModal(true); }}
          onAdvance={() => { advanceShipment(detailShipment); setDetailShipment(null); }}
          onBOL={() => { setBolShipment(detailShipment); setDetailShipment(null); }}
        />
      )}
    </div>
  );
}

function ShipmentModal({ shipment, jobs, customers, onSave, onClose }: {
  shipment: Shipment | null;
  jobs: ReturnType<typeof useApp>['state']['jobs'];
  customers: ReturnType<typeof useApp>['state']['customers'];
  onSave: (s: Shipment) => void;
  onClose: () => void;
}) {
  const [custId, setCustId] = useState(shipment?.customerId ?? customers[0]?.id ?? '');
  const [carrier, setCarrier] = useState<CarrierType>(shipment?.carrier ?? 'fedex');
  const [serviceLevel, setServiceLevel] = useState(shipment?.serviceLevel ?? 'Ground');
  const [trackingNumber, setTrackingNumber] = useState(shipment?.trackingNumber ?? '');
  const [bolNumber, setBolNumber] = useState(shipment?.bolNumber ?? '');
  const [shipDate, setShipDate] = useState(shipment?.shipDate ?? '');
  const [estDelivery, setEstDelivery] = useState(shipment?.estimatedDelivery ?? '');
  const [specialInstructions, setSpecialInstructions] = useState(shipment?.specialInstructions ?? '');
  const [billToCustomer, setBillToCustomer] = useState(shipment?.billToCustomer ?? true);
  const [shippingCost, setShippingCost] = useState(String(shipment?.shippingCost ?? ''));
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(shipment?.jobIds ?? []);
  const [totalWeight, setTotalWeight] = useState(String(shipment?.totalWeight ?? ''));
  const [photos, setPhotos] = useState<string[]>(shipment?.photos ?? []);

  const customer = customers.find(c => c.id === custId);
  const custJobs = jobs.filter(j => j.customerId === custId);

  function toggleJob(id: string) {
    setSelectedJobIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  function handleSave() {
    const now = new Date().toISOString();
    const selJobs = jobs.filter(j => selectedJobIds.includes(j.id));
    const packingList: PackingItem[] = selJobs.map(j => ({
      id: generateId(), jobId: j.id, jobNumber: j.jobNumber,
      description: j.parts[0]?.description ?? j.jobNumber,
      partCount: j.parts.reduce((s, p) => s + p.quantity, 0),
      weight: j.parts.reduce((s, p) => s + (p.weight ?? 0) * p.quantity, 0) || undefined,
      boxCount: 1,
    }));
    const totalBoxes = packingList.reduce((s, p) => s + p.boxCount, 0) || 1;
    onSave({
      id: shipment?.id ?? generateId(),
      shipmentNumber: shipment?.shipmentNumber ?? `SHIP-2026-${String(Date.now()).slice(-4)}`,
      status: shipment?.status ?? 'pending',
      customerId: custId, customerName: customer?.name ?? '',
      jobIds: selectedJobIds, packingList,
      carrier, serviceLevel: serviceLevel || undefined,
      trackingNumber: trackingNumber || undefined, bolNumber: bolNumber || undefined,
      shipDate: shipDate || undefined, estimatedDelivery: estDelivery || undefined,
      deliveredDate: shipment?.deliveredDate,
      deliveryAddress: customer?.shippingAddress ?? { street: '', city: '', state: '', zip: '', country: 'US' },
      totalWeight: totalWeight ? Number(totalWeight) : undefined,
      totalBoxes,
      shippingCost: shippingCost ? Number(shippingCost) : undefined,
      billToCustomer, specialInstructions: specialInstructions || undefined,
      signedBy: shipment?.signedBy,
      photos,
      createdBy: shipment?.createdBy ?? 'Sam Chen',
      createdAt: shipment?.createdAt ?? now, updatedAt: now,
    });
  }

  return (
    <Modal open={true} onClose={onClose} title={shipment ? `Edit Shipment: ${shipment.shipmentNumber}` : 'New Shipment'} size="xl"
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>{shipment ? 'Save Changes' : 'Create Shipment'}</Button></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Customer" value={custId} onChange={e => { setCustId(e.target.value); setSelectedJobIds([]); }} className="col-span-2">
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>

        {/* Job selection */}
        <div className="col-span-2">
          <div className="text-xs font-semibold text-gray-700 mb-1.5">Select Jobs to Include</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
            {custJobs.length === 0 && <div className="text-xs text-gray-400 text-center py-3">No jobs for this customer</div>}
            {custJobs.map(j => (
              <label key={j.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                <input type="checkbox" checked={selectedJobIds.includes(j.id)} onChange={() => toggleJob(j.id)} className="rounded" />
                <span className="font-mono text-xs text-brand-700">{j.jobNumber}</span>
                <span className="text-xs text-gray-600 flex-1 truncate">{j.parts[0]?.description}</span>
                <span className="text-xs text-gray-400 capitalize">{j.status}</span>
              </label>
            ))}
          </div>
        </div>

        <Select label="Carrier" value={carrier} onChange={e => setCarrier(e.target.value as CarrierType)}>
          {Object.entries(CARRIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input label="Service Level" value={serviceLevel} onChange={e => setServiceLevel(e.target.value)} placeholder="Ground, 2-Day, LTL..." />
        {carrier === 'freight' ? (
          <Input label="BOL #" value={bolNumber} onChange={e => setBolNumber(e.target.value)} />
        ) : (
          <Input label="Tracking #" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
        )}
        <Input label="Shipping Cost ($)" type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)} />
        <Input label="Ship Date" type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} />
        <Input label="Est. Delivery" type="date" value={estDelivery} onChange={e => setEstDelivery(e.target.value)} />
        <Input label="Total Weight (lbs)" type="number" min="0" value={totalWeight} onChange={e => setTotalWeight(e.target.value)} />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="billCust" checked={billToCustomer} onChange={e => setBillToCustomer(e.target.checked)} className="rounded" />
          <label htmlFor="billCust" className="text-sm text-gray-700">Bill shipping to customer</label>
        </div>
        <Textarea label="Special Instructions" value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={2} className="col-span-2" />
      </div>

      <div className="mt-4">
        <PhotoCapture photos={photos} onChange={setPhotos} label="Shipment Photos" compact />
      </div>

      {customer && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 flex items-start gap-2">
          <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-600">
            <div className="font-semibold">{customer.shippingAddress.street}</div>
            <div>{customer.shippingAddress.city}, {customer.shippingAddress.state} {customer.shippingAddress.zip}</div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ShipmentDetailModal({ shipment, jobs, onClose, onEdit, onAdvance, onBOL }: {
  shipment: Shipment;
  jobs: ReturnType<typeof useApp>['state']['jobs'];
  onClose: () => void;
  onEdit: () => void;
  onAdvance: () => void;
  onBOL: () => void;
}) {
  const sc = STATUS_CONFIG[shipment.status];
  const isAdvanceable = SHIPMENT_FLOW.includes(shipment.status) && shipment.status !== 'delivered';

  return (
    <Modal open={true} onClose={onClose} title={`Shipment: ${shipment.shipmentNumber}`} size="lg"
      footer={
        <div className="flex gap-2 justify-between">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileText size={14} />} onClick={onBOL}>
              {shipment.bolSignedAt ? '✓ View BOL' : 'Bill of Lading'}
            </Button>
            <Button variant="secondary" onClick={onEdit}>Edit</Button>
            {isAdvanceable && <Button onClick={onAdvance}>
              {shipment.status === 'ready' ? 'Mark Shipped' : shipment.status === 'in_transit' ? 'Mark Delivered' : 'Advance'}
            </Button>}
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge className={sc.color}>{sc.label}</Badge>
          <span className="text-sm text-gray-600">{shipment.customerName}</span>
          <span className="text-sm text-gray-400">·</span>
          <span className="text-sm text-gray-600">{CARRIER_LABELS[shipment.carrier]}</span>
          {shipment.serviceLevel && <span className="text-sm text-gray-400">{shipment.serviceLevel}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Tracking / BOL', value: shipment.trackingNumber ?? shipment.bolNumber ?? '—' },
            { label: 'Ship Date', value: shipment.shipDate ? formatDate(shipment.shipDate) : '—' },
            { label: 'Est. Delivery', value: shipment.estimatedDelivery ? formatDate(shipment.estimatedDelivery) : '—' },
            { label: 'Delivered', value: shipment.deliveredDate ? formatDate(shipment.deliveredDate) : '—' },
            { label: 'Total Boxes', value: String(shipment.totalBoxes) },
            { label: 'Total Weight', value: shipment.totalWeight ? `${shipment.totalWeight} lbs` : '—' },
            { label: 'Shipping Cost', value: shipment.shippingCost ? formatCurrency(shipment.shippingCost) : '—' },
            { label: 'Bill to Customer', value: shipment.billToCustomer ? 'Yes' : 'No' },
          ].map(row => (
            <div key={row.label} className="flex justify-between">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-medium text-gray-800">{row.value}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><MapPin size={13} />Delivery Address</div>
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {shipment.deliveryAddress.street}, {shipment.deliveryAddress.city}, {shipment.deliveryAddress.state} {shipment.deliveryAddress.zip}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Packing List</div>
          <table className="w-full text-xs border rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {['Job #', 'Description', 'Parts', 'Weight', 'Boxes', 'Notes'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shipment.packingList.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-mono text-brand-700">{item.jobNumber}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{item.description}</td>
                  <td className="px-3 py-2 text-center text-gray-700">{item.partCount}</td>
                  <td className="px-3 py-2 text-gray-600">{item.weight ? `${item.weight} lbs` : '—'}</td>
                  <td className="px-3 py-2 text-center text-gray-700">{item.boxCount}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{item.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shipment.specialInstructions && (
          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
            <span className="font-semibold">Special Instructions: </span>{shipment.specialInstructions}
          </div>
        )}

        {/* BOL Signature summary */}
        {shipment.driverSignature && (
          <div className="border border-green-200 bg-green-50 rounded-xl p-3">
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle size={12} />BOL Signed
            </div>
            <div className="flex items-center gap-4">
              <img
                src={shipment.driverSignature}
                alt="Driver signature"
                className="h-14 object-contain bg-white border border-gray-200 rounded px-2"
              />
              <div className="text-xs text-gray-600 space-y-0.5">
                {shipment.driverName && <div className="font-semibold">{shipment.driverName}</div>}
                {shipment.truckNumber && <div>Unit: {shipment.truckNumber}</div>}
                {shipment.bolSignedAt && <div className="text-gray-400">{new Date(shipment.bolSignedAt).toLocaleString()}</div>}
              </div>
            </div>
          </div>
        )}
        {(shipment.photos?.length ?? 0) > 0 && (
          <PhotoCapture photos={shipment.photos ?? []} onChange={() => {}} label="Shipment Photos" readOnly />
        )}
      </div>
    </Modal>
  );
}
