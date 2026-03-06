import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, AlertTriangle, Plus, Search, TrendingDown, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { formatCurrency, inventoryCategoryLabel, generateId, clsx } from '../../utils';
import type { InventoryItem, InventoryCategory, InventoryTransaction, BarcodeLabel } from '../../types';
import { LabelPrintModal } from '../../barcode/LabelPrintModal';
import { buildInventoryLabel } from '../../barcode/BarcodeUtils';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
const INVENTORY_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '📦', label: 'Add Inventory Item',
    description: 'Create a new SKU: name, category (powder, chemical, substrate etc), unit cost, and reorder point.' },
  { type: 'action', icon: '➕', label: 'Receive Stock',
    description: 'Record incoming stock from a supplier delivery. Quantity on Hand (QOH) is updated immediately.' },
  { type: 'action', icon: '🔗', label: 'Allocate to Jobs',
    description: 'When a job is confirmed, the required powder quantity is allocated and deducted from available QOH.' },
  { type: 'decision', icon: '⚠️', label: 'Low Stock Alert?',
    branches: [
      { label: '✓ Stock OK', color: 'green',
        steps: [{ label: 'Continue tracking usage' }]},
      { label: '⚠ Below Reorder Point', color: 'red',
        steps: [{ label: 'Alert shown on dashboard' }, { label: 'Create purchase order / receive delivery' }]},
    ]},
  { type: 'action', icon: '📊', label: 'Track via Scan Station',
    description: 'Operators scan inventory items at the Scan Station to consume weight and log usage per job.' },
  { type: 'end', icon: '📈', label: 'Stock Levels Updated',
    description: 'QOH is always live. Inventory value and low-stock counts are shown on the Dashboard.' },
];

const INVENTORY_TOUR: TourStep[] = [
  { selector: '[data-tour="inv-stats"]', title: 'Inventory Stats',
    why: 'Total SKUs, inventory value, low-stock alerts, and powder colour count give you a snapshot of stock health.',
    what: 'If "Low Stock Alerts" is red, scroll down to the alert strip to see which items need reordering.' },
  { selector: '[data-tour="inv-alerts"]', title: 'Low Stock Alerts',
    why: 'Items below their reorder point are flagged here so you never run out of powder or chemicals mid-job.',
    what: 'Each card shows available quantity vs reorder point. Create a PO or adjust stock to resolve.' },
  { selector: '[data-tour="inv-filters"]', title: 'Search & Category Filter',
    why: 'With many SKUs, filtering by category (powder, chemical, substrate) or searching by name keeps things manageable.',
    what: 'Type in the search box or click a category chip. Click "Print" to generate barcode labels for selected items.' },
  { selector: '[data-tour="inv-table"]', title: 'Inventory Table',
    why: 'Every item shows SKU, name, quantity on hand, allocated, available, unit cost, and total value.',
    what: 'Click "Adjust" to add/remove stock. Click a row to view transaction history and lot info.' },
  { selector: '[data-tour="inv-new"]', title: 'Add Inventory Item',
    why: 'New powders, chemicals, or substrates need a record before they can be allocated to jobs.',
    what: 'Click "Add Item" to enter name, SKU, category, unit cost, and reorder thresholds.' },
];

function NewItemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useApp();
  const [form, setForm] = useState({
    sku: '', name: '', category: 'powder' as InventoryCategory,
    unit: 'lbs', qoh: 0, reorderPoint: 0, reorderQty: 0,
    unitCost: 0, location: '', manufacturer: '', colorCode: '', colorHex: '',
    finish: '', notes: '',
  });

  function handleSave() {
    const now = new Date().toISOString().split('T')[0];
    const item: InventoryItem = {
      id: generateId(),
      sku: form.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      name: form.name,
      category: form.category,
      unit: form.unit,
      quantityOnHand: form.qoh,
      quantityAllocated: 0,
      reorderPoint: form.reorderPoint,
      reorderQty: form.reorderQty,
      unitCost: form.unitCost,
      location: form.location,
      manufacturer: form.manufacturer,
      colorCode: form.colorCode,
      colorHex: form.colorHex,
      finish: form.finish,
      notes: form.notes,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: item });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Inventory Item" size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!form.name}>Add Item</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Input label="SKU" value={form.sku} onChange={e => setForm(f=>({...f,sku:e.target.value}))} placeholder="Auto-generate if empty" />
          <Input label="Name *" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="col-span-2" />
          <Select label="Category" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value as InventoryCategory}))}>
            {['powder','chemical','sublimation_ink','transfer_paper','substrate','packaging','consumable','equipment_part'].map(c =>
              <option key={c} value={c}>{inventoryCategoryLabel(c)}</option>
            )}
          </Select>
          <Input label="Unit" value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))} placeholder="lbs, gal, ea, pk..." />
          <Input label="Manufacturer" value={form.manufacturer} onChange={e => setForm(f=>({...f,manufacturer:e.target.value}))} />
          <Input label="Qty on Hand" type="number" value={form.qoh} onChange={e => setForm(f=>({...f,qoh:Number(e.target.value)}))} />
          <Input label="Reorder Point" type="number" value={form.reorderPoint} onChange={e => setForm(f=>({...f,reorderPoint:Number(e.target.value)}))} />
          <Input label="Reorder Qty" type="number" value={form.reorderQty} onChange={e => setForm(f=>({...f,reorderQty:Number(e.target.value)}))} />
          <Input label="Unit Cost ($)" type="number" step="0.01" value={form.unitCost} onChange={e => setForm(f=>({...f,unitCost:Number(e.target.value)}))} />
          <Input label="Location" value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} />
        </div>
        {form.category === 'powder' && (
          <div className="grid grid-cols-3 gap-3">
            <Input label="Color Code" value={form.colorCode} onChange={e => setForm(f=>({...f,colorCode:e.target.value}))} placeholder="RAL 9005, SW-6258..." />
            <Input label="Color Hex" type="color" value={form.colorHex || '#cccccc'} onChange={e => setForm(f=>({...f,colorHex:e.target.value}))} />
            <Input label="Finish" value={form.finish} onChange={e => setForm(f=>({...f,finish:e.target.value}))} placeholder="matte, gloss..." />
          </div>
        )}
        <Textarea label="Notes" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
      </div>
    </Modal>
  );
}

