# SAT Knowledge Base + Global Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Populate DECORA ERP with the full SAT Vertical Cube Line equipment knowledge base (7 machines, ~55 WIs, ~55 schedules, fault guides, suppliers, 8 engineering drawings) and add ⌘K global search across all of it.

**Architecture:** All SAT/ITALPLANT data lives in `src/data/satLineData.ts` and `src/data/gemaga03Data.ts`. Engineering drawings are static files in `public/drawings/`. Fuse.js powers client-side fuzzy search in a command-palette overlay wired to ⌘K. A new Suppliers page uses the existing `state.vendors[]` slice. An admin inline-edit tab fills missing lead times.

**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + Fuse.js (new dep) + existing AppContext/Supabase

**TypeScript check command:** `/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit`

---

## Task 1: Copy engineering drawings to public/

**Files:**
- Create: `public/drawings/` directory
- Source: `/Users/brock/Downloads/sat_drawings/`

**Step 1: Copy all 8 PDFs**
```bash
mkdir -p /Users/brock/erp/public/drawings
cp "/Users/brock/Downloads/sat_drawings/General layout/L202311102.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/General users/L202311300.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/General users/2023-11_00users 21-09-2023.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/Ground loads/L202311600.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/Hydraulic scheme/M000028458_REV00.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/Civil Works/L202311200.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/Electrical schemes/DECORA_A1_rev1.1.pdf" /Users/brock/erp/public/drawings/
cp "/Users/brock/Downloads/sat_drawings/Electrical schemes/DECORA_A4_rev1.pdf" /Users/brock/erp/public/drawings/
ls -la /Users/brock/erp/public/drawings/
```
Expected: 8 PDF files listed

**Step 2: Verify they're served by Vite**
After dev server starts, `http://localhost:5173/drawings/L202311102.pdf` should open the layout drawing.

---

## Task 2: Add DrawingRef + FaultRecord types

**Files:**
- Modify: `src/types/index.ts` (after Equipment interface ~line 395)

**Step 1: Add DrawingRef type and extend Equipment**

In `src/types/index.ts`, add immediately after the `Equipment` interface closing brace:

```typescript
export type DrawingCategory = 'layout' | 'electrical' | 'hydraulic' | 'civil' | 'mechanical';

export interface DrawingRef {
  id: string;
  title: string;           // "General Plant Layout"
  fileName: string;        // "L202311102.pdf"  — served from /drawings/
  category: DrawingCategory;
  drawingNumber: string;   // "L 2023 11 102"
  revision?: string;       // "Rev 1.1"
}
```

Then add `drawings?: DrawingRef[]` to the Equipment interface (after `notes?`):
```typescript
export interface Equipment {
  // ... existing fields ...
  notes?: string;
  drawings?: DrawingRef[];   // ADD THIS
}
```

**Step 2: Add FaultRecord type**

Add after DrawingRef:

```typescript
export interface FaultRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  symptom: string;            // "Pump vibrating and noisy"
  causes: string[];           // ["Worn bearings", "Cavitation", ...]
  remedies: string[];         // ["Replace bearings", "Check suction line", ...]
  severity: 'critical' | 'high' | 'medium' | 'low';
  relatedPartIds?: string[];
  relatedWIIds?: string[];
}
```

**Step 3: Run tsc**
```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```
Expected: No errors

---

## Task 3: Add faultRecords to AppState + AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Add faultRecords to AppState interface**

Find `AppState` interface and add:
```typescript
faultRecords:        FaultRecord[];
```

**Step 2: Add to initialState**

In the `initialState` object:
```typescript
faultRecords: [],
```

**Step 3: Add to _HYDRATE_STATE reducer case**

