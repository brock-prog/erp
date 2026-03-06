/**
 * ScanLog.tsx
 * Shows today's scan event history at the bottom of the scan station.
 */

import React from 'react';
import { CheckCircle, XCircle, Package, Minus, Truck, Search, ClipboardList } from 'lucide-react';
import type { ScanEvent } from '../../types';

interface ScanLogProps {
  events: ScanEvent[];
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  receive_inventory: <Package size={14} className="text-green-500" />,
  consume_material: <Minus size={14} className="text-blue-500" />,
  ship_pickup: <Truck size={14} className="text-purple-500" />,
  lookup_item: <Search size={14} className="text-gray-500" />,
  lookup_job: <Search size={14} className="text-gray-500" />,
  create_job_order: <ClipboardList size={14} className="text-orange-500" />,
};

const ACTION_LABELS: Record<string, string> = {
  receive_inventory: 'Received',
  consume_material: 'Consumed',
  ship_pickup: 'Pickup',
  lookup_item: 'Lookup',
  lookup_job: 'Job Lookup',
  create_job_order: 'Job Order',
};

export function ScanLog({ events }: ScanLogProps) {
  const today = new Date().toDateString();
  const todayEvents = events.filter(e => new Date(e.createdAt).toDateString() === today);

  if (todayEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No scans yet today
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto">
      {todayEvents.map(event => (
        <div
          key={event.id}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            event.success ? 'bg-gray-800' : 'bg-red-950'
          }`}
        >
          {/* Action icon */}
          <span className="shrink-0">{ACTION_ICONS[event.action] ?? <Search size={14} />}</span>

          {/* Code */}
          <span className="font-mono text-xs text-gray-400 shrink-0 w-24 truncate">
            {event.scannedCode}
          </span>

          {/* Action label */}
          <span className="text-gray-300 text-xs shrink-0">
            {ACTION_LABELS[event.action] ?? event.action}
          </span>

          {/* Weight */}
          {event.weightLbs != null && (
            <span className="text-blue-400 text-xs shrink-0">{event.weightLbs.toFixed(2)} lbs</span>
          )}

          {/* Job */}
          {event.jobNumber && (
            <span className="text-brand-400 text-xs shrink-0">{event.jobNumber}</span>
          )}

          {/* Location */}
          {event.locationAssigned && (
            <span className="text-green-400 text-xs truncate">{event.locationAssigned}</span>
          )}

          {/* Error */}
          {!event.success && event.errorMessage && (
            <span className="text-red-400 text-xs truncate">{event.errorMessage}</span>
          )}

          {/* Spacer + status */}
          <span className="ml-auto shrink-0">
            {event.success
              ? <CheckCircle size={14} className="text-green-500" />
              : <XCircle size={14} className="text-red-500" />
            }
          </span>

          {/* Time */}
          <span className="text-gray-600 text-xs shrink-0">
            {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}
