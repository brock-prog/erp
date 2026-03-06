import React from 'react';
import { clsx } from '../../utils';

interface TextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export function Textarea({ label, value, onChange, placeholder, rows = 3, className, disabled }: TextareaProps) {
  const id = label?.toLowerCase().replace(/\s+/g, '_');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs font-medium text-gray-700">{label}</label>}
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={clsx(
          'w-full rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 px-3 py-2 border-gray-300 bg-white',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      />
    </div>
  );
}
