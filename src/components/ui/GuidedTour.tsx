/**
 * GuidedTour — interactive step-by-step page tour with spotlight overlay.
 *
 * Usage:
 *   import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
 *
 *   const TOUR: TourStep[] = [
 *     { selector: '[data-tour="customer"]', title: 'Customer Field',
 *       why: 'Links the job to billing — wrong customer = wrong invoice.',
 *       what: 'Search by name. Click + to add a new customer.' },
 *   ];
 *
 *   <GuidedTourButton steps={TOUR} />
 *
 * Place data-tour="xxx" attributes on key elements for stable selectors.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, X, ChevronLeft, ChevronRight, SkipForward, Lightbulb, Target } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface TourStep {
  /** CSS selector for the element to highlight (e.g. '[data-tour="customer"]') */
  selector: string;
  /** Short title for this step (e.g. "Customer Field") */
  title: string;
  /** Why this field/area matters to the business */
  why: string;
  /** What the user should enter or look for */
  what: string;
  /** Preferred tooltip placement relative to highlighted element */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const OVERLAY_Z = 9998;
const TOOLTIP_Z = 9999;
const PADDING = 8;       // px around highlighted element
const BORDER_RADIUS = 8; // px for spotlight cutout corners

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getElementRect(selector: string): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY - PADDING,
    left: rect.left + window.scrollX - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

