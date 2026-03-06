/**
 * ReceiveItemModal.tsx
 * Shown when a RCV: (receipt) barcode is scanned.
 * Lets the operator confirm receipt items and assign a storage location.
 * For weight-tracked items (powder, film) shows a weight entry field.
 */

import React, { useState } from 'react';
import { MapPin, Weight, CheckCircle, X, Package } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Receipt, InventoryItem } from '../../types';

interface ReceiveItemModalProps {
  receipt: Receipt;
  inventoryMap: Map<string, InventoryItem>;
  onConfirm: (data: {
    locationAssigned: string;
    weights: Record<string, number>; // itemId → weight in lbs
    notes?: string;
  }) => void;
  onClose: () => void;
}

const STORAGE_LOCATIONS = [
  'Powder Room – Shelf A1',
  'Powder Room – Shelf A2',
  'Powder Room – Shelf B1',
  'Powder Room – Shelf B2',
  'Film Storage – Rack 1',
  'Film Storage – Rack 2',
  'Chemical Store – Cabinet 1',
  'Chemical Store – Cabinet 2',
  'Receiving Dock – Temp',
  'Warehouse – Bay 1',
  'Warehouse – Bay 2',
  'Warehouse – Bay 3',
  'Other',
];

export function ReceiveItemModal({ receipt, inventoryMap, onConfirm, onClose }: ReceiveItemModalProps) {
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  const weightableCategories = new Set(['powder', 'sublimation_ink', 'transfer_paper', 'chemical']);

  const effectiveLocation = location === 'Other' ? customLocation : location;

  function isWeightable(item: ReceiptItem) {
    const inv = item.inventoryItemId ? inventoryMap.get(item.inventoryItemId) : undefined;
    if (!inv) return false;
    return weightableCategories.has(inv.category);
  }

  function handleConfirm() {
    onConfirm({ locationAssigned: effectiveLocation, weights, notes: notes || undefined });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Package size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Receive Items</h2>
              <p className="text-sm text-gray-500">{receipt.receiptNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Vendor / customer */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
            <span className="font-medium">From: </span>
            {receipt.vendorName ?? receipt.customerName ?? 'Unknown'}
            {receipt.poNumber && <span className="ml-3 text-gray-500">PO# {receipt.poNumber}</span>}
          </div>

          {/* Items list */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Items Received</h3>
            <div className="space-y-2">
              {receipt.items.map(item => {
                const inv = item.inventoryItemId ? inventoryMap.get(item.inventoryItemId) : undefined;
                const needsWeight = isWeightable(item);
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantityReceived} {item.unit}
                          {inv && <span className="ml-2 text-brand-600">SKU: {inv.sku}</span>}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.condition === 'good' ? 'bg-green-100 text-green-700' :
                        item.condition === 'damaged' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.condition}
                      </span>
                    </div>
                    {needsWeight && (
                      <div className="flex items-center gap-2">
                        <Weight size={14} className="text-blue-500 shrink-0" />
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="Actual weight (lbs)"
                          value={weights[item.id] ?? ''}
                          onChange={e => setWeights(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <span className="text-xs text-gray-500">lbs</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Storage location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <MapPin size={14} className="inline mr-1 text-brand-500" />
              Assign Storage Location
            </label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Select location —</option>
              {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {location === 'Other' && (
              <input
                type="text"
                placeholder="Enter custom location…"
                value={customLocation}
                onChange={e => setCustomLocation(e.target.value)}
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Any notes about condition, discrepancies, etc."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            variant="success"
            onClick={handleConfirm}
            disabled={!effectiveLocation}
            icon={<CheckCircle size={16} />}
            className="flex-1"
          >
            Confirm Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

// Local type alias (receipt items are accessed via receipt.items)
type ReceiptItem = Receipt['items'][number];
