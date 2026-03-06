/**
 * ScanInput.tsx
 * Large, auto-focused input for USB barcode scanner or manual entry.
 * Always visible at top of the scan station.
 */

import React, { useRef, useEffect } from 'react';
import { ScanLine } from 'lucide-react';

interface ScanInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ScanInput({ value, onChange, onSubmit, placeholder = 'Scan barcode or type code…', disabled }: ScanInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  // Auto-focus on mount and whenever not disabled
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim());
      onChange('');
    }
  }

  return (
    <div className="relative w-full">
      <ScanLine
        size={24}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 pointer-events-none"
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full pl-12 pr-4 py-4 text-xl font-mono rounded-xl border-2 border-brand-400 bg-gray-900 text-green-400
                   placeholder:text-gray-600 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-inner"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-lg font-bold"
        >
          ×
        </button>
      )}
    </div>
  );
}