function scrollToElement(selector: string) {
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** Compute tooltip position to stay in viewport */
function computeTooltipStyle(
  spot: SpotlightRect,
  position: TourStep['position'],
  tooltipRef: React.RefObject<HTMLDivElement | null>,
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = tooltipRef.current?.offsetWidth ?? 340;
  const tooltipH = tooltipRef.current?.offsetHeight ?? 200;
  const scrollY = window.scrollY;

  // Convert spot (page coords) to viewport coords for overflow checks
  const spotViewTop = spot.top - scrollY;
  const spotViewBottom = spotViewTop + spot.height;

  let top: number;
  let left: number;

  const preferred = position ?? 'bottom';

  // Try preferred position, fall back if not enough space
  if (preferred === 'bottom' && spotViewBottom + tooltipH + 12 < vh) {
    top = spot.top + spot.height + 12;
    left = spot.left + spot.width / 2 - tooltipW / 2;
  } else if (preferred === 'top' && spotViewTop - tooltipH - 12 > 0) {
    top = spot.top - tooltipH - 12;
    left = spot.left + spot.width / 2 - tooltipW / 2;
  } else if (preferred === 'right' && spot.left + spot.width + tooltipW + 12 < vw) {
    top = spot.top + spot.height / 2 - tooltipH / 2;
    left = spot.left + spot.width + 12;
  } else if (preferred === 'left' && spot.left - tooltipW - 12 > 0) {
    top = spot.top + spot.height / 2 - tooltipH / 2;
    left = spot.left - tooltipW - 12;
  } else {
    // Fallback: below if room, else above, else centered
    if (spotViewBottom + tooltipH + 12 < vh) {
      top = spot.top + spot.height + 12;
    } else if (spotViewTop - tooltipH - 12 > 0) {
      top = spot.top - tooltipH - 12;
    } else {
      top = spot.top + spot.height / 2 - tooltipH / 2;
    }
    left = spot.left + spot.width / 2 - tooltipW / 2;
  }

  // Clamp left to viewport
  left = Math.max(12, Math.min(left, vw - tooltipW - 12));

  return { position: 'absolute', top, left, width: tooltipW, zIndex: TOOLTIP_Z };
}

/* ─── Overlay (SVG mask with cutout) ─────────────────────────────────────── */

function SpotlightOverlay({ rect }: { rect: SpotlightRect | null }) {
  const [dims, setDims] = useState({ w: window.innerWidth, h: document.documentElement.scrollHeight });

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: document.documentElement.scrollHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Recalculate page height when rect changes
  useEffect(() => {
    setDims({ w: window.innerWidth, h: document.documentElement.scrollHeight });
  }, [rect]);

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: dims.w, height: dims.h, zIndex: OVERLAY_Z, pointerEvents: 'none' }}
    >
      <defs>
        <mask id="tour-mask">
          {/* White = visible (dimmed area) */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {/* Black = cutout (spotlight) */}
          {rect && (
            <rect
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              rx={BORDER_RADIUS}
              ry={BORDER_RADIUS}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        x="0" y="0" width="100%" height="100%"
        fill="rgba(15,23,42,0.55)"
        mask="url(#tour-mask)"
        style={{ pointerEvents: 'all' }}
      />
    </svg>
  );
}

/* ─── Tooltip Card ───────────────────────────────────────────────────────── */

interface TooltipProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  spot: SpotlightRect;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function TourTooltip({ step, stepIndex, totalSteps, spot, onNext, onBack, onSkip }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    // Compute after first render so we know tooltip dimensions
    requestAnimationFrame(() => {
      setStyle(computeTooltipStyle(spot, step.position, ref));
    });
  }, [spot, step.position]);

  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  return (
    <div ref={ref} style={style} className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#1f355e] to-[#009877]" />

      <div className="px-5 py-4">
        {/* Step counter */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-[#1f355e]" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="End tour"
          >
            <X size={14} />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-gray-900 mb-2">{step.title}</h3>

        {/* Why it matters */}
        <div className="flex gap-2 mb-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
          <Lightbulb size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Why it matters</div>
            <p className="text-xs text-amber-900 leading-relaxed">{step.why}</p>
          </div>
        </div>

        {/* What to do */}
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{step.what}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-1 mb-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? 'w-4 bg-[#1f355e]' : i < stepIndex ? 'w-1.5 bg-[#009877]' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1 transition-colors"
          >
            <SkipForward size={11} /> Skip tour
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={12} /> Back
              </button>
            )}
            <button
              onClick={onNext}
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#1f355e] hover:bg-[#162744] rounded-lg transition-colors flex items-center gap-1"
            >
              {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tour Portal ────────────────────────────────────────────────────────── */

function TourPortal({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotRect, setSpotRect] = useState<SpotlightRect | null>(null);

  const step = steps[currentStep];

  // Scroll to and highlight current step
  const updateSpotlight = useCallback(() => {
    if (!step) return;
    scrollToElement(step.selector);
    // Wait for scroll to settle
    setTimeout(() => {
      setSpotRect(getElementRect(step.selector));
    }, 350);
  }, [step]);

  useEffect(() => {
    updateSpotlight();
  }, [updateSpotlight]);

  // Recalc on resize/scroll
  useEffect(() => {
    const recalc = () => {
      if (step) setSpotRect(getElementRect(step.selector));
    };
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc);
    };
  }, [step]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Arrow keys for navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
        else onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentStep > 0) setCurrentStep(s => s - 1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [currentStep, steps.length, onClose]);

  if (!step) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
    else onClose();
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  return createPortal(
    <div>
      <SpotlightOverlay rect={spotRect} />
      {spotRect && (
        <TourTooltip
          step={step}
          stepIndex={currentStep}
          totalSteps={steps.length}
          spot={spotRect}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={onClose}
        />
      )}
    </div>,
    document.body,
  );
}

/* ─── GuidedTourButton (place next to WorkflowHelp) ──────────────────────── */

export interface GuidedTourButtonProps {
  steps: TourStep[];
  className?: string;
  variant?: 'default' | 'dark';
  label?: string;
}

export function GuidedTourButton({ steps, className = '', variant = 'default', label }: GuidedTourButtonProps) {
  const [active, setActive] = useState(false);

  if (steps.length === 0) return null;

  const btnCls = variant === 'dark'
    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white/60 hover:text-white'
    : 'bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-400 text-blue-500 hover:text-blue-700';

  return (
    <>
      <button
        onClick={() => setActive(true)}
        title="Start guided tour"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold tracking-wide transition-all ${btnCls} ${className}`}
      >
        <Play size={9} fill="currentColor" />
        {label ?? 'Tour'}
      </button>
      {active && <TourPortal steps={steps} onClose={() => setActive(false)} />}
    </>
  );
}
