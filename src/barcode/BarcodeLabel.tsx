/**
 * BarcodeLabel.tsx
 * Renders a printable barcode label.
 * Uses JsBarcode to draw a Code-128 barcode into an SVG ref.
 */

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import type { BarcodeLabel as BarcodeLabelData } from '../types';

interface BarcodeLabelProps {
  label: BarcodeLabelData;
  /** Width in px for screen preview (print uses @page CSS). Default 240 */
  width?: number;
}

export function BarcodeLabel({ label, width = 240 }: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, label.code, {
        format: 'CODE128',
        width: 1.6,
        height: 40,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      // Invalid barcode value – leave SVG empty
    }
  }, [label.code]);

  return (
    <div
      className="barcode-label bg-white border border-gray-300 rounded flex flex-col items-center gap-0.5 p-2"
      style={{ width, fontFamily: 'monospace' }}
    >
      {/* Color swatch for powder labels */}
      {label.colorSwatch && (
        <div
          className="w-full h-3 rounded-sm mb-0.5"
          style={{ backgroundColor: label.colorSwatch }}
        />
      )}

      {/* Text lines */}
      <p className="w-full text-center text-[10px] font-bold leading-tight truncate text-gray-900">
        {label.line1}
      </p>
      {label.line2 && (
        <p className="w-full text-center text-[8px] leading-tight text-gray-600 truncate">
          {label.line2}
        </p>
      )}
      {label.line3 && (
        <p className="w-full text-center text-[8px] leading-tight text-gray-500 truncate">
          {label.line3}
        </p>
      )}

      {/* Barcode SVG */}
      <svg ref={svgRef} className="mt-1" style={{ maxWidth: width - 16, height: 44 }} />

      {/* Human-readable code */}
      <p className="text-[7px] text-gray-500 leading-none mt-0.5">{label.code}</p>
    </div>
  );
}
