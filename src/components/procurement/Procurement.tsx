import React, { useState, useMemo, useCallback } from 'react';
import {
  Search, Plus, Edit2, Trash2, ChevronRight, X, Check,
  Package, ShoppingCart, FileText, BarChart3, Truck,
  Building2, Globe, DollarSign, Calendar, AlertTriangle,
  Clock, Filter, Download, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
import { clsx, generateId, formatCurrency } from '../../utils';
import { exportToCSV, type ExportColumn } from '../../lib/exportUtils';
import type {
  Vendor,
  VendorType,
  PurchaseOrder,
  PurchaseOrderStatus,
  POLineItem,
  VendorBill,
  VendorBillStatus,
  InventoryItem,
  Currency,
} from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// Tour & Workflow
// ─────────────────────────────────────────────────────────────────────────

const PROCUREMENT_TOUR: TourStep[] = [
  {
    selector: '[data-tour="proc-tabs"]',
    title: 'Procurement Tabs',
    why: 'Each tab handles a stage of Procure to Pay: vendors, purchase orders, bills, receiving, and analytics.',
    what: 'Start with Vendors to set up suppliers, then create Purchase Orders and track Bills.',
  },
  {
    selector: '[data-tour="proc-add-vendor"]',
    title: 'Add Vendor',
    why: 'Vendors are the foundation — every PO and bill links back to a vendor record.',
    what: 'Click to add a new supplier with contact info, payment terms, and tax details.',
  },
  {
    selector: '[data-tour="proc-add-po"]',
    title: 'Create Purchase Order',
    why: 'POs lock in prices and quantities with your supplier before goods arrive.',
    what: 'Select a vendor, add line items, set delivery date, and submit for approval.',
  },
  {
    selector: '[data-tour="proc-analytics"]',
    title: 'Spend Analytics',
    why: 'Track vendor spend, outstanding obligations, and bills aging to manage cash flow.',
    what: 'Review YTD spend by vendor, overdue bills, and open PO values.',
  },
];

const PROCUREMENT_WORKFLOW: WorkflowStep[] = [
  {
    type: 'start',
    icon: '📋',
    label: 'Need Identified',
    description: 'A material or service is needed — low stock, new job requirement, or maintenance need.',
  },
  {
    type: 'action',
    icon: '🏢',
    label: 'Select Vendor',
    description: 'Choose an active vendor from your supplier list or add a new one.',
  },
  {
    type: 'action',
    icon: '📝',
    label: 'Create Purchase Order',
    description: 'Add line items, quantities, and costs. Submit PO to vendor.',
  },
  {
    type: 'decision',
    icon: '✅',
    label: 'Pricing Approved?',
    branches: [
      { label: '✓ Approved', color: 'green', steps: [{ label: 'PO sent to vendor' }] },
      { label: '✗ Revise', color: 'red', steps: [{ label: 'Edit PO and resubmit' }] },
    ],
  },
  {
    type: 'action',
    icon: '📦',
    label: 'Goods Received',
    description: 'Vendor ships goods → received at dock → inventory updated.',
  },
  {
    type: 'action',
    icon: '💰',
    label: 'Vendor Bill',
    description: 'Vendor invoice arrives → match to PO → approve for payment.',
  },
  {
    type: 'end',
    icon: '✅',
    label: 'Payment Complete',
    description: 'Bill paid via EFT/cheque. Procure to Pay cycle closed.',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helper: PO Number & Bill Number Generation
// ─────────────────────────────────────────────────────────────────────────

function generatePONumber(existingPOs: PurchaseOrder[]): string {
  const year = new Date().getFullYear();
  const poThisYear = existingPOs.filter((po) => po.poNumber.startsWith(`PO-${year}`));
  const nextNum = poThisYear.length + 1;
  return `PO-${year}-${String(nextNum).padStart(3, '0')}`;
}

function generateBillNumber(existingBills: VendorBill[]): string {
  const year = new Date().getFullYear();
  const billThisYear = existingBills.filter((b) => b.billNumber.startsWith(`BILL-${year}`));
  const nextNum = billThisYear.length + 1;
  return `BILL-${year}-${String(nextNum).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-Component: VendorModal
// ─────────────────────────────────────────────────────────────────────────

interface VendorModalProps {
  open: boolean;
  vendor?: Vendor;
  onClose: () => void;
  onSave: (vendor: Vendor) => void;
}

function VendorModal({ open, vendor, onClose, onSave }: VendorModalProps) {
  const [form, setForm] = useState<Vendor>(
    vendor || {
      id: generateId(),
      name: '',
      type: 'supplier',
      status: 'active',
      country: 'CA',
      currency: 'CAD',
      contacts: [],
      billingAddress: { street: '', city: '', state: '', zip: '', country: 'CA' },
      paymentTerms: 'Net 30',
      chargesGst: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.name.trim()) newErrors.name = 'Vendor name required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave({ ...form, updatedAt: new Date().toISOString() });
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={vendor ? 'Edit Vendor' : 'New Vendor'} size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Col 1 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                errors.name ? 'border-red-500' : 'border-gray-200'
              )}
              placeholder="Vendor name"
            />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Account Number</label>
            <input
              type="text"
              value={form.accountNumber ?? ''}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g., SAT-0512"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as VendorType })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="supplier">Supplier</option>
              <option value="contractor">Contractor</option>
              <option value="freight_carrier">Freight Carrier</option>
              <option value="customs_broker">Customs Broker</option>
              <option value="utility">Utility</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="CA, US, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AUD">AUD</option>
              <option value="JPY">JPY</option>
              <option value="CNY">CNY</option>
              <option value="INR">INR</option>
              <option value="MXN">MXN</option>
              <option value="CHF">CHF</option>
            </select>
          </div>

          {/* Col 2 */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Terms</label>
            <select
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="COD">COD</option>
              <option value="Prepaid">Prepaid</option>
              <option value="Due on Receipt">Due on Receipt</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Payment Method</label>
            <select
              value={form.preferredPaymentMethod ?? 'eft'}
              onChange={(e) =>
                setForm({
                  ...form,
                  preferredPaymentMethod: e.target.value as
                    | 'cheque'
                    | 'eft'
                    | 'wire'
                    | 'credit_card'
                    | 'ach',
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="eft">EFT</option>
              <option value="cheque">Cheque</option>
              <option value="wire">Wire Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="ach">ACH</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">GST/HST Number</label>
            <input
              type="text"
              value={form.gstHstNumber ?? ''}
              onChange={(e) => setForm({ ...form, gstHstNumber: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g., 123456789RT0001"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">VAT Number</label>
            <input
              type="text"
              value={form.vatNumber ?? ''}
              onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="EU VAT ID"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">US EIN</label>
            <input
              type="text"
              value={form.usEin ?? ''}
              onChange={(e) => setForm({ ...form, usEin: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="12-3456789"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              <input
                type="checkbox"
                checked={form.chargesGst}
                onChange={(e) => setForm({ ...form, chargesGst: e.target.checked })}
                className="rounded border-gray-300 text-brand-600 mr-2"
              />
              Charges GST/HST
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Special payment instructions, contact preferences, etc."
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
        >
          Save Vendor
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-Component: POModal
// ─────────────────────────────────────────────────────────────────────────

interface POModalProps {
  open: boolean;
  po?: PurchaseOrder;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
  vendors: Vendor[];
  inventoryItems: InventoryItem[];
}

function POModal({ open, po, onClose, onSave, vendors, inventoryItems }: POModalProps) {
  const [form, setForm] = useState<PurchaseOrder>(
    po || {
      id: generateId(),
      poNumber: '',
      vendorId: '',
      supplier: '',
      status: 'draft',
      lineItems: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      notes: '',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  const [expectedDelivery, setExpectedDelivery] = useState<string>(po?.expectedDelivery ?? '');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const selectedVendor = vendors.find((v) => v.id === form.vendorId);

  const addLineItem = () => {
    const newLine: POLineItem = {
      id: generateId(),
      itemName: '',
      quantity: 1,
      unit: 'ea',
      unitCost: 0,
      total: 0,
      receivedQty: 0,
    };
    setForm({ ...form, lineItems: [...form.lineItems, newLine] });
  };

  const updateLineItem = (index: number, updates: Partial<POLineItem>) => {
    const updated = [...form.lineItems];
    const item = { ...updated[index], ...updates };
    // Auto-calc total
    if (updates.quantity || updates.unitCost) {
      item.total = item.quantity * item.unitCost;
    }
    updated[index] = item;
    recalculateTotals(updated);
  };

  const removeLineItem = (index: number) => {
    const updated = form.lineItems.filter((_, i) => i !== index);
    recalculateTotals(updated);
  };

  const recalculateTotals = (items: POLineItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.13; // Assume 13% HST
    const total = subtotal + tax;
    setForm({
      ...form,
      lineItems: items,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.vendorId) newErrors.vendor = 'Vendor required';
    if (form.lineItems.length === 0) newErrors.items = 'At least one line item required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      const poNumber = po?.poNumber || generatePONumber([]);
      onSave({
        ...form,
        poNumber,
        expectedDelivery: expectedDelivery || undefined,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={po ? 'Edit Purchase Order' : 'New Purchase Order'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor *</label>
            <select
              value={form.vendorId}
              onChange={(e) => {
                const vendor = vendors.find((v) => v.id === e.target.value);
                setForm({
                  ...form,
                  vendorId: e.target.value,
                  supplier: vendor?.name ?? '',
                });
              }}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                errors.vendor ? 'border-red-500' : 'border-gray-200'
              )}
            >
              <option value="">Select vendor...</option>
              {vendors
                .filter((v) => v.status === 'active')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
            {errors.vendor && <p className="text-red-600 text-xs mt-1">{errors.vendor}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Expected Delivery</label>
            <input
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        {selectedVendor && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-gray-700">
              <strong>Payment Terms:</strong> {selectedVendor.paymentTerms}
              {selectedVendor.preferredPaymentMethod && (
                <>
                  {' '}
                  • <strong>Preferred Method:</strong> {selectedVendor.preferredPaymentMethod.toUpperCase()}
                </>
              )}
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-700">Line Items</label>
            <button
              onClick={addLineItem}
              className="text-xs px-2 py-1 rounded bg-brand-50 text-brand-600 font-medium hover:bg-brand-100 transition-colors"
            >
              + Add Row
            </button>
          </div>

          {form.lineItems.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500">No line items. Click "+ Add Row" to begin.</p>
              {errors.items && <p className="text-red-600 text-xs mt-1">{errors.items}</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                      Item
                    </th>
                    <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                      Qty
                    </th>
                    <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                      Unit
                    </th>
                    <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                      Unit Cost
                    </th>
                    <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                      Total
                    </th>
                    <th className="text-center font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.lineItems.map((item, idx) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => updateLineItem(idx, { itemName: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                          placeholder="Item name"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, { quantity: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                          min="0"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateLineItem(idx, { unit: e.target.value })}
                          className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                          placeholder="ea"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(e) => updateLineItem(idx, { unitCost: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 rounded border border-gray-200 text-xs text-right focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeLineItem(idx)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-semibold">{formatCurrency(form.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax (13%):</span>
            <span className="font-semibold">{formatCurrency(form.tax)}</span>
          </div>
          <div className="flex justify-between text-brand-600">
            <span>Total:</span>
            <span className="font-bold">{formatCurrency(form.total)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Special instructions, rush delivery, etc."
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
        >
          Save PO
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-Component: BillModal
// ─────────────────────────────────────────────────────────────────────────

interface BillModalProps {
  open: boolean;
  bill?: VendorBill;
  onClose: () => void;
  onSave: (bill: VendorBill) => void;
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
}

function BillModal({ open, bill, onClose, onSave, vendors, purchaseOrders }: BillModalProps) {
  const [form, setForm] = useState<VendorBill>(
    bill || {
      id: generateId(),
      billNumber: '',
      vendorId: '',
      vendorName: '',
      status: 'draft',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      amount: 0,
      tax: 0,
      totalDue: 0,
      paidAmount: 0,
      notes: '',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const selectedVendor = vendors.find((v) => v.id === form.vendorId);
  const outstandingPos = selectedVendor
    ? purchaseOrders.filter(
        (po) => po.vendorId === form.vendorId && po.status !== 'cancelled' && po.status !== 'received'
      )
    : [];

  const handleAmountChange = (amount: number, tax: number) => {
    const totalDue = amount + tax;
    setForm({
      ...form,
      amount,
      tax,
      totalDue: Math.round(totalDue * 100) / 100,
    });
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.vendorId) newErrors.vendor = 'Vendor required';
    if (!form.billNumber.trim()) newErrors.billNumber = 'Bill number required';
    if (!form.billDate) newErrors.billDate = 'Bill date required';
    if (form.amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave({
        ...form,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={bill ? 'Edit Bill' : 'New Vendor Bill'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor *</label>
            <select
              value={form.vendorId}
              onChange={(e) => {
                const vendor = vendors.find((v) => v.id === e.target.value);
                setForm({
                  ...form,
                  vendorId: e.target.value,
                  vendorName: vendor?.name ?? '',
                });
              }}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                errors.vendor ? 'border-red-500' : 'border-gray-200'
              )}
            >
              <option value="">Select vendor...</option>
              {vendors
                .filter((v) => v.status === 'active')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
            {errors.vendor && <p className="text-red-600 text-xs mt-1">{errors.vendor}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Bill Number *</label>
            <input
              type="text"
              value={form.billNumber}
              onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                errors.billNumber ? 'border-red-500' : 'border-gray-200'
              )}
              placeholder="e.g., INV-45678"
            />
            {errors.billNumber && <p className="text-red-600 text-xs mt-1">{errors.billNumber}</p>}
          </div>

          {outstandingPos.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Link to PO (optional)</label>
              <select
                value={form.purchaseOrderId ?? ''}
                onChange={(e) => {
                  const po = purchaseOrders.find((p) => p.id === e.target.value);
                  setForm({
                    ...form,
                    purchaseOrderId: e.target.value || undefined,
                    poNumber: po?.poNumber || undefined,
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">No PO</option>
                {outstandingPos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} ({formatCurrency(po.total)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Bill Date *</label>
            <input
              type="date"
              value={form.billDate}
              onChange={(e) => setForm({ ...form, billDate: e.target.value })}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                errors.billDate ? 'border-red-500' : 'border-gray-200'
              )}
            />
            {errors.billDate && <p className="text-red-600 text-xs mt-1">{errors.billDate}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => handleAmountChange(parseFloat(e.target.value), form.tax)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
                errors.amount ? 'border-red-500' : 'border-gray-200'
              )}
              min="0"
              step="0.01"
            />
            {errors.amount && <p className="text-red-600 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tax</label>
            <input
              type="number"
              value={form.tax}
              onChange={(e) => handleAmountChange(form.amount, parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Total Due</label>
            <div className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm font-semibold">
              {formatCurrency(form.totalDue)}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Any discrepancies, credit notes, etc."
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
        >
          Save Bill
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 1: Vendors
// ─────────────────────────────────────────────────────────────────────────

function VendorsTab() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VendorType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const isManagerPlus = ['admin', 'manager'].includes(state.currentUser?.role ?? '');
  const isAdmin = state.currentUser?.role === 'admin';

  const filtered = useMemo(() => {
    return state.vendors.filter((v) => {
      const matchSearch = v.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || v.type === typeFilter;
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [state.vendors, search, typeFilter, statusFilter]);

  const handleSave = (vendor: Vendor) => {
    if (editingVendor) {
      dispatch({ type: 'UPDATE_VENDOR', payload: vendor });
    } else {
      dispatch({ type: 'ADD_VENDOR', payload: vendor });
    }
    setShowModal(false);
    setEditingVendor(undefined);
  };

  const handleDelete = (vendorId: string) => {
    if (window.confirm('Delete this vendor? Associated POs and bills will remain.')) {
      dispatch({ type: 'DELETE_VENDOR', payload: vendorId });
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingVendor(undefined);
    setShowModal(true);
  };

  const typeLabels: { [key in VendorType]: string } = {
    supplier: 'Supplier',
    contractor: 'Contractor',
    freight_carrier: 'Freight',
    customs_broker: 'Broker',
    utility: 'Utility',
    other: 'Other',
  };

  const handleExportVendors = () => {
    const columns: ExportColumn<Vendor>[] = [
      { key: 'name', header: 'Name' },
      {
        key: 'contacts',
        header: 'Contact',
        format: (contacts) => {
          const primary = (contacts as any[])?.find((c) => c.isPrimary) ?? (contacts as any[])?.[0];
          return primary?.name ?? '';
        },
      },
      {
        key: 'contacts',
        header: 'Email',
        format: (contacts) => {
          const primary = (contacts as any[])?.find((c) => c.isPrimary) ?? (contacts as any[])?.[0];
          return primary?.email ?? '';
        },
      },
      {
        key: 'contacts',
        header: 'Phone',
        format: (contacts) => {
          const primary = (contacts as any[])?.find((c) => c.isPrimary) ?? (contacts as any[])?.[0];
          return primary?.phone ?? '';
        },
      },
      { key: 'paymentTerms', header: 'Payment Terms' },
      { key: 'status', header: 'Status' },
      { key: 'currency', header: 'Currency' },
    ];
    exportToCSV(filtered, columns, 'vendors-export');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as VendorType | 'all')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Types</option>
          <option value="supplier">Supplier</option>
          <option value="contractor">Contractor</option>
          <option value="freight_carrier">Freight</option>
          <option value="customs_broker">Broker</option>
          <option value="utility">Utility</option>
          <option value="other">Other</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          onClick={handleExportVendors}
          className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors flex items-center gap-1"
          title="Export vendors to CSV"
        >
          <Download size={16} /> Export
        </button>

        {isManagerPlus && (
          <button
            onClick={handleAddNew}
            data-tour="proc-add-vendor"
            className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors flex items-center gap-1"
          >
            <Plus size={16} /> New Vendor
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Name
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Type
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Country
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Currency
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Terms
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Status
              </th>
              <th className="text-center font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((vendor) => (
              <tr key={vendor.id} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-semibold">{vendor.name}</td>
                <td className="px-3 py-2">
                  <Badge className="bg-blue-100 text-blue-700">{typeLabels[vendor.type]}</Badge>
                </td>
                <td className="px-3 py-2">{vendor.country}</td>
                <td className="px-3 py-2">{vendor.currency}</td>
                <td className="px-3 py-2">{vendor.paymentTerms}</td>
                <td className="px-3 py-2">
                  <Badge className={vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {vendor.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center flex gap-1 justify-center">
                  {isManagerPlus && (
                    <button
                      onClick={() => handleEdit(vendor)}
                      className="text-brand-600 hover:text-brand-700 p-1"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No vendors found</p>
        </div>
      )}

      <VendorModal
        open={showModal}
        vendor={editingVendor}
        onClose={() => {
          setShowModal(false);
          setEditingVendor(undefined);
        }}
        onSave={handleSave}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 2: Purchase Orders
// ─────────────────────────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | undefined>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  const isManagerPlus = ['admin', 'manager'].includes(state.currentUser?.role ?? '');
  const isAdmin = state.currentUser?.role === 'admin';

  const filtered = useMemo(() => {
    return state.purchaseOrders.filter((po) => {
      const matchSearch =
        po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
        po.supplier.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || po.status === statusFilter;
      const matchVendor = vendorFilter === 'all' || po.vendorId === vendorFilter;
      return matchSearch && matchStatus && matchVendor;
    });
  }, [state.purchaseOrders, search, statusFilter, vendorFilter]);

  const statusColors: { [key in PurchaseOrderStatus]: string } = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-700',
    acknowledged: 'bg-amber-100 text-amber-700',
    partial: 'bg-purple-100 text-purple-700',
    received: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const handleSave = (po: PurchaseOrder) => {
    if (editingPO) {
      dispatch({ type: 'UPDATE_PURCHASE_ORDER', payload: po });
    } else {
      dispatch({
        type: 'ADD_PURCHASE_ORDER',
        payload: { ...po, poNumber: generatePONumber(state.purchaseOrders) },
      });
    }
    setShowModal(false);
    setEditingPO(undefined);
  };

  const handleDelete = (poId: string) => {
    if (window.confirm('Delete this purchase order?')) {
      dispatch({ type: 'DELETE_PURCHASE_ORDER', payload: poId });
    }
  };

  const handleStatusTransition = (po: PurchaseOrder, newStatus: PurchaseOrderStatus) => {
    dispatch({ type: 'UPDATE_PURCHASE_ORDER', payload: { ...po, status: newStatus } });
  };

  const handleEdit = (po: PurchaseOrder) => {
    setEditingPO(po);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingPO(undefined);
    setShowModal(true);
  };

  const handleExportPOs = () => {
    const columns: ExportColumn<PurchaseOrder>[] = [
      { key: 'poNumber', header: 'PO Number' },
      { key: 'supplier', header: 'Vendor Name' },
      { key: 'status', header: 'Status' },
      {
        key: 'createdAt',
        header: 'Order Date',
        format: (date) => new Date(date as string).toLocaleDateString(),
      },
      {
        key: 'expectedDelivery',
        header: 'Expected Delivery',
        format: (date) => (date ? new Date(date as string).toLocaleDateString() : '—'),
      },
      {
        key: 'subtotal',
        header: 'Subtotal',
        format: (value) => formatCurrency(value as number),
      },
      {
        key: 'tax',
        header: 'Tax',
        format: (value) => formatCurrency(value as number),
      },
      {
        key: 'total',
        header: 'Total',
        format: (value) => formatCurrency(value as number),
      },
      { key: 'approvedBy', header: 'Approved By' },
    ];
    exportToCSV(filtered, columns, 'purchase-orders-export');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search POs by number or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'all')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Vendors</option>
          {state.vendors
            .filter((v) => v.status === 'active')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>

        <button
          onClick={handleExportPOs}
          className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors flex items-center gap-1"
          title="Export purchase orders to CSV"
        >
          <Download size={16} /> Export
        </button>

        {isManagerPlus && (
          <button
            onClick={handleAddNew}
            data-tour="proc-add-po"
            className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors flex items-center gap-1"
          >
            <Plus size={16} /> New PO
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                PO #
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Vendor
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Status
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Created
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Expected Delivery
              </th>
              <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Total
              </th>
              <th className="text-center font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((po) => (
              <tr key={po.id} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-semibold">{po.poNumber}</td>
                <td className="px-3 py-2">{po.supplier}</td>
                <td className="px-3 py-2">
                  <Badge className={statusColors[po.status]}>{po.status}</Badge>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {new Date(po.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(po.total)}</td>
                <td className="px-3 py-2 text-center flex gap-1 justify-center">
                  {isManagerPlus && (
                    <button
                      onClick={() => handleEdit(po)}
                      className="text-brand-600 hover:text-brand-700 p-1"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(po.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No purchase orders found</p>
        </div>
      )}

      <POModal
        open={showModal}
        po={editingPO}
        onClose={() => {
          setShowModal(false);
          setEditingPO(undefined);
        }}
        onSave={handleSave}
        vendors={state.vendors}
        inventoryItems={state.inventory}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 3: Vendor Bills
// ─────────────────────────────────────────────────────────────────────────

function BillsTab() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<VendorBill | undefined>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorBillStatus | 'all'>('all');
  const [vendorFilter, setVendorFilter] = useState('all');

  const isManagerPlus = ['admin', 'manager'].includes(state.currentUser?.role ?? '');
  const isAdmin = state.currentUser?.role === 'admin';

  const filtered = useMemo(() => {
    return state.vendorBills.filter((bill) => {
      const matchSearch =
        bill.billNumber.toLowerCase().includes(search.toLowerCase()) ||
        bill.vendorName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || bill.status === statusFilter;
      const matchVendor = vendorFilter === 'all' || bill.vendorId === vendorFilter;
      return matchSearch && matchStatus && matchVendor;
    });
  }, [state.vendorBills, search, statusFilter, vendorFilter]);

  const statusColors: { [key in VendorBillStatus]: string } = {
    draft: 'bg-gray-100 text-gray-700',
    received: 'bg-blue-100 text-blue-700',
    matched: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    paid: 'bg-emerald-100 text-emerald-700',
    disputed: 'bg-red-100 text-red-700',
  };

  const handleSave = (bill: VendorBill) => {
    if (editingBill) {
      dispatch({ type: 'UPDATE_VENDOR_BILL', payload: bill });
    } else {
      dispatch({
        type: 'ADD_VENDOR_BILL',
        payload: { ...bill, billNumber: generateBillNumber(state.vendorBills) },
      });
    }
    setShowModal(false);
    setEditingBill(undefined);
  };

  const handleDelete = (billId: string) => {
    if (window.confirm('Delete this vendor bill?')) {
      dispatch({ type: 'DELETE_VENDOR_BILL', payload: billId });
    }
  };

  const handleStatusTransition = (bill: VendorBill, newStatus: VendorBillStatus) => {
    dispatch({ type: 'UPDATE_VENDOR_BILL', payload: { ...bill, status: newStatus } });
  };

  const handleEdit = (bill: VendorBill) => {
    setEditingBill(bill);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingBill(undefined);
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search bills by number or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VendorBillStatus | 'all')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="received">Received</option>
          <option value="matched">Matched</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="disputed">Disputed</option>
        </select>

        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="all">All Vendors</option>
          {state.vendors
            .filter((v) => v.status === 'active')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>

        {isManagerPlus && (
          <button
            onClick={handleAddNew}
            className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors flex items-center gap-1"
          >
            <Plus size={16} /> New Bill
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Bill #
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Vendor
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                PO Link
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Bill Date
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Due Date
              </th>
              <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Amount
              </th>
              <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Status
              </th>
              <th className="text-center font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((bill) => (
              <tr key={bill.id} className="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-semibold">{bill.billNumber}</td>
                <td className="px-3 py-2">{bill.vendorName}</td>
                <td className="px-3 py-2 text-gray-600">{bill.poNumber ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">
                  {new Date(bill.billDate).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(bill.totalDue)}
                </td>
                <td className="px-3 py-2">
                  <Badge className={statusColors[bill.status]}>{bill.status}</Badge>
                </td>
                <td className="px-3 py-2 text-center flex gap-1 justify-center">
                  {isManagerPlus && (
                    <button
                      onClick={() => handleEdit(bill)}
                      className="text-brand-600 hover:text-brand-700 p-1"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(bill.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No vendor bills found</p>
        </div>
      )}

      <BillModal
        open={showModal}
        bill={editingBill}
        onClose={() => {
          setShowModal(false);
          setEditingBill(undefined);
        }}
        onSave={handleSave}
        vendors={state.vendors}
        purchaseOrders={state.purchaseOrders}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 4: Receiving Summary
// ─────────────────────────────────────────────────────────────────────────

function ReceivingTab() {
  const { state } = useApp();

  const thisMonthShipments = state.incomingShipments.filter((s) => {
    const shipDate = new Date(s.receivedAt);
    const now = new Date();
    return shipDate.getMonth() === now.getMonth() && shipDate.getFullYear() === now.getFullYear();
  });

  const awaitingReceipt = state.purchaseOrders.filter((po) => po.status === 'partial' || po.status === 'acknowledged');
  const pendingDelivery = state.purchaseOrders.filter(
    (po) => po.status === 'submitted' || po.status === 'acknowledged'
  );

  const recentReceipts = state.incomingShipments
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Shipments This Month</p>
              <p className="text-3xl font-bold text-brand-600 mt-1">{thisMonthShipments.length}</p>
            </div>
            <Package className="text-brand-200" size={32} />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Awaiting Receipt</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{awaitingReceipt.length}</p>
            </div>
            <Truck className="text-amber-200" size={32} />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">POs Pending Delivery</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{pendingDelivery.length}</p>
            </div>
            <ShoppingCart className="text-blue-200" size={32} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Recent Shipments</h3>
          <a
            href="/receiving"
            className="text-brand-600 hover:text-brand-700 text-xs font-semibold flex items-center gap-1"
          >
            Go to Receiving <ChevronRight size={14} />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Shipment #
                </th>
                <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Supplier
                </th>
                <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Received Date
                </th>
                <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Items
                </th>
              </tr>
            </thead>
            <tbody>
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    No recent shipments
                  </td>
                </tr>
              ) : (
                recentReceipts.map((shipment) => (
                  <tr key={shipment.id} className="border-t border-gray-200">
                    <td className="px-3 py-2">{shipment.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{shipment.customerName}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {shipment.receivedAt ? new Date(shipment.receivedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{shipment.quantity ?? 0} items</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 5: Analytics
// ─────────────────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { state } = useApp();

  // Spend by Vendor (YTD)
  const spendByVendor = useMemo(() => {
    const map: { [vendorId: string]: { vendorName: string; poCount: number; poValue: number; billCount: number; billValue: number; paidValue: number } } = {};

    state.purchaseOrders.forEach((po) => {
      if (!map[po.vendorId]) {
        map[po.vendorId] = { vendorName: po.supplier, poCount: 0, poValue: 0, billCount: 0, billValue: 0, paidValue: 0 };
      }
      map[po.vendorId].poCount += 1;
      map[po.vendorId].poValue += po.total;
    });

    state.vendorBills.forEach((bill) => {
      if (!map[bill.vendorId]) {
        map[bill.vendorId] = { vendorName: bill.vendorName, poCount: 0, poValue: 0, billCount: 0, billValue: 0, paidValue: 0 };
      }
      map[bill.vendorId].billCount += 1;
      map[bill.vendorId].billValue += bill.totalDue;
      map[bill.vendorId].paidValue += bill.paidAmount;
    });

    return Object.values(map).sort((a, b) => b.poValue + b.billValue - (a.poValue + a.billValue));
  }, [state.purchaseOrders, state.vendorBills]);

  // Outstanding PO Value
  const outstandingPoValue = useMemo(() => {
    return state.purchaseOrders
      .filter((po) => po.status !== 'received' && po.status !== 'cancelled')
      .reduce((sum, po) => sum + po.total, 0);
  }, [state.purchaseOrders]);

  // Bills Aging
  const billsAging = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let overdue = { count: 0, total: 0 };
    let dueThisWeek = { count: 0, total: 0 };
    let future = { count: 0, total: 0 };

    state.vendorBills.forEach((bill) => {
      if (bill.status === 'paid') return;

      const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
      const outstanding = bill.totalDue - bill.paidAmount;

      if (!dueDate) {
        future.count += 1;
        future.total += outstanding;
      } else {
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          overdue.count += 1;
          overdue.total += outstanding;
        } else if (diffDays <= 7) {
          dueThisWeek.count += 1;
          dueThisWeek.total += outstanding;
        } else {
          future.count += 1;
          future.total += outstanding;
        }
      }
    });

    return { overdue, dueThisWeek, future };
  }, [state.vendorBills]);

  return (
    <div className="space-y-4" data-tour="proc-analytics">
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <div>
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Overdue Bills</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{billsAging.overdue.count}</p>
            <p className="text-sm text-gray-600 mt-1">{formatCurrency(billsAging.overdue.total)} outstanding</p>
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <div>
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Due This Week</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{billsAging.dueThisWeek.count}</p>
            <p className="text-sm text-gray-600 mt-1">{formatCurrency(billsAging.dueThisWeek.total)} due</p>
          </div>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <div>
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Outstanding PO Value</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(outstandingPoValue)}</p>
            <p className="text-sm text-gray-600 mt-1">{state.purchaseOrders.filter((po) => po.status !== 'received' && po.status !== 'cancelled').length} POs</p>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-gray-700 mb-3">Spend by Vendor (YTD)</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Vendor
                </th>
                <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  # POs
                </th>
                <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  PO Value
                </th>
                <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  # Bills
                </th>
                <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Billed
                </th>
                <th className="text-right font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {spendByVendor.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    No vendor spend data
                  </td>
                </tr>
              ) : (
                spendByVendor.map((vendor) => (
                  <tr key={vendor.vendorName} className="border-t border-gray-200">
                    <td className="px-3 py-2 font-semibold">{vendor.vendorName}</td>
                    <td className="px-3 py-2 text-right">{vendor.poCount}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(vendor.poValue)}
                    </td>
                    <td className="px-3 py-2 text-right">{vendor.billCount}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(vendor.billValue)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-600">
                      {formatCurrency(vendor.paidValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────

export function Procurement() {
  const [activeTab, setActiveTab] = useState<'vendors' | 'pos' | 'bills' | 'receiving' | 'analytics'>('vendors');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Procurement</h1>
          <p className="text-gray-600 text-sm mt-1">Procure-to-Pay workflow management</p>
        </div>

        <div className="flex gap-2">
          <WorkflowHelp title="Procurement Workflow" description="End-to-end Procure to Pay cycle." steps={PROCUREMENT_WORKFLOW} />
          <GuidedTourButton steps={PROCUREMENT_TOUR} />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="mb-4 flex gap-1 bg-gray-100 rounded-lg p-1 w-fit" data-tour="proc-tabs">
        {(
          [
            { id: 'vendors', label: 'Vendors', icon: Building2 },
            { id: 'pos', label: 'Purchase Orders', icon: ShoppingCart },
            { id: 'bills', label: 'Bills', icon: FileText },
            { id: 'receiving', label: 'Receiving', icon: Package },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2',
              activeTab === id
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'vendors' && <VendorsTab />}
        {activeTab === 'pos' && <PurchaseOrdersTab />}
        {activeTab === 'bills' && <BillsTab />}
        {activeTab === 'receiving' && <ReceivingTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}
