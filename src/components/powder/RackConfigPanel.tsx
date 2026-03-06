import React, { useEffect, useState } from 'react';
import type { PowderCoatingRackConfig, LineType, RackType, HookType, SubstrateAlloy } from '../../types';
import { clsx } from '../../utils';

// ─── Label maps ───────────────────────────────────────────────────────────────

const LINE_LABELS: Record<LineType, string> = {
  horizontal_auto: 'Automated Horizontal Line',
  batch:           'Batch Line',
  manual:          'Manual / Custom',
};

const RACK_OPTIONS: Array<{ value: RackType; label: string; hint: string }> = [
  { value: 'standard_flat', label: 'Standard Flat Rack',  hint: 'General purpose — flat parts' },
  { value: 'h_bar',         label: 'H-Bar Rack',          hint: 'Ideal for extrusions & profiles' },
  { value: 'angle_rack',    label: 'Angle Rack',          hint: 'Angles and structural sections' },
  { value: 'tube_rack',     label: 'Tube Rack',           hint: 'Tubes and hollow sections' },
  { value: 'channel_rack',  label: 'Channel Rack',        hint: 'C-channel and U-profiles' },
  { value: 'z_bar',         label: 'Z-Bar Rack',          hint: 'Z-profiles and Z-sections' },
  { value: 'wing_rack',     label: 'Wing Rack',           hint: 'High-volume panel hanging' },
  { value: 'custom',        label: 'Custom Fixture',      hint: 'Fabricated for this job' },
];

const HOOK_OPTIONS: Array<{ value: HookType; label: string }> = [
  { value: 'standard_s_hook',  label: 'Standard S-Hook' },
  { value: 'c_hook',           label: 'C-Hook' },
  { value: 'j_hook',           label: 'J-Hook' },
  { value: 'threaded_hook',    label: 'Threaded Hook' },
  { value: 'wire_hook',        label: 'Wire Hook' },
  { value: 'heavy_duty_hook',  label: 'Heavy Duty Hook' },
  { value: 'profile_clip',     label: 'Profile Clip' },
  { value: 'double_hook',      label: 'Double Hook' },
];

const SUBSTRATE_GROUPS: Array<{ group: string; options: Array<{ value: SubstrateAlloy; label: string }> }> = [
  { group: 'Steel', options: [
    { value: 'steel_mild',        label: 'Mild Steel' },
    { value: 'steel_galvanized',  label: 'Galvanized Steel' },
    { value: 'stainless_304',     label: 'Stainless 304' },
    { value: 'stainless_316',     label: 'Stainless 316' },
    { value: 'cast_iron',         label: 'Cast Iron' },
  ]},
  { group: 'Aluminum', options: [
    { value: 'aluminum_6063',  label: 'Aluminum 6063 (Extrusion)' },
    { value: 'aluminum_6061',  label: 'Aluminum 6061' },
    { value: 'aluminum_5052',  label: 'Aluminum 5052' },
    { value: 'aluminum_cast',  label: 'Aluminum Cast' },
  ]},
  { group: 'Other', options: [
    { value: 'other', label: 'Other / Mixed' },
  ]},
];

