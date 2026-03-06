import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, Trash2, Copy, ArrowRight, ChevronDown, ChevronUp, Info, Zap, Upload, Camera, CheckCircle2, Loader2, X, ImageIcon, FileUp, ScanLine } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import {
  formatCurrency, formatDate, quoteStatusConfig, generateId, generateQuoteNumber,
  generateJobNumber, calcLineItemTotal, sumLineItems, clsx,
} from '../../utils';
import {
  getTaxRates, getStateProvinceOptions, getStateProvinceLabel, COUNTRIES,
} from '../../utils/taxUtils';
import { RackConfigPanel } from '../powder/RackConfigPanel';
import type { Quote, QuoteLineItem, QuoteStatus, Priority, ServiceType, Job, PowderCoatingRackConfig } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const QUOTES_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '📞', label: 'Customer Requests Pricing',
    description: 'A customer or CRM opportunity triggers a quote request.' },
  { type: 'action', icon: '➕', label: 'Create Quote',
    description: 'Click "New Quote" — select customer, add line items with service type and pricing.' },
  { type: 'action', icon: '🧮', label: 'Use Pricing Tool',
    description: 'Open the Pricing Tool tab to calculate costs based on part size, weight, finish type, and complexity.' },
  { type: 'action', icon: '📧', label: 'Send Quote to Customer',
    description: 'Set status to "Sent" and email or share via the customer portal.' },
  { type: 'decision', icon: '❓', label: 'Customer Accepts?',
    branches: [
      { label: '✓ Accepted', color: 'green',
        steps: [{ label: 'Status → Accepted' }, { label: 'Convert to Job Order' }, { label: 'Log CRM activity (+30 pts)' }]},
      { label: '✗ Rejected / Expired', color: 'red',
        steps: [{ label: 'Status → Rejected or Expired' }, { label: 'Log lost reason in CRM' }]},
    ]},
  { type: 'end', icon: '🏭', label: 'Job Order Created',
    description: 'Accepted quotes become pending job orders, ready for receiving and production.' },
];

const QUOTES_TOUR: TourStep[] = [
  { selector: '[data-tour="quote-stats"]', title: 'Quote Status Counts',
    why: 'Shows how many quotes are in each stage — draft, sent, approved, rejected, expired, converted.',
    what: 'Click any status card to filter the list below to just that status.' },
  { selector: '[data-tour="quote-search"]', title: 'Search & Filter',
    why: 'Quickly find a quote by customer name, quote number, or PO reference.',
    what: 'Type in the search box or click a status chip to narrow results.' },
  { selector: '[data-tour="quote-actions"]', title: 'Create a Quote',
    why: 'Every job starts with a quote — this is how you price work for the customer.',
    what: '"Quick Quote" for fast single-line estimates. "New Quote" for detailed multi-line quotes with tax and delivery.' },
  { selector: '[data-tour="quote-list"]', title: 'Quote List',
    why: 'All quotes sorted by date. Each row shows customer, total, status, and expiry.',
    what: 'Click a quote row to expand details. Use the action buttons to edit, duplicate, convert to job, or delete.' },
];

// ─── Quote Modal ───────────────────────────────────────────────────────────────

