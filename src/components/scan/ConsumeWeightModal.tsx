/**
 * ConsumeWeightModal.tsx
 * Shown when an INV: (inventory item) barcode is scanned for consumption.
 * Operator enters actual weight used and links to a job number.
 * Used for powder paint, sublimation film, chemicals, etc.
 */

import React, { useState } from 'react';
import { Weight, Link2, Minus, X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import type { InventoryItem, Job } from '../../types';

interface ConsumeWeightModalProps {
  item: InventoryItem;
  jobs: Job[]; // active jobs for linking
  onConfirm: (data: {
    weightLbs: number;
    quantity: number; // same as weightLbs for lbs-unit items, otherwise entered qty
    jobId?: string;
    jobNumber?: string;
    notes?: string;
  }) => void;
  onClose: () => void;
}

export function ConsumeWeightModal({ item, jobs, onConfirm, onClose }: ConsumeWeightModalProps) {
  const [weightLbs, setWeightLbs] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const isWeightBased = ['lbs', 'lb', 'oz', 'kg'].includes(item.unit.toLowerCase());
  const availableQty = item.quantityOnHand - item.quantityAllocated;
  const enteredQty = isWeightBased ? parseFloat(weightLbs) || 0 : parseFloat(quantity) || 0;
  const isOverdraw = enteredQty > availableQty;

  const activeJobs = jobs.filter(j => !['complete', 'cancelled', 'on_hold'].includes(j.status));
  const selectedJob = activeJobs.find(j => j.id === jobId);

  function handleConfirm() {
    if (enteredQty <= 0) return;
    onConfirm({
      weightLbs: isWeightBased ? enteredQty : 0,
      quantity: enteredQty,
      jobId: jobId || undefined,
      jobNumber: selectedJob?.jobNumber,
      notes: notes || undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-blue-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Minus size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Consume Material</h2>
              <p className="text-sm text-gray-500">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Item info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2">
              {item.colorHex && (
                <div className="w-5 h-5 rounded-full border border-gray-300" style={{ backgroundColor: item.colorHex }} />
              )}
              <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
            </div>
            <p className="text-xs text-gray-500">SKU: {item.sku} | Location: {item.location}</p>
            <div className="flex items-center gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-400">Available</p>
                <p className="font-bold text-green-700">{availableQty.toFixed(1)} {item.unit}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">On Hand</p>
                <p className="font-medium text-gray-700">{item.quantityOnHand.toFixed(1)} {item.unit}</p>
              </div>
              {item.colorCode && (
                <div>
                  <p className="text-xs text-gray-400">Color</p>
                  <p className="font-medium text-gray-700">{item.colorCode}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quantity / weight input */}
          {isWeightBased ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <Weight size={14} className="inline mr-1 text-blue-500" />
                Weight Used (lbs) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weightLbs}
                onChange={e => setWeightLbs(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 text-center mt-1">
                Weigh the container before and after; enter the difference
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Quantity Used ({item.unit}) *
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Overdraw warning */}
          {isOverdraw && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle size={16} className="shrink-0" />
              Quantity exceeds available stock ({availableQty.toFixed(1)} {item.unit})
            </div>
          )}

          {/* Job link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <Link2 size={14} className="inline mr-1 text-brand-500" />
              Link to Job (optional)
            </label>
            <select
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— No job link —</option>
              {activeJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} – {j.customerName} ({j.status})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. extra coat due to rework…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={enteredQty <= 0}
            icon={<Minus size={16} />}
            className="flex-1"
          >
            Record Usage
          </Button>
        </div>
      </div>
    </div>
  );
}
