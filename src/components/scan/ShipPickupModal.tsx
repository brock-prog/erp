/**
 * ShipPickupModal.tsx
 * Shown when a SHP: (shipment) barcode is scanned.
 * Operator confirms pickup, signs, records carrier/driver info.
 */

import React, { useState } from 'react';
import { Truck, User, CheckCircle, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Shipment } from '../../types';

interface ShipPickupModalProps {
  shipment: Shipment;
  onConfirm: (data: {
    signedBy: string;
    driverName?: string;
    notes?: string;
  }) => void;
  onClose: () => void;
}

export function ShipPickupModal({ shipment, onConfirm, onClose }: ShipPickupModalProps) {
  const [signedBy, setSignedBy] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');

  function handleConfirm() {
    if (!signedBy.trim()) return;
    onConfirm({ signedBy: signedBy.trim(), driverName: driverName.trim() || undefined, notes: notes || undefined });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-purple-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Truck size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pickup Confirmation</h2>
              <p className="text-sm text-gray-500">{shipment.shipmentNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Shipment summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-900">{shipment.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Carrier</span>
              <span className="font-medium text-gray-900 uppercase">{shipment.carrier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Boxes</span>
              <span className="font-medium text-gray-900">{shipment.totalBoxes}</span>
            </div>
            {shipment.totalWeight && (
              <div className="flex justify-between">
                <span className="text-gray-500">Weight</span>
                <span className="font-medium text-gray-900">{shipment.totalWeight} lbs</span>
              </div>
            )}
            {shipment.trackingNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tracking</span>
                <span className="font-mono text-xs text-brand-600">{shipment.trackingNumber}</span>
              </div>
            )}
          </div>

          {/* Signed by */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <User size={14} className="inline mr-1 text-brand-500" />
              Signed By (your name) *
            </label>
            <input
              type="text"
              value={signedBy}
              onChange={e => setSignedBy(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Driver */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Driver / Carrier Name (optional)
            </label>
            <input
              type="text"
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              placeholder="Driver name or carrier ref"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Any pickup notes…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            variant="success"
            onClick={handleConfirm}
            disabled={!signedBy.trim()}
            icon={<CheckCircle size={16} />}
            className="flex-1"
          >
            Confirm Pickup
          </Button>
        </div>
      </div>
    </div>
  );
}