function AdjustModal({ item, open, onClose }: { item: InventoryItem; open: boolean; onClose: () => void }) {
  const { dispatch } = useApp();
  const { state } = useApp();
  const [type, setType] = useState<'received' | 'consumed' | 'adjustment'>('received');
  const [qty, setQty] = useState(0);
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');

  function handleSave() {
    const delta = type === 'consumed' ? -Math.abs(qty) : Math.abs(qty);
    const newQOH = item.quantityOnHand + delta;
    const updated: InventoryItem = { ...item, quantityOnHand: Math.max(0, newQOH), updatedAt: new Date().toISOString().split('T')[0] };
    dispatch({ type: 'UPDATE_INVENTORY_ITEM', payload: updated });
    const tx: InventoryTransaction = {
      id: generateId(),
      itemId: item.id,
      itemName: item.name,
      type,
      quantity: delta,
      balanceBefore: item.quantityOnHand,
      balanceAfter: Math.max(0, newQOH),
      referenceNumber: ref,
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      notes,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_INV_TRANSACTION', payload: tx });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Adjust: ${item.name}`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={qty === 0}>Save</Button></>}>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Current QOH</span><span className="font-bold">{item.quantityOnHand} {item.unit}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Allocated</span><span className="text-orange-600 font-semibold">{item.quantityAllocated} {item.unit}</span></div>
          <div className="flex justify-between mt-1 border-t pt-1"><span className="text-gray-500">Available</span><span className="text-green-700 font-bold">{item.quantityOnHand - item.quantityAllocated} {item.unit}</span></div>
        </div>
        <Select label="Transaction Type" value={type} onChange={e => setType(e.target.value as any)}>
          <option value="received">Received (incoming)</option>
          <option value="consumed">Consumed (outgoing)</option>
          <option value="adjustment">Manual Adjustment</option>
        </Select>
        <Input label={`Quantity (${item.unit})`} type="number" step="0.1" value={qty} onChange={e => setQty(Number(e.target.value))}
          hint={`New balance: ${Math.max(0, item.quantityOnHand + (type === 'consumed' ? -Math.abs(qty) : Math.abs(qty)))} ${item.unit}`} />
        <Input label="Reference # (PO, Job, etc.)" value={ref} onChange={e => setRef(e.target.value)} />
        <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  powder: 'bg-brand-100 text-brand-700',
  chemical: 'bg-orange-100 text-orange-700',
  sublimation_ink: 'bg-emerald-100 text-emerald-700',
  transfer_paper: 'bg-teal-100 text-teal-700',
  substrate: 'bg-purple-100 text-purple-700',
  packaging: 'bg-gray-100 text-gray-600',
  consumable: 'bg-yellow-100 text-yellow-700',
  equipment_part: 'bg-red-100 text-red-700',
};

export function Inventory() {
  const { state, can } = useApp();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showNew, setShowNew] = useState(params.get('new') === '1');
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [printLabels, setPrintLabels] = useState<BarcodeLabel[] | null>(null);

  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, [params]);

  const filtered = state.inventory.filter(item => {
    const ms = !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      (item.colorCode ?? '').toLowerCase().includes(search.toLowerCase());
    const mc = catFilter === 'all' || item.category === catFilter;
    const ml = !showLowOnly || (item.quantityOnHand - item.quantityAllocated) <= item.reorderPoint;
    return ms && mc && ml && item.active;
  });

  const totalValue = state.inventory.reduce((s, i) => s + i.quantityOnHand * i.unitCost, 0);
  const lowStockItems = state.inventory.filter(i => (i.quantityOnHand - i.quantityAllocated) <= i.reorderPoint);

  const categories = ['all', 'powder', 'chemical', 'sublimation_ink', 'transfer_paper', 'substrate', 'consumable'];

  return (
    <div className="space-y-5">
      <NewItemModal open={showNew} onClose={() => setShowNew(false)} />
      {adjustItem && <AdjustModal item={adjustItem} open={!!adjustItem} onClose={() => setAdjustItem(null)} />}
      {printLabels && <LabelPrintModal labels={printLabels} title="Print Inventory Label" onClose={() => setPrintLabels(null)} />}

      {/* Page header */}
      <div className="flex items-center gap-2">
        <Package size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Inventory</h1>
        <WorkflowHelp title="Inventory Workflow" description="How stock is managed from receipt through allocation to reorder alerts." steps={INVENTORY_WORKFLOW} />
        <GuidedTourButton steps={INVENTORY_TOUR} />
      </div>
      {/* Stats */}
      <div data-tour="inv-stats" className="grid grid-cols-4 gap-4">
        <Card><div className="text-xs text-gray-500 mb-1">Total SKUs</div><div className="text-2xl font-bold text-gray-900">{state.inventory.filter(i=>i.active).length}</div></Card>
        <Card><div className="text-xs text-gray-500 mb-1">Inventory Value</div><div className="text-2xl font-bold text-green-700">{formatCurrency(totalValue)}</div></Card>
        <Card>
          <div className="text-xs text-gray-500 mb-1">Low Stock Alerts</div>
          <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-red-600' : 'text-green-700'}`}>{lowStockItems.length}</div>
        </Card>
        <Card><div className="text-xs text-gray-500 mb-1">Powder Colors</div><div className="text-2xl font-bold text-brand-700">{state.inventory.filter(i=>i.category==='powder').length}</div></Card>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div data-tour="inv-alerts" className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-500" /><span className="font-semibold text-amber-800 text-sm">Low Stock — Action Required</span></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="bg-white rounded-lg p-2.5 border border-amber-200 text-xs">
                <div className="font-semibold text-gray-800 truncate">{item.name}</div>
                <div className="text-red-600 font-bold">{item.quantityOnHand - item.quantityAllocated} {item.unit} available</div>
                <div className="text-gray-500">Reorder at: {item.reorderPoint} {item.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div data-tour="inv-filters" className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, color..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                catFilter === c ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {c === 'all' ? 'All' : inventoryCategoryLabel(c)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showLowOnly} onChange={e => setShowLowOnly(e.target.checked)} className="rounded" />
          Low stock only
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => setPrintLabels(filtered.map(buildInventoryLabel))}>Print Labels</Button>
          <span data-tour="inv-new">
          {can(3)
            ? <Button icon={<Plus size={14} />} onClick={() => setShowNew(true)}>Add Item</Button>
            : <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">View Only</span>
          }
          </span>
        </div>
      </div>

      {/* Powder color palette */}
      {(catFilter === 'all' || catFilter === 'powder') && (
        <Card>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Powder Color Stock</div>
          <div className="flex flex-wrap gap-3">
            {state.inventory.filter(i => i.category === 'powder' && i.active).map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                <div className="w-5 h-5 rounded-full border border-gray-300 shadow-inner flex-shrink-0"
                  style={{ backgroundColor: item.colorHex || '#cccccc' }} />
                <div>
                  <div className="text-xs font-semibold text-gray-800">{item.colorCode}</div>
                  <div className={`text-xs font-bold ${item.quantityOnHand - item.quantityAllocated <= item.reorderPoint ? 'text-red-600' : 'text-green-700'}`}>
                    {item.quantityOnHand - item.quantityAllocated} {item.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Inventory table */}
      <Card padding={false} data-tour="inv-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['SKU','Item','Category','QOH','Allocated','Available','Reorder Pt.','Unit Cost','Value','Location','Actions'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(item => {
              const available = item.quantityOnHand - item.quantityAllocated;
              const isLow = available <= item.reorderPoint;
              const value = item.quantityOnHand * item.unitCost;
              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                  <td className="px-3 py-3 max-w-[200px]">
                    <div className="font-medium text-gray-900 text-xs leading-tight truncate">{item.name}</div>
                    {item.colorCode && <div className="flex items-center gap-1 mt-0.5"><div className="w-3 h-3 rounded-full border" style={{backgroundColor: item.colorHex || '#ccc'}} /><span className="text-xs text-gray-400">{item.colorCode}</span></div>}
                  </td>
                  <td className="px-3 py-3"><Badge className={CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600'}>{inventoryCategoryLabel(item.category)}</Badge></td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{item.quantityOnHand} <span className="text-gray-400 font-normal">{item.unit}</span></td>
                  <td className="px-3 py-3 text-orange-600 font-medium">{item.quantityAllocated}</td>
                  <td className="px-3 py-3">
                    <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-700'}`}>{available}</span>
                    {isLow && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{item.reorderPoint}</td>
                  <td className="px-3 py-3 text-gray-700">{formatCurrency(item.unitCost)}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{formatCurrency(value)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-[100px] truncate">{item.location}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setAdjustItem(item)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors" title="Adjust stock">
                        <TrendingDown size={13} />
                      </button>
                      <button onClick={() => setPrintLabels([buildInventoryLabel(item)])} className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors" title="Print barcode label">
                        <Printer size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">No items found</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Recent transactions */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <span className="text-sm font-semibold">Recent Transactions</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Date','Item','Type','Qty Change','Balance','Job','By'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...state.inventoryTransactions].reverse().slice(0,10).map(tx => (
              <tr key={tx.id}>
                <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-gray-800 max-w-[150px] truncate">{tx.itemName}</td>
                <td className="px-4 py-2.5">
                  <Badge className={tx.type === 'received' ? 'bg-green-100 text-green-700' : tx.type === 'consumed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}>
                    {tx.type}
                  </Badge>
                </td>
                <td className={`px-4 py-2.5 text-xs font-bold ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-700">{tx.balanceAfter}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-brand-600">{tx.jobNumber ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{tx.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
