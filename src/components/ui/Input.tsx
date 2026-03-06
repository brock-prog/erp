import React from 'react';
import { clsx } from '../../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  hint?: string;
  suffix?: string;
}

export function Input({ label, error, icon, hint, suffix, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-600">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          {...props}
          className={clsx(
            'w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 placeholder-gray-400',
            error
              ? 'border-red-400 bg-red-50 focus:ring-red-400/30 focus:border-red-400'
              : 'border-gray-200 bg-white hover:border-gray-300',
            icon  ? 'pl-9'  : 'pl-3',
            suffix ? 'pr-10' : 'pr-3',
            'py-2',
            props.disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed',
            className,
          )}
        />
        {suffix && (
          <span className="absolute right-3 text-xs text-gray-400 pointer-events-none">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 flex items-center gap-1">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Select({ label, error, hint, className, id, children, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-600">
          {label}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className={clsx(
          'w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 pl-3 pr-8 py-2 bg-white appearance-none cursor-pointer',
          error ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-200 hover:border-gray-300',
          props.disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed',
          className,
        )}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-600">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={clsx(
          'w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 px-3 py-2 resize-y placeholder-gray-400',
          error ? 'border-red-400 bg-red-50 focus:ring-red-400/30' : 'border-gray-200 bg-white hover:border-gray-300',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
