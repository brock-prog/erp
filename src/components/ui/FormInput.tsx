import React from 'react';
import { clsx } from '../../utils';

interface FormInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  hint?: string;
  error?: string;
}

/** Simplified Input wrapper with string onChange — for use in form modals */
export function Input({ label, value, onChange, type = 'text', placeholder, className, disabled, hint, error }: FormInputProps) {
  const id = label?.toLowerCase().replace(/\s+/g, '_');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs font-medium text-gray-700">{label}</label>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(
          'w-full rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 pl-3 pr-3 py-2',
          error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