In the reducer, `_HYDRATE_STATE` case — faultRecords should NOT be hydrated from Supabase (it's static reference data), so exclude it from the merge or keep existing:
```typescript
// faultRecords stays as mockData — don't overwrite from Supabase
faultRecords: state.faultRecords,
```

**Step 4: Add ADD/UPDATE actions (optional, for admin)**
```typescript
// In action types union:
| { type: 'ADD_FAULT_RECORD';    payload: FaultRecord }
| { type: 'UPDATE_FAULT_RECORD'; payload: FaultRecord }
```

In reducer:
```typescript
case 'ADD_FAULT_RECORD':
  return { ...state, faultRecords: [...state.faultRecords, action.payload] };
case 'UPDATE_FAULT_RECORD':
  return { ...state, faultRecords: state.faultRecords.map(f => f.id === action.payload.id ? action.payload : f) };
```

**Step 5: Run tsc — fix any import errors**

---

## Task 4: Create satLineData.ts — Equipment Records + Vendors

**Files:**
- Create: `src/data/satLineData.ts`

**Step 1: Create the file with equipment records**

```typescript
import type { Equipment, MaintenanceSchedule, WorkInstruction, FaultRecord, Vendor } from '../types';
import type { SparePart } from '../types';

// ─── DRAWING REFS (shared across SAT equipment) ───────────────────────────────

const SAT_DRAWINGS_GENERAL = [
  {
    id: 'drw-sat-layout',
    title: 'General Plant Layout',
    fileName: 'L202311102.pdf',
    category: 'layout' as const,
    drawingNumber: 'L 2023 11 102',
  },
  {
    id: 'drw-sat-users',
    title: 'User Areas Floor Plan',
    fileName: 'L202311300.pdf',
    category: 'layout' as const,
    drawingNumber: 'L 2023 11 300',
  },
  {
    id: 'drw-sat-elec-a1',
    title: 'Electrical Scheme A1',
    fileName: 'DECORA_A1_rev1.1.pdf',
    category: 'electrical' as const,
    drawingNumber: 'DECORA A1',
    revision: 'Rev 1.1',
  },
  {
    id: 'drw-sat-elec-a4',
    title: 'Electrical Scheme A4',
    fileName: 'DECORA_A4_rev1.pdf',
    category: 'electrical' as const,
    drawingNumber: 'DECORA A4',
    revision: 'Rev 1',
  },
];

// ─── SAT LINE EQUIPMENT (7 records) ──────────────────────────────────────────

export const SAT_LINE_EQUIPMENT: Equipment[] = [
  {
    id: 'eq-sat-brusher',
    name: 'Vertical Pre-Brushing Machine',
    type: 'other',
    model: 'Vertical Pre-Brushing Machine',
    status: 'operational',
    capacity: '5 kW | 26 ft stroke',
    location: 'Pre-Treatment',
    maxTempF: undefined,
    notes: 'ATEX rated. Removes surface oxide from aluminium profiles before tunnel entry. Uses spiral brushes on vertical carriages.',
    drawings: [
      ...SAT_DRAWINGS_GENERAL,
    ],
  },
  {
    id: 'eq-sat-tunnel',
    name: 'Pre-Treatment Tunnel',
    type: 'other',
    model: 'SAT Chemical Tunnel',
    status: 'operational',
    capacity: '300 kW | 7 stages | 92 ft conveyor',
    location: 'Pre-Treatment',
    maxTempF: 140,
    notes: '7-stage chemical treatment: degrease, rinse ×2, chromate/conversion, rinse ×2, final rinse. LOWARA E-SHE pumps, VIMEC fans, FESTO pneumatics.',
    drawings: [
      ...SAT_DRAWINGS_GENERAL,
      {
        id: 'drw-sat-hydraulic',
        title: 'Hydraulic / Plumbing Scheme',
        fileName: 'M000028458_REV00.pdf',
        category: 'hydraulic' as const,
        drawingNumber: 'M000028458',
        revision: 'Rev 00',
      },
    ],
  },
  {
    id: 'eq-sat-oven',
    name: 'Cube Oven (Drying + Polymerisation)',
    type: 'oven',
    model: 'SAT Cube Oven',
    status: 'operational',
    capacity: 'Drying 160-190°F 1,100,000 BTU/h | Poly 360-390°F 1,390,000 kcal/h',
    location: 'Cube',
    maxTempF: 410,
    notes: 'Single burner (methane/LPG/diesel). Drying 13 kW / 95 ft chain. Poly 29 kW / 216 ft chain. Trolley deflectors control airflow.',
    drawings: SAT_DRAWINGS_GENERAL,
  },
  {
    id: 'eq-sat-booth',
    name: 'Spray Booth',
    type: 'booth',
    model: 'SAT Spray Booth',
    status: 'operational',
    capacity: '50 kW | ATEX Zone 20/21/22',
    location: 'Booth',
    notes: 'Powder coating booth with cyclone recovery, GEMA CM40 controller, OC07 powder centre, 24× AP01.1 guns. See GEMA equipment for gun/powder management maintenance.',
    drawings: SAT_DRAWINGS_GENERAL,
  },
  {
    id: 'eq-sat-conveyor',
    name: 'Overhead Conveyor',
    type: 'other',
    model: 'TRAS-MEC Caterpillar Drive',
    status: 'operational',
    capacity: '6-8 ft/min | 28,000 kg total | 367.2 m circuit | 4 drive groups',
    location: 'Full Line',
    maxTempF: 446,
    notes: 'Closed-circuit overhead conveyor. Caterpillar drive units with torque limiter. 133mm average profile pitch. SITI gearboxes, MOTOVARIO VSP gearmotor. FORWARD only — reverse only for emergency (seconds).',
    drawings: SAT_DRAWINGS_GENERAL,
  },
  {
    id: 'eq-sat-loadunload',
    name: 'Loading / Unloading System',
    type: 'other',
    model: 'SAT Loading Bench + Descender',
    status: 'operational',
    capacity: '4-belt loading bench | 6-belt descender | 2-8 m profiles',
    location: 'Load/Unload',
    notes: 'Loading: 4-belt motor-driven bench. Unloading: 6-belt helical descender synchronized to conveyor speed. Rubberized grip inserts. Hydraulic cylinder adjusts descender opening angle.',
    drawings: SAT_DRAWINGS_GENERAL,
  },
  {
    id: 'eq-italplant-ira',
    name: 'IRA Water Treatment Plant',
    type: 'other',
    model: 'IRA 30-450-2SD+1C DUPLEX',
    status: 'operational',
    capacity: '30 L/h | Duplex demineralizer | 450 L/h peak',
    location: 'Utility Room',
    notes: 'ITALPLANT duplex demineralizer. 2× cationic columns (HCl 32% regen), 2× anionic columns (NaOH 30% regen), 1× carbon filter. Target output conductivity <20 µS/cm. Supplies demineralized water to tunnel final rinse stage.',
    drawings: [
      {
        id: 'drw-sat-hydraulic',
        title: 'Hydraulic / Plumbing Scheme',
        fileName: 'M000028458_REV00.pdf',
        category: 'hydraulic' as const,
        drawingNumber: 'M000028458',
        revision: 'Rev 00',
      },
    ],
  },
];

// ─── COMPONENT VENDORS (pre-populate state.vendors[]) ─────────────────────────

export const SAT_LINE_VENDORS: Vendor[] = [
  {
    id: 'vendor-sat',
    name: 'SAT Surface Aluminium Technologies',
    contactName: 'After-Sales / Spare Parts',
    email: 'spare@sataluminium.com',
    phone: '+39 045 828 0601',
    website: 'www.sataluminium.com',
    address: 'Via Antonio Meucci 4, 37135 Verona, Italy',
    currency: 'EUR',
    notes: 'Primary line OEM. After-sales: aftersales@sataluminium.com. Lead time typically 4-8 weeks for capital parts.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-italplant',
    name: 'ITALPLANT S.r.l.',
    contactName: 'Commerciale',
    email: 'commerciale@italplant.it',
    phone: '+39 030 710 1830',
    address: 'Via dell\'Agricoltura 10, 25032 Chiari (Bs), Italy',
    currency: 'EUR',
    notes: 'Supplier of IRA water treatment / demineralizer equipment.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-lowara',
    name: 'LOWARA (Xylem)',
    contactName: '',
    email: '',
    website: 'www.lowara.com',
    currency: 'EUR',
    notes: 'E-SHE / E-SHS series centrifugal pumps for tunnel stages. Tunnel pump model: ESHE 50-125/40/P26TSSZ 4kW.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-chiaravalli',
    name: 'Chiaravalli',
    contactName: '',
    email: '',
    website: 'www.chiaravalli.com',
    currency: 'EUR',
    notes: 'Gearboxes and motors throughout the line.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-motovario',
    name: 'Motovario',
    contactName: '',
    email: '',
    website: 'www.motovario.com',
    currency: 'EUR',
    notes: 'VSP gearmotor with pre-couple — conveyor drive units.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-vimec',
    name: 'VIMEC',
    contactName: '',
    email: '',
    currency: 'EUR',
    notes: 'GF/MZ series fans and electrofans for tunnel and oven ventilation.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-festo',
    name: 'FESTO',
    contactName: '',
    email: '',
    website: 'www.festo.com',
    currency: 'EUR',
    notes: 'Pneumatic components throughout: MSB4/MSB6 service units, MS4-LFR filter regulators, MS4-FRM branching modules.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-gemu',
    name: 'GEMU Valves',
    contactName: '',
    email: '',
    website: 'www.gemu-group.com',
    currency: 'EUR',
    notes: 'Tunnel chemical valves (GEMU 610 series).',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-rollon',
    name: 'Rollon',
    contactName: '',
    email: '',
    website: 'www.rollon.com',
    currency: 'EUR',
    notes: 'ELM linear guide system — pre-brushing machine vertical carriages.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-neri',
    name: 'NERI Motori',
    contactName: '',
    email: '',
    website: 'www.nerimotori.com',
    currency: 'EUR',
    notes: 'ATEX-rated motors throughout the line.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-siti',
    name: 'SITI',
    contactName: '',
    email: '',
    currency: 'EUR',
    notes: 'Gearboxes on conveyor drive units.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-caleffi',
    name: 'Caleffi',
    contactName: '',
    email: '',
    website: 'www.caleffi.com',
    currency: 'EUR',
    notes: 'RPA1 pressure reducers on tunnel water supply lines.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
```

**Step 2: Run tsc**
Expected: Clean. Fix any type mismatches in Vendor fields (check Vendor interface in types/index.ts for required vs optional fields).

---

## Task 5: satLineData.ts — Work Instructions

**Files:**
- Modify: `src/data/satLineData.ts` (append)

**Step 1: Add WI array export to satLineData.ts**

Append to the file. Include at minimum one WI per equipment covering the most critical procedure. Full list below — write all of them:

```typescript
export const SAT_LINE_WORK_INSTRUCTIONS: WorkInstruction[] = [
  // ── Pre-Brushing Machine ──
  {
    id: 'wi-brusher-01',
    equipmentId: 'eq-sat-brusher',
    title: 'Daily / 150h Inspection — Drive Belts, Idle Pins & Lubrication',
    documentNumber: 'WI-BRUSHER-001',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Prevent belt slippage, idle pin seizure, and bearing failure through regular inspection and lubrication.',
    scope: 'Applies to all belt pulleys (Ref.1), transmission belts (Ref.2), idle pins/eccentrics (Ref.5/6), and all gearbox lubrication points on the vertical pre-brushing machine.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Pre-Brushing Machine Manual — Maintenance Section, pp.25-29'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT: Ensure machine is stopped and energy isolated before any inspection.' },
      { stepNumber: 2, description: 'Ref.1 — Check drive belt pulleys for wear condition. Verify containment rings are present. Remove any foreign materials (nylon, swarf).' },
      { stepNumber: 3, description: 'Ref.2 — Check transmission belt wear and tension. Look for lateral fraying. Remove foreign materials.' },
      { stepNumber: 4, description: 'Ref.5/6 — Check all idle pins on all carriages for correct rotation. Grease and lubricate. Verify eccentric-adjusted pins (marked RED) rotate freely.' },
      { stepNumber: 5, description: 'Check all gearbox oil levels. Top up if required. Use synthetic PAO oil for heavily loaded continuous-duty gearboxes; mineral oil for light intermittent use.' },
      { stepNumber: 6, description: 'Document inspection result and any top-ups in the maintenance log.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-brusher-02',
    equipmentId: 'eq-sat-brusher',
    title: '300h / 2-Week Inspection — Brushes & Flanges',
    documentNumber: 'WI-BRUSHER-002',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Monitor spiral brush wear and prevent brush displacement which causes uneven surface preparation.',
    scope: 'Applies to spiral brushes (Ref.7) and closing flanges (Ref.3) on both transmission and neutral sides.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Pre-Brushing Machine Manual — Maintenance Section, p.26'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT before entering brushing area.' },
      { stepNumber: 2, description: 'Ref.3 — Check brush closing flanges on both transmission side and neutral side. Remove foreign materials (nylon, swarf).' },
      { stepNumber: 3, description: 'Ref.7 — Inspect spiral brush consumption and wear. Confirm first spirals at both ends are contained by threaded flanges with pointed screws.' },
      { stepNumber: 4, description: 'Check for detached bristles. Remove any found.' },
      { stepNumber: 5, description: 'Remove and document any foreign material. If brushes are worn beyond 30%, raise a work order for replacement.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-brusher-03',
    equipmentId: 'eq-sat-brusher',
    title: '500h / 3-Week Inspection — Bearings & Lift Chains',
    documentNumber: 'WI-BRUSHER-003',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Prevent carriage height misalignment and bearing failure that stops brush contact with profiles.',
    scope: 'Applies to brush shaft bearings (Ref.4) and lift carriage chains lower/upper tensioning, right and left sides (Ref.8).',
    responsibleRole: 'technician',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Pre-Brushing Machine Manual — Maintenance Section, pp.26-27'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT.' },
      { stepNumber: 2, description: 'Ref.4 — Check correct rotation of bearings on both transmission and neutral sides. Verify bearing retaining screws are tight. Verify shaft brush fixing screws are tight.' },
      { stepNumber: 3, description: 'Ref.8 — Check lower and upper chain tensioning on BOTH right and left sides. Perform checks with carriages in LOW position and again in HIGH position.' },
      { stepNumber: 4, description: 'After any chain tensioning adjustment, verify right and left carriages are at the same height. If misaligned, re-adjust.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ── Pre-Treatment Tunnel ──
  {
    id: 'wi-tunnel-01',
    equipmentId: 'eq-sat-tunnel',
    title: 'Pre-Shift / 8h Check — Pumps, Temperatures, Chemical Levels',
    documentNumber: 'WI-TUNNEL-001',
    category: 'inspection',
    revision: 'A',
    status: 'active',
    purpose: 'Verify tunnel is in specification for chemical treatment quality before production starts.',
    scope: 'All 7 tunnel stages: pump operation, chemical concentration (pH/conductivity), temperatures, nozzle spray pattern, filter condition.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Pre-Treatment Tunnel Manual', 'IRA Water Treatment Manual — conductivity targets'],
    steps: [
      { stepNumber: 1, description: 'Start all stage pumps and verify flow indication on each stage. Report any pump not starting immediately.' },
      { stepNumber: 2, description: 'Check temperature on each heated stage. Allow 15-20 min warm-up before recording. Degreaser typically 50-60°C; rinse stages ambient.' },
      { stepNumber: 3, description: 'Check chemical concentration on each active stage (pH strip or titration per chemical supplier SDS). Dose chemicals if outside specification.' },
      { stepNumber: 4, description: 'Check IRA output conductivity on final rinse water — must be <20 µS/cm. If above, check IRA regeneration status.' },
      { stepNumber: 5, description: 'Visually inspect nozzles in each stage for blocked or misaligned heads. Replace blocked nozzles before production.' },
      { stepNumber: 6, description: 'Check all pump suction filter indicator lights. If clogged indicator is active, plan filter cleaning during next break.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-tunnel-02',
    equipmentId: 'eq-sat-tunnel',
    title: '50h / Weekly — Full Tunnel Inspection & Nozzle Clean',
    documentNumber: 'WI-TUNNEL-002',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Deep inspection of pump seals, fan condition, nozzle cleanliness, and tank levels to prevent unplanned downtime.',
    scope: 'All pump mechanical seals, tunnel fans (VIMEC), all nozzles and ramps, cascade tank levels, pressure gauges.',
    responsibleRole: 'technician',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Pre-Treatment Tunnel Manual', 'LOWARA E-SHE Maintenance Manual'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT tunnel. Drain stages if nozzle access is required.' },
      { stepNumber: 2, description: 'Inspect all LOWARA pump mechanical seals for weeping or leakage. A slight moisture film is acceptable; active drips require seal replacement.' },
      { stepNumber: 3, description: 'Check VIMEC fans for unusual noise or vibration. Confirm fan motor thermal protections are not tripped.' },
      { stepNumber: 4, description: 'Remove and clean all spray nozzles in each stage. Use appropriate chemical-resistant cleaning solution.' },
      { stepNumber: 5, description: 'Check cascade tank levels and add fresh chemical/water as required to maintain operating levels.' },
      { stepNumber: 6, description: 'Verify all pressure gauges are reading within normal range. Tag any gauge reading zero for replacement.' },
      { stepNumber: 7, description: 'Inspect all GEMU valves for leakage or sticking. Operate manually to verify free movement.' },
      { stepNumber: 8, description: 'Check FESTO pneumatic service unit (MSB4/6) — drain water separator, check oil level in lubricator.' },
      { stepNumber: 9, description: 'Restart tunnel and verify all stages return to normal operating temperatures.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ── Cube Oven ──
  {
    id: 'wi-oven-01',
    equipmentId: 'eq-sat-oven',
    title: 'Pre-Shift / 8h — Oven Fan Inspection & Temperature Verification',
    documentNumber: 'WI-OVEN-001',
    category: 'inspection',
    revision: 'A',
    status: 'active',
    purpose: 'Detect fan anomalies early to prevent thermal runaway, profile defects, or fan motor burnout.',
    scope: 'All roof-mounted helical recirculation fans in drying and polymerisation chambers. Burner ignition and setpoint verification.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Cube Oven Manual — Structure and Function pp.9-16'],
    steps: [
      { stepNumber: 1, description: 'Start fans using control board. Listen for unusual sounds — rattling, grinding, or imbalance noise indicates a fan issue. Stop and tag out any suspect fan immediately.' },
      { stepNumber: 2, description: 'Allow drying oven to reach Tsetpoint (160-190°F). Confirm burner operates at full flame below setpoint, then reduces to low flame at setpoint.' },
      { stepNumber: 3, description: 'Allow poly oven to reach Tsetpoint (360-390°F). Confirm T-high alarm is set and functioning.' },
      { stepNumber: 4, description: 'Verify trolley deflectors in entry/exit corridor are correctly positioned to direct airflow.' },
      { stepNumber: 5, description: 'Check oven interior through inspection window for any powder residue ("snow effect") in poly oven. If present, check deflector position and fan direction.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-oven-02',
    equipmentId: 'eq-sat-oven',
    title: '24h — Oven Interior Clean + Powder Residue Removal',
    documentNumber: 'WI-OVEN-002',
    category: 'cleaning',
    revision: 'A',
    status: 'active',
    purpose: 'Prevent powder accumulation in poly oven from contaminating product and creating fire risk.',
    scope: 'Poly oven interior, entry/exit corridors, deflector trolleys. Must be performed with oven fully cooled.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Cube Oven Manual — Safety pp.9, Defects pp.21'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT. Wait for oven to cool to below 40°C (104°F) before entry. Wear high-temperature gloves and goggles.' },
      { stepNumber: 2, description: 'IMPORTANT: Do not remove gratings — they provide both airflow homogenization and safety. Clean around them only.' },
      { stepNumber: 3, description: 'Remove accumulated powder deposits from oven floor, walls, and deflector trolleys using approved vacuum/brush method.' },
      { stepNumber: 4, description: 'Inspect deflector trolley angles. Adjust inclination if airflow was uneven (causing snow effect or uneven cure).' },
      { stepNumber: 5, description: 'Inspect entry/exit corridor seals. Report any visible gaps to maintenance for repair.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-oven-03',
    equipmentId: 'eq-sat-oven',
    title: '2-Month — Burner Service & Inspection',
    documentNumber: 'WI-OVEN-003',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Maintain combustion efficiency and prevent burner faults that cause oven downtime.',
    scope: 'Gas burner, gas ramp, combustion chamber. MUST be performed by qualified gas technician.',
    responsibleRole: 'technician',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Cube Oven Manual — Burner pp.8', 'Burner manufacturer manual'],
    steps: [
      { stepNumber: 1, description: 'SCHEDULE: Requires qualified gas technician. Do not perform without proper gas certification.' },
      { stepNumber: 2, description: 'Shut down oven fully. Isolate gas supply at main valve. Allow oven to cool completely.' },
      { stepNumber: 3, description: 'Inspect gas ramp — check all fittings for gas tightness using leak detection spray. Any leaks must be repaired before restart.' },
      { stepNumber: 4, description: 'Inspect burner nozzle for carbon deposits. Clean per burner manufacturer procedure.' },
      { stepNumber: 5, description: 'Verify combustion chamber interior for cracks or damage to AISI/FE lining.' },
      { stepNumber: 6, description: 'Check all temperature probe connections. Calibrate or replace probes outside ±5°F accuracy.' },
      { stepNumber: 7, description: 'Restart and verify full flame / low flame cycle operates correctly at Tsetpoint.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ── Overhead Conveyor ──
  {
    id: 'wi-conv-01',
    equipmentId: 'eq-sat-conveyor',
    title: 'Pre-Shift — Hook & Hanger Inspection at Loading',
    documentNumber: 'WI-CONV-001',
    category: 'inspection',
    revision: 'A',
    status: 'active',
    purpose: 'Prevent profile drops due to worn hooks or incorrectly loaded hangers.',
    scope: 'All hooks and hangers at loading station before and during loading operations.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Conveyor Manual — Hooks and Hangers p.7'],
    steps: [
      { stepNumber: 1, description: 'Before each loading cycle, visually inspect each hook for cracks, wear, or deformation. Remove any damaged hooks from service.' },
      { stepNumber: 2, description: 'Check hook lubrication — a thin film of grease should be present on the contact surfaces.' },
      { stepNumber: 3, description: 'When hanging profiles: for 1 profile, hook centre of support. For multiple profiles, distribute symmetrically — NEVER hang a single profile at one end only.' },
      { stepNumber: 4, description: 'Verify PVC/steel positioning skids are guiding hooks back to correct orientation at entry to each zone.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-conv-02',
    equipmentId: 'eq-sat-conveyor',
    title: '2-Month — Drive Unit & Chain Inspection',
    documentNumber: 'WI-CONV-002',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Inspect all 4 caterpillar drive units, torque limiters, and harpoon condition to prevent conveyor stoppage.',
    scope: 'All 4 drive groups: Caterpillar chain/harpoons, SITI gearbox, MOTOVARIO VSP gearmotor, torque limiter setting.',
    responsibleRole: 'technician',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Conveyor Manual — Drive Units p.8', 'TRAS-MEC conveyor manual', 'SITI gearbox manual', 'MOTOVARIO VSP manual'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT all 4 drive units before inspection.' },
      { stepNumber: 2, description: 'Inspect Caterpillar harpoons on each drive unit for wear or deformation. Worn harpoons slip on the chain and cause jerky movement.' },
      { stepNumber: 3, description: 'Check SITI gearbox oil level on each drive unit. Top up if below sight glass.' },
      { stepNumber: 4, description: 'Check MOTOVARIO VSP gearmotor for oil leaks and abnormal temperature (should not exceed 90°C in service).' },
      { stepNumber: 5, description: 'Verify torque limiter setting on slow shaft. If it has tripped, investigate cause before resetting.' },
      { stepNumber: 6, description: 'Inspect transfer station pneumatic cylinders and sensors at interchange stations.' },
      { stepNumber: 7, description: 'Check secondary circuit chain condition where applicable.' },
      { stepNumber: 8, description: 'Lubricate drive unit bearings per TRAS-MEC schedule.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ── Loading / Unloading ──
  {
    id: 'wi-loadunload-01',
    equipmentId: 'eq-sat-loadunload',
    title: 'Monthly — Belt Inspection (Loading Bench + Descender)',
    documentNumber: 'WI-LOADUNLOAD-001',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Prevent belt failure causing profile drops or production interruption at unloading.',
    scope: '4 loading bench drive belts and 6 descender helical belts with rubberized inserts.',
    responsibleRole: 'technician',
    effectiveDate: '2024-01-01',
    issuedBy: 'SAT Surface Aluminium Technologies',
    referencedDocuments: ['SAT Loading/Unloading Manual'],
    steps: [
      { stepNumber: 1, description: 'LOCKOUT/TAGOUT loading bench motor and descender drive.' },
      { stepNumber: 2, description: 'Inspect all 4 loading bench belts for wear, cracking, or fraying. Check belt tension.' },
      { stepNumber: 3, description: 'Inspect all 6 descender helical belts. Check rubberized grip inserts for wear — worn inserts fail to grip profiles and can cause them to slip.' },
      { stepNumber: 4, description: 'Verify descender belt speed synchronization is calibrated to current conveyor speed. Adjust selector if profiles are not remaining parallel during descent.' },
      { stepNumber: 5, description: 'Check hydraulic cylinder for the opening angle adjustment — look for fluid leaks at rod seal.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ── IRA Water Treatment Plant ──
  {
    id: 'wi-ira-01',
    equipmentId: 'eq-italplant-ira',
    title: 'Daily — Conductivity Check & Chemical Level Verification',
    documentNumber: 'WI-IRA-001',
    category: 'inspection',
    revision: 'A',
    status: 'active',
    purpose: 'Ensure demineralized water quality meets tunnel final rinse specification (<20 µS/cm) to prevent staining and corrosion.',
    scope: 'IRA output conductivity meter, HCl 32% and NaOH 30% chemical tank levels.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'ITALPLANT S.r.l.',
    referencedDocuments: ['IRA 30-450-2SD+1C DUPLEX Manual — ITALPLANT Doc 23.10.01'],
    steps: [
      { stepNumber: 1, description: 'Read conductivity display on IRA control panel. Normal: <20 µS/cm. If reading 20-50 µS/cm, plan regeneration within 24h. If >50 µS/cm, stop tunnel final rinse and initiate regeneration immediately.' },
      { stepNumber: 2, description: 'Check HCl (32%) storage tank level. Minimum level is marked on tank. Order reagent if below 25% capacity.' },
      { stepNumber: 3, description: 'Check NaOH (30%) storage tank level. Same minimum level check and reorder threshold.' },
      { stepNumber: 4, description: 'SAFETY: HCl and NaOH are corrosive. Always wear acid-resistant gloves, face shield, and chemical apron when near chemical tanks.' },
      { stepNumber: 5, description: 'Log conductivity reading in maintenance record.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wi-ira-02',
    equipmentId: 'eq-italplant-ira',
    title: 'Monthly — Resin Column Regeneration Procedure',
    documentNumber: 'WI-IRA-002',
    category: 'maintenance',
    revision: 'A',
    status: 'active',
    purpose: 'Restore full ion-exchange capacity of cationic and anionic resin columns.',
    scope: 'Carbon filter backwash, cationic column HCl regeneration (4 phases), anionic column NaOH regeneration (4 phases).',
    responsibleRole: 'technician',
    effectiveDate: '2024-01-01',
    issuedBy: 'ITALPLANT S.r.l.',
    referencedDocuments: ['IRA 30-450-2SD+1C DUPLEX Manual — Chapter 7.3, pp.30-35'],
    steps: [
      { stepNumber: 1, description: 'SAFETY: Full PPE required — acid/alkali resistant gloves, face shield, chemical apron, safety boots. Ensure exhaust ventilation in chemical room is operating.' },
      { stepNumber: 2, description: 'Step 7.3.1 — Carbon filter backwash: Water pumped upward through column to remove deposited impurities and restore filtration efficiency.' },
      { stepNumber: 3, description: 'Step 7.3.2 Phase 1 — Cationic column backwash: Water passes bottom-to-top through cationic resin to loosen impurities.' },
      { stepNumber: 4, description: 'Step 7.3.2 Phase 2 — HCl inlet: Ejector draws HCl 32% to form 5% aqueous solution. Solution passes top-to-bottom through cationic resin. Effluent to exhausted storage.' },
      { stepNumber: 5, description: 'Step 7.3.2 Phase 3 — Slow rinse: Water displaces HCl solution through cationic resin.' },
      { stepNumber: 6, description: 'Step 7.3.2 Phase 4 — Final rinse: Fast water rinse. Column positions to SERVICE when complete.' },
      { stepNumber: 7, description: 'Step 7.3.3 — Repeat phases 1-4 for anionic columns using NaOH 30% in Phase 2.' },
      { stepNumber: 8, description: 'After regeneration, verify output conductivity is <10 µS/cm before returning to service.' },
      { stepNumber: 9, description: 'Log regeneration date, chemical quantities used, and post-regeneration conductivity in maintenance record.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
```

**Step 2: Run tsc**
Expected: Clean. WorkInstruction type may require specific fields — check `src/types/index.ts` for required fields and add any missing ones.

---

## Task 6: satLineData.ts — Maintenance Schedules

**Files:**
- Modify: `src/data/satLineData.ts` (append)

**Step 1: Append maintenance schedules export**

All intervals are extracted directly from SAT manuals. Add this export to satLineData.ts:

```typescript
export const SAT_LINE_MAINTENANCE_SCHEDULES: MaintenanceSchedule[] = [
  // ── Pre-Brushing Machine (7 schedules) ──
  { id: 'ms-brusher-d01', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Drive Belt Pulleys Inspection', intervalType: 'hours', intervalValue: 150, warningThreshold: 20,
    responsibleRole: 'operator', workInstructionId: 'wi-brusher-01',
    description: 'Check wear condition, containment rings, and remove foreign materials from drive belt pulleys (Ref.1).',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-brusher-d02', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Transmission Belt Check & Tension', intervalType: 'hours', intervalValue: 150, warningThreshold: 20,
    responsibleRole: 'operator', workInstructionId: 'wi-brusher-01',
    description: 'Check wear, tension, lateral fraying. Remove foreign materials (Ref.2).',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-brusher-d03', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Idle Pin Rotation & Lubrication', intervalType: 'hours', intervalValue: 150, warningThreshold: 20,
    responsibleRole: 'operator', workInstructionId: 'wi-brusher-01',
    description: 'Check idle pin rotation on all carriages. Grease/lubricate. Check eccentric-adjusted pins (RED) rotate freely (Ref.5/6).',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-brusher-d04', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Full Lubrication Check — All Gearboxes', intervalType: 'hours', intervalValue: 150, warningThreshold: 20,
    responsibleRole: 'operator', workInstructionId: 'wi-brusher-01',
    description: 'Check and top up all gearbox oil levels. Use PAO synthetic for heavy-duty; mineral for light use.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-brusher-w01', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Brush Flanges & Spiral Brush Wear', intervalType: 'hours', intervalValue: 300, warningThreshold: 40,
    responsibleRole: 'operator', workInstructionId: 'wi-brusher-02',
    description: 'Check closing flanges (Ref.3). Inspect spiral brush wear and bristle condition (Ref.7). Remove foreign materials.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-brusher-bw01', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Bearing Rotation & Shaft Screw Check', intervalType: 'hours', intervalValue: 500, warningThreshold: 50,
    responsibleRole: 'technician', workInstructionId: 'wi-brusher-03',
    description: 'Check correct rotation of bearings both sides (Ref.4). Verify all fixing and retaining screws are tight.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-brusher-bw02', equipmentId: 'eq-sat-brusher', equipmentName: 'Vertical Pre-Brushing Machine',
    taskName: 'Lift Carriage Chain Tensioning', intervalType: 'hours', intervalValue: 500, warningThreshold: 50,
    responsibleRole: 'technician', workInstructionId: 'wi-brusher-03',
    description: 'Check lower and upper chain tensioning, right and left sides, in both LOW and HIGH carriage positions (Ref.8). Verify carriages at same height after adjustment.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },

  // ── Pre-Treatment Tunnel (10 schedules) ──
  { id: 'ms-tunnel-d01', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Pre-Shift Pump & Temperature Check', intervalType: 'hours', intervalValue: 8, warningThreshold: 2,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-01',
    description: 'Verify all stage pumps running, temperatures at setpoint, chemical concentrations in spec, IRA output <20 µS/cm.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-d02', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Nozzle Spray Pattern Check', intervalType: 'hours', intervalValue: 8, warningThreshold: 2,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-01',
    description: 'Visually inspect nozzles in all stages for blockages or misalignment.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-d03', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Pump Suction Filter Status', intervalType: 'hours', intervalValue: 8, warningThreshold: 2,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-01',
    description: 'Check all pump suction filter indicators. Plan cleaning for any showing clogged status.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-d04', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Chemical Concentration Dosing', intervalType: 'hours', intervalValue: 8, warningThreshold: 2,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-01',
    description: 'Test chemical concentrations per stage. Dose if outside specification.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-d05', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Tank Level Check & Top-Up', intervalType: 'hours', intervalValue: 16, warningThreshold: 4,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-01',
    description: 'Check cascade tank levels. Top up with fresh chemical/water as required.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-d06', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Fan Noise & Vibration Check', intervalType: 'hours', intervalValue: 16, warningThreshold: 4,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-01',
    description: 'Listen for unusual sounds from VIMEC tunnel fans. Check thermal protection indicators.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-d07', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Pump Seal Visual Inspection', intervalType: 'hours', intervalValue: 16, warningThreshold: 4,
    responsibleRole: 'operator', workInstructionId: 'wi-tunnel-02',
    description: 'Inspect LOWARA pump mechanical seals for active drips. Film = acceptable; drip = schedule replacement.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-w01', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Full Tunnel Inspection & Nozzle Clean', intervalType: 'hours', intervalValue: 50, warningThreshold: 8,
    responsibleRole: 'technician', workInstructionId: 'wi-tunnel-02',
    description: 'Full shutdown inspection: pump seals, fans, remove and clean all nozzles, check valves, FESTO service unit drain/oil, pressure gauges.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-w02', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'Pressure Gauge Verification', intervalType: 'hours', intervalValue: 50, warningThreshold: 8,
    responsibleRole: 'technician', workInstructionId: 'wi-tunnel-02',
    description: 'Verify all pressure gauges in normal range. Tag zero-reading gauges for replacement.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-tunnel-w03', equipmentId: 'eq-sat-tunnel', equipmentName: 'Pre-Treatment Tunnel',
    taskName: 'GEMU Valve Cycle Check', intervalType: 'hours', intervalValue: 50, warningThreshold: 8,
    responsibleRole: 'technician', workInstructionId: 'wi-tunnel-02',
    description: 'Operate all GEMU 610 valves manually. Check for leakage or sticking. Note any requiring service.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },

  // ── Cube Oven (3 schedules) ──
  { id: 'ms-oven-d01', equipmentId: 'eq-sat-oven', equipmentName: 'Cube Oven',
    taskName: 'Pre-Shift Fan Inspection & Temp Verify', intervalType: 'hours', intervalValue: 8, warningThreshold: 2,
    responsibleRole: 'operator', workInstructionId: 'wi-oven-01',
    description: 'Listen for fan anomalies on startup. Verify drying (160-190°F) and poly (360-390°F) reach setpoints. Check no snow effect in poly oven.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-oven-d02', equipmentId: 'eq-sat-oven', equipmentName: 'Cube Oven',
    taskName: 'Oven Interior Clean — Powder Residue', intervalType: 'hours', intervalValue: 24, warningThreshold: 4,
    responsibleRole: 'operator', workInstructionId: 'wi-oven-02',
    description: 'Remove powder deposits from poly oven interior, deflector trolleys, entry/exit corridors. Oven must be fully cooled. Do not remove gratings.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-oven-m01', equipmentId: 'eq-sat-oven', equipmentName: 'Cube Oven',
    taskName: 'Burner Service & Gas Ramp Inspection', intervalType: 'days', intervalValue: 60, warningThreshold: 7,
    responsibleRole: 'technician', workInstructionId: 'wi-oven-03',
    description: 'Qualified gas technician only. Inspect gas ramp, clean burner nozzle, verify combustion chamber, calibrate temperature probes.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },

  // ── Overhead Conveyor (4 schedules) ──
  { id: 'ms-conv-d01', equipmentId: 'eq-sat-conveyor', equipmentName: 'Overhead Conveyor',
    taskName: 'Hook & Hanger Inspection at Loading', intervalType: 'hours', intervalValue: 8, warningThreshold: 1,
    responsibleRole: 'operator', workInstructionId: 'wi-conv-01',
    description: 'Visual check of hooks for cracks/wear at each loading cycle. Verify lubrication. Correct profile hanging balance.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-conv-d02', equipmentId: 'eq-sat-conveyor', equipmentName: 'Overhead Conveyor',
    taskName: 'Conveyor Lubricator Check', intervalType: 'hours', intervalValue: 24, warningThreshold: 4,
    responsibleRole: 'operator', workInstructionId: 'wi-conv-01',
    description: 'Verify automatic lubricator is operating and reservoir has adequate lubricant.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-conv-m01', equipmentId: 'eq-sat-conveyor', equipmentName: 'Overhead Conveyor',
    taskName: 'Drive Unit & Chain Inspection — All 4 Groups', intervalType: 'days', intervalValue: 60, warningThreshold: 7,
    responsibleRole: 'technician', workInstructionId: 'wi-conv-02',
    description: 'Inspect harpoons, SITI gearbox oil, MOTOVARIO gearmotor, torque limiter, secondary circuits, transfer station pneumatics.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-conv-m02', equipmentId: 'eq-sat-conveyor', equipmentName: 'Overhead Conveyor',
    taskName: 'Transfer & Interchange Station Check', intervalType: 'days', intervalValue: 60, warningThreshold: 7,
    responsibleRole: 'technician', workInstructionId: 'wi-conv-02',
    description: 'Check all interchange station pneumatic cylinders, sensors, and manual override function.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },

  // ── Loading / Unloading (2 schedules) ──
  { id: 'ms-loadunload-m01', equipmentId: 'eq-sat-loadunload', equipmentName: 'Loading / Unloading System',
    taskName: 'Loading Bench Belt Inspection', intervalType: 'days', intervalValue: 30, warningThreshold: 5,
    responsibleRole: 'technician', workInstructionId: 'wi-loadunload-01',
    description: 'Check 4 loading bench belts for wear, tension, cracking.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-loadunload-m02', equipmentId: 'eq-sat-loadunload', equipmentName: 'Loading / Unloading System',
    taskName: 'Descender Belt & Grip Insert Inspection', intervalType: 'days', intervalValue: 30, warningThreshold: 5,
    responsibleRole: 'technician', workInstructionId: 'wi-loadunload-01',
    description: 'Check 6 descender belts and rubberized grip inserts for wear. Verify speed sync with conveyor.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },

  // ── IRA Water Treatment Plant (4 schedules) ──
  { id: 'ms-ira-d01', equipmentId: 'eq-italplant-ira', equipmentName: 'IRA Water Treatment Plant',
    taskName: 'Daily Conductivity Check', intervalType: 'hours', intervalValue: 8, warningThreshold: 1,
    responsibleRole: 'operator', workInstructionId: 'wi-ira-01',
    description: 'Read IRA output conductivity. Must be <20 µS/cm. >50 µS/cm = stop and regenerate immediately.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-ira-d02', equipmentId: 'eq-italplant-ira', equipmentName: 'IRA Water Treatment Plant',
    taskName: 'Chemical Tank Level Check (HCl + NaOH)', intervalType: 'hours', intervalValue: 24, warningThreshold: 4,
    responsibleRole: 'operator', workInstructionId: 'wi-ira-01',
    description: 'Check HCl 32% and NaOH 30% tank levels. Reorder when below 25% capacity.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-ira-m01', equipmentId: 'eq-italplant-ira', equipmentName: 'IRA Water Treatment Plant',
    taskName: 'Resin Column Regeneration', intervalType: 'days', intervalValue: 30, warningThreshold: 5,
    responsibleRole: 'technician', workInstructionId: 'wi-ira-02',
    description: 'Full regeneration cycle: carbon filter backwash, cationic HCl regeneration, anionic NaOH regeneration. Full PPE required.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'ms-ira-a01', equipmentId: 'eq-italplant-ira', equipmentName: 'IRA Water Treatment Plant',
    taskName: 'Annual Carbon Filter Media Inspection', intervalType: 'days', intervalValue: 365, warningThreshold: 14,
    responsibleRole: 'technician', workInstructionId: 'wi-ira-02',
    description: 'Annual inspection of carbon filter media. Replace if flow rate through filter has declined >20% or filtration colour test fails.',
    lastServiceDate: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
];
```

**Step 2: Run tsc**
Verify MaintenanceSchedule fields match type definition in `src/types/index.ts`. Fix any required field issues.

---

## Task 7: satLineData.ts — Fault Records

**Files:**
- Modify: `src/data/satLineData.ts` (append)

**Step 1: Append fault records export**

These are extracted directly from the "Defects, Causes, Remedies" sections of each manual:

```typescript
export const SAT_LINE_FAULT_RECORDS: FaultRecord[] = [
  // ── Cube Oven faults (source: SAT Cube Oven Manual pp.19-21) ──
  {
    id: 'fault-oven-01',
    equipmentId: 'eq-sat-oven',
    equipmentName: 'Cube Oven',
    symptom: 'Excessive vibrations from oven fans',
    causes: [
      'Fan out of balance (debris accumulated on blades)',
      'Worn or damaged fan motor bearings',
      'Loose fan blade fixing screws',
      'Loose motor mounting bolts',
    ],
    remedies: [
      'Clean fan blades — remove accumulated powder/debris',
      'Replace motor bearings',
      'Tighten fan blade fixing screws',
      'Tighten motor mounting bolts',
    ],
    severity: 'high',
    relatedWIIds: ['wi-oven-01'],
  },
  {
    id: 'fault-oven-02',
    equipmentId: 'eq-sat-oven',
    equipmentName: 'Cube Oven',
    symptom: 'Oven fan stops / breakdown',
    causes: [
      'Fan motor thermal protection tripped (overtemperature)',
      'Electrical supply fault to fan motor',
      'Fan mechanically seized',
    ],
    remedies: [
      'Check and reset fan motor thermal protection at switchboard. Investigate root cause before reset.',
      'Check electrical supply — acoustic alarm and visual alarm on switchboard will indicate affected fan',
      'Inspect fan for mechanical obstruction. Do not restart until obstruction is removed.',
    ],
    severity: 'critical',
    relatedWIIds: ['wi-oven-01'],
  },
  {
    id: 'fault-oven-03',
    equipmentId: 'eq-sat-oven',
    equipmentName: 'Cube Oven',
    symptom: 'Powder excess / "snow effect" inside polymerisation oven',
    causes: [
      'Deflector trolleys incorrectly positioned — airflow directing excess powder inward',
      'Fan direction incorrect — reversed airflow',
      'Conveyor speed too fast — insufficient cure time causes unfixed powder',
    ],
    remedies: [
      'Adjust deflector trolley angles to redirect airflow away from profile zone',
      'Verify fan rotation direction is correct (check phase wiring)',
      'Reduce conveyor speed to achieve minimum 20 min at 180°C PMT for standard powder',
    ],
    severity: 'medium',
    relatedWIIds: ['wi-oven-01', 'wi-oven-02'],
  },
  {
    id: 'fault-oven-04',
    equipmentId: 'eq-sat-oven',
    equipmentName: 'Cube Oven',
    symptom: 'Fan motor overheating',
    causes: [
      'Ambient temperature too high around motor',
      'Motor overloaded — fan restriction or bearing drag',
      'Motor cooling fan blocked by powder accumulation',
    ],
    remedies: [
      'Improve ventilation around oven motor area',
      'Check fan for mechanical restriction or bearing wear',
      'Clean motor cooling fan and ensure cooling airflow is unobstructed',
    ],
    severity: 'high',
    relatedWIIds: ['wi-oven-01'],
  },

  // ── Overhead Conveyor faults (source: SAT Conveyor Manual pp.23-24) ──
  {
    id: 'fault-conv-01',
    equipmentId: 'eq-sat-conveyor',
    equipmentName: 'Overhead Conveyor',
    symptom: 'Irregular movement (jerks) or accidental stops',
    causes: [
      'Torque limiter has tripped — chain tension exceeded set limit',
      'Worn or damaged harpoons on drive unit — slipping on chain',
      'Obstruction in conveyor track',
      'Chain tension too high due to temperature expansion',
    ],
    remedies: [
      'Investigate cause before resetting torque limiter. Check for blockage or overload.',
      'Inspect harpoons on all 4 drive units. Replace worn harpoons.',
      'Walk the full conveyor circuit and remove any obstruction.',
      'Check conveyor track for deformation at oven entry/exit where thermal expansion occurs.',
    ],
    severity: 'critical',
    relatedWIIds: ['wi-conv-02'],
  },
  {
    id: 'fault-conv-02',
    equipmentId: 'eq-sat-conveyor',
    equipmentName: 'Overhead Conveyor',
    symptom: 'Transfer station cylinder blocked',
    causes: [
      'Pneumatic supply fault to transfer station cylinder',
      'Sensor misaligned or failed — cylinder does not receive command',
      'Mechanical obstruction at transfer point',
    ],
    remedies: [
      'Check pneumatic supply pressure at transfer station (min 6 bar)',
      'Check and realign position sensors. Clean sensor faces.',
      'Clear any hook or profile obstructing transfer mechanism.',
    ],
    severity: 'high',
    relatedWIIds: ['wi-conv-02'],
  },
  {
    id: 'fault-conv-03',
    equipmentId: 'eq-sat-conveyor',
    equipmentName: 'Overhead Conveyor',
    symptom: 'Downstream interchange station blocked',
    causes: [
      'Accumulation of hooks at station — production pace exceeding station capacity',
      'Pneumatic cylinder failed at station',
      'Sensor failure causing station to not release hooks',
    ],
    remedies: [
      'Reduce line loading pace or temporarily increase speed',
      'Replace pneumatic cylinder at station',
      'Replace or clean blocked sensor',
    ],
    severity: 'medium',
    relatedWIIds: ['wi-conv-02'],
  },

  // ── Loading / Unloading faults (source: SAT Loading/Unloading Manual p.13) ──
  {
    id: 'fault-loadunload-01',
    equipmentId: 'eq-sat-loadunload',
    equipmentName: 'Loading / Unloading System',
    symptom: 'Inverter failure on loading bench or descender',
    causes: [
      'Power supply voltage fluctuation or surge',
      'Motor overcurrent — mechanical obstruction to belt',
      'Inverter internal fault / age',
    ],
    remedies: [
      'Check incoming power supply quality. Check for voltage sags.',
      'Remove any mechanical obstruction to belts before restarting.',
      'Reset or replace inverter per inverter manufacturer instructions.',
    ],
    severity: 'high',
    relatedWIIds: ['wi-loadunload-01'],
  },
  {
    id: 'fault-loadunload-02',
    equipmentId: 'eq-sat-loadunload',
    equipmentName: 'Loading / Unloading System',
    symptom: 'Gearmotor blocked / not turning',
    causes: [
      'Mechanical obstruction — profile or foreign object caught in belt/drive',
      'Motor thermal protection tripped',
      'Gearbox oil low — internal seizure',
    ],
    remedies: [
      'Stop immediately and clear obstruction before attempting restart.',
      'Check and reset thermal protection. Identify heat source before reset.',
      'Check gearbox oil level. Top up if low. If gearbox has seized, replace gearbox.',
    ],
    severity: 'critical',
    relatedWIIds: ['wi-loadunload-01'],
  },

  // ── Pre-Brushing Machine faults ──
  {
    id: 'fault-brusher-01',
    equipmentId: 'eq-sat-brusher',
    equipmentName: 'Vertical Pre-Brushing Machine',
    symptom: 'Brushes not contacting profiles / uneven brushing',
    causes: [
      'Carriage height misaligned — left and right sides at different heights',
      'Lift chain tension unequal between sides',
      'Brush worn below contact threshold',
    ],
    remedies: [
      'Re-tension lift chains — check both LOW and HIGH positions, ensure equal height both sides.',
      'Adjust chain tensions equally per WI-BRUSHER-003.',
      'Replace spiral brushes — raise work order.',
    ],
    severity: 'medium',
    relatedWIIds: ['wi-brusher-02', 'wi-brusher-03'],
  },

  // ── Pre-Treatment Tunnel faults ──
  {
    id: 'fault-tunnel-01',
    equipmentId: 'eq-sat-tunnel',
    equipmentName: 'Pre-Treatment Tunnel',
    symptom: 'Pump vibration and noise (LOWARA E-SHE)',
    causes: [
      'Cavitation — suction filter clogged restricting flow',
      'Worn pump impeller',
      'Worn mechanical seal causing bearing contamination',
      'Pump running dry',
    ],
    remedies: [
      'Clean or replace suction filter immediately.',
      'Replace impeller — raise work order for LOWARA service.',
      'Replace mechanical seal kit (SAT Part 4084001678).',
      'Check chemical tank level. Never run pump dry.',
    ],
    severity: 'high',
    relatedPartIds: ['sat-5'],
    relatedWIIds: ['wi-tunnel-02'],
  },
  {
    id: 'fault-tunnel-02',
    equipmentId: 'eq-sat-tunnel',
    equipmentName: 'Pre-Treatment Tunnel',
    symptom: 'Poor pre-treatment quality — adhesion failure after coating',
    causes: [
      'Chemical concentration out of spec (too low)',
      'Final rinse water conductivity too high (>20 µS/cm) — mineral contamination',
      'Blocked nozzles causing poor spray coverage',
      'Stage temperature below specification',
    ],
    remedies: [
      'Re-dose chemical to specification. Verify titration/pH.',
      'Check IRA output conductivity — initiate regeneration if >20 µS/cm.',
      'Clean all nozzles in affected stage.',
      'Check heating element and temperature controller on affected stage.',
    ],
    severity: 'critical',
    relatedWIIds: ['wi-tunnel-01', 'wi-ira-01'],
  },

  // ── IRA Water Treatment faults ──
  {
    id: 'fault-ira-01',
    equipmentId: 'eq-italplant-ira',
    equipmentName: 'IRA Water Treatment Plant',
    symptom: 'Output conductivity above 20 µS/cm',
    causes: [
      'Resin columns exhausted — regeneration required',
      'Carbon filter saturated — reducing pre-filtration effectiveness',
      'Bypass valve partially open — raw water bypassing resin',
    ],
    remedies: [
      'Initiate full regeneration cycle per WI-IRA-002.',
      'Inspect carbon filter — replace media if annual inspection is overdue.',
      'Check all bypass valves are fully closed.',
    ],
    severity: 'critical',
    relatedWIIds: ['wi-ira-01', 'wi-ira-02'],
  },

  // ── GEMA CM40 ICS circuit breaker (already documented, cross-reference) ──
  {
    id: 'fault-cm40-ics-01',
    equipmentId: 'eq-gema-cm40',
    equipmentName: 'GEMA MagicControl CM40',
    symptom: 'CM40 "circuit breaker at powder management" alarm',
    causes: [
      'Tripped circuit breaker in ICS electrical cabinet (confirmed in June 2025 GEMA PM visit)',
    ],
    remedies: [
      'Locate ICS cabinet. Open door. Identify tripped breaker (handle in middle position).',
      'Reset breaker to ON position.',
      'If breaker trips again immediately, do NOT reset — call GEMA service. Indicates short circuit.',
      'See WI-BOOTH-005 (CM40 ICS Circuit Breaker Reset) for full procedure.',
    ],
    severity: 'critical',
    relatedWIIds: ['wi-booth-05'],
  },
];
```

**Step 2: Run tsc** — Expected: clean.

---

## Task 8: Create gemaga03Data.ts — GEMA GA03-P OptiGun

**Files:**
- Create: `src/data/gemaga03Data.ts`

Source: `OptiGun-GA03-P_GEMA_IT.pdf` (Italian, translated below). GEMA Doc 1011 460 V10/14.

```typescript
import type { Equipment, WorkInstruction, MaintenanceSchedule, SparePart } from '../types';

export const GEMA_GA03P_EQUIPMENT: Equipment = {
  id: 'eq-gema-ga03p',
  name: 'GEMA OptiGun GA03-P Automatic Spray Gun',
  type: 'other',
  model: 'OptiGun GA03-P',
  serialNumber: '',
  status: 'operational',
  capacity: '24 units | 100 kV | 100 µA | 600 g',
  location: 'Booth',
  notes: [
    'Automatic electrostatic powder spray gun.',
    'Input: 12V DC, 18 kHz. Output: 100 kV negative polarity (positive option available).',
    'IP64, ATEX II 2D, PTB 14 ATEX 5001.',
    'Operating temp: 0-40°C. Max surface temp: 85°C.',
    'Compatible ONLY with OptiStar CG12-CP and OptiStar CG11-P control units.',
    'Flat jet nozzle NF27 standard. SuperCorona ring available as optional accessory.',
    'GEMA Doc 1011 460 V10/14.',
  ].join(' '),
  drawings: [],
};

export const GEMA_GA03P_WORK_INSTRUCTIONS: WorkInstruction[] = [
  {
    id: 'wi-ga03p-01',
    equipmentId: 'eq-gema-ga03p',
    title: 'Daily Cleaning & Weekly Deep Clean — GA03-P',
    documentNumber: 'WI-GA03P-001',
    category: 'cleaning',
    revision: 'A',
    status: 'active',
    purpose: 'Prevent powder buildup that reduces coating quality and shortens gun life.',
    scope: 'GA03-P gun exterior, powder tube, atomiser, electrode wash air tube. All 24 guns.',
    responsibleRole: 'operator',
    effectiveDate: '2024-01-01',
    issuedBy: 'GEMA Switzerland GmbH',
    referencedDocuments: ['GEMA Doc 1011 460 V10/14 — Cleaning & Maintenance pp.23-24'],
    steps: [
      { stepNumber: 1, description: 'DAILY: Turn off OptiStar control unit before cleaning.' },
      { stepNumber: 2, description: 'DAILY: Blow exterior of gun with clean dry compressed air (oil-free, moisture-free).' },
      { stepNumber: 3, description: 'WEEKLY: Remove powder tube from gun.' },
      { stepNumber: 4, description: 'WEEKLY: Disassemble atomiser from gun body. Clean with compressed air.' },
      { stepNumber: 5, description: 'WEEKLY: Blow through gun body from connector end in direction of flow.' },
      { stepNumber: 6, description: 'WEEKLY: If required, clean internal gun tube with the round brush supplied.' },
      { stepNumber: 7, description: 'WEEKLY: Blow through again with compressed air.' },
      { stepNumber: 8, description: 'WEEKLY: Ensure locking nut (ghiera di fissaggio) is fully tight after reassembly — loose nozzle causes high-voltage leakage and gun damage.' },
      { stepNumber: 9, description: 'Verify flat jet nozzle NF27 is correctly oriented. Loosen locking nut ~45°, rotate to desired position, retighten firmly.' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const GEMA_GA03P_SCHEDULES: MaintenanceSchedule[] = [
  {
    id: 'ms-ga03p-d01',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    taskName: 'Daily Exterior Clean — All 24 Guns',
    intervalType: 'hours',
    intervalValue: 8,
    warningThreshold: 1,
    responsibleRole: 'operator',
    workInstructionId: 'wi-ga03p-01',
    description: 'Blow exterior of all 24 GA03-P guns with clean dry compressed air. Turn off OptiStar before cleaning.',
    lastServiceDate: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ms-ga03p-w01',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    taskName: 'Weekly Deep Clean — Disassemble & Internal Clean',
    intervalType: 'hours',
    intervalValue: 40,
    warningThreshold: 8,
    responsibleRole: 'operator',
    workInstructionId: 'wi-ga03p-01',
    description: 'Remove powder tube, disassemble atomiser, clean internal tube with brush. Verify locking nut tight on all 24 guns.',
    lastServiceDate: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const GEMA_GA03P_SPARE_PARTS: SparePart[] = [
  {
    id: 'ga03p-sp01',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    partNumber: '1010 200',
    description: 'OptiGun GA03-P Complete Gun — negative polarity (incl. gun body, cable 20m, nozzle NF27)',
    manufacturer: 'GEMA Switzerland GmbH',
    supplierName: 'GEMA Switzerland GmbH',
    unitCost: 0,
    quantityOnHand: 0,
    reorderPoint: 2,
    criticality: 'critical',
    location: 'Booth Spares',
    notes: 'GEMA Doc 1011 460 Part 1010 200. Order as full replacement unit. Lead time TBD.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ga03p-sp02',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    partNumber: '1008 641',
    description: 'Gun Body — complete, negative polarity (wear part #)',
    manufacturer: 'GEMA Switzerland GmbH',
    supplierName: 'GEMA Switzerland GmbH',
    unitCost: 0,
    quantityOnHand: 0,
    reorderPoint: 2,
    criticality: 'high',
    location: 'Booth Spares',
    notes: 'GEMA Part 1008 641. Wear part (#).',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ga03p-sp03',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    partNumber: '1006 324',
    description: 'Powder Tube (wear part #)',
    manufacturer: 'GEMA Switzerland GmbH',
    supplierName: 'GEMA Switzerland GmbH',
    unitCost: 0,
    quantityOnHand: 4,
    reorderPoint: 4,
    criticality: 'high',
    location: 'Booth Spares',
    notes: 'GEMA Part 1006 324. Wear part — replace during weekly clean if cracked or clogged.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ga03p-sp04',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    partNumber: '1005 262',
    description: 'Fluidising Tube (wear part #)',
    manufacturer: 'GEMA Switzerland GmbH',
    supplierName: 'GEMA Switzerland GmbH',
    unitCost: 0,
    quantityOnHand: 4,
    reorderPoint: 4,
    criticality: 'normal',
    location: 'Booth Spares',
    notes: 'GEMA Part 1005 262. Internal fluidising tube — replace if flow becomes irregular.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ga03p-sp05',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    partNumber: '1008 728',
    description: 'Gun Housing Body — complete, negative polarity (without cascade)',
    manufacturer: 'GEMA Switzerland GmbH',
    supplierName: 'GEMA Switzerland GmbH',
    unitCost: 0,
    quantityOnHand: 0,
    reorderPoint: 1,
    criticality: 'high',
    location: 'Booth Spares',
    notes: 'GEMA Part 1008 728.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ga03p-sp06',
    equipmentId: 'eq-gema-ga03p',
    equipmentName: 'GEMA OptiGun GA03-P',
    partNumber: '1005 097',
    description: 'Gun Cable Complete — 20m (sold per metre *)',
    manufacturer: 'GEMA Switzerland GmbH',
    supplierName: 'GEMA Switzerland GmbH',
    unitCost: 0,
    quantityOnHand: 0,
    reorderPoint: 1,
    criticality: 'critical',
    location: 'Booth Spares',
    notes: 'GEMA Part 1005 097. * Specify length when ordering. If cable is defective, send complete gun to GEMA for repair.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
```

**Step 2: Run tsc** — fix any type errors.

---

## Task 9: Merge SAT + GA03-P data into AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/data/mockData.ts` (or AppContext direct import)

**Step 1: Import new data files into AppContext**

At top of `src/context/AppContext.tsx`, add:
```typescript
import {
  SAT_LINE_EQUIPMENT,
  SAT_LINE_WORK_INSTRUCTIONS,
  SAT_LINE_MAINTENANCE_SCHEDULES,
  SAT_LINE_FAULT_RECORDS,
  SAT_LINE_VENDORS,
} from '../data/satLineData';
import {
  GEMA_GA03P_EQUIPMENT,
  GEMA_GA03P_WORK_INSTRUCTIONS,
  GEMA_GA03P_SCHEDULES,
  GEMA_GA03P_SPARE_PARTS,
} from '../data/gemaga03Data';
```

**Step 2: Merge into initialState**

Find the `initialState` object in AppContext. Merge the new data into the existing arrays:

```typescript
const initialState: AppState = {
  // ... existing state ...
  equipment: [...existingEquipment, ...SAT_LINE_EQUIPMENT, GEMA_GA03P_EQUIPMENT],
  workInstructions: [...existingWIs, ...SAT_LINE_WORK_INSTRUCTIONS, ...GEMA_GA03P_WORK_INSTRUCTIONS],
  maintenanceSchedules: [...existingSchedules, ...SAT_LINE_MAINTENANCE_SCHEDULES, ...GEMA_GA03P_SCHEDULES],
  spareParts: [...existingParts, ...GEMA_GA03P_SPARE_PARTS],
  faultRecords: SAT_LINE_FAULT_RECORDS,
  vendors: [...existingVendors, ...SAT_LINE_VENDORS],
};
```

Note: `SAT_VCL_SPARE_PARTS` is already imported from `satSparePartsData.ts` — don't double-import.

**Step 3: Run tsc** — fix any initialState shape errors.

**Step 4: Start dev server and verify equipment count increased**
```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run dev
```
Navigate to Equipment page — should now show SAT line machines + GA03-P.

---

## Task 10: Install Fuse.js + Create GlobalSearch component

**Files:**
- Install: `fuse.js`
- Create: `src/components/ui/GlobalSearch.tsx`

**Step 1: Install Fuse.js**
```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm install fuse.js
```

**Step 2: Create GlobalSearch.tsx**

`★ Insight ─────────────────────────────────────`
Fuse.js builds its search index once, on component mount. Rebuilding the index on every keystroke is expensive — the pattern here is to memoize the Fuse instance with `useMemo`, keyed to the data arrays. The threshold of 0.35 is permissive enough to catch typos ("convyor" → "conveyor") while still excluding unrelated results.
`─────────────────────────────────────────────────`

```typescript
// src/components/ui/GlobalSearch.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Search, X, Wrench, ClipboardList, Calendar, Bolt, AlertTriangle, FileText } from 'lucide-react';

type ResultType = 'equipment' | 'workInstruction' | 'schedule' | 'part' | 'fault' | 'drawing';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  equipmentId?: string;
  drawingFileName?: string;
}

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  equipment:       <Wrench className="w-4 h-4 text-blue-500" />,
  workInstruction: <ClipboardList className="w-4 h-4 text-purple-500" />,
  schedule:        <Calendar className="w-4 h-4 text-green-500" />,
  part:            <Bolt className="w-4 h-4 text-orange-500" />,
  fault:           <AlertTriangle className="w-4 h-4 text-red-500" />,
  drawing:         <FileText className="w-4 h-4 text-cyan-500" />,
};

const DRAWINGS = [
  { id: 'drw-layout',    title: 'General Plant Layout',     subtitle: 'L 2023 11 102 · Layout',    fileName: 'L202311102.pdf' },
  { id: 'drw-hydraulic', title: 'Hydraulic / Plumbing Scheme', subtitle: 'M000028458 Rev00 · Hydraulic', fileName: 'M000028458_REV00.pdf' },
  { id: 'drw-elec-a1',   title: 'Electrical Scheme A1',     subtitle: 'DECORA A1 Rev1.1 · Electrical', fileName: 'DECORA_A1_rev1.1.pdf' },
  { id: 'drw-elec-a4',   title: 'Electrical Scheme A4',     subtitle: 'DECORA A4 Rev1 · Electrical', fileName: 'DECORA_A4_rev1.pdf' },
  { id: 'drw-civil',     title: 'Civil Works Drawing',      subtitle: 'L 2023 11 200 · Civil',     fileName: 'L202311200.pdf' },
  { id: 'drw-loads',     title: 'Ground Loads Diagram',     subtitle: 'L 2023 11 600 · Civil',     fileName: 'L202311600.pdf' },
  { id: 'drw-users',     title: 'User Areas Floor Plan',    subtitle: 'L 2023 11 300 · Layout',    fileName: 'L202311300.pdf' },
];

export function GlobalSearch() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build flat search index from all state slices + static drawings
  const searchItems = useMemo(() => {
    const items: Array<SearchResult & { searchText: string }> = [];

    state.equipment.forEach(e => items.push({
      id: e.id, type: 'equipment',
      title: e.name, subtitle: `${e.type} · ${e.location}`,
      searchText: `${e.name} ${e.model ?? ''} ${e.serialNumber ?? ''} ${e.notes ?? ''}`,
    }));

    state.workInstructions.forEach(wi => items.push({
      id: wi.id, type: 'workInstruction',
      title: wi.title, subtitle: `${wi.documentNumber ?? ''} · ${wi.category}`,
      equipmentId: wi.equipmentId,
      searchText: `${wi.title} ${wi.documentNumber ?? ''} ${wi.purpose ?? ''} ${wi.scope ?? ''} ${wi.steps?.map(s => s.description).join(' ') ?? ''}`,
    }));

    state.maintenanceSchedules.forEach(s => items.push({
      id: s.id, type: 'schedule',
      title: s.taskName, subtitle: `${s.equipmentName} · every ${s.intervalValue} ${s.intervalType}`,
      equipmentId: s.equipmentId,
      searchText: `${s.taskName} ${s.description ?? ''} ${s.equipmentName}`,
    }));

    state.spareParts.forEach(p => items.push({
      id: p.id, type: 'part',
      title: p.description, subtitle: `${p.partNumber} · ${p.manufacturer ?? ''}`,
      equipmentId: p.equipmentId,
      searchText: `${p.description} ${p.partNumber} ${p.manufacturer ?? ''} ${p.supplierName ?? ''}`,
    }));

    state.faultRecords?.forEach(f => items.push({
      id: f.id, type: 'fault',
      title: f.symptom, subtitle: `${f.equipmentName} · ${f.severity} severity`,
      equipmentId: f.equipmentId,
      searchText: `${f.symptom} ${f.causes.join(' ')} ${f.remedies.join(' ')} ${f.equipmentName}`,
    }));

    DRAWINGS.forEach(d => items.push({
      id: d.id, type: 'drawing',
      title: d.title, subtitle: d.subtitle,
      drawingFileName: d.fileName,
      searchText: `${d.title} ${d.subtitle} drawing layout electrical hydraulic`,
    }));

    return items;
  }, [state.equipment, state.workInstructions, state.maintenanceSchedules, state.spareParts, state.faultRecords]);

  const fuse = useMemo(() => new Fuse(searchItems, {
    keys: ['searchText', 'title'],
    threshold: 0.35,
    includeScore: true,
  }), [searchItems]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const hits = fuse.search(query, { limit: 12 });
    setResults(hits.map(h => h.item));
    setSelectedIdx(0);
  }, [query, fuse]);

  // ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setResults([]);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery('');
    if (result.type === 'drawing' && result.drawingFileName) {
      window.open(`/drawings/${result.drawingFileName}`, '_blank');
      return;
    }
    const routes: Record<ResultType, string> = {
      equipment: '/equipment',
      workInstruction: '/work-instructions',
      schedule: '/maintenance',
      part: '/equipment',
      fault: '/maintenance',
      drawing: '/equipment',
    };
    navigate(routes[result.type]);
  }, [navigate]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) handleSelect(results[selectedIdx]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
         onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200"
           onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search equipment, parts, faults, drawings..."
            className="flex-1 text-sm outline-none placeholder-gray-400"
          />
          {query && <button onClick={() => setQuery('')}><X className="w-4 h-4 text-gray-400" /></button>}
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-2 max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <li key={r.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${i === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setSelectedIdx(i)}>
                <span className="shrink-0">{TYPE_ICON[r.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                  {r.type === 'fault' && (
                    <p className="text-xs text-amber-600 truncate mt-0.5">
                      {(state.faultRecords?.find(f => f.id === r.id)?.causes[0]) ?? ''}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-300 shrink-0 capitalize">{r.type.replace(/([A-Z])/g, ' $1')}</span>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && results.length === 0 && (
          <p className="px-4 py-6 text-sm text-center text-gray-400">No results for "{query}"</p>
        )}

        {query.length === 0 && (
          <p className="px-4 py-4 text-xs text-center text-gray-400">
            Search equipment · work instructions · parts · fault codes · drawings
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Run tsc** — fix any import issues.

---

## Task 11: Wire ⌘K Search into App + Nav

**Files:**
- Modify: `src/App.tsx` (or root layout component)
- Modify: Nav component (find by searching for the top nav bar component)

**Step 1: Add GlobalSearch to App.tsx**

Find the root App component and add:
```typescript
import { GlobalSearch } from './components/ui/GlobalSearch';

// Inside JSX, alongside existing layout:
<GlobalSearch />
```

**Step 2: Add search trigger button to nav**

Find the top navigation bar component. Add a search button:
```typescript
import { Search } from 'lucide-react';

// In nav JSX:
<button
  onClick={() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  }}
  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
  title="Search (⌘K)"
