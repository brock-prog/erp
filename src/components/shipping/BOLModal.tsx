import React, { useRef, useState } from 'react';
import { Printer, Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SignaturePad, SignaturePadRef } from '../ui/SignaturePad';
import { formatDate, formatCurrency, clsx } from '../../utils';
import type { Shipment } from '../../types';

// ─── Carrier name helper ───────────────────────────────────────────────────────

const CARRIER_LABELS: Record<string, string> = {
  fedex: 'FedEx', ups: 'UPS', usps: 'USPS', freight: 'Freight / LTL',
  customer_pickup: 'Customer Pickup', own_truck: 'Own Truck', other: 'Other',
};

// ─── Decora company info ───────────────────────────────────────────────────────

const SHIPPER = {
  name: 'Decora Powder Coatings Ltd.',
  street: '2685 Queensway St',
  city: 'Prince George',
  province: 'BC',
  postal: 'V2L 1N2',
  phone: '(250) 564-0000',
  email: 'shipping@decorapowdercoatings.com',
};

// ─── BOL HTML generator (opens in print window) ───────────────────────────────

function generateBOLHTML(
  shipment: Shipment,
  driverName: string,
  truckNumber: string,
  signatureDataUrl: string | null,
  signedAt: string,
): string {
  const today = signedAt || new Date().toLocaleDateString('en-CA');
  const carrier = CARRIER_LABELS[shipment.carrier] ?? shipment.carrier;

  const itemRows = shipment.packingList.map(item => `
    <tr>
      <td>${item.jobNumber}</td>
      <td>${item.description}</td>
      <td class="center">${item.partCount}</td>
      <td class="center">${item.boxCount}</td>
      <td class="right">${item.weight ? `${item.weight} lbs` : '—'}</td>
      <td>${item.notes ?? ''}</td>
    </tr>
  `).join('');

  const sigImg = signatureDataUrl
    ? `<img src="${signatureDataUrl}" style="max-height:70px;max-width:300px;object-fit:contain;" alt="Signature" />`
    : '<div style="height:60px;border-bottom:1px solid #000;width:300px;"></div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Bill of Lading — ${shipment.shipmentNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #111;
      padding: 18px 24px;
      line-height: 1.4;
    }
    h1 { font-size: 20px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
    .doc-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1f355e; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 3px solid #1f355e; padding-bottom: 8px; }
    .logo-block { display: flex; flex-direction: column; gap: 2px; }
    .logo-block h1 { color: #1f355e; }
    .logo-green { color: #009877; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
    .meta-block { text-align: right; }
    .meta-block .bol-num { font-size: 14px; font-weight: 700; color: #1f355e; }

    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #999; margin-bottom: 8px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #999; margin-bottom: 8px; }
    .cell { padding: 7px 10px; border-right: 1px solid #ccc; }
    .cell:last-child { border-right: none; }
    .cell-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; margin-bottom: 3px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
    .cell-value { font-size: 11px; font-weight: 600; }
    .cell-sub { font-size: 10px; color: #333; margin-top: 1px; }

    table { width: 100%; border-collapse: collapse; border: 1px solid #999; margin-bottom: 8px; }
    thead tr { background: #1f355e; color: white; }
    th { padding: 5px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; font-size: 10px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .right { text-align: right; }
    .totals-row { background: #f5f5f5; font-weight: 700; }

    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border: 1px solid #999; padding: 12px; margin-bottom: 8px; }
    .sig-block { display: flex; flex-direction: column; gap: 6px; }
    .sig-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; }
    .sig-line { border-bottom: 1px solid #000; height: 50px; display: flex; align-items: flex-end; padding-bottom: 4px; }
    .sig-name { font-size: 10px; color: #333; margin-top: 2px; }
    .sig-date { font-size: 10px; color: #555; }

    .instructions { border: 1px solid #f59e0b; background: #fffbeb; padding: 8px 10px; font-size: 10px; margin-bottom: 8px; }
    .instructions-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #92400e; margin-bottom: 3px; }

    .disclaimer { font-size: 8.5px; color: #666; border-top: 1px solid #ccc; padding-top: 6px; line-height: 1.5; }
    .tag { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }

    @media print {
      body { padding: 10px 14px; }
      @page { size: letter; margin: 0.5in; }
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <h1>Decora</h1>
      <div class="logo-green">POWDER COATINGS LTD.</div>
      <div style="font-size:9px;color:#555;margin-top:4px;">${SHIPPER.street}, ${SHIPPER.city}, ${SHIPPER.province} ${SHIPPER.postal}</div>
      <div style="font-size:9px;color:#555;">${SHIPPER.phone}</div>
    </div>
    <div class="meta-block">
      <div class="doc-title">Bill of Lading</div>
      <div class="bol-num">${shipment.shipmentNumber}</div>
      <div style="font-size:10px;color:#555;margin-top:4px;">Date: <strong>${today}</strong></div>
      ${shipment.trackingNumber ? `<div style="font-size:9px;color:#555;">PRO / Tracking: <strong>${shipment.trackingNumber}</strong></div>` : ''}
      ${shipment.bolNumber ? `<div style="font-size:9px;color:#555;">BOL #: <strong>${shipment.bolNumber}</strong></div>` : ''}
    </div>
  </div>

  <!-- SHIPPER / CONSIGNEE / CARRIER -->
  <div class="grid3">
    <div class="cell">
      <div class="cell-label">Shipper (From)</div>
      <div class="cell-value">${SHIPPER.name}</div>
      <div class="cell-sub">${SHIPPER.street}</div>
      <div class="cell-sub">${SHIPPER.city}, ${SHIPPER.province} ${SHIPPER.postal}</div>
      <div class="cell-sub">${SHIPPER.phone}</div>
    </div>
    <div class="cell">
      <div class="cell-label">Consignee (To)</div>
      <div class="cell-value">${shipment.customerName}</div>
      <div class="cell-sub">${shipment.deliveryAddress.street}</div>
      <div class="cell-sub">${shipment.deliveryAddress.city}, ${shipment.deliveryAddress.state} ${shipment.deliveryAddress.zip}</div>
    </div>
    <div class="cell">
      <div class="cell-label">Carrier / Driver</div>
      <div class="cell-value">${carrier}</div>
      ${driverName ? `<div class="cell-sub">Driver: ${driverName}</div>` : ''}
      ${truckNumber ? `<div class="cell-sub">Unit / Truck: ${truckNumber}</div>` : ''}
      ${shipment.serviceLevel ? `<div class="cell-sub">Service: ${shipment.serviceLevel}</div>` : ''}
      ${shipment.estimatedDelivery ? `<div class="cell-sub">Est. Delivery: ${formatDate(shipment.estimatedDelivery)}</div>` : ''}
    </div>
  </div>

  <!-- FREIGHT CHARGES -->
  <div class="grid3">
    <div class="cell">
      <div class="cell-label">Freight Charges</div>
      <div style="display:flex;gap:16px;margin-top:4px;">
        <label style="display:flex;align-items:center;gap:4px;font-size:10px;">
          <input type="radio" ${shipment.billToCustomer ? '' : 'checked'} readonly /> Prepaid
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:10px;">
          <input type="radio" ${shipment.billToCustomer ? 'checked' : ''} readonly /> Collect
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:10px;">
          <input type="radio" readonly /> 3rd Party
        </label>
      </div>
      ${shipment.shippingCost ? `<div class="cell-sub" style="margin-top:4px;">Amount: <strong>${formatCurrency(shipment.shippingCost)}</strong></div>` : ''}
    </div>
    <div class="cell">
      <div class="cell-label">Ship Date</div>
      <div class="cell-value">${shipment.shipDate ? formatDate(shipment.shipDate) : today}</div>
    </div>
    <div class="cell">
      <div class="cell-label">Payment Terms</div>
      <div class="cell-value">${shipment.billToCustomer ? 'Bill to Consignee' : 'Prepaid by Shipper'}</div>
    </div>
  </div>

  <!-- SPECIAL INSTRUCTIONS -->
  ${shipment.specialInstructions ? `
  <div class="instructions">
    <div class="instructions-label">⚠ Special Instructions / Handling Notes</div>
    ${shipment.specialInstructions}
  </div>
  ` : ''}

  <!-- FREIGHT DESCRIPTION TABLE -->
  <table>
    <thead>
      <tr>
        <th>Job / Reference #</th>
        <th>Description of Articles</th>
        <th class="center">Pieces</th>
        <th class="center">Boxes</th>
        <th class="right">Weight</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="totals-row">
        <td colspan="2" style="text-align:right;">TOTALS</td>
        <td class="center">${shipment.packingList.reduce((s, i) => s + i.partCount, 0)}</td>
        <td class="center">${shipment.totalBoxes}</td>
        <td class="right">${shipment.totalWeight ? `${shipment.totalWeight} lbs` : '—'}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <!-- SIGNATURES -->
  <div class="sig-grid">
    <div class="sig-block">
      <div class="sig-label">Shipper Authorized Signature</div>
      <div class="sig-line"></div>
      <div class="sig-name">Decora Powder Coatings Ltd.</div>
      <div class="sig-date">Date: ${today}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Driver / Carrier Signature</div>
      <div class="sig-line">${sigImg}</div>
      ${driverName ? `<div class="sig-name">${driverName}</div>` : ''}
      <div class="sig-date">Date: ${today}</div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    <strong>Notice:</strong> The shipper or its agent hereby declares that the contents of this consignment are fully and accurately described above by the proper shipping name, and are classified, packaged, marked, and labelled/placarded, and are in all respects in proper condition for transport according to applicable international and national government regulations. Received, subject to individually determined rates or contracts that have been agreed upon in writing between the carrier and shipper, if applicable, otherwise to the rates, classifications and rules that have been established by the carrier and are available to the shipper, on request, and to all applicable state and federal regulations.
  </div>

  <script>window.onload = () => { window.focus(); window.print(); }<\/script>
</body>
</html>`;
}

// ─── Main BOL Modal ────────────────────────────────────────────────────────────

interface BOLModalProps {
  shipment: Shipment;
  onClose: () => void;
  onSave: (updated: Shipment) => void;
}

type Step = 'review' | 'sign' | 'confirm';

export function BOLModal({ shipment, onClose, onSave }: BOLModalProps) {
  const sigRef = useRef<SignaturePadRef>(null);
  const [step, setStep] = useState<Step>('review');
  const [driverName, setDriverName] = useState(shipment.driverName ?? '');
  const [truckNumber, setTruckNumber] = useState(shipment.truckNumber ?? '');
  const [driverEmail, setDriverEmail] = useState('');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [saved, setSaved] = useState(false);
  const [printing, setPrinting] = useState(false);

  const today = new Date().toLocaleDateString('en-CA');

  function handlePrint() {
    const sigData = sigRef.current?.getSignature() ?? null;
    const html = generateBOLHTML(shipment, driverName, truckNumber, sigData, today);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Please allow pop-ups to print the BOL.');
      return;
    }
    setPrinting(true);
    win.document.write(html);
    win.document.close();
    setTimeout(() => setPrinting(false), 1500);
  }

  function handleEmail() {
    const to = driverEmail.trim();
    const subject = encodeURIComponent(
      `Bill of Lading – ${shipment.shipmentNumber} – Decora Powder Coatings`,
    );
    const items = shipment.packingList
      .map(i => `  • ${i.jobNumber}: ${i.description} (${i.partCount} pcs, ${i.boxCount} box)`)
      .join('\n');

    const body = encodeURIComponent(`Dear ${driverName || 'Driver'},

Please find your Bill of Lading details below for Shipment ${shipment.shipmentNumber}.

──────────────────────────────
BILL OF LADING
BOL #: ${shipment.shipmentNumber}
Date: ${today}
──────────────────────────────
FROM (Shipper):
Decora Powder Coatings Ltd.
${SHIPPER.street}
${SHIPPER.city}, ${SHIPPER.province} ${SHIPPER.postal}
${SHIPPER.phone}

TO (Consignee):
${shipment.customerName}
${shipment.deliveryAddress.street}
${shipment.deliveryAddress.city}, ${shipment.deliveryAddress.state} ${shipment.deliveryAddress.zip}

CARRIER: ${CARRIER_LABELS[shipment.carrier] ?? shipment.carrier}
${driverName ? `Driver: ${driverName}` : ''}
${truckNumber ? `Unit: ${truckNumber}` : ''}

CONTENTS:
${items}

Total Boxes: ${shipment.totalBoxes}
Total Weight: ${shipment.totalWeight ? `${shipment.totalWeight} lbs` : 'See above'}
${shipment.specialInstructions ? `\nSpecial Instructions:\n${shipment.specialInstructions}` : ''}
──────────────────────────────
For a printed copy with your signature, please contact us at ${SHIPPER.email}

Thank you,
Decora Powder Coatings Ltd.
${SHIPPER.phone}`);

    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
  }

  function handleConfirmAndSave() {
    const sigData = sigRef.current?.getSignature() ?? null;
    const now = new Date().toISOString();
    onSave({
      ...shipment,
      driverName: driverName || undefined,
      truckNumber: truckNumber || undefined,
      driverSignature: sigData ?? undefined,
      bolSignedAt: sigData ? now : undefined,
      signedBy: driverName || shipment.signedBy,
      updatedAt: now,
    });
    setSaved(true);
  }

  const carrier = CARRIER_LABELS[shipment.carrier] ?? shipment.carrier;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Bill of Lading — ${shipment.shipmentNumber}`}
      size="2xl"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button variant="ghost" onClick={onClose}>
            {saved ? 'Close' : 'Cancel'}
          </Button>
          <div className="flex gap-2">
            {step !== 'review' && !saved && (
              <Button variant="secondary" onClick={() => setStep('review')}>
                ← Back
              </Button>
            )}
            {step === 'review' && (
              <Button onClick={() => setStep('sign')}>
                Proceed to Sign →
              </Button>
            )}
            {step === 'sign' && (
              <>
                <Button
                  variant="secondary"
                  icon={<Printer size={14} />}
                  onClick={handlePrint}
                  disabled={printing}
                >
                  {printing ? 'Opening...' : 'Print BOL'}
                </Button>
                <Button onClick={() => setStep('confirm')}>
                  Continue →
                </Button>
              </>
            )}
            {step === 'confirm' && !saved && (
              <>
                <Button
                  variant="secondary"
                  icon={<Printer size={14} />}
                  onClick={handlePrint}
                >
                  Print BOL
                </Button>
                {driverEmail && (
                  <Button
                    variant="secondary"
                    icon={<Mail size={14} />}
                    onClick={handleEmail}
                  >
                    Email Driver
                  </Button>
                )}
                <Button
                  icon={<CheckCircle size={14} />}
                  onClick={handleConfirmAndSave}
                >
                  Confirm & Save
                </Button>
              </>
            )}
            {saved && (
              <Button
                icon={<Printer size={14} />}
                onClick={handlePrint}
              >
                Print Another Copy
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">

        {/* ── STEP INDICATOR ── */}
        <div className="flex items-center gap-0">
          {(['review', 'sign', 'confirm'] as Step[]).map((s, i) => {
            const labels = ['Review', 'Signature', 'Confirm & Send'];
            const done = ['review', 'sign', 'confirm'].indexOf(step) > i;
            const active = step === s;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    active ? 'bg-brand-600 border-brand-600 text-white' :
                    done ? 'bg-green-500 border-green-500 text-white' :
                    'bg-white border-gray-300 text-gray-400'
                  )}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={clsx('text-xs font-medium hidden sm:inline', active ? 'text-brand-700' : done ? 'text-green-700' : 'text-gray-400')}>
                    {labels[i]}
                  </span>
                </div>
                {i < 2 && <div className={clsx('flex-1 h-0.5 mx-2', done ? 'bg-green-400' : 'bg-gray-200')} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── STEP 1: REVIEW ── */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Shipment summary card */}
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-brand-500 font-semibold uppercase tracking-wider mb-1">From (Shipper)</div>
                <div className="font-semibold text-brand-900">{SHIPPER.name}</div>
                <div className="text-brand-700 text-xs">{SHIPPER.street}, {SHIPPER.city}, {SHIPPER.province} {SHIPPER.postal}</div>
                <div className="text-brand-700 text-xs">{SHIPPER.phone}</div>
              </div>
              <div>
                <div className="text-xs text-brand-500 font-semibold uppercase tracking-wider mb-1">To (Consignee)</div>
                <div className="font-semibold text-gray-900">{shipment.customerName}</div>
                <div className="text-gray-700 text-xs">{shipment.deliveryAddress.street}</div>
                <div className="text-gray-700 text-xs">{shipment.deliveryAddress.city}, {shipment.deliveryAddress.state} {shipment.deliveryAddress.zip}</div>
              </div>
              <div>
                <div className="text-xs text-brand-500 font-semibold uppercase tracking-wider mb-1">Carrier</div>
                <div className="font-semibold">{carrier}</div>
                {shipment.serviceLevel && <div className="text-xs text-gray-600">{shipment.serviceLevel}</div>}
                {shipment.trackingNumber && <div className="text-xs text-gray-500 font-mono">{shipment.trackingNumber}</div>}
              </div>
              <div>
                <div className="text-xs text-brand-500 font-semibold uppercase tracking-wider mb-1">Freight</div>
                <div className="font-semibold">{shipment.totalBoxes} box{shipment.totalBoxes > 1 ? 'es' : ''}{shipment.totalWeight ? ` · ${shipment.totalWeight} lbs` : ''}</div>
                {shipment.shippingCost && <div className="text-xs text-gray-600">{formatCurrency(shipment.shippingCost)} — {shipment.billToCustomer ? 'Collect' : 'Prepaid'}</div>}
              </div>
            </div>

            {/* Packing list preview */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Packing List</div>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    {['Job #', 'Description', 'Pieces', 'Boxes', 'Weight', 'Notes'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shipment.packingList.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-mono text-brand-700">{item.jobNumber}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.partCount}</td>
                      <td className="px-3 py-2 text-center">{item.boxCount}</td>
                      <td className="px-3 py-2">{item.weight ? `${item.weight} lbs` : '—'}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{item.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Driver info */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Driver Name"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="e.g. John Smith"
              />
              <Input
                label="Truck / Unit #"
                value={truckNumber}
                onChange={e => setTruckNumber(e.target.value)}
                placeholder="e.g. T-42"
              />
            </div>

            {shipment.specialInstructions && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                <div><span className="font-semibold">Special Instructions: </span>{shipment.specialInstructions}</div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: SIGNATURE ── */}
        {step === 'sign' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <div className="font-semibold mb-1">Driver Signature Required</div>
              <p className="text-xs">
                {driverName ? `${driverName}, please` : 'Please'} sign below to confirm receipt of the shipment.
                Use your finger, stylus, or mouse to sign in the box below.
              </p>
            </div>

            <SignaturePad
              ref={sigRef}
              height={200}
              onSignatureChange={isEmpty => setSigEmpty(isEmpty)}
            />

            {sigEmpty && (
              <p className="text-xs text-amber-600 text-center">
                A signature is recommended but not required to print or confirm.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="font-semibold text-gray-700 mb-1">Signing for:</div>
                <div>{shipment.shipmentNumber}</div>
                <div>{shipment.packingList.length} item{shipment.packingList.length > 1 ? 's' : ''} · {shipment.totalBoxes} box{shipment.totalBoxes > 1 ? 'es' : ''}</div>
                {shipment.totalWeight && <div>{shipment.totalWeight} lbs total</div>}
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="font-semibold text-gray-700 mb-1">Driver:</div>
                <div>{driverName || '(not entered)'}</div>
                <div className="text-gray-400">{today}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: CONFIRM & SEND ── */}
        {step === 'confirm' && !saved && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Signature preview */}
              <div className="border border-gray-200 rounded-xl p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Captured Signature</div>
                {sigRef.current && !sigRef.current.isEmpty() ? (
                  <img
                    src={sigRef.current.getSignature() ?? ''}
                    alt="Driver signature"
                    className="max-h-24 object-contain border border-gray-100 rounded w-full"
                  />
                ) : (
                  <div className="h-16 flex items-center justify-center text-gray-400 text-xs bg-gray-50 rounded-lg">
                    No signature captured
                  </div>
                )}
                {driverName && <div className="text-xs text-gray-600 mt-1 font-medium">{driverName}</div>}
                <div className="text-xs text-gray-400">{today}</div>
              </div>

              {/* Send options */}
              <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Send Copy</div>
                <Input
                  label="Driver's Email (optional)"
                  type="email"
                  value={driverEmail}
                  onChange={e => setDriverEmail(e.target.value)}
                  placeholder="driver@carrier.com"
                />
                <div className="text-xs text-gray-400">
                  Enter the driver's email then click "Email Driver" to open your email app with the BOL details pre-filled.
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 flex gap-3">
              <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                Clicking <strong>Confirm & Save</strong> will save the driver name, signature, and timestamp to this shipment record. You can still print additional copies at any time.
              </div>
            </div>
          </div>
        )}

        {/* ── SAVED STATE ── */}
        {saved && (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div className="font-semibold text-gray-900">BOL Confirmed &amp; Saved</div>
            <div className="text-sm text-gray-500">
              Shipment {shipment.shipmentNumber} has been signed{driverName ? ` by ${driverName}` : ''} and saved.
            </div>
            {driverEmail && (
              <Button variant="secondary" icon={<Mail size={14} />} onClick={handleEmail}>
                Resend Email to Driver
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
