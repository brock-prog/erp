# SAT Line Knowledge Base — Design Doc
**Date:** 2026-03-02
**Session:** 14
**Status:** Approved

---

## Overview

Populate DECORA ERP with the full SAT Vertical Cube Line equipment knowledge base:
maintenance schedules, work instructions, spare parts, fault guides, supplier records,
engineering drawings, and a global ⌘K search across all of it.

Source materials:
- 10 SAT/ITALPLANT equipment manuals (PDFs)
- 1 zip of 66 component supplier manuals
- 1 zip of 8 engineering drawings (layouts, electrical, hydraulic, civil)
- Existing `satSparePartsData.ts` (121 parts, SAT Offer PRV-369 May 2024)

---

## Section 1 — Data Layer

### New files
| File | Contents |
|------|----------|
| `src/data/satLineData.ts` | 7 equipment records, ~55 WIs, ~55 schedules, fault tables, component suppliers |
| `src/data/gemaga03Data.ts` | GEMA GA03-P OptiGun (backlog item, source: zip) |

### Updated files
| File | Change |
|------|--------|
| `satSparePartsData.ts` | Add `leadTimeDays` estimates + `supplierId` links |
| `src/types/index.ts` | Add `DrawingRef` type + `drawings?: DrawingRef[]` on `Equipment` |
| `src/context/AppContext.tsx` | Merge satLineData into initial state |

### Equipment records (7 new)
| ID | Name | Supplier |
|----|------|----------|
| `eq-sat-brusher` | Vertical Pre-Brushing Machine | SAT |
| `eq-sat-tunnel` | Pre-Treatment Tunnel | SAT |
| `eq-sat-oven` | Cube Oven (Drying + Polymerisation) | SAT |
| `eq-sat-booth` | Spray Booth | SAT |
| `eq-sat-conveyor` | Overhead Conveyor | SAT / TRAS-MEC |
| `eq-sat-loadunload` | Loading / Unloading System | SAT |
| `eq-italplant-ira` | IRA Water Treatment Plant | ITALPLANT |

### Maintenance intervals extracted from manuals
| Equipment | Intervals |
|-----------|-----------|
| Pre-Brushing | 150h (×3), 300h (×2), 500h (×2) |
| Tunnel | 8h (×5), 16h (×4), 24h (×1), 50h (×4) |
| Cube Oven | 8h (×1), 24h (×1), 2-month (×1) |
| Booth | 2-3h (×1), 8h (×2), 24h (×3), 160h (×2), 400h (×1), 6-month (×1), 12-month (×1) |
| Conveyor | 24h (×1), 2-month (×3) |
| Loading/Unloading | monthly (×2) |
| IRA Water Treatment | daily (×1), weekly (×1), monthly (×1), annual (×1) |

### Fault/Cause/Remedy tables (structured, powers search)
All fault tables from every manual are stored as structured data:
```typescript
interface FaultRecord {
  id: string;
  equipmentId: string;
  symptom: string;       // "Pump vibrating and noisy"
  causes: string[];      // ["Worn bearings", "Cavitation", ...]
  remedies: string[];    // ["Replace bearings", "Check suction line", ...]
  relatedPartIds?: string[];
  relatedWIIds?: string[];
}
```

### Component suppliers (pre-populated in state.vendors[])
SAT, ITALPLANT, LOWARA, CHIARAVALLI, MOTOVARIO, VIMEC, FESTO, GEMU, ROLLON,
NERI Motori, SEIPEE, SITI, GEMA, Caleffi

---

## Section 2 — Engineering Drawings

### Storage
All 8 PDFs copied to `public/drawings/` → served statically at `/drawings/<filename>`

| File | Category | Links to |
|------|----------|----------|
| `L202311102.pdf` | layout | All SAT equipment |
| `M000028458_REV00.pdf` | hydraulic | Tunnel, Water Treatment |
| `L202311300.pdf` | layout | All SAT equipment |
| `L202311600.pdf` | civil | Facility |
| `L202311200.pdf` | civil | Facility |
| `DECORA_A1_rev1.1.pdf` | electrical | All SAT equipment |
| `DECORA_A4_rev1.pdf` | electrical | All SAT equipment |
| `2023-11_00users 21-09-2023.pdf` | layout | All SAT equipment |

### New type
```typescript
interface DrawingRef {
  id: string;
  title: string;
  fileName: string;
  category: 'layout' | 'electrical' | 'hydraulic' | 'civil' | 'mechanical';
  drawingNumber: string;
  revision?: string;
}
// Added to Equipment: drawings?: DrawingRef[]
```

### UI integration
- Equipment card → "Drawings" button → list → click opens PDF in new tab
- Work instruction detail → relevant drawing linked inline
- Global search returns drawings as results (📐 icon)

---

## Section 3 — Supplier Module

New page: `src/components/suppliers/Suppliers.tsx`
Added to main nav (manager+ view, admin edit)

### Features
- Supplier cards: name, contact, phone, email, website, lead time notes, currency
- Linked parts count → click filters Equipment spare parts to that supplier
- Add / Edit (manager+)
- Uses existing `state.vendors[]` from session 8

---

## Section 4 — ⌘K Global Search

### Component
`src/components/ui/GlobalSearch.tsx` — command-palette overlay, triggered by ⌘K or search icon in top nav

### Search index (Fuse.js, client-side, offline-capable)
| Type | Fields indexed | Icon |
|------|---------------|------|
| Equipment | name, model, serial, notes | 🔧 |
| Work Instruction | title, documentNumber, steps, purpose | 📋 |
| Maintenance Schedule | taskName, description | 📅 |
| Spare Part | description, partNumber, manufacturer | 🔩 |
| Fault Record | symptom, causes, remedies | ⚠️ |
| Drawing | title, drawingNumber, category | 📐 |

### Result behaviour
- Typing navigates; Enter / click opens relevant page/record
- Fault results show symptom + top 2 causes inline
- Drawing results open PDF in new tab directly

### Tech choice: Fuse.js
- ~15kb, no API calls, instant results, works on shop floor with poor network
- Threshold 0.35 (permissive fuzzy — "pump vib" matches "pump vibration")

---

## Section 5 — Admin Parts & Lead Times Tab

New tab in AdminConsole: `parts-leadtimes`
Inline spreadsheet table of all spare parts showing:
- Part number, description, equipment, supplier, unit cost, lead time days, qty on hand
- Amber highlight on rows with blank `leadTimeDays` or no supplier
- Click cell → inline edit (no modal)
- Export to CSV button

---

## Delivery Order

| Step | Task |
|------|------|
| 1 | Copy drawings to `public/drawings/` |
| 2 | Add `DrawingRef` type + `drawings` field to Equipment |
| 3 | Add `FaultRecord` type to `src/types/index.ts` |
| 4 | Add `faultRecords` slice to AppState + AppContext |
| 5 | Create `src/data/satLineData.ts` (equipment + WIs + schedules + faults + suppliers) |
| 6 | Create `src/data/gemaga03Data.ts` |
| 7 | Merge satLineData into AppContext initial state |
| 8 | Install Fuse.js |
| 9 | Create `GlobalSearch.tsx` component |
| 10 | Wire ⌘K listener into App.tsx + add search icon to nav |
| 11 | Create `Suppliers.tsx` page + add to nav |
| 12 | Add `parts-leadtimes` tab to AdminConsole |
| 13 | tsc --noEmit clean pass |