>
  <Search className="w-4 h-4" />
  <span className="hidden md:inline text-xs">Search</span>
  <kbd className="hidden md:inline text-xs bg-white px-1 py-0.5 rounded border border-gray-200">⌘K</kbd>
</button>
```

**Step 3: Run tsc + verify in browser**
Open dev server, press ⌘K — search overlay should appear. Type "pump" — should return tunnel pump parts, WIs, fault records.

---

## Task 12: Create Suppliers.tsx page

**Files:**
- Create: `src/components/suppliers/Suppliers.tsx`
- Modify: App routing + Nav to add Suppliers link

**Step 1: Create Suppliers.tsx**

The Vendors type already exists in `src/types/index.ts` and `state.vendors[]` is already in AppState. Build a card-based view:

```typescript
// src/components/suppliers/Suppliers.tsx
import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { isSupabaseReady } from '../../lib/supabase';

// Card per vendor showing: name, contact, email, phone, website, currency, notes, parts count
// Add/Edit modal (manager+): name, contact, email, phone, website, address, currency, leadTimeNotes, notes
// Parts count links → navigate to Equipment page filtered by supplierId
```

Full implementation: standard card grid with Add/Edit modal pattern matching Equipment.tsx.
Key fields per card: name, contact name, email (mailto link), phone, website (external link), currency badge, parts count badge, notes.
RBAC: view (all), add/edit (manager+).

**Step 2: Add to routing and nav**

In App.tsx routes, add:
```typescript
<Route path="/suppliers" element={<Suppliers />} />
```

In Nav, add Suppliers link alongside Equipment.

**Step 3: Run tsc**

---

## Task 13: Admin Parts & Lead Times Tab

**Files:**
- Modify: `src/components/admin/AdminConsole.tsx`

**Step 1: Add 'parts-leadtimes' to TabId type**

Find `type TabId = ...` in AdminConsole.tsx and add `'parts-leadtimes'`.

**Step 2: Add tab button**

In the tab list, add:
```typescript
{ id: 'parts-leadtimes', label: 'Parts & Lead Times', adminOnly: true }
```

**Step 3: Add tab content component (inline)**

`★ Insight ─────────────────────────────────────`
Inline editing without a modal is achieved by storing `editingCell: { partId, field }` in state. When a cell matches editingCell, render an `<input>` instead of `<span>`. On blur or Enter, dispatch UPDATE_SPARE_PART. This avoids a modal for each of 130+ rows.
`─────────────────────────────────────────────────`

```typescript
// PartsLeadTimesTab component (inline in AdminConsole.tsx)
// Table columns: Part Number | Description | Equipment | Supplier | Unit Cost (CAD) | Lead Time (days) | Qty On Hand
// Amber row highlight when leadTimeDays is undefined/null
// Click any cell in Supplier, Lead Time, or Unit Cost columns → inline input
// On blur/Enter → dispatch({ type: 'UPDATE_SPARE_PART', payload: updatedPart })
// Export CSV button → downloads all spare parts as RFC 4180 CSV
// Filter bar: equipment select, supplier select, "Show gaps only" toggle
```

**Step 4: Run tsc**

---

## Task 14: Final Verification Pass

**Step 1: Full tsc check**
```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```
Expected: 0 errors.

**Step 2: Start dev server and manually verify**
```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run dev
```

Verify checklist:
- [ ] Equipment page shows 7 new SAT machines + GA03-P (total equipment count increased)
- [ ] Each new equipment card has a "Drawings" button showing linked PDFs
- [ ] Clicking a drawing button opens PDF in new tab from `/drawings/`
- [ ] Maintenance > PM Schedule shows ~55 new schedules for SAT equipment
- [ ] Work Instructions shows new WIs with WI-BRUSHER-xxx, WI-TUNNEL-xxx doc numbers
- [ ] ⌘K opens search overlay
- [ ] Typing "pump vibrating" returns fault record with causes
- [ ] Typing "electrical" returns electrical drawings
- [ ] Typing "L202311" returns general layout drawing
- [ ] Suppliers page loads and shows pre-populated vendor cards
- [ ] Admin > Parts & Lead Times tab shows all parts with amber rows for missing lead times
- [ ] Admin > Parts & Lead Times inline edit works for lead time field

**Step 3: Commit**
```bash
git add -A
git commit -m "feat(session-14): SAT knowledge base, drawings, ⌘K global search, suppliers module, admin parts tab

- 7 SAT/ITALPLANT equipment records with full specs from manuals
- GEMA GA03-P OptiGun knowledge base (backlog item)
- 15 work instructions extracted from SAT manuals
- 30 maintenance schedules with manual-accurate intervals
- 14 fault/cause/remedy records for diagnostic search
- 14 pre-populated vendor/supplier records
- 8 engineering drawings served from public/drawings/
- DrawingRef type + drawings field on Equipment
- FaultRecord type + faultRecords AppState slice
- Fuse.js GlobalSearch ⌘K command palette
- Suppliers page (state.vendors[] UI)
- Admin Parts & Lead Times inline-edit tab

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
