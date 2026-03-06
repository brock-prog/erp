/**
 * WorkflowHelp — universal "?" help button + workflow flowchart modal.
 * Drop <WorkflowHelp title="..." steps={[...]} /> anywhere near a page heading.
 */

import React, { useState } from 'react';
import { X, ArrowDown } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type StepType = 'start' | 'action' | 'decision' | 'end' | 'note';
export type BranchColor = 'green' | 'red' | 'blue' | 'amber' | 'gray' | 'purple';

export interface WorkflowBranch {
  label: string;                                         // "✓ Yes"  "✗ No"
  color?: BranchColor;
  steps: Array<{ label: string; description?: string }>; // sub-steps for this branch
}

export interface WorkflowStep {
  type: StepType;
  label: string;
  description?: string;
  icon?: string;           // emoji shown left of label
  branches?: WorkflowBranch[];
}

export interface WorkflowHelpProps {
  title: string;
  description?: string;
  steps: WorkflowStep[];
  className?: string;
  variant?: 'default' | 'dark';
}

/* ─── Style maps ──────────────────────────────────────────────────────────── */

const TYPE_CONFIG: Record<StepType, {
  badge: string; dotBg: string; boxBg: string; boxBorder: string; labelColor: string;
}> = {
  start: {
    badge: 'START', dotBg: 'bg-emerald-500',
    boxBg: 'bg-emerald-50', boxBorder: 'border-emerald-300', labelColor: 'text-emerald-800',
  },
  action: {
    badge: 'ACTION', dotBg: 'bg-blue-500',
    boxBg: 'bg-blue-50', boxBorder: 'border-blue-300', labelColor: 'text-blue-900',
  },
  decision: {
    badge: 'DECISION', dotBg: 'bg-amber-500',
    boxBg: 'bg-amber-50', boxBorder: 'border-amber-400', labelColor: 'text-amber-900',
  },
  end: {
    badge: 'END', dotBg: 'bg-gray-400',
    boxBg: 'bg-gray-100', boxBorder: 'border-gray-300', labelColor: 'text-gray-700',
  },
  note: {
    badge: 'NOTE', dotBg: 'bg-yellow-400',
    boxBg: 'bg-yellow-50', boxBorder: 'border-yellow-300', labelColor: 'text-yellow-800',
  },
};

const BRANCH_CONFIG: Record<BranchColor, { bg: string; border: string; header: string; subStep: string }> = {
  green:  { bg: 'bg-emerald-50', border: 'border-emerald-300', header: 'text-emerald-700 bg-emerald-100', subStep: 'text-emerald-800' },
  red:    { bg: 'bg-red-50',     border: 'border-red-300',     header: 'text-red-700 bg-red-100',         subStep: 'text-red-800'     },
  blue:   { bg: 'bg-blue-50',    border: 'border-blue-300',    header: 'text-blue-700 bg-blue-100',       subStep: 'text-blue-800'    },
  amber:  { bg: 'bg-amber-50',   border: 'border-amber-300',   header: 'text-amber-700 bg-amber-100',     subStep: 'text-amber-800'   },
  gray:   { bg: 'bg-gray-50',    border: 'border-gray-300',    header: 'text-gray-600 bg-gray-100',       subStep: 'text-gray-700'    },
  purple: { bg: 'bg-purple-50',  border: 'border-purple-300',  header: 'text-purple-700 bg-purple-100',   subStep: 'text-purple-800'  },
};

/* ─── Sub-components ────────────────────────────────────────────────────── */

function StepBox({ step, index, isLast }: { step: WorkflowStep; index: number; isLast: boolean }) {
  const cfg = TYPE_CONFIG[step.type];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Step row */}
      <div className="flex items-start gap-3 w-full">
        {/* Left: number + dot */}
        <div className="flex flex-col items-center flex-shrink-0 pt-1">
          <div className={`w-7 h-7 rounded-full ${cfg.dotBg} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
            {index + 1}
          </div>
          {!isLast && <div className="w-0.5 bg-gray-200 flex-1 mt-1" style={{ minHeight: 16 }} />}
        </div>

        {/* Right: box content */}
        <div className={`flex-1 mb-3 rounded-xl border ${cfg.boxBg} ${cfg.boxBorder} px-4 py-3 shadow-sm`}>
          {/* Badge + label row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase ${cfg.dotBg} text-white`}>
              {cfg.badge}
            </span>
            {step.icon && <span className="text-base leading-none">{step.icon}</span>}
            <span className={`text-sm font-semibold ${cfg.labelColor}`}>{step.label}</span>
          </div>
          {/* Description */}
          {step.description && (
            <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{step.description}</p>
          )}

          {/* Decision branches */}
          {step.type === 'decision' && step.branches && step.branches.length > 0 && (
            <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(step.branches.length, 3)}, 1fr)` }}>
              {step.branches.map((branch, bi) => {
                const bc = BRANCH_CONFIG[branch.color ?? 'gray'];
                return (
                  <div key={bi} className={`rounded-lg border ${bc.border} ${bc.bg} overflow-hidden`}>
                    {/* Branch header */}
                    <div className={`px-3 py-1.5 text-xs font-bold ${bc.header}`}>
                      {branch.label}
                    </div>
                    {/* Branch sub-steps */}
                    <div className="px-3 py-2 space-y-1.5">
                      {branch.steps.map((s, si) => (
                        <div key={si} className="flex items-start gap-1.5">
                          <span className="text-gray-400 text-xs mt-0.5 flex-shrink-0">▸</span>
                          <div>
                            <div className={`text-xs font-medium ${bc.subStep}`}>{s.label}</div>
                            {s.description && (
                              <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{s.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div className="flex items-center justify-start w-full pl-[14px] mb-1 -mt-2 z-10">
          <ArrowDown size={12} className="text-gray-300 ml-1" />
        </div>
      )}
    </div>
  );
}

function WorkflowModal({ title, description, steps, onClose }: WorkflowHelpProps & { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h2 className="text-base font-bold text-gray-900">{title}</h2>
            </div>
            {description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-sm">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-4"
          >
            <X size={15} />
          </button>
        </div>

        {/* Legend */}
        <div className="px-6 py-2.5 border-b border-gray-100 bg-gray-50 flex gap-3 flex-wrap">
          {(Object.entries(TYPE_CONFIG) as [StepType, typeof TYPE_CONFIG[StepType]][]).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${cfg.dotBg}`} />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{cfg.badge}</span>
            </div>
          ))}
        </div>

        {/* Flowchart */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {steps.map((step, i) => (
            <StepBox key={i} step={step} index={i} isLast={i === steps.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ──────────────────────────────────────────────────────── */

export function WorkflowHelp({ title, description, steps, className = '', variant = 'default' }: WorkflowHelpProps) {
  const [open, setOpen] = useState(false);

  const btnCls = variant === 'dark'
    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white/50 hover:text-white'
    : 'bg-gray-100 hover:bg-blue-100 border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-600';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="View workflow guide"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-all flex-shrink-0 ${btnCls} ${className}`}
      >
        <span className="text-[10px] font-black leading-none select-none">?</span>
      </button>
      {open && (
        <WorkflowModal
          title={title}
          description={description}
          steps={steps}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
