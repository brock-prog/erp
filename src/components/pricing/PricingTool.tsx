import React, { useState, useCallback, useMemo } from 'react';
import {
  Calculator, Upload, ChevronDown, ChevronUp,
  TrendingUp, Save, Copy, FileText, Zap, BarChart2, Settings,
  AlertCircle, CheckCircle, RefreshCw, DollarSign, Globe,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/FormInput';
import { Select } from '../ui/Select';
import { clsx } from '../../utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApplicationMethod = 'horizontal_line' | 'vertical_line' | 'batch_booth';
type GeometryType = 'box' | 'flat_sheet' | 'cylinder' | 'tube_round' | 'tube_square' | 'angle' | 'channel' | 'direct';
type PowderType = 'standard_polyester' | 'premium_polyester' | 'epoxy_hybrid' | 'pvdf' | 'specialty';
type CoatType = 'single' | 'primer_plus_topcoat' | 'two_topcoat' | 'three_coat';
type ComplexityLevel = 'simple_flat' | 'simple_3d' | 'moderate' | 'complex_tubular' | 'very_complex' | 'extreme';
type PretreatmentMethod = 'none' | 'chemical_wash' | 'zinc_phosphate' | 'chromate_free' | 'blast_only' | 'blast_plus_wash' | 'full_qualicoat';
type FilmThickness = 'standard' | 'architectural' | 'heavy' | 'pvdf_class3';
type ColorCategory = 'standard' | 'premium_ral' | 'custom_match' | 'metallic' | 'chrome_effect' | 'textured';
type FinishType = 'gloss' | 'semi_gloss' | 'satin' | 'matte' | 'textured' | 'metallic';
type RushLevel = 'none' | 'priority' | 'rush' | 'same_day';

interface PricingInputs {
  partDescription: string;
  quantity: number;
  applicationMethod: ApplicationMethod;
  // Geometry / area
  geometryType: GeometryType;
  dim1: number; // length / diameter / leg1 / side / flange width / direct sqft
  dim2: number; // width / length (for round/tube) / leg2 / web height
  dim3: number; // height / thickness / channel length / angle length
  complexityLevel: ComplexityLevel;
  // Coating spec
  powderType: PowderType;
  coatType: CoatType;
  filmThickness: FilmThickness;
  colorCategory: ColorCategory;
  finish: FinishType;
  // Pretreatment & handling
  pretreatment: PretreatmentMethod;
  rushLevel: RushLevel;
  smallLot: boolean;
  maskingRequired: boolean;
  maskingComplexity: 'simple' | 'moderate' | 'complex';
  maskingPoints: number; // alternative: count of mask points
  maskingInputMethod: 'category' | 'points';
  // Volume discount
  monthlyVolumeDollars: number;
  // Shop rates
  powderCostPerLb: number;
  transferEfficiency: number; // 0-100
  laborRatePerHr: number;
  overheadBurnRatePerHr: number;
  desiredMarginPct: number;
}

interface PricingResult {
  areaSqFt: number;
  powderWeightLbs: number;
  powderCost: number;
  laborCost: number;
  overheadCost: number;
  pretreatmentCost: number;
  maskingCost: number;
  setupCost: number;
  totalCostPerPiece: number;
  marginAmount: number;
  pricePerPiece: number;
  totalLotPrice: number;
  pricePerSqFt: number;
  powderPct: number;
  laborPct: number;
  overheadPct: number;
  volumeDiscount: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Specific gravity & cost multiplier by powder type
// Powder consumption formula: lbs = area(ft²) × mils × SG × 0.0052 / (TE/100)
// 0.0052 = unit conversion (1 ft² × 0.001" × 1g/cc in lbs/in³)
const POWDER_SG: Record<PowderType, number> = {
  standard_polyester: 1.55,
  premium_polyester:  1.58,
  epoxy_hybrid:       1.60,
  pvdf:               1.78,
  specialty:          1.65,
};

const POWDER_COST_MULT: Record<PowderType, number> = {
  standard_polyester: 1.00,
  premium_polyester:  1.45,
  epoxy_hybrid:       1.25,
  pvdf:               3.20,
  specialty:          2.80,
};

const FILM_MILS: Record<FilmThickness, { target: number; label: string }> = {
  standard:     { target: 2.5, label: '2.5 mil — General industrial' },
  architectural:{ target: 4.0, label: '4.0 mil — Architectural AAMA 2604' },
  heavy:        { target: 6.5, label: '6.5 mil — Heavy corrosion protection' },
  pvdf_class3:  { target: 3.5, label: '3.5 mil — PVDF / Qualicoat Class 3' },
};

const COMPLEXITY_MULT: Record<ComplexityLevel, number> = {
  simple_flat:     1.00,
  simple_3d:       1.15,
  moderate:        1.30,
  complex_tubular: 1.55,
  very_complex:    1.90,
  extreme:         2.50,
};

// Effective throughput factor (vs base) at each complexity level
const COMPLEXITY_THROUGHPUT: Record<ComplexityLevel, number> = {
  simple_flat:     1.00,
  simple_3d:       0.85,
  moderate:        0.70,
  complex_tubular: 0.55,
  very_complex:    0.38,
  extreme:         0.22,
};

// Base sq ft/hr at simple_flat complexity (medium shop, not peak production)
const BASE_THROUGHPUT: Record<ApplicationMethod, number> = {
  horizontal_line: 350,
  vertical_line:   280,
  batch_booth:      80,
};

// Setup cost per color run (fixed per job)
const SETUP_COST: Record<ApplicationMethod, number> = {
  horizontal_line: 55,
  vertical_line:   40,
  batch_booth:     25,
};

const PRETREAT_PER_SQFT: Record<PretreatmentMethod, number> = {
  none:            0.00,
  chemical_wash:   0.05,  // 3-stage iron phosphate
  zinc_phosphate:  0.07,  // Better adhesion, auto spec
  chromate_free:   0.09,  // EU REACH compliant (Oxsilan/Bonderite)
  blast_only:      0.12,  // Abrasive blast
  blast_plus_wash: 0.19,  // Blast + phosphate (best)
  full_qualicoat:  0.22,  // 5-stage architectural aluminum
};

const COLOR_PREMIUM: Record<ColorCategory, number> = {
  standard:      1.00,
  premium_ral:   1.20,
  custom_match:  1.50,
  metallic:      1.65,
  chrome_effect: 2.80,
  textured:      1.20,
};

const COAT_MULT: Record<CoatType, { powder: number; labor: number }> = {
  single:              { powder: 1.00, labor: 1.00 },
  primer_plus_topcoat: { powder: 1.90, labor: 1.70 },
  two_topcoat:         { powder: 1.80, labor: 1.60 },
  three_coat:          { powder: 2.80, labor: 2.50 },
};

const RUSH_MULT: Record<RushLevel, number> = {
  none:     1.00,
  priority: 1.20, // 3-5 business days
  rush:     1.45, // 1-2 business days
  same_day: 1.90, // same day / emergency
};

const SMALL_LOT_MIN = 95;

const MASKING_COST_CATEGORY: Record<string, number> = {
  simple:   9,
  moderate: 25,
  complex:  60,
};

// Masking points: ~0.35 min/point average + $0.15 material/point
const MASKING_MIN_PER_POINT = 0.35;
const MASKING_MATERIAL_PER_POINT = 0.15;

function getVolumeDiscount(monthly: number): number {
  if (monthly < 5000)  return 0;
  if (monthly < 15000) return 0.05;
  if (monthly < 30000) return 0.09;
  if (monthly < 75000) return 0.13;
  return 0.18;
}

// ─── Geometry Config ──────────────────────────────────────────────────────────

interface GeoConfig {
  label: string;
  desc: string;
  d1: string; d2: string; d3?: string;
}

const GEO: Record<GeometryType, GeoConfig> = {
  flat_sheet: { label: 'Flat Sheet / Panel',      desc: 'Both sides + thin edge', d1: 'Length (in)', d2: 'Width (in)', d3: 'Thickness (in, opt.)' },
  box:        { label: 'Box / Enclosure',         desc: 'All 6 faces',            d1: 'Length (in)', d2: 'Width (in)', d3: 'Height (in)' },
  cylinder:   { label: 'Cylinder / Rod',          desc: 'Barrel + two end caps',  d1: 'Diameter (in)', d2: 'Length (in)' },
  tube_round: { label: 'Round Tube',              desc: 'OD exterior barrel only',d1: 'OD (in)',       d2: 'Length (in)' },
  tube_square:{ label: 'Square / Rect Tube',      desc: '4 exterior faces',       d1: 'Side Width (in)', d2: 'Length (in)' },
  angle:      { label: 'Angle / L-Bracket',       desc: 'Both sides, both legs',  d1: 'Leg 1 (in)', d2: 'Leg 2 (in)', d3: 'Length (in)' },
  channel:    { label: 'Channel / C-Section',     desc: 'Flanges + web, 2 faces', d1: 'Flange Width (in)', d2: 'Web Height (in)', d3: 'Length (in)' },
  direct:     { label: 'Enter Sq Ft Directly',    desc: 'Manual total area entry', d1: 'Surface Area (ft²)', d2: '' },
};

function calcGeometryArea(g: GeometryType, d1: number, d2: number, d3: number): number {
  if (d1 <= 0) return 0;
  const t = d3 > 0 ? d3 : 0.125; // default thickness for flat_sheet
  switch (g) {
    case 'flat_sheet':  return (2 * d1 * d2 + 2 * (d1 + d2) * t) / 144;
    case 'box':         return 2 * (d1 * d2 + d1 * d3 + d2 * d3) / 144;
    case 'cylinder':    return (Math.PI * d1 * d2 + 2 * Math.PI * (d1 / 2) ** 2) / 144;
    case 'tube_round':  return (Math.PI * d1 * d2) / 144;
    case 'tube_square': return (4 * d1 * d2) / 144;
    case 'angle':       return (2 * (d1 + d2) * d3) / 144;
    case 'channel':     return (2 * (d1 + 2 * d2) * d3) / 144;
    case 'direct':      return d1; // d1 IS the area in sqft
    default:            return 0;
  }
}

// ─── Pricing Calculation ──────────────────────────────────────────────────────

function calculatePrice(inp: PricingInputs): PricingResult {
  const notes: string[] = [];

  // 1. Base geometric area (per piece)
  const baseArea = calcGeometryArea(inp.geometryType, inp.dim1, inp.dim2, inp.dim3);
  // 2. Apply complexity multiplier for recesses, tubes, blind areas
  const complexMult = COMPLEXITY_MULT[inp.complexityLevel];
  const areaSqFt = baseArea * (inp.geometryType === 'direct' ? 1 : complexMult);

  if (areaSqFt <= 0) {
    return {
      areaSqFt: 0, powderWeightLbs: 0, powderCost: 0, laborCost: 0,
      overheadCost: 0, pretreatmentCost: 0, maskingCost: 0, setupCost: 0,
      totalCostPerPiece: 0, marginAmount: 0, pricePerPiece: 0, totalLotPrice: 0,
      pricePerSqFt: 0, powderPct: 0, laborPct: 0, overheadPct: 0,
      volumeDiscount: 0, confidence: 'low', notes: ['Enter part dimensions to calculate price.'],
    };
  }

  // 3. Powder consumption: lbs = area × mils × SG × 0.0052 / TE
  const mils = FILM_MILS[inp.filmThickness].target;
  const sg = POWDER_SG[inp.powderType];
  const te = inp.transferEfficiency / 100;
  const coatM = COAT_MULT[inp.coatType];
  const rawPowderLbs = areaSqFt * mils * sg * 0.0052 / te;
  const actualPowderLbs = rawPowderLbs * coatM.powder;
  const colorPrem = COLOR_PREMIUM[inp.colorCategory];
  const powderCostPerLb = inp.powderCostPerLb * POWDER_COST_MULT[inp.powderType];
  const powderCost = actualPowderLbs * powderCostPerLb * colorPrem;

  // 4. Labor + overhead via throughput model
  const throughputFactor = COMPLEXITY_THROUGHPUT[inp.complexityLevel];
  const effectiveThroughput = BASE_THROUGHPUT[inp.applicationMethod] * throughputFactor; // sqft/hr
  const laborHrs = (areaSqFt / effectiveThroughput) * coatM.labor;
  const laborCost = laborHrs * inp.laborRatePerHr;
  const overheadCost = laborHrs * inp.overheadBurnRatePerHr;

  // 5. Pretreatment
  const pretreatmentCost = areaSqFt * PRETREAT_PER_SQFT[inp.pretreatment];

  // 6. Masking
  let maskingCost = 0;
  if (inp.maskingRequired) {
    if (inp.maskingInputMethod === 'points' && inp.maskingPoints > 0) {
      maskingCost = inp.maskingPoints * (MASKING_MIN_PER_POINT / 60 * inp.laborRatePerHr + MASKING_MATERIAL_PER_POINT);
    } else {
      maskingCost = MASKING_COST_CATEGORY[inp.maskingComplexity];
    }
  }

  // 7. Setup (amortized over lot)
  const setupCost = SETUP_COST[inp.applicationMethod] / Math.max(inp.quantity, 1);

  // 8. Total cost per piece
  const totalCostPerPiece = powderCost + laborCost + overheadCost + pretreatmentCost + maskingCost + setupCost;

  // 9. Margin markup
  const marginDecimal = inp.desiredMarginPct / 100;
  const basePrice = totalCostPerPiece / (1 - marginDecimal);

  // 10. Rush multiplier
  const rushM = RUSH_MULT[inp.rushLevel];
  const afterRush = basePrice * rushM;
  if (inp.rushLevel !== 'none') {
    const pct = ((rushM - 1) * 100).toFixed(0);
    const label = { priority: 'Priority (3-5 days)', rush: 'Rush (1-2 days)', same_day: 'Same-day/emergency' }[inp.rushLevel as string] ?? '';
    notes.push(`${label} +${pct}% rush premium applied.`);
  }

  // 11. Volume discount
  const discount = getVolumeDiscount(inp.monthlyVolumeDollars);
  const priceAfterDiscount = afterRush * (1 - discount);
  if (discount > 0) notes.push(`Volume discount of ${(discount * 100).toFixed(0)}% applied (monthly volume: $${inp.monthlyVolumeDollars.toLocaleString()}).`);

  // 12. Small lot minimum
  const lotTotal = priceAfterDiscount * inp.quantity;
  const totalLotPrice = inp.smallLot ? Math.max(lotTotal, SMALL_LOT_MIN) : lotTotal;
  const effectivePricePerPiece = totalLotPrice / Math.max(inp.quantity, 1);
  if (inp.smallLot && totalLotPrice === SMALL_LOT_MIN) {
    notes.push(`Minimum lot charge of $${SMALL_LOT_MIN} applied.`);
  }

  // Validation notes
  if (inp.transferEfficiency < 55) notes.push('Transfer efficiency below 55% — consider gun calibration and booth optimization.');
  if (inp.colorCategory === 'chrome_effect') notes.push('Chrome-effect powders require strict contamination prevention and dedicated equipment.');
  if (inp.powderType === 'pvdf') notes.push('PVDF powder requires Qualicoat Class 3 pretreatment and specialized cure schedule.');
  if (inp.quantity < 5) notes.push('Very small lot — setup cost is a significant % of price. Apply minimum lot charge.');
  if (inp.quantity >= 100) notes.push('Volume lot — consider volume discount tier if a regular customer.');
  if (inp.complexityLevel === 'extreme') notes.push('Extreme complexity — physical inspection required before final quote. Estimate may vary ±25%.');

  // Breakdown percentages
  const powderPct  = totalCostPerPiece > 0 ? (powderCost / totalCostPerPiece) * 100 : 0;
  const laborPct   = totalCostPerPiece > 0 ? (laborCost / totalCostPerPiece) * 100 : 0;
  const overheadPct= totalCostPerPiece > 0 ? (overheadCost / totalCostPerPiece) * 100 : 0;

  // Confidence
  let confidence: PricingResult['confidence'] = 'high';
  if (['custom_match', 'chrome_effect'].includes(inp.colorCategory)) { confidence = 'medium'; notes.push('Custom color or chrome effect — confirm powder cost with supplier.'); }
  if (['very_complex', 'extreme'].includes(inp.complexityLevel)) confidence = 'medium';
  if (inp.geometryType === 'direct' && inp.dim1 === 0) confidence = 'low';

  return {
    areaSqFt,
    powderWeightLbs: parseFloat(actualPowderLbs.toFixed(4)),
    powderCost, laborCost, overheadCost, pretreatmentCost, maskingCost, setupCost,
    totalCostPerPiece,
    marginAmount: effectivePricePerPiece - totalCostPerPiece,
    pricePerPiece: effectivePricePerPiece,
    totalLotPrice,
    pricePerSqFt: areaSqFt > 0 ? effectivePricePerPiece / areaSqFt : 0,
    powderPct, laborPct, overheadPct,
    volumeDiscount: discount,
    confidence,
    notes: [...new Set(notes)],
  };
}

// ─── Default inputs ───────────────────────────────────────────────────────────

const DEFAULT_INPUTS: PricingInputs = {
  partDescription: '',
  quantity: 10,
  applicationMethod: 'horizontal_line',
  geometryType: 'box',
  dim1: 24, dim2: 12, dim3: 4,
  complexityLevel: 'moderate',
  powderType: 'standard_polyester',
  coatType: 'single',
  filmThickness: 'standard',
  colorCategory: 'standard',
  finish: 'gloss',
  pretreatment: 'chemical_wash',
  rushLevel: 'none',
  smallLot: false,
  maskingRequired: false,
  maskingComplexity: 'simple',
  maskingPoints: 0,
  maskingInputMethod: 'category',
  monthlyVolumeDollars: 0,
  powderCostPerLb: 5.50,
  transferEfficiency: 68,
  laborRatePerHr: 35,
  overheadBurnRatePerHr: 28,
  desiredMarginPct: 42,
};

// ─── Saved Estimate type ──────────────────────────────────────────────────────

interface SavedEstimate {
  id: string;
  name: string;
  inputs: PricingInputs;
  result: PricingResult;
  savedAt: string;
  jobWon?: boolean;
  actualCost?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PricingTool() {
  const [inputs, setInputs] = useState<PricingInputs>(DEFAULT_INPUTS);
  const [showRates, setShowRates] = useState(false);
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>(() => {
    try { return JSON.parse(localStorage.getItem('coatpro_pricing_estimates') ?? '[]'); } catch { return []; }
  });
  const [tab, setTab] = useState<'calculator' | 'history' | 'benchmarks'>('calculator');
  const [dragOver, setDragOver] = useState(false);
  const [fileParseStatus, setFileParseStatus] = useState<string | null>(null);

  const set = useCallback(<K extends keyof PricingInputs>(k: K, v: PricingInputs[K]) => {
    setInputs(prev => ({ ...prev, [k]: v }));
  }, []);

  const result = useMemo(() => calculatePrice(inputs), [inputs]);
  const geoConfig = GEO[inputs.geometryType];

  function saveEstimate() {
    const name = inputs.partDescription || `Estimate ${new Date().toLocaleString()}`;
    const est: SavedEstimate = { id: `est_${Date.now()}`, name, inputs: { ...inputs }, result, savedAt: new Date().toISOString() };
    const updated = [est, ...savedEstimates].slice(0, 50);
    setSavedEstimates(updated);
    localStorage.setItem('coatpro_pricing_estimates', JSON.stringify(updated));
  }

  function loadEstimate(est: SavedEstimate) { setInputs(est.inputs); setTab('calculator'); }

  function markJobOutcome(id: string, won: boolean, actualCost?: number) {
    const updated = savedEstimates.map(e => e.id === id ? { ...e, jobWon: won, actualCost } : e);
    setSavedEstimates(updated);
    localStorage.setItem('coatpro_pricing_estimates', JSON.stringify(updated));
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        try {
          const extmin = text.match(/EXTMIN[\s\S]{0,200}?\n\s*([\d\-.]+)\n\s*10\n\s*([\d\-.]+)\n\s*20\n\s*([\d\-.]+)/);
          const extmax = text.match(/EXTMAX[\s\S]{0,200}?\n\s*([\d\-.]+)\n\s*10\n\s*([\d\-.]+)\n\s*20\n\s*([\d\-.]+)/);
          if (extmin && extmax) {
            const w = Math.abs(parseFloat(extmax[2]) - parseFloat(extmin[2]));
            const h = Math.abs(parseFloat(extmax[3]) - parseFloat(extmin[3]));
            set('geometryType', 'flat_sheet');
            set('dim1', parseFloat(w.toFixed(2)));
            set('dim2', parseFloat(h.toFixed(2)));
            setFileParseStatus(`DXF bounding box: ${w.toFixed(2)}" × ${h.toFixed(2)}" (assumed inches — verify units)`);
          } else {
            setFileParseStatus('DXF opened but EXTMIN/EXTMAX not found. Enter dimensions manually.');
          }
        } catch { setFileParseStatus('Could not parse DXF. Enter dimensions manually.'); }
      };
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const parts = ((ev.target?.result as string) ?? '').trim().split(/[,\t\s]+/).map(Number).filter(n => !isNaN(n) && n > 0);
        if (parts.length >= 2) {
          set('geometryType', 'box');
          set('dim1', parts[0]); set('dim2', parts[1]);
          if (parts[2]) set('dim3', parts[2]);
          setFileParseStatus(`Imported dimensions: ${parts[0]}" × ${parts[1]}"${parts[2] ? ` × ${parts[2]}"` : ''}`);
        } else { setFileParseStatus('Could not parse CSV. Format: length,width,height (inches)'); }
      };
      reader.readAsText(file);
    } else {
      setFileParseStatus(`Received "${file.name}". Use .dxf for drawings or .csv with length,width,height.`);
    }
  }

  const learningData = savedEstimates.filter(e => e.jobWon !== undefined && e.actualCost !== undefined);
  const avgVariance = learningData.length > 0
    ? learningData.reduce((a, e) => a + Math.abs((e.actualCost! - e.result.totalLotPrice) / e.result.totalLotPrice), 0) / learningData.length
    : null;
  const decidedEstimates = savedEstimates.filter(e => e.jobWon !== undefined);
  const winRate = decidedEstimates.length > 0 ? savedEstimates.filter(e => e.jobWon === true).length / decidedEstimates.length : null;

  const TABS = [
    { id: 'calculator' as const, label: 'Calculator', icon: <Calculator size={15} /> },
    { id: 'history' as const,    label: `Saved Estimates (${savedEstimates.length})`, icon: <FileText size={15} /> },
    { id: 'benchmarks' as const, label: 'Benchmarks & Standards', icon: <Globe size={15} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Powder Coating Pricing Tool</h1>
          <p className="text-gray-500 text-sm mt-0.5">Parametric pricing engine for horizontal, vertical, and batch applications — informed by global industry data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>{t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ─── Calculator Tab ─── */}
      {tab === 'calculator' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Inputs — 3 cols */}
          <div className="xl:col-span-3 space-y-4">

            {/* Part Info */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><FileText size={16} />Part Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input label="Part Description" value={inputs.partDescription} onChange={v => set('partDescription', v)} placeholder="e.g. Steel enclosure bracket, aluminum extrusion frame…" />
                </div>
                <Input label="Quantity (pcs)" type="number" value={String(inputs.quantity)} onChange={v => set('quantity', Math.max(1, parseInt(v) || 1))} />
                <Select label="Application Method" value={inputs.applicationMethod} onChange={v => set('applicationMethod', v as ApplicationMethod)} options={[
                  { value: 'horizontal_line', label: 'Horizontal Powder Line (automated)' },
                  { value: 'vertical_line',   label: 'Vertical Powder Line (extrusions)' },
                  { value: 'batch_booth',     label: 'Batch Booth (manual)' },
                ]} />
              </div>
            </Card>

            {/* Surface Area — geometry based */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Calculator size={16} />Part Geometry & Surface Area</h3>

              {/* DXF drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={clsx('border-2 border-dashed rounded-lg p-3 text-center mb-4 transition-colors',
                  dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-gray-50')}
              >
                <Upload size={18} className="mx-auto text-gray-400 mb-1" />
                <p className="text-xs text-gray-500">Drop <strong>.dxf</strong> drawing or <strong>dimension CSV</strong> to auto-fill</p>
                {fileParseStatus && <p className="text-xs mt-1.5 font-medium text-brand-700">{fileParseStatus}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Select label="Part Geometry" value={inputs.geometryType} onChange={v => set('geometryType', v as GeometryType)} options={[
                    { value: 'flat_sheet',  label: 'Flat Sheet / Panel' },
                    { value: 'box',         label: 'Box / Enclosure' },
                    { value: 'cylinder',    label: 'Cylinder / Round Rod' },
                    { value: 'tube_round',  label: 'Round Tube' },
                    { value: 'tube_square', label: 'Square / Rect Tube' },
                    { value: 'angle',       label: 'Angle / L-Bracket' },
                    { value: 'channel',     label: 'Channel / C-Section' },
                    { value: 'direct',      label: 'Enter Sq Ft Directly' },
                  ]} />
                  <p className="text-xs text-gray-400 mt-0.5">{geoConfig.desc}</p>
                </div>

                {inputs.geometryType === 'direct' ? (
                  <div className="col-span-2">
                    <Input label="Surface Area (sq ft) — total coated area per piece" type="number" value={String(inputs.dim1)} onChange={v => set('dim1', parseFloat(v) || 0)} />
                  </div>
                ) : (
                  <>
                    <Input label={geoConfig.d1} type="number" value={String(inputs.dim1)} onChange={v => set('dim1', parseFloat(v) || 0)} />
                    {geoConfig.d2 && <Input label={geoConfig.d2} type="number" value={String(inputs.dim2)} onChange={v => set('dim2', parseFloat(v) || 0)} />}
                    {geoConfig.d3 && <Input label={geoConfig.d3} type="number" value={String(inputs.dim3)} onChange={v => set('dim3', parseFloat(v) || 0)} />}
                  </>
                )}

                {inputs.geometryType !== 'direct' && (
                  <div className="col-span-2">
                    <Select label="Part Complexity" value={inputs.complexityLevel} onChange={v => set('complexityLevel', v as ComplexityLevel)} options={[
                      { value: 'simple_flat',     label: 'Simple Flat — sheet metal, flat plates (×1.0)' },
                      { value: 'simple_3d',       label: 'Simple 3D — box, simple stamping (×1.15)' },
                      { value: 'moderate',        label: 'Moderate — standard weldments, brackets (×1.30)' },
                      { value: 'complex_tubular', label: 'Complex Tubular — tube frames, deep recesses (×1.55)' },
                      { value: 'very_complex',    label: 'Very Complex — castings, mesh, blind areas (×1.90)' },
                      { value: 'extreme',         label: 'Extreme — severe Faraday cage / intricate castings (×2.50)' },
                    ]} />
                    <p className="text-xs text-gray-400 mt-0.5">Multiplier applied to geometric area to account for recesses, tubes, and areas requiring multiple gun passes.</p>
                  </div>
                )}
              </div>

              {result.areaSqFt > 0 && (
                <div className="mt-3 bg-brand-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-brand-700">Calculated Coated Area (per piece)</span>
                  <span className="font-bold text-brand-800 text-lg">{result.areaSqFt.toFixed(2)} ft²</span>
                </div>
              )}
            </Card>

            {/* Coating Specification */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Zap size={16} />Coating Specification</h3>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Coat System" value={inputs.coatType} onChange={v => set('coatType', v as CoatType)} options={[
                  { value: 'single',              label: 'Single Coat' },
                  { value: 'primer_plus_topcoat', label: 'Primer + Topcoat (×1.9 powder, ×1.7 labor)' },
                  { value: 'two_topcoat',         label: 'Color + Clear Topcoat (×1.8 powder)' },
                  { value: 'three_coat',          label: '3-Coat System — show/premium (×2.8 powder)' },
                ]} />
                <Select label="Powder Type" value={inputs.powderType} onChange={v => set('powderType', v as PowderType)} options={[
                  { value: 'standard_polyester', label: 'Standard Polyester (SG 1.55)' },
                  { value: 'premium_polyester',  label: 'Premium Polyester (SG 1.58, +45%)' },
                  { value: 'epoxy_hybrid',       label: 'Epoxy Hybrid (SG 1.60, +25%)' },
                  { value: 'pvdf',               label: 'PVDF / Kynar (SG 1.78, ×3.2 cost)' },
                  { value: 'specialty',          label: 'Specialty (SG 1.65, ×2.8 cost)' },
                ]} />
                <Select label="Film Thickness" value={inputs.filmThickness} onChange={v => set('filmThickness', v as FilmThickness)} options={[
                  { value: 'standard',    label: FILM_MILS.standard.label },
                  { value: 'architectural',label: FILM_MILS.architectural.label },
                  { value: 'heavy',       label: FILM_MILS.heavy.label },
                  { value: 'pvdf_class3', label: FILM_MILS.pvdf_class3.label },
                ]} />
                <Select label="Color Category" value={inputs.colorCategory} onChange={v => set('colorCategory', v as ColorCategory)} options={[
                  { value: 'standard',      label: 'Standard Stock Colors (×1.0)' },
                  { value: 'premium_ral',   label: 'Premium / Non-stock RAL (+20%)' },
                  { value: 'custom_match',  label: 'Custom Color Match (+50%)' },
                  { value: 'metallic',      label: 'Metallic / Pearl (+65%)' },
                  { value: 'textured',      label: 'Textured Powder (+20%)' },
                  { value: 'chrome_effect', label: 'Chrome Effect (+180%)' },
                ]} />
                <Select label="Finish" value={inputs.finish} onChange={v => set('finish', v as FinishType)} options={[
                  { value: 'gloss',      label: 'Gloss (85%+ GU)' },
                  { value: 'semi_gloss', label: 'Semi-Gloss (60-70 GU)' },
                  { value: 'satin',      label: 'Satin (30-50 GU)' },
                  { value: 'matte',      label: 'Matte / Flat (<15 GU)' },
                  { value: 'textured',   label: 'Textured' },
                  { value: 'metallic',   label: 'Metallic' },
                ]} />
              </div>
            </Card>

            {/* Pretreatment & Options */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Settings size={16} />Pretreatment, Handling & Rush</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Select label="Pretreatment Method" value={inputs.pretreatment} onChange={v => set('pretreatment', v as PretreatmentMethod)} options={[
                    { value: 'none',            label: 'None — pre-cleaned by customer' },
                    { value: 'chemical_wash',   label: 'Iron Phosphate Wash (3-5 stage) +$0.05/ft²' },
                    { value: 'zinc_phosphate',  label: 'Zinc Phosphate (better adhesion, auto spec) +$0.07/ft²' },
                    { value: 'chromate_free',   label: 'Chromate-Free Conversion (EU REACH compliant) +$0.09/ft²' },
                    { value: 'blast_only',      label: 'Abrasive Blast Only +$0.12/ft²' },
                    { value: 'blast_plus_wash', label: 'Blast + Chemical Wash (best adhesion) +$0.19/ft²' },
                    { value: 'full_qualicoat',  label: 'Full Qualicoat 5-Stage (architectural aluminum) +$0.22/ft²' },
                  ]} />
                </div>
                <Select label="Rush / Lead Time" value={inputs.rushLevel} onChange={v => set('rushLevel', v as RushLevel)} options={[
                  { value: 'none',     label: 'Standard lead time (+0%)' },
                  { value: 'priority', label: 'Priority — 3-5 days (+20%)' },
                  { value: 'rush',     label: 'Rush — 1-2 days (+45%)' },
                  { value: 'same_day', label: 'Same-Day / Emergency (+90%)' },
                ]} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Options</label>
                  <div className="space-y-2 mt-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={inputs.smallLot} onChange={e => set('smallLot', e.target.checked)} className="rounded" />
                      Apply minimum lot charge (${SMALL_LOT_MIN})
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={inputs.maskingRequired} onChange={e => set('maskingRequired', e.target.checked)} className="rounded" />
                      Masking required
                    </label>
                  </div>
                </div>
                {inputs.maskingRequired && (
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <Select label="Masking Input Method" value={inputs.maskingInputMethod} onChange={v => set('maskingInputMethod', v as PricingInputs['maskingInputMethod'])} options={[
                      { value: 'category', label: 'By complexity category' },
                      { value: 'points',   label: 'By masking point count' },
                    ]} />
                    {inputs.maskingInputMethod === 'category' ? (
                      <Select label="Masking Complexity" value={inputs.maskingComplexity} onChange={v => set('maskingComplexity', v as PricingInputs['maskingComplexity'])} options={[
                        { value: 'simple',   label: `Simple — plugs only (~$${MASKING_COST_CATEGORY.simple}/pc)` },
                        { value: 'moderate', label: `Moderate — tape + plugs (~$${MASKING_COST_CATEGORY.moderate}/pc)` },
                        { value: 'complex',  label: `Complex — custom fixtures (~$${MASKING_COST_CATEGORY.complex}/pc)` },
                      ]} />
                    ) : (
                      <div>
                        <Input label="Masking Points (holes, edges)" type="number" value={String(inputs.maskingPoints)} onChange={v => set('maskingPoints', parseInt(v) || 0)} />
                        <p className="text-xs text-gray-400 mt-0.5">~0.35 min/point at your labor rate + $0.15 material/point</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Shop Rates */}
            <Card className="p-5">
              <button className="w-full flex items-center justify-between text-left" onClick={() => setShowRates(!showRates)}>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2"><DollarSign size={16} />Shop Rates, Margin & Volume</h3>
                {showRates ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {!showRates && (
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>Powder: ${inputs.powderCostPerLb}/lb</span>
                  <span>TE: {inputs.transferEfficiency}%</span>
                  <span>Labor: ${inputs.laborRatePerHr}/hr</span>
                  <span>Burn: ${inputs.overheadBurnRatePerHr}/hr</span>
                  <span>Margin: {inputs.desiredMarginPct}%</span>
                </div>
              )}
              {showRates && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Input label="Powder Cost ($/lb)" type="number" value={String(inputs.powderCostPerLb)} onChange={v => set('powderCostPerLb', parseFloat(v) || 0)} />
                  <div>
                    <Input label={`Transfer Efficiency (${inputs.transferEfficiency}%)`} type="number" value={String(inputs.transferEfficiency)} onChange={v => set('transferEfficiency', Math.min(95, Math.max(30, parseInt(v) || 65)))} />
                    <p className="text-xs text-gray-400 mt-0.5">Auto-line 65-75% · Batch 50-62%</p>
                  </div>
                  <Input label="Labor Rate ($/hr fully loaded)" type="number" value={String(inputs.laborRatePerHr)} onChange={v => set('laborRatePerHr', parseFloat(v) || 0)} />
                  <Input label="Overhead Burn Rate ($/hr)" type="number" value={String(inputs.overheadBurnRatePerHr)} onChange={v => set('overheadBurnRatePerHr', parseFloat(v) || 0)} />
                  <div className="col-span-2">
                    <Input label={`Target Gross Margin (${inputs.desiredMarginPct}%)`} type="number" value={String(inputs.desiredMarginPct)} onChange={v => set('desiredMarginPct', Math.min(90, Math.max(10, parseInt(v) || 40)))} />
                    <p className="text-xs text-gray-400 mt-0.5">Industry benchmark: 38-55% gross margin for powder coating job shops</p>
                  </div>
                  <div className="col-span-2">
                    <Input label="Customer Monthly Volume ($) — for volume discount" type="number" value={String(inputs.monthlyVolumeDollars)} onChange={v => set('monthlyVolumeDollars', parseFloat(v) || 0)} />
                    <p className="text-xs text-gray-400 mt-0.5">
                      Discount tiers: &lt;$5k = 0% · $5-15k = 5% · $15-30k = 9% · $30-75k = 13% · $75k+ = 18%
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Results — 2 cols */}
          <div className="xl:col-span-2 space-y-4">

            {/* Price Summary */}
            <Card className={clsx('p-5', {
              'ring-1 ring-green-200': result.confidence === 'high',
              'ring-1 ring-amber-200': result.confidence === 'medium',
              'ring-1 ring-red-200':   result.confidence === 'low',
            })}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Pricing Result</h3>
                <span className={clsx('text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1',
                  result.confidence === 'high'   ? 'bg-green-100 text-green-700' :
                  result.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                )}>
                  <CheckCircle size={11} /> {result.confidence} confidence
                </span>
              </div>

              <div className="bg-brand-50 rounded-xl p-4 text-center mb-4">
                <div className="text-xs text-brand-600 font-medium mb-1 uppercase tracking-wide">Price Per Piece</div>
                <div className="text-4xl font-bold text-brand-700">${result.pricePerPiece.toFixed(2)}</div>
                <div className="text-sm text-brand-500 mt-1">${result.pricePerSqFt.toFixed(2)} / sq ft</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Lot Total ({inputs.quantity} pcs)</div>
                  <div className="text-xl font-bold text-gray-900">${result.totalLotPrice.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Gross Margin</div>
                  <div className="text-xl font-bold text-gray-900">{inputs.desiredMarginPct}%</div>
                  <div className="text-xs text-gray-400">${result.marginAmount.toFixed(2)}/pc</div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2 mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost Breakdown (per piece)</div>
                {[
                  { label: 'Powder Material', value: result.powderCost, pct: result.powderPct, color: 'bg-blue-400' },
                  { label: 'Labor', value: result.laborCost, pct: result.laborPct, color: 'bg-green-400' },
                  { label: 'Overhead / Burn Rate', value: result.overheadCost, pct: result.overheadPct, color: 'bg-purple-400' },
                  ...(result.pretreatmentCost > 0 ? [{ label: 'Pretreatment', value: result.pretreatmentCost, pct: result.totalCostPerPiece > 0 ? (result.pretreatmentCost / result.totalCostPerPiece) * 100 : 0, color: 'bg-amber-400' }] : []),
                  ...(result.maskingCost > 0 ? [{ label: 'Masking', value: result.maskingCost, pct: result.totalCostPerPiece > 0 ? (result.maskingCost / result.totalCostPerPiece) * 100 : 0, color: 'bg-red-400' }] : []),
                  { label: 'Setup (amortized)', value: result.setupCost, pct: result.totalCostPerPiece > 0 ? (result.setupCost / result.totalCostPerPiece) * 100 : 0, color: 'bg-gray-400' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600">{row.label}</span>
                      <span className="font-medium text-gray-800">${row.value.toFixed(3)} ({row.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full', row.color)} style={{ width: `${Math.min(100, row.pct)}%` }} />
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Total Cost/piece</span>
                  <span className="text-gray-900">${result.totalCostPerPiece.toFixed(3)}</span>
                </div>
              </div>

              {/* Powder Detail */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 mb-4">
                <div className="font-semibold text-gray-600 mb-1">Powder Detail</div>
                <div className="flex justify-between"><span className="text-gray-500">Geometry</span><span className="capitalize">{GEO[inputs.geometryType].label}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Coated area</span><span>{result.areaSqFt.toFixed(2)} ft²</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Powder type</span><span className="capitalize">{inputs.powderType.replace(/_/g,' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Specific gravity</span><span>{POWDER_SG[inputs.powderType].toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Film target</span><span>{FILM_MILS[inputs.filmThickness].target} mil</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Transfer efficiency</span><span>{inputs.transferEfficiency}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Powder consumed</span><span>{result.powderWeightLbs.toFixed(3)} lbs/pc</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Lot powder total</span><span>{(result.powderWeightLbs * inputs.quantity).toFixed(2)} lbs</span></div>
                {result.volumeDiscount > 0 && <div className="flex justify-between text-green-700"><span>Volume discount</span><span>-{(result.volumeDiscount * 100).toFixed(0)}%</span></div>}
              </div>

              {/* Notes */}
              {result.notes.length > 0 && (
                <div className="space-y-1 mb-4">
                  {result.notes.map((note, i) => (
                    <div key={i} className="flex gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                      <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /> {note}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={saveEstimate} className="flex-1" size="sm"><Save size={13} className="mr-1" />Save Estimate</Button>
                <button onClick={() => navigator.clipboard.writeText(
                  `Powder Coating Estimate\n${inputs.partDescription || 'Part'}\nQty: ${inputs.quantity}\nMethod: ${inputs.applicationMethod.replace(/_/g,' ')}\nGeometry: ${GEO[inputs.geometryType].label}\nArea/pc: ${result.areaSqFt.toFixed(2)} ft²\nPrice/pc: $${result.pricePerPiece.toFixed(2)}\nLot total: $${result.totalLotPrice.toFixed(2)}\nMargin: ${inputs.desiredMarginPct}%`
                )} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Copy to clipboard">
                  <Copy size={15} className="text-gray-500" />
                </button>
                <button onClick={() => setInputs(DEFAULT_INPUTS)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Reset">
                  <RefreshCw size={15} className="text-gray-500" />
                </button>
              </div>
            </Card>

            {/* Quick Scenarios */}
            <Card className="p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Volume Scenarios (same part, no lot min)</div>
              <div className="space-y-1.5">
                {([1, 5, 25, 100, 500] as const).map(qty => {
                  const r = calculatePrice({ ...inputs, quantity: qty, smallLot: false });
                  const isActive = qty === inputs.quantity;
                  return (
                    <div key={qty} onClick={() => set('quantity', qty)}
                      className={clsx('flex justify-between items-center text-sm py-1.5 px-2 rounded-lg cursor-pointer transition-colors',
                        isActive ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50'
                      )}>
                      <span className={clsx('text-gray-600', isActive && 'text-brand-700 font-medium')}>{qty} {qty === 1 ? 'piece' : 'pieces'}</span>
                      <div className="text-right">
                        <span className={clsx('font-semibold', isActive ? 'text-brand-700' : 'text-gray-900')}>${r.pricePerPiece.toFixed(2)}/pc</span>
                        <span className="text-xs text-gray-400 ml-2">${r.totalLotPrice.toFixed(0)} total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Click a row to set quantity.</p>
            </Card>
          </div>
        </div>
      )}

      {/* ─── History Tab ─── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {(avgVariance !== null || winRate !== null) && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-brand-600" />
                <h3 className="font-semibold text-gray-800">Pricing Intelligence</h3>
                <span className="text-xs text-gray-400">— tracks actual vs. estimated to sharpen future quotes</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div><div className="text-2xl font-bold text-gray-800">{savedEstimates.length}</div><div className="text-xs text-gray-500">Total Estimates</div></div>
                <div><div className="text-2xl font-bold text-gray-800">{decidedEstimates.length}</div><div className="text-xs text-gray-500">Decided Jobs</div></div>
                {winRate !== null && <div><div className="text-2xl font-bold text-brand-700">{(winRate * 100).toFixed(0)}%</div><div className="text-xs text-gray-500">Win Rate</div></div>}
                {avgVariance !== null && <div><div className={clsx('text-2xl font-bold', avgVariance > 0.1 ? 'text-red-600' : 'text-green-600')}>{(avgVariance * 100).toFixed(1)}%</div><div className="text-xs text-gray-500">Cost Variance</div></div>}
              </div>
              {winRate !== null && winRate < 0.35 && <div className="mt-3 text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">Win rate below 35% — pricing may be too high for your market segment. Consider reviewing complexity multipliers.</div>}
              {winRate !== null && winRate > 0.85 && <div className="mt-3 text-xs text-blue-700 bg-blue-50 rounded px-3 py-2">Win rate above 85% — you may be underpricing. Consider increasing margin or reviewing your rates.</div>}
              {avgVariance !== null && avgVariance > 0.12 && <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">Cost variance &gt;12% — review your transfer efficiency and overhead burn rate defaults.</div>}
            </Card>
          )}
          {savedEstimates.length === 0 ? (
            <div className="text-center text-gray-400 py-12"><Calculator size={32} className="mx-auto mb-2 text-gray-300" />No saved estimates yet. Use the Calculator tab and click Save Estimate.</div>
          ) : (
            <div className="space-y-3">
              {savedEstimates.map(est => (
                <Card key={est.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{est.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {est.inputs.applicationMethod.replace(/_/g,' ')} · {est.inputs.quantity} pcs ·
                        {GEO[est.inputs.geometryType]?.label} · {est.result.areaSqFt.toFixed(2)} ft²/pc · Saved {new Date(est.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-900">${est.result.pricePerPiece.toFixed(2)}/pc</div>
                      <div className="text-xs text-gray-500">${est.result.totalLotPrice.toFixed(2)} lot · ${est.result.pricePerSqFt.toFixed(2)}/ft²</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => loadEstimate(est)} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><RefreshCw size={11} /> Load</button>
                    {est.jobWon === undefined && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="text-xs text-gray-500">Job outcome:</span>
                        <button onClick={() => markJobOutcome(est.id, true)} className="text-xs text-green-600 hover:underline">Won</button>
                        <button onClick={() => markJobOutcome(est.id, false)} className="text-xs text-red-600 hover:underline">Lost</button>
                      </>
                    )}
                    {est.jobWon !== undefined && (
                      <>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', est.jobWon ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{est.jobWon ? 'Won' : 'Lost'}</span>
                        {est.actualCost && <span className="text-xs text-gray-500">Actual cost: ${est.actualCost.toFixed(2)}</span>}
                      </>
                    )}
                    {est.jobWon === true && est.actualCost === undefined && (
                      <><span className="text-gray-300">|</span><span className="text-xs text-gray-500">Actual lot cost: $</span></>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Benchmarks Tab ─── */}
      {tab === 'benchmarks' && (
        <div className="space-y-6">

          {/* Global pricing table */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Globe size={16} />Global Benchmark Pricing</h3>
            <p className="text-xs text-gray-500 mb-4">Single coat, standard stock color, iron phosphate pretreatment. Prices are market ranges (2024-2025).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-700">Scenario</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">USA ($/ft²)</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Europe (€/m²)</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">UAE (AED/m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { scenario: 'Automated line, simple, high-vol (1000+ pcs)',    us: '$0.30–0.55',  eu: '€3–6',    uae: 'AED 15–28' },
                    { scenario: 'Automated line, simple, medium-vol (100-999 pcs)',us: '$0.50–0.85',  eu: '€5–9',    uae: 'AED 22–40' },
                    { scenario: 'Automated line, moderate complexity',             us: '$0.85–1.50',  eu: '€8–15',   uae: 'AED 35–65' },
                    { scenario: 'Automated line, complex tubular',                 us: '$1.30–2.50',  eu: '€12–22',  uae: 'AED 50–100' },
                    { scenario: 'Batch / manual, simple parts',                    us: '$1.20–2.50',  eu: '€10–20',  uae: 'AED 40–80' },
                    { scenario: 'Batch / manual, complex parts',                   us: '$3.00–8.00',  eu: '€25–60',  uae: 'AED 100–200' },
                    { scenario: 'Architectural (AAMA 2604, Qualicoat Class 1)',     us: '$0.90–1.80',  eu: '€8–14',   uae: 'AED 35–65' },
                    { scenario: 'PVDF / Qualicoat Class 3',                        us: '$2.00–4.50',  eu: '€18–35',  uae: 'AED 70–140' },
                  ].map(row => (
                    <tr key={row.scenario} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-700">{row.scenario}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-800">{row.us}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{row.eu}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{row.uae}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Color & Coat Multipliers */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Color Premium & Coat System Reference</h3>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Color Multipliers (on powder cost)</div>
              <div className="space-y-1.5 mb-4 text-sm">
                {[
                  { label: 'Standard stock (white, black, gray)', mult: '×1.0' },
                  { label: 'Stocked RAL colors', mult: '×1.0–1.10' },
                  { label: 'Non-stock / premium RAL', mult: '×1.15–1.30' },
                  { label: 'Custom color match (lab charge)', mult: '×1.38–1.65' },
                  { label: 'Specialty texture (wrinkle, hammertone)', mult: '×1.20–1.40' },
                  { label: 'Metallic / sparkle / pearl', mult: '×1.45–1.85' },
                  { label: 'Chrome effect (show quality)', mult: '×2.50–3.50' },
                  { label: 'PVDF architectural', mult: '×2.50–4.00' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between border-b border-gray-50 pb-1.5">
                    <span className="text-gray-600">{r.label}</span>
                    <span className="font-semibold text-gray-800 ml-4 flex-shrink-0">{r.mult}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Coat System Multipliers</div>
              <div className="space-y-1.5 text-sm">
                {[
                  { system: 'Single coat', powder: '×1.0', labor: '×1.0' },
                  { system: 'Primer + topcoat', powder: '×1.90', labor: '×1.70' },
                  { system: 'Two topcoats (color + clear)', powder: '×1.80', labor: '×1.60' },
                  { system: '3-coat (primer + color + clear)', powder: '×2.80', labor: '×2.50' },
                ].map(r => (
                  <div key={r.system} className="flex justify-between border-b border-gray-50 pb-1.5">
                    <span className="text-gray-600">{r.system}</span>
                    <span className="text-gray-500">Powder {r.powder} · Labor {r.labor}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Application Method Comparison */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Application Method Comparison</h3>
              {[
                { method: 'Horizontal Powder Line', te: '65–75%', throughput: '200–600 ft²/hr', setup: '$45–75/color', best: 'High-volume flat & fabricated parts', notes: 'Best cost/ft² at volume. Setup amortization critical for small runs.' },
                { method: 'Vertical Line (Extrusions)', te: '68–78%', throughput: '150–400 m²/hr', setup: '$35–60/color', best: 'Profiles, extrusions, long parts', notes: 'Price often in $/linear meter × profile factor in Europe. Ideal for aluminum architectural.' },
                { method: 'Batch / Manual Booth', te: '50–62%', throughput: '15–80 ft²/hr', setup: '$20–35/color', best: 'Prototypes, complex parts, small runs', notes: 'Labor-intensive. Highest $/ft² but lowest capital cost and most flexible.' },
              ].map(m => (
                <div key={m.method} className="mb-4 last:mb-0 bg-gray-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-800 mb-1">{m.method}</div>
                  <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-600 mb-1.5">
                    <span>Transfer efficiency: <strong>{m.te}</strong></span>
                    <span>Setup: <strong>{m.setup}</strong></span>
                    <span className="col-span-2">Throughput: <strong>{m.throughput}</strong></span>
                  </div>
                  <div className="text-xs text-gray-500"><strong>Best for:</strong> {m.best}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.notes}</div>
                </div>
              ))}
            </Card>

            {/* Powder Consumption Reference */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Powder Consumption Reference</h3>
              <p className="text-xs text-gray-500 mb-3">Formula: lbs/ft²/mil = SG × 0.0052 / (TE/100). At 68% TE:</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 font-semibold text-gray-700">Thickness</th>
                    <th className="text-right py-1.5 font-semibold text-gray-700">Std Poly (SG 1.55)</th>
                    <th className="text-right py-1.5 font-semibold text-gray-700">PVDF (SG 1.78)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { mil: '2.0 mil', std: 0.030, pvdf: 0.034 },
                    { mil: '2.5 mil (standard)', std: 0.037, pvdf: 0.043 },
                    { mil: '3.5 mil', std: 0.052, pvdf: 0.060 },
                    { mil: '4.0 mil (arch.)', std: 0.060, pvdf: 0.069 },
                    { mil: '6.5 mil (heavy)', std: 0.097, pvdf: 0.111 },
                  ].map(r => (
                    <tr key={r.mil}>
                      <td className="py-1.5 text-gray-600">{r.mil}</td>
                      <td className="py-1.5 text-right font-medium">{r.std.toFixed(3)} lbs/ft²</td>
                      <td className="py-1.5 text-right text-gray-500">{r.pvdf.toFixed(3)} lbs/ft²</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Setup / Changeover */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Changeover Cost Estimator</h3>
              <p className="text-xs text-gray-500 mb-3">Setup and color change costs vary significantly. Amortize over piece count.</p>
              <div className="space-y-2 text-sm">
                {[
                  { scenario: 'Auto line — same supplier, similar color', time: '15–30 min', cost: '$50–150' },
                  { scenario: 'Auto line — full purge, different color',  time: '30–60 min', cost: '$100–300' },
                  { scenario: 'Manual booth — simple color change',        time: '10–20 min', cost: '$15–50' },
                  { scenario: 'Manual booth — dark to light',              time: '20–45 min', cost: '$30–100' },
                ].map(r => (
                  <div key={r.scenario} className="flex justify-between border-b border-gray-50 pb-2">
                    <span className="text-gray-600 flex-1 pr-2">{r.scenario}</span>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-gray-800">{r.cost}</div>
                      <div className="text-xs text-gray-400">{r.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
                <strong>Key insight:</strong> A 45-min changeover on a $300/hr automated line = $225 setup cost. For 10 pieces, that's $22.50/piece just for changeover — why small runs price high.
              </div>
            </Card>
          </div>

          {/* European & Global Standards */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart2 size={16} />Industry Standards & Regional Practices</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              {[
                {
                  region: 'European (QUALICOAT / GSB)',
                  color: 'text-blue-600',
                  points: [
                    'QUALICOAT certification required for architectural aluminum',
                    'Class 1: ≥60μm (2.4 mil) · Class 1.5: ≥70μm · Class 2: ≥80μm · Class 3: PVDF',
                    'GSB International standard widely used in Germany/Netherlands',
                    'REACH regulations eliminated hexavalent chrome pretreatment since 2019',
                    'Chromate-free conversion (Bonderite, Oxsilan) now standard for EU architectural',
                    'German shops use "Schwierigkeitsgrad" 1-6 difficulty scale for multipliers',
                    'Extrusions typically priced in €/m² or €/linear meter × profile factor',
                    'Annual UV/weathering audit cost factored into architectural pricing',
                  ],
                },
                {
                  region: 'UAE / Dubai / Gulf Region',
                  color: 'text-emerald-600',
                  points: [
                    'High demand for PVDF + powder systems for extreme UV/solar resistance',
                    'Architectural aluminum dominates — AAMA 2605 spec is standard',
                    'Salt spray resistance critical: blast + chrome-free pretreatment standard',
                    'AED 18–35/m² standard polyester · AED 30–60/m² architectural spec',
                    'AED 60–120/m² PVDF / anodize-look finish',
                    'Large construction projects use "call-off" fixed-rate contracts (AED/m²)',
                    'UV-stable colors (reds, blues) carry premium in desert climate',
                    'Chrome conversion coating still permitted and widely used on structural aluminum',
                  ],
                },
                {
                  region: 'Pricing Intelligence Best Practices',
                  color: 'text-brand-600',
                  points: [
                    'Area-based ($/ft² or €/m²) is most transparent and defensible model',
                    'Track actual powder consumed per job (weigh pre/post) to calibrate TE',
                    'Volume breaks: <10 / 10-50 / 50-200 / 200-1000 / 1000+ pieces',
                    'Monthly review: estimated vs actual cost for every completed job',
                    'Win-rate monitoring: target 40-65% for optimal margin/volume balance',
                    'Masking cost often 20-40% of total for precision machined parts',
                    'Review complexity multipliers quarterly against actual time data',
                    'Minimum lot charge protects against losing money on setups',
                  ],
                },
              ].map(section => (
                <div key={section.region}>
                  <div className={clsx('font-semibold mb-2 text-xs uppercase tracking-wider', section.color)}>{section.region}</div>
                  <ul className="space-y-1.5">
                    {section.points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-gray-600 text-xs">
                        <span className="text-gray-300 flex-shrink-0 mt-0.5">›</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