const DEFAULT_CONFIG: PowderCoatingRackConfig = {
  lineType: 'horizontal_auto',
  rackType: 'h_bar',
  hookType: 'profile_clip',
  substrateAlloy: 'aluminum_6063',
  hooksPerRack: 20,
  partsPerHook: 1,
  totalParts: 100,
  partsPerLoad: 20,
  estimatedLoads: 5,
  lineSpeedFtPerMin: 3,
  runLengthFt: 150,
  estimatedRunTimeMinutes: 250,
  maxPartLengthMm: 6000,
  maxPartWidthMm: 300,
  maxPartWeightKg: 25,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface RackConfigPanelProps {
  value?: PowderCoatingRackConfig;
  onChange?: (config: PowderCoatingRackConfig) => void;
  readOnly?: boolean;
  showComparison?: boolean;
  actualConfig?: PowderCoatingRackConfig;
}

// ─── Read-only display ────────────────────────────────────────────────────────

function ConfigDisplay({ config, label, highlight }: { config: PowderCoatingRackConfig; label?: string; highlight?: PowderCoatingRackConfig }) {
  const diff = (field: keyof PowderCoatingRackConfig) =>
    highlight ? highlight[field] !== config[field] : false;

  const Row = ({ f, l, v }: { f: keyof PowderCoatingRackConfig; l: string; v: React.ReactNode }) => (
    <div className={clsx('flex justify-between py-1 px-2 rounded text-xs', diff(f) ? 'bg-amber-50 text-amber-800 font-semibold' : '')}>
      <span className="text-gray-500">{l}</span>
      <span className="font-medium text-gray-800">{v}</span>
    </div>
  );

  return (
    <div className="space-y-0.5">
      {label && <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</div>}
      <Row f="lineType"     l="Line Type"     v={LINE_LABELS[config.lineType]} />
      <Row f="substrateAlloy" l="Substrate"   v={config.substrateAlloy.replace(/_/g, ' ')} />
      <Row f="rackType"     l="Rack Type"     v={RACK_OPTIONS.find(r => r.value === config.rackType)?.label ?? config.rackType} />
      <Row f="hookType"     l="Hook Type"     v={HOOK_OPTIONS.find(h => h.value === config.hookType)?.label ?? config.hookType} />
      <Row f="totalParts"   l="Total Parts"   v={config.totalParts} />
      <Row f="partsPerLoad" l="Parts/Load"    v={config.partsPerLoad} />
      <Row f="estimatedLoads" l="Est. Loads"  v={config.estimatedLoads} />
      <Row f="estimatedRunTimeMinutes" l="Est. Run Time" v={`${config.estimatedRunTimeMinutes} min`} />
      <Row f="maxPartLengthMm" l="Max Length" v={`${config.maxPartLengthMm} mm`} />
      <Row f="maxPartWeightKg" l="Max Weight" v={`${config.maxPartWeightKg} kg`} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RackConfigPanel({ value, onChange, readOnly, showComparison, actualConfig }: RackConfigPanelProps) {
  const [cfg, setCfg] = useState<PowderCoatingRackConfig>(value ?? DEFAULT_CONFIG);

  useEffect(() => { if (value) setCfg(value); }, [value]);

  function update(partial: Partial<PowderCoatingRackConfig>) {
    const next = { ...cfg, ...partial };
    // Auto-calc parts per load
    if ('hooksPerRack' in partial || 'partsPerHook' in partial) {
      next.partsPerLoad = next.hooksPerRack * next.partsPerHook;
    }
    // Auto-calc estimated loads
    if ('totalParts' in partial || 'partsPerLoad' in partial || 'hooksPerRack' in partial || 'partsPerHook' in partial) {
      next.estimatedLoads = Math.ceil(next.totalParts / Math.max(next.partsPerLoad, 1));
    }
    // Auto-calc run time for horizontal line
    if (next.lineType === 'horizontal_auto' && next.lineSpeedFtPerMin && next.runLengthFt) {
      next.estimatedRunTimeMinutes = Math.round((next.runLengthFt / next.lineSpeedFtPerMin) * next.estimatedLoads);
    }
    setCfg(next);
    onChange?.(next);
  }

  if (readOnly && showComparison && actualConfig) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-brand-200 bg-brand-50/40 rounded-lg p-3">
          <ConfigDisplay config={cfg} label="Quoted" highlight={actualConfig} />
        </div>
        <div className="border border-accent-200 bg-accent-50/40 rounded-lg p-3">
          <ConfigDisplay config={actualConfig} label="Actual" highlight={cfg} />
        </div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <ConfigDisplay config={cfg} />
      </div>
    );
  }

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );

  const selectCls = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white';
  const inputCls = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400';

  return (
    <div className="space-y-4 text-sm">
      {/* Section 1: Line & Substrate */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Line & Substrate</div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Line Type">
            <select className={selectCls} value={cfg.lineType} onChange={e => update({ lineType: e.target.value as LineType })}>
              {(Object.keys(LINE_LABELS) as LineType[]).map(k => (
                <option key={k} value={k}>{LINE_LABELS[k]}</option>
              ))}
            </select>
          </F>
          <F label="Substrate / Alloy">
            <select className={selectCls} value={cfg.substrateAlloy} onChange={e => update({ substrateAlloy: e.target.value as SubstrateAlloy })}>
              {SUBSTRATE_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </F>
        </div>
      </div>

      {/* Section 2: Rack & Hook */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rack & Hook Configuration</div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Rack Type">
            <select className={selectCls} value={cfg.rackType} onChange={e => update({ rackType: e.target.value as RackType })}>
              {RACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">{RACK_OPTIONS.find(r => r.value === cfg.rackType)?.hint}</p>
          </F>
          <F label="Hook Type">
            <select className={selectCls} value={cfg.hookType} onChange={e => update({ hookType: e.target.value as HookType })}>
              {HOOK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </F>
        </div>
      </div>

      {/* Section 3: Volume */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Volume Calculator</div>
        <div className="grid grid-cols-3 gap-3">
          <F label="Hooks / Rack">
            <input type="number" className={inputCls} min={1} value={cfg.hooksPerRack}
              onChange={e => update({ hooksPerRack: +e.target.value })} />
          </F>
          <F label="Parts / Hook">
            <input type="number" className={inputCls} min={1} value={cfg.partsPerHook}
              onChange={e => update({ partsPerHook: +e.target.value })} />
          </F>
          <F label="Total Parts">
            <input type="number" className={inputCls} min={1} value={cfg.totalParts}
              onChange={e => update({ totalParts: +e.target.value })} />
          </F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Parts / Load (auto)">
            <input type="number" className={inputCls} min={1} value={cfg.partsPerLoad}
              onChange={e => update({ partsPerLoad: +e.target.value })} />
          </F>
          <div className="flex items-end pb-1">
            <div className="text-xs text-gray-500">
              <span className="font-semibold text-brand-700 text-base">{cfg.estimatedLoads}</span>
              <span className="ml-1">estimated load{cfg.estimatedLoads !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Part Dimensions */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Part Dimensions (Metric)</div>
        <div className="grid grid-cols-3 gap-3">
          <F label="Max Length (mm)">
            <input type="number" className={inputCls} min={1} value={cfg.maxPartLengthMm}
              onChange={e => update({ maxPartLengthMm: +e.target.value })} />
          </F>
          <F label="Max Width (mm)">
            <input type="number" className={inputCls} min={1} value={cfg.maxPartWidthMm}
              onChange={e => update({ maxPartWidthMm: +e.target.value })} />
          </F>
          <F label="Max Weight (kg)">
            <input type="number" className={inputCls} min={0.1} step={0.1} value={cfg.maxPartWeightKg}
              onChange={e => update({ maxPartWeightKg: +e.target.value })} />
          </F>
        </div>
      </div>

      {/* Section 5: Horizontal Line Timing */}
      {cfg.lineType === 'horizontal_auto' && (
        <div className="border border-accent-200 bg-accent-50/30 rounded-lg p-3 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent-600">Horizontal Line Timing</div>
          <div className="grid grid-cols-3 gap-3">
            <F label="Line Speed (ft/min)">
              <input type="number" className={inputCls} min={0.5} step={0.5} value={cfg.lineSpeedFtPerMin ?? 3}
                onChange={e => update({ lineSpeedFtPerMin: +e.target.value })} />
            </F>
            <F label="Run Length (ft)">
              <input type="number" className={inputCls} min={10} value={cfg.runLengthFt ?? 150}
                onChange={e => update({ runLengthFt: +e.target.value })} />
            </F>
            <div className="flex items-end pb-1">
              <div className="text-xs text-gray-500">
                <span className="font-semibold text-accent-700 text-base">{cfg.estimatedRunTimeMinutes}</span>
                <span className="ml-1">min total</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <F label="Notes">
        <textarea
          className={clsx(inputCls, 'resize-none')}
          rows={2}
          placeholder="Special handling, masking areas, fixture notes..."
          value={cfg.notes ?? ''}
          onChange={e => update({ notes: e.target.value })}
        />
      </F>
    </div>
  );
}

export default RackConfigPanel;