function QuoteModal({ open, onClose, editQuote }: { open: boolean; onClose: () => void; editQuote?: Quote }) {
  const { state, dispatch } = useApp();

  const [customerId, setCustomerId] = useState(editQuote?.customerId ?? '');
  const [priority, setPriority] = useState<Priority>(editQuote?.priority ?? 'normal');
  const [expiryDate, setExpiryDate] = useState(editQuote?.expiryDate ?? '');
  const [notes, setNotes] = useState(editQuote?.notes ?? '');
  const [items, setItems] = useState<QuoteLineItem[]>(editQuote?.lineItems ?? [
    { id: generateId(), description: '', quantity: 1, unitPrice: 0, unit: 'ea', discount: 0, serviceType: 'powder_coating' },
  ]);

  // Delivery / Tax
  const [deliveryCountry, setDeliveryCountry] = useState(editQuote?.deliveryProvince ? 'CA' : 'CA');
  const [deliveryProvince, setDeliveryProvince] = useState(editQuote?.deliveryProvince ?? '');
  const [taxOverride, setTaxOverride] = useState(editQuote?.taxOverride ?? false);
  const [manualTaxRate, setManualTaxRate] = useState(editQuote?.taxRate ?? 0);

  // Powder coating rack config
  const [showRackConfig, setShowRackConfig] = useState(!!editQuote?.rackConfig);
  const [rackConfig, setRackConfig] = useState<PowderCoatingRackConfig | undefined>(editQuote?.rackConfig);

  // When customer changes, auto-populate delivery address
  useEffect(() => {
    const customer = state.customers.find(c => c.id === customerId);
    if (customer && !taxOverride) {
      const country = customer.billingAddress?.country ?? 'CA';
      const province = customer.billingAddress?.state ?? '';
      setDeliveryCountry(country);
      setDeliveryProvince(province);
    }
  }, [customerId]);

  // Compute tax rates from delivery location
  const taxRates = useMemo(
    () => getTaxRates(deliveryCountry, deliveryProvince),
    [deliveryCountry, deliveryProvince],
  );

  // Effective tax rate: auto or manual override
  const effectiveTaxRate = taxOverride ? manualTaxRate : taxRates.totalRate * 100;

  // Financials
  const subtotal = sumLineItems(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })));
  const taxAmount = subtotal * (effectiveTaxRate / 100);
  const total = subtotal + taxAmount;

  // Does the quote include powder coating?
  const hasPowderCoating = items.some(i => i.serviceType === 'powder_coating' || i.serviceType === 'both');

  // Province options for delivery selector
  const provinceOptions = getStateProvinceOptions(deliveryCountry);
  const provinceLabel = getStateProvinceLabel(deliveryCountry);

  // Customer's currency
  const selectedCustomer = state.customers.find(c => c.id === customerId);
  const currency = selectedCustomer?.currency ?? (selectedCustomer?.billingAddress?.country === 'US' ? 'USD' : 'CAD');
  const isUSD = currency === 'USD';

  function addLine() {
    setItems(prev => [...prev, { id: generateId(), description: '', quantity: 1, unitPrice: 0, unit: 'ea', discount: 0, serviceType: 'powder_coating' }]);
  }

  function updateLine(id: string, field: keyof QuoteLineItem, value: unknown) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeLine(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handleSave() {
    const now = new Date().toISOString().split('T')[0];
    const customer = state.customers.find(c => c.id === customerId);
    const quote: Quote = {
      id: editQuote?.id ?? generateId(),
      quoteNumber: editQuote?.quoteNumber ?? generateQuoteNumber(state.quotes.map(q => q.quoteNumber)),
      customerId,
      customerName: customer?.name ?? '',
      status: editQuote?.status ?? 'draft',
      priority,
      createdBy: state.currentUser.name,
      issueDate: now,
      expiryDate,
      lineItems: items,
      subtotal,
      discountAmount: 0,
      taxRate: effectiveTaxRate,
      taxAmount,
      total,
      notes,
      currency,
      deliveryProvince: deliveryCountry === 'CA' ? deliveryProvince : undefined,
      taxOverride,
      rackConfig: hasPowderCoating && rackConfig ? rackConfig : undefined,
      createdAt: editQuote?.createdAt ?? now,
      updatedAt: now,
    };
    if (editQuote) {
      dispatch({ type: 'UPDATE_QUOTE', payload: quote });
    } else {
      dispatch({ type: 'ADD_QUOTE', payload: quote });
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editQuote ? `Edit ${editQuote.quoteNumber}` : 'New Quote'} size="2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!customerId}>Save Quote</Button></>}>
      <div className="space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-3 gap-4">
          <Select label="Customer *" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Select customer...</option>
            {state.customers.filter(c => c.status === 'active').map(c => {
              const cur = c.currency ?? (c.billingAddress?.country === 'US' ? 'USD' : 'CAD');
              return (
                <option key={c.id} value={c.id}>
                  {c.name} {cur === 'USD' ? '🇺🇸' : '🇨🇦'}
                </option>
              );
            })}
          </Select>
          <Select label="Priority" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option><option value="normal">Normal</option>
            <option value="high">High</option><option value="rush">Rush</option>
          </Select>
          <Input label="Expiry Date" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        </div>

        {/* Currency indicator */}
        {customerId && (
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
            isUSD ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-brand-50 text-brand-700 border border-brand-200',
          )}>
            <span>{isUSD ? '🇺🇸' : '🇨🇦'}</span>
            <span>Quoting in <strong>{currency}</strong> — {isUSD ? 'US Dollar' : 'Canadian Dollar'}</span>
          </div>
        )}

        {/* Line items */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Line Items</div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                <div className="col-span-4">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Description</label>}
                  <input value={item.description} onChange={e => updateLine(item.id, 'description', e.target.value)}
                    placeholder="Service description..." className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Service</label>}
                  <select value={item.serviceType} onChange={e => updateLine(item.id, 'serviceType', e.target.value as ServiceType)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white">
                    <option value="powder_coating">Powder Coat</option>
                    <option value="sublimation">Sublimation</option>
                    <option value="both">Both</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Qty</label>}
                  <input type="number" value={item.quantity} onChange={e => updateLine(item.id, 'quantity', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Unit</label>}
                  <input value={item.unit} onChange={e => updateLine(item.id, 'unit', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Unit $</label>}
                  <input type="number" step="0.01" value={item.unitPrice} onChange={e => updateLine(item.id, 'unitPrice', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Disc%</label>}
                  <input type="number" value={item.discount} onChange={e => updateLine(item.id, 'discount', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Total</label>}
                  <div className="text-xs font-semibold text-gray-700 py-1.5 text-right">
                    {formatCurrency(calcLineItemTotal(item.quantity, item.unitPrice, item.discount))}
                  </div>
                </div>
                <div className="col-span-1 flex items-end justify-center pb-0.5">
                  <button onClick={() => removeLine(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={addLine}>Add Line</Button>
          </div>
        </div>

        {/* ── Powder Coating Rack Config ─────────────────────────────────────── */}
        {hasPowderCoating && (
          <div className="border border-orange-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowRackConfig(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-orange-800">🏭 Powder Coating Rack Configuration</span>
                {rackConfig && <Badge className="bg-orange-100 text-orange-700">Configured</Badge>}
              </div>
              {showRackConfig ? <ChevronUp size={16} className="text-orange-600" /> : <ChevronDown size={16} className="text-orange-600" />}
            </button>
            {showRackConfig && (
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-4">
                  Define how parts will be racked on the powder coat line. This information travels with the job so floor operators know how it was quoted.
                </p>
                <RackConfigPanel
                  value={rackConfig}
                  onChange={setRackConfig}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Delivery & Taxes ───────────────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Delivery Location & Taxes</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Manual override</span>
              <button
                onClick={() => setTaxOverride(v => !v)}
                className={clsx(
                  'relative w-9 h-5 rounded-full transition-colors focus:outline-none',
                  taxOverride ? 'bg-brand-500' : 'bg-gray-300',
                )}
              >
                <span className={clsx(
                  'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  taxOverride ? 'translate-x-4' : 'translate-x-0',
                )} />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {!taxOverride ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Delivery Country"
                    value={deliveryCountry}
                    onChange={e => { setDeliveryCountry(e.target.value); setDeliveryProvince(''); }}
                  >
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </Select>
                  {provinceOptions.length > 0 ? (
                    <Select
                      label={provinceLabel}
                      value={deliveryProvince}
                      onChange={e => setDeliveryProvince(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {provinceOptions.map(o => (
                        <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      label={provinceLabel}
                      value={deliveryProvince}
                      onChange={e => setDeliveryProvince(e.target.value)}
                    />
                  )}
                </div>
                {deliveryProvince && deliveryCountry === 'CA' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
                    <div className="font-semibold mb-0.5">Auto-calculated: {taxRates.breakdown}</div>
                    <div className="text-green-600">Total tax rate: {(taxRates.totalRate * 100).toFixed(3)}%</div>
                  </div>
                )}
                {deliveryCountry !== 'CA' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                    Export sale — no Canadian taxes applied (0%)
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Info size={14} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-700">Manual override active — auto-calculation disabled</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-500">Tax rate:</span>
                  <input
                    type="number"
                    step="0.001"
                    value={manualTaxRate}
                    onChange={e => setManualTaxRate(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs border border-amber-300 rounded bg-amber-50 text-right font-mono"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Totals ────────────────────────────────────────────────────────── */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

          {/* Tax breakdown */}
          {!taxOverride && deliveryCountry === 'CA' && deliveryProvince ? (
            <>
              {taxRates.hstRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 text-xs">HST ({(taxRates.hstRate * 100).toFixed(0)}%)</span>
                  <span className="text-gray-600">{formatCurrency(subtotal * taxRates.hstRate)}</span>
                </div>
              )}
              {taxRates.gstRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 text-xs">GST ({(taxRates.gstRate * 100).toFixed(0)}%)</span>
                  <span className="text-gray-600">{formatCurrency(subtotal * taxRates.gstRate)}</span>
                </div>
              )}
              {taxRates.pstRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 text-xs">PST ({(taxRates.pstRate * 100).toFixed(0)}%)</span>
                  <span className="text-gray-600">{formatCurrency(subtotal * taxRates.pstRate)}</span>
                </div>
              )}
              {taxRates.qstRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 text-xs">QST ({(taxRates.qstRate * 100).toFixed(3)}%)</span>
                  <span className="text-gray-600">{formatCurrency(subtotal * taxRates.qstRate)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax Total ({(effectiveTaxRate).toFixed(3)}%)</span>
                <span className="font-medium">{formatCurrency(taxAmount)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                Tax {taxOverride ? '(manual)' : deliveryCountry !== 'CA' ? '(export — 0%)' : '— select province'}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(taxAmount)}</span>
                <span className="text-gray-400 text-xs">({effectiveTaxRate.toFixed(3)}%)</span>
              </div>
            </div>
          )}

          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
            <span>Total</span>
            <span className={isUSD ? 'text-blue-700' : 'text-brand-700'}>
              {formatCurrency(total)} {currency}
            </span>
          </div>
        </div>

        <Textarea label="Customer Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

// ─── Quick Quote Modal ────────────────────────────────────────────────────────
// Scan a profile drawing (photo or PDF) → auto-extract dimensions →
// fill in paint code + quantity + length → generate a draft quote instantly.

type QQStep = 'upload' | 'scanning' | 'details';

interface ScannedProfile {
  profileType: string;
  material: string;
  width: string;
  height: string;
  wallThickness: string;
  extractedNotes: string;
}

// Simulated scan results (in production: call Claude vision API with the image)
const DEMO_SCANS: ScannedProfile[] = [
  { profileType: 'Aluminum Extrusion — Box Section', material: 'Aluminum 6063-T5', width: '2.5"', height: '1.5"', wallThickness: '0.125"', extractedNotes: 'Pre-drilled holes, 8 per piece. Ends mitered at 45°.' },
  { profileType: 'Steel C-Channel', material: 'Mild Steel A36', width: '3"', height: '1.5"', wallThickness: '0.187"', extractedNotes: 'Punched slots on web, 3/8" diameter.' },
  { profileType: 'Aluminum Angle', material: 'Aluminum 6061-T6', width: '2"', height: '2"', wallThickness: '0.25"', extractedNotes: 'Rounded inside corner, standard mill finish.' },
  { profileType: 'Tubular Steel Section', material: 'ERW Mild Steel', width: '2"', height: '2"', wallThickness: '0.120"', extractedNotes: 'Square tube, welded seam. Light surface rust, will require blast.' },
];

const SCAN_STEPS = [
  { label: 'Reading file dimensions', duration: 700 },
  { label: 'Identifying profile geometry', duration: 900 },
  { label: 'Extracting material callouts', duration: 700 },
  { label: 'Preparing quote fields', duration: 500 },
];

const FINISH_TYPES = ['Gloss', 'Semi-Gloss', 'Satin', 'Matte', 'Texture', 'Wrinkle', 'Candy', 'Chrome-look'];
const PREP_OPTIONS = [
  { id: 'wash', label: 'Standard chemical wash' },
  { id: 'blast', label: 'Abrasive blast + wash (+$0.35/ft)' },
];

function QuickQuoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState<QQStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanStepIdx, setScanStepIdx] = useState(-1);
  const [scanned, setScanned] = useState<ScannedProfile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Quote detail fields
  const [customerId, setCustomerId] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [colorName, setColorName] = useState('');
  const [finish, setFinish] = useState('Gloss');
  const [qty, setQty] = useState('');
  const [lengthFt, setLengthFt] = useState('');
  const [prep, setPrep] = useState('wash');
  const [isRush, setIsRush] = useState(false);
  const [notes, setNotes] = useState('');

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('upload'); setFile(null); setPreviewUrl(null);
        setScanStepIdx(-1); setScanned(null); setIsDragging(false);
        setCustomerId(''); setProfileDesc(''); setColorCode(''); setColorName('');
        setFinish('Gloss'); setQty(''); setLengthFt('');
        setPrep('wash'); setIsRush(false); setNotes('');
      }, 300);
    }
  }, [open]);

  function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    const f = files[0];
    setFile(f);
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null); // PDF — show icon only
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function startScan() {
    setStep('scanning');
    setScanStepIdx(0);

    let idx = 0;
    function advance() {
      idx++;
      setScanStepIdx(idx);
      if (idx < SCAN_STEPS.length) {
        setTimeout(advance, SCAN_STEPS[idx]?.duration ?? 800);
      } else {
        // Done — pick a random demo result, pre-fill fields
        const result = DEMO_SCANS[Math.floor(Math.random() * DEMO_SCANS.length)];
        setScanned(result);
        setProfileDesc(result.profileType);
        setNotes(result.extractedNotes);
        if (result.material.toLowerCase().includes('steel') && !result.material.toLowerCase().includes('stainless')) {
          setPrep('blast');
        }
        setTimeout(() => setStep('details'), 400);
      }
    }
    setTimeout(advance, SCAN_STEPS[0].duration);
  }

  // Pricing estimate
  const estimate = useMemo(() => {
    const q = parseFloat(qty) || 0;
    const l = parseFloat(lengthFt) || 0;
    if (!q || !l) return null;
    const isSteel = scanned?.material.toLowerCase().includes('steel') ?? false;
    const baseRate = isSteel ? 1.20 : 1.55; // $/linear foot
    const blastSurcharge = prep === 'blast' ? 0.35 : 0;
    const linearFt = q * l;
    const setupFee = 85;
    let subtotal = linearFt * (baseRate + blastSurcharge) + setupFee;
    if (isRush) subtotal *= 1.25;
    return { linearFt: Math.round(linearFt * 10) / 10, subtotal: Math.round(subtotal * 100) / 100 };
  }, [qty, lengthFt, prep, isRush, scanned]);

  function createQuote() {
    const customer = state.customers.find(c => c.id === customerId);
    const now = new Date().toISOString().split('T')[0];
    const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];
    const unitPrice = estimate ? estimate.subtotal / Math.max(1, parseFloat(qty) || 1) : 0;
    const lineItems: QuoteLineItem[] = [
      {
        id: generateId(),
        description: `${profileDesc}${colorCode ? ` · ${colorCode}` : ''}${colorName ? ` ${colorName}` : ''} · ${finish} finish · ${lengthFt}ft × ${qty}pcs`,
        quantity: parseFloat(qty) || 1,
        unitPrice,
        unit: 'pcs',
        discount: 0,
        serviceType: 'powder_coating',
        notes: [
          scanned ? `Material: ${scanned.material}` : '',
          scanned ? `Profile: ${scanned.width} × ${scanned.height}, wall ${scanned.wallThickness}` : '',
          prep === 'blast' ? 'Surface prep: abrasive blast + chemical wash' : 'Surface prep: chemical wash',
          notes,
        ].filter(Boolean).join(' | '),
      },
    ];
    const subtotal = estimate?.subtotal ?? 0;
    const taxRate = 0.13; // default ON HST
    const taxAmount = subtotal * taxRate;
    const quote: Quote = {
      id: generateId(),
      quoteNumber: generateQuoteNumber(state.quotes.map(q => q.quoteNumber)),
      customerId,
      customerName: customer?.name ?? '',
      status: 'draft',
      priority: isRush ? 'rush' : 'normal',
      createdBy: state.currentUser.name,
      issueDate: now,
      expiryDate: expiry,
      lineItems,
      subtotal,
      discountAmount: 0,
      taxRate: taxRate * 100,
      taxAmount,
      total: subtotal + taxAmount,
      notes: notes || undefined,
      currency: 'CAD',
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_QUOTE', payload: quote });
    onClose();
  }

  if (!open) return null;

  const canCreate = customerId && qty && lengthFt && (colorCode || colorName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Zap size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Quick Quote</div>
              <div className="text-xs text-gray-400">
                {step === 'upload' ? 'Upload drawing or photo' : step === 'scanning' ? 'Scanning file…' : 'Review & create quote'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          {(['upload', 'scanning', 'details'] as QQStep[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  step === s ? 'bg-brand-600 text-white' :
                  (['upload', 'scanning', 'details'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
                  'bg-gray-200 text-gray-500',
                )}>
                  {(['upload', 'scanning', 'details'].indexOf(step) > i) ? <CheckCircle2 size={12} /> : i + 1}
                </div>
                <span className={clsx('text-xs capitalize', step === s ? 'text-gray-900 font-medium' : 'text-gray-400')}>
                  {s === 'upload' ? 'Upload' : s === 'scanning' ? 'Scan' : 'Details'}
                </span>
              </div>
              {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Upload a profile drawing, shop drawing, or photo. The system will scan it and pre-fill dimensions, material, and suggested surface prep.
              </p>
              {/* Hidden inputs */}
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.dxf,.dwg"
                className="hidden" onChange={e => handleFiles(e.target.files)} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={e => handleFiles(e.target.files)} />

              {!file ? (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={clsx(
                    'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 transition-colors cursor-pointer',
                    isDragging ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50',
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <FileUp size={24} className="text-gray-400" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-700 text-sm">Drag & drop drawing or photo</div>
                    <div className="text-gray-400 text-xs mt-1">PDF, PNG, JPG, DXF, DWG accepted</div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Upload size={13} /> Browse Files
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Camera size={13} /> Take Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {previewUrl ? (
                    <div className="relative">
                      <img src={previewUrl} alt="Drawing preview" className="w-full max-h-56 object-contain bg-gray-100" />
                      <button
                        onClick={() => { setFile(null); setPreviewUrl(null); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
                        <ImageIcon size={18} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-800 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</div>
                      </div>
                      <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="text-gray-400 hover:text-red-500">
                        <X size={15} />
                      </button>
                    </div>
                  )}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {file.name} ready to scan
                    </div>
                    <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="text-xs text-brand-600 hover:underline">
                      Change file
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3 text-xs text-amber-800">
                <ScanLine size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>AI Scan</strong> reads profile type, material callouts, and dimensions from the drawing. You'll review and confirm all extracted data before the quote is created.
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: SCANNING ── */}
          {step === 'scanning' && (
            <div className="space-y-6 py-4">
              {previewUrl && (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img src={previewUrl} alt="Scanning" className="w-full max-h-40 object-contain bg-gray-100 blur-[1px] opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/90 rounded-xl px-5 py-3 flex items-center gap-3 shadow-lg">
                      <Loader2 size={18} className="text-brand-600 animate-spin" />
                      <span className="text-sm font-medium text-gray-800">
                        {SCAN_STEPS[Math.min(scanStepIdx, SCAN_STEPS.length - 1)]?.label ?? 'Processing…'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {SCAN_STEPS.map((s, i) => (
                  <div key={i} className={clsx('flex items-center gap-3 transition-all', i > scanStepIdx && 'opacity-30')}>
                    <div className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                      i < scanStepIdx  ? 'bg-emerald-100' :
                      i === scanStepIdx ? 'bg-brand-100' :
                      'bg-gray-100',
                    )}>
                      {i < scanStepIdx  ? <CheckCircle2 size={14} className="text-emerald-600" /> :
                       i === scanStepIdx ? <Loader2 size={13} className="text-brand-600 animate-spin" /> :
                       <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                    </div>
                    <span className={clsx(
                      'text-sm',
                      i < scanStepIdx  ? 'text-emerald-600 font-medium' :
                      i === scanStepIdx ? 'text-brand-700 font-medium' :
                      'text-gray-400',
                    )}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: DETAILS ── */}
          {step === 'details' && (
            <div className="space-y-5">
              {/* Scanned results card */}
              {scanned && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <ScanLine size={15} className="text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Scan Results</span>
                        <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Review & edit below</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-800">
                        <div><span className="text-emerald-600">Profile:</span> {scanned.profileType}</div>
                        <div><span className="text-emerald-600">Material:</span> {scanned.material}</div>
                        <div><span className="text-emerald-600">Width × Height:</span> {scanned.width} × {scanned.height}</div>
                        <div><span className="text-emerald-600">Wall:</span> {scanned.wallThickness}</div>
                        {scanned.extractedNotes && (
                          <div className="col-span-2"><span className="text-emerald-600">Notes:</span> {scanned.extractedNotes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Customer *</label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select customer…</option>
                  {state.customers.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Profile description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Profile Description *</label>
                <input
                  value={profileDesc}
                  onChange={e => setProfileDesc(e.target.value)}
                  placeholder="e.g. Aluminum extrusion — 2.5″ × 1.5″ box section"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Paint code + finish */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Paint Code / RAL# *
                  </label>
                  <input
                    value={colorCode}
                    onChange={e => setColorCode(e.target.value)}
                    placeholder="e.g. RAL 7016 / SW6119"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Color Name</label>
                  <input
                    value={colorName}
                    onChange={e => setColorName(e.target.value)}
                    placeholder="e.g. Anthracite Gray"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Finish */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Finish Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {FINISH_TYPES.map(f => (
                    <button
                      key={f}
                      onClick={() => setFinish(f)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        finish === f
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty + Length */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Quantity (pieces) *</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    placeholder="e.g. 50"
                    min="1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Length per piece (ft) *</label>
                  <input
                    type="number"
                    value={lengthFt}
                    onChange={e => setLengthFt(e.target.value)}
                    placeholder="e.g. 8"
                    min="0.1"
                    step="0.1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Surface prep */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Surface Preparation</label>
                <div className="space-y-2">
                  {PREP_OPTIONS.map(o => (
                    <label key={o.id} className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                      prep === o.id ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:bg-gray-50',
                    )}>
                      <input type="radio" name="prep" value={o.id} checked={prep === o.id}
                        onChange={() => setPrep(o.id)} className="accent-brand-600" />
                      <span className="text-sm text-gray-700">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rush + Notes */}
              <div className="flex items-center gap-3">
                <label className={clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors flex-1',
                  isRush ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:bg-gray-50',
                )}>
                  <input type="checkbox" checked={isRush} onChange={e => setIsRush(e.target.checked)} className="accent-red-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Rush Order</div>
                    <div className="text-xs text-gray-400">+25% expedite surcharge</div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Masking requirements, packaging, special handling…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Price estimate */}
              {estimate ? (
                <div className="rounded-xl bg-gray-900 text-white p-4">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Estimated Price</div>
                  <div className="flex items-end justify-between">
                    <div className="space-y-1 text-xs text-gray-400">
                      <div>{estimate.linearFt} linear ft × {prep === 'blast' ? '$1.55–1.90' : '$1.20–1.55'}/ft</div>
                      {isRush && <div className="text-red-400">+25% rush surcharge</div>}
                      <div>+$85.00 setup fee</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-white">${estimate.subtotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</div>
                      <div className="text-xs text-gray-400">excl. tax · CAD</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center text-xs text-gray-400">
                  Enter quantity and length to see price estimate
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button onClick={step === 'upload' ? onClose : () => setStep(step === 'details' ? 'upload' : 'upload')}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {step === 'upload' ? 'Cancel' : '← Back'}
          </button>
          <div className="flex gap-2">
            {step === 'upload' && (
              <button
                disabled={!file}
                onClick={startScan}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                  file
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                )}
              >
                <ScanLine size={14} /> Scan Drawing
              </button>
            )}
            {step === 'details' && (
              <>
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Re-scan
                </button>
                <button
                  disabled={!canCreate}
                  onClick={createQuote}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                    canCreate
                      ? 'bg-brand-600 hover:bg-brand-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                  )}
                >
                  <Zap size={14} /> Create Draft Quote
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quotes Page ──────────────────────────────────────────────────────────────

export function Quotes() {
  const { state, dispatch, can } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNew, setShowNew] = useState(params.get('new') === '1');
  const [showQuickQuote, setShowQuickQuote] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | undefined>();

  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, [params]);

  const filtered = state.quotes.filter(q => {
    const ms = !search || q.quoteNumber.toLowerCase().includes(search.toLowerCase()) || q.customerName.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all' || q.status === statusFilter;
    return ms && mf;
  });

  function convertToJob(quote: Quote) {
    const now = new Date().toISOString().split('T')[0];
    const job: Job = {
      id: generateId(),
      jobNumber: generateJobNumber(state.jobs.map(j => j.jobNumber)),
      quoteId: quote.id,
      customerId: quote.customerId,
      customerName: quote.customerName,
      serviceType: quote.lineItems[0]?.serviceType ?? 'powder_coating',
      status: 'received',
      priority: quote.priority,
      parts: [],
      quotedRackConfig: quote.rackConfig,
      dueDate: now,
      receivedDate: now,
      estimatedHours: 0,
      laborCost: 0,
      materialCost: 0,
      totalCost: 0,
      salePrice: quote.total,
      notes: quote.notes,
      internalNotes: '',
      statusHistory: [{ status: 'received', timestamp: new Date().toISOString(), userId: state.currentUser.id, userName: state.currentUser.name }],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_JOB', payload: job });
    dispatch({ type: 'UPDATE_QUOTE', payload: { ...quote, status: 'converted', convertedToJobId: job.id } });
    navigate(`/jobs/${job.id}`);
  }

  const statusCounts = ['draft', 'sent', 'approved', 'rejected', 'expired', 'converted'].reduce((acc, s) => {
    acc[s] = state.quotes.filter(q => q.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <QuoteModal open={showNew} onClose={() => setShowNew(false)} />
      {editQuote && <QuoteModal open={!!editQuote} onClose={() => setEditQuote(undefined)} editQuote={editQuote} />}
      <QuickQuoteModal open={showQuickQuote} onClose={() => setShowQuickQuote(false)} />

      {/* Page header */}
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Quotes</h1>
        <WorkflowHelp title="Quotes Workflow" description="From customer pricing request to accepted quote and job creation." steps={QUOTES_WORKFLOW} />
        <GuidedTourButton steps={QUOTES_TOUR} />
      </div>
      {/* Stats */}
      <div data-tour="quote-stats" className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => {
          const cfg = quoteStatusConfig(status as QuoteStatus);
          return (
            <div key={status} onClick={() => setStatusFilter(status)}
              className="bg-white rounded-xl border border-gray-200 p-3 text-center cursor-pointer hover:border-brand-300 transition-colors">
              <div className={`text-xl font-bold ${cfg.color.split(' ')[1]}`}>{count}</div>
              <div className="text-xs text-gray-500 capitalize">{status}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div data-tour="quote-search" className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['all', 'draft', 'sent', 'approved', 'rejected', 'expired', 'converted'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {s}
            </button>
          ))}
        </div>
        <span data-tour="quote-actions" className="flex gap-2 ml-auto">
        {can(2) ? (
          <>
            <Button icon={<Zap size={14} />} onClick={() => setShowQuickQuote(true)} variant="secondary" className="mr-2">Quick Quote</Button>
            <Button icon={<Plus size={14} />} onClick={() => setShowNew(true)}>New Quote</Button>
          </>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">View Only</span>
        )}
        </span>
      </div>

      {/* Table */}
      <Card padding={false} data-tour="quote-list">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {['Quote #', 'Customer', 'Status', 'Priority', 'Issued', 'Expires', 'Total', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(q => {
              const sc = quoteStatusConfig(q.status);
              const cur = q.currency ?? 'CAD';
              return (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">{q.quoteNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{q.customerName}</div>
                    {q.deliveryProvince && (
                      <div className="text-xs text-gray-400">Delivery: {q.deliveryProvince}</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge className={sc.color}>{sc.label}</Badge></td>
                  <td className="px-4 py-3 text-xs font-semibold text-orange-600 capitalize">{q.priority}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(q.issueDate)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(q.expiryDate)}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{formatCurrency(q.total)}</div>
                    <div className={`text-xs font-medium ${cur === 'USD' ? 'text-blue-500' : 'text-brand-500'}`}>{cur}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditQuote(q)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors" title="Edit">
                        <FileText size={14} />
                      </button>
                      {q.status === 'approved' && !q.convertedToJobId && (
                        <button onClick={() => convertToJob(q)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors" title="Convert to Job">
                          <ArrowRight size={14} />
                        </button>
                      )}
                      {q.convertedToJobId && (
                        <button onClick={() => navigate(`/jobs/${q.convertedToJobId}`)} className="p-1.5 text-green-500 rounded transition-colors" title="View Job">
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No quotes found</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
