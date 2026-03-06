/**
 * LabelPrintModal.tsx
 * Modal that displays one or more barcode labels ready for printing.
 * Calls window.print() which, combined with @print CSS in index.css,
 * only shows the labels and nothing else.
 */

import React from 'react';
import { Printer, X } from 'lucide-react';
import { BarcodeLabel } from './BarcodeLabel';
import { Button } from '../components/ui/Button';
import type { BarcodeLabel as BarcodeLabelData } from '../types';

interface LabelPrintModalProps {
  labels: BarcodeLabelData[];
  title?: string;
  onClose: () => void;
}

export function LabelPrintModal({ labels, title = 'Print Labels', onClose }: LabelPrintModalProps) {
  function handlePrint() {
    document.body.classList.add('printing-labels');
    window.print();
    // Remove class after print dialog closes
    setTimeout(() => document.body.classList.remove('printing-labels'), 2000);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Printer size={20} className="text-brand-600" />
              {title}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Labels preview */}
          <div id="label-print-area" className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-wrap gap-3 justify-center">
              {labels.map((lbl, i) => (
                <BarcodeLabel key={i} label={lbl} width={230} />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <p className="text-sm text-gray-500">
              {labels.length} label{labels.length !== 1 ? 's' : ''} ready to print
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" icon={<Printer size={15} />} onClick={handlePrint}>
                Print Labels
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
