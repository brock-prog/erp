# DECORA ERP — Claude Session Context

> Drop this file path into any new session: `/Users/brock/erp/CLAUDE.md`
> Claude Code reads this automatically on startup.

---

## Project Overview

**DECORA** powder coatings ERP system.
- Stack: React 18 + TypeScript + Vite + TailwindCSS
- State: Custom `AppContext` (useReducer) + Supabase JSONB persistence
- Path: `/Users/brock/erp`
- UI component library: custom, in `src/components/ui/`

---

## Environment

```bash
# Node (non-standard path — always use full path)
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm

# TypeScript check (run after every edit)
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit

# Dev server
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run dev
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/context/AppContext.tsx` | Global state, dispatch, Supabase hydration on login |
| `src/lib/supabase.ts` | Supabase client + `isSupabaseReady` export |
| `src/lib/db.ts` | `dbSync()`, `dbLoadAppState()` — persistence helpers |
| `src/types/index.ts` | All TypeScript types |
| `src/utils.ts` | `generateId()`, `formatCurrency()`, etc. |
| `src/components/crm/CRM.tsx` | CRM + sales, gamification leaderboard |
| `src/components/jobs/PendingJobQueue.tsx` | Job queue, received shipments drawer |
| `src/components/workstations/ReceivingKiosk.tsx` | Receiving form, customer + parts comboboxes |
| `src/components/admin/AdminConsole.tsx` | Admin panel, RBAC hierarchy tab |

---

## Critical Type Notes

```typescript
// Customer — NO direct email/phone fields
// Use contacts array:
const primary = c.contacts.find(ct => ct.isPrimary) ?? c.contacts[0];
primary?.email   // ✅
c.email          // ❌ doesn't exist

// InventoryItem — stock field is:
item.quantityOnHand   // ✅
item.stockQty         // ❌ doesn't exist

// isSupabaseReady comes from supabase.ts, NOT db.ts
import { isSupabaseReady } from '../lib/supabase';   // ✅
import { isSupabaseReady } from '../lib/db';          // ❌
```

---

## State Shape (AppState slices)

```typescript
state.customers          // Customer[]
state.savedParts         // SavedPart[]
state.incomingShipments  // IncomingShipment[]
state.inventoryItems     // InventoryItem[]
state.jobs               // Job[]
state.invoices           // Invoice[]
state.users              // User[]
state.currentUser        // User | null
state.crmActivities      // CRMActivity[]
state.crmOpportunities   // CRMOpportunity[]
```

---

## Dispatch Patterns

```typescript
// Fire-and-forget — dbSync is called automatically inside the wrapped dispatch
dispatch({ type: 'ADD_CUSTOMER',       payload: customer });
dispatch({ type: 'UPDATE_SAVED_PART',  payload: updatedPart });
dispatch({ type: 'ADD_SAVED_PART',     payload: newPart });
dispatch({ type: 'ADD_CRM_OPPORTUNITY', payload: opp });
```

---

## Supabase Persistence

```typescript
// On login — parallel load, Supabase wins for any key it has
Promise.allSettled([
  isSupabaseReady ? dbLoadAppState() : Promise.resolve({}),
  api.loadState(getSocketId()).catch(() => ({})),
]).then(([supabaseResult, apiResult]) => {
  const merged = { ...(apiState), ...(supabaseState) }; // Supabase wins
  rawDispatch({ type: '_HYDRATE_STATE', payload: merged });
});
```

---

## RBAC / Roles

| Rank | Roles | Level |
|------|-------|-------|
| Owner | `admin` | 1 (highest) |
| Manager | `manager` | 2 |
| Supervisor | `supervisor` | 3 |
| Operator | `operator` | 4 |
| Guest/Sales | `viewer`, `sales` | 5 (lowest) |

Access check: `rank.level <= privilege.minLevel`

Helpers in AppContext:
```typescript
const isAdmin      = currentUser?.role === 'admin';
const isManagerPlus = ['admin','manager'].includes(currentUser?.role ?? '');
```

---

## CRM Gamification (src/components/crm/CRM.tsx)

Points engine lives **above** the `/* ─── Main Component ───` comment.

```typescript
ACTIVITY_POINTS: { note:5, follow_up:8, email:8, call:12, visit:25, quote_sent:30, order_placed:40, payment_received:20 }
STAGE_POINTS:    { lead:10, prospect:20, quoted:35, negotiating:50, won:0, lost:5 }
wonDealPoints(value) // tiered: 20/35/60/100/200 based on deal size
LEVELS: Rookie(0) → Hunter(80) → Closer(250) → Ace(600) → Legend(1200)
```

Tabs (in order): `today | pipeline | scores | activities | forecast | analytics | leaderboard`

---

## IncomingShipment Extended Fields

Added in `src/types/index.ts`:
```typescript
drawingAttachments?:   PJOAttachment[];   // CAD/PDF uploads
criticalSurfaces?:     string;            // Red-highlighted annotation
paintInventoryItemId?: string;            // Linked powder/paint item
paintRequiredKg?:      number;            // Required quantity
```

---

## SavedPart Auto-Save Logic (ReceivingKiosk)

On shipment confirm:
1. If known part selected → bump `usageCount` + update `lastUsedAt`
2. If new description typed → case-insensitive check in `savedParts`:
   - Match found → bump usageCount
   - No match → `dispatch({ type: 'ADD_SAVED_PART', payload: newPart })`

---

## Completed Features (as of session 6)

- [x] Supabase hydration on login (AppContext)
- [x] Customer search combobox (ReceivingKiosk)
- [x] Parts/profiles library search + auto-save (ReceivingKiosk)
- [x] Received shipment drawer: drawings upload, critical surfaces, paint combobox + stock (PendingJobQueue)
- [x] Admin Console: User Hierarchy / RBAC tab (pyramid + privilege matrix)
- [x] CRM Gamification: points engine + Leaderboard tab (full rankings, podium, cheat sheet)
- [x] WorkflowHelp `?` button on every page — visual flowchart modal (14 pages covered)
- [x] Metal finishing compliance features (session 5):
  - `ComplianceStandard` type (AAMA 2603/2604/2605, Qualicoat 1/2/3, GSB, AS/NZS, EN, ISO)
  - `COMPLIANCE_STANDARD_LABELS` + `COMPLIANCE_MIN_DFT_UM` lookup maps
  - `MilThicknessReading` type for multi-point DFT per ISO 2360 / ASTM D7091
  - `OvenCureLog` type (PMT, time-at-temp, cure window pass/fail, data logger)
  - `ChemicalBathLog` type (pH, conductivity, concentration, shift log)
  - `CertificateOfConformance` type (full CoC fields)
  - `ReworkRecord` type (strip/recoat workflow, method, costs)
  - `InventoryItem.lotNumber` + `lotManufactureDate` for powder lot traceability
  - `InventoryTransaction.lotNumber` for chain-of-custody
  - `Batch.powderLotNumber` + `ovenCureLogId` linkage
  - `QCInspection.milReadings[]` multi-point DFT + `complianceStandards[]` + `cocId`
  - `Job.complianceStandards[]` per-job compliance tagging
  - `Rack.cycleCount` + `lastStrippedAt` + `stripDueAtCycles` for jig maintenance scheduling
  - AppState: `ovenCureLogs`, `chemicalBathLogs`, `certificates`, `reworkRecords`
  - Quality.tsx: **Cure Logs**, **Bath Logs**, **Certificates** tabs with full CRUD modals
- [x] Demo / Live Mode toggle (session 6):
  - `demoMode: boolean` in AppState — persisted to `localStorage` key `coatpro_demo_mode`
  - `SET_DEMO_MODE` action — Supabase sync skipped when `demoMode === true`
  - Amber banner strip at top of every page in Demo Mode
  - Admin Console → System tab: Demo/Live mode card with confirmation modal
- [x] Backup system (session 6):
  - `src/lib/backup.ts` — `downloadBackup()`, `readBackupFile()`, history, settings, `formatBytes()`
  - Admin Console → **Backups** tab (admin-only): health banner, manual download, auto-backup toggle (1h/6h/24h), backup history (last 10), restore from file, SSD setup guide (macOS rsync + Windows robocopy)
- [x] Security dashboard (session 6):
  - Admin Console → **Security** tab (admin-only): security health score (5 checks), session timeout (Off/15m/30m/1h/4h/8h), active sessions panel, login history, data security notes, emergency lockdown (deactivates all non-admin users)
  - Session timeout auto-logout: global `useEffect` in AppContext, activity events reset the timer, persisted in `localStorage` key `coatpro_session_timeout_min`
- [x] User management (session 6):
  - `ADD_USER` / `UPDATE_USER` actions + reducer cases
  - Users now persisted in localStorage (removed from exclusion list)
  - Admin Console → Users tab: **Add User** button + **Edit** per row → modal with full form (name, email, role, department, phone, active toggle), duplicate-email guard, audit log entry
- [x] Multi-material / two-phase job system (session 7):
  - `MaterialType`, `JobPhaseType`, `JobPhaseStatus`, `MaterialRequirement`, `JobPhase` types
  - `JobStatus` extended with `'awaiting_sublimation'`
  - `Job` extended with `phases[]`, `currentPhaseIndex`, `materialRequirements[]`, `materialsReadyForScheduling`
  - `PendingJobOrder` extended with paint kg + sublimation film fields
  - PendingJobQueue: paint required input + film picker combobox, two-phase banner
  - Jobs.tsx: dynamic `orderStatuses` (injects `awaiting_sublimation` for multi-phase), Phase Tracker card, Material Requirements confirm gate
- [x] International trade & QuickBooks integration foundation (session 8):
  - **types/index.ts**: `Currency` (10 currencies), `TaxJurisdiction` (23 jurisdictions), `QB_TAX_CODE` map, `JURISDICTION_RATE`, `JURISDICTION_LABELS`, `inferTaxJurisdiction()`, `Vendor`, `BrokerageRecord`, `CommercialInvoice`, `QBSettings`, `QBImportRecord<T>`, `QBImportSession`; Customer + InventoryItem extended with international/QB fields
  - **taxUtils.ts**: `getQBTaxCode()`, `getEffectiveTaxRate()`, `resolveCustomerJurisdiction()`, EU VAT validation (27 countries + UK), GST/HST + US EIN validation, `formatByCurrency()`, `canClaimITC()`, `COMMON_HS_CODES`, `INCOTERM_OPTIONS`
  - **src/lib/qbImport.ts**: RFC 4180 CSV parser, QB Online column mapping for customers/vendors/products/invoices, duplicate detection, `detectQBCSVType()`, `buildImportSession()`
  - **AppContext**: `vendors[]`, `brokerageRecords[]`, `qbSettings`, `qbImportHistory[]` slices + all action types + reducer cases
  - **Admin Console → QuickBooks tab** (admin-only): OAuth connection status card (Phase 2 placeholder), tax registration number fields (GST/HST + QST), Canadian tax code matrix (all 13 provinces/territories), international export codes, chart of accounts mapping (13 fields), CSV import wizard (auto-detect type → preview table → confirm), import history
- [x] GEMA MagicControl 4.0 (CM40) equipment knowledge base (session 9):
  - **Equipment record** `eq-gema-cm40`: full technical specs (ARM Cortex-A9 800MHz, 15.6" PCT, 24VDC SELV, 404×255×76mm, all connections/environmental specs), user levels, operating modes, wear tracking summary, ATEX compliance, spare parts reference
  - **8 work instructions** (wi-cm40-01 through wi-cm40-08): Daily Startup (11 steps), AUTO Mode Production, MAN Mode Manual Operation, CLN Mode Cleaning (13 steps), Shutdown Procedure (6 steps), Daily Powder Output Correction, SD Card Data Backup, ATEX & Critical Safety Reference
  - **8 maintenance schedules** (ms-cm40-01 through ms-cm40-08): All 7 CM40-tracked wear intervals — electrode holder 800h, gun nozzle 600h, powder hose 1500h, injector cartridge 100h, IN pinch valve 1000h, OUT pinch valve 1000h, filter elements 1500h; plus pinch valve diagnostic reminder 16h
  - **2 spare parts** (cm40-sp01, cm40-sp02): Micro Touch Panel MC 15.6" complete (Part No. 1015 320), SD card 4 GB (on request)
  - All data sourced from GEMA Doc 1011 534 EN Rev.01 12/21
- [x] GEMA OptiCenter OC07 equipment knowledge base (session 10):
  - **Equipment record** `eq-gema-oc07`: 230V+E+N, IP54, ATEX II 3D, 6.5 bar air, 24 guns, 3.5 kg/min recovery, OptiSpeeder 6 kg, 1900×1700mm, 460/840 kg
  - **8 work instructions** (wi-oc07-01 through wi-oc07-08): Daily Startup (10 steps), Coating with Recovery, Color Change/Cleaning (12 steps), Daily Shutdown, Powder Bag Replacement, 100% Level Sensor Teach, Fresh Powder Ratio Management, ATEX & Safety Reference
  - **10 maintenance schedules** (ms-oc07-01 through ms-oc07-10): Daily noise/residue checks, monthly AirMover clean, 5 annual tasks (fluid plate, NW15 pinch hoses, level sensor, filter elements, hose/electrical checks), 2-year NW32 pinch hose replacement
  - **8 spare parts** (oc07-sp01 through oc07-sp08): Touch Panel 7" (1015 525), SD card, Pinch valve DN32 (1007 648), Pinch hose NW32 (1007 647), Fluidizing plate 24P (1018 017), AirMover NW40 (1008 066), Pinch valve DN15 (1018 025), Fluidizing/suction unit (1005 332)
  - All data sourced from GEMA Doc 1011 545 EN Rev.02 04/21
- [x] GEMA US07 Ultrasonic Sieve System equipment knowledge base (session 10):
  - **Equipment record** `eq-gema-us07`: SGL4 pro generator (230VAC, IP40, ATEX II 3D, 100W, 33-37 kHz), mesh sizes 140-1180µm, 250µm standard (3.5 kg/min, 30 guns), no scheduled maintenance
  - **2 work instructions** (wi-us07-01, wi-us07-02): Startup/Troubleshooting (6 steps with fault guide), Sieve Replacement procedure
  - **3 spare parts** (us07-sp01 through us07-sp03): Sieve 250µm (1018 753), HF cable 6m (1018 716), Converter (1018 067)
  - All data sourced from GEMA Doc 1011 501 EN V03/19
- [x] GEMA OptiStar 4.0 CG24-CP gun control knowledge base (session 10):
  - **Equipment record** `eq-gema-optistar`: 24 units, 100-240VAC, IP54, ATEX II 3(2)D, PTB17 ATEX 5002, 6.5 bar air, 250 programs, 3 preset modes, PCC mode
  - **1 work instruction** (wi-optistar-01): Startup, preset/program mode selection, powder output and air setting (8 steps)
  - **2 spare parts** (optistar-sp01, optistar-sp02): Complete unit (1015 205), Pneumatic group (1020 104)
  - All data sourced from GEMA Doc 1011 532 EN Rev.01 09/22
- [x] GEMA OptiFeed 4.0 PP07 powder pump knowledge base (session 10):
  - **Equipment record** `eq-gema-pp07`: 24 units, 24VDC, IP54, ATEX II 3D, T6, 6-8 bar air, 6 kg/min max output, pinch valve cycle monitoring (3M cycles default)
  - **2 work instructions** (wi-pp07-01, wi-pp07-02): Operation/cleaning (8 steps), **Annual pinch valve & filter element replacement — internal replacement procedure eliminating GEMA service visit for this task**
  - **4 maintenance schedules** (ms-pp07-01 through ms-pp07-04): Annual pump service (pinch valves + filter elements), daily wear monitoring, daily cleaning verification, annual hose/electrical check
  - **5 spare parts** (pp07-sp01 through pp07-sp05): Maintenance Set Small (1020 444), Large (1020 449), Pinch valve (1020 805), Filter element (1019 465), Powder chamber complete (1019 460)
  - All data sourced from GEMA Doc 1017 576 EN Rev.01 05/23
- [x] GEMA Service Net PM report integration + internal service program (session 11):
  - **Source**: GEMA Service Net on-site technician PM report "Magic Booth System Periodic Maintenance Schedule and Checklist" (June 13, 2025 visit, $50k/year contract)
  - **Key findings documented**: (1) Operators NOT checking nozzles/electrodes daily — guns ran 6+ months without inspection; (2) CM40 "circuit breaker at powder management" error — tripped CB in ICS cabinet, reset and cleared; (3) IR flame detection not tested during visit (SAT system — now added as internal monthly task)
  - **New equipment records**: `eq-gema-ap01` (OptiGun AP01.1 ×24 spray guns), `eq-gema-pp06` (PP06 bulk powder transfer pumps — reclaim + fresh)
  - **New work instructions** (wi-ap01-01, wi-booth-01 through wi-booth-06): Daily gun inspection (8 steps), Daily pre-shift full system checklist (10 steps), Weekly PM (6 steps), Monthly fire/safety/charge PM (6 steps), Semi-annual reciprocator service (8 steps), **Annual PM — dust collector + powder hoses + PP06 rebuild (7 steps, replaces GEMA annual service visit)**, CM40 ICS circuit breaker reset (6 steps)
  - **New spare parts** (ap01-sp01 through ap01-sp03, pp06-sp01, booth-sp01 through booth-sp04): Gun nozzles ×24, electrode holders ×24, deflectors/inserts ×24, PP06 rebuild kit, dust collector filter set, final filter set, full-line powder hose set ×24, cyclone scouring media
  - **New maintenance schedules** (ms-booth-d01 through ms-booth-a04 = 19 schedules): 6 daily, 4 weekly, 5 monthly, 2 semi-annual, 4 annual — covering complete Magic Booth System PM program at all intervals
  - All data sourced from GEMA Service Net visit report + GEMA manual data
- [x] MaintainX-level CMMS enhancement + ISO 9001:2015 QMS integration (session 12):
  - **Maintenance.tsx** fully rewritten (1,518 lines) — 5-tab MaintainX-grade module:
    - **Dashboard**: KPI row (overdue, in-progress, scheduled, monthly/YTD cost, MTTR, PM compliance), overdue alert strip, upcoming WO cards, recent activity
    - **Work Orders**: 4 dropdown filters (status/equipment/type/priority) + search; table with task# / equipment / type / title / priority / status / scheduled / assigned / est.h / actual.h / labor cost / parts cost / total; Start/Complete quick actions; Edit + Delete (admin/manager)
    - **PM Schedule**: Embeds MaintenanceScheduler; "Generate Work Order" button on due/overdue items with WI deep-link badges
    - **Equipment Health**: Cards with YTD cost, open WO count, operational status
    - **Analytics**: Cost by equipment table (YTD), monthly trend (rolling 12 months), technician utilization from `laborEntries[]`, PM compliance per equipment
  - **WorkOrderModal** — 5 inner tabs (Details, Labor, Parts, Checklist, Notes & Photos):
    - **Labor entries**: Per-technician time entries (name, date, hours, rate); `laborCost` auto-computed; default rate $0 (always entered manually)
    - **Parts**: "Select from inventory" picker auto-fills from `spareParts`; stores `sparePartId`; disposal confirmation required on WO completion; `UPDATE_SPARE_PART` decrements `quantityOnHand`
    - **Work Instruction link**: Dropdown filtered by equipment; displays doc number + WI title; "View" hyperlink → `/work-instructions?id=XXX`
    - **Completion notes**: Separate textarea (shown on status=complete)
    - **Delete WO**: Admin/manager only; confirm dialog; dispatches `DELETE_MAINTENANCE`
  - **New types** (`src/types/index.ts`): `LaborEntry` interface; `MaintenancePart` extended with `sparePartId?`, `confirmedUsed?`, `disposalConfirmedAt?`; `MaintenanceTask` extended with `laborEntries?`, `workInstructionId?`, `completionNotes?`; `MaintenanceSchedule` extended with `workInstructionId?`
  - **AppContext**: `DELETE_MAINTENANCE` action + reducer case
  - **ISO 9001:2015 QMS** — `WorkInstruction` extended with 7 new §7.5 document control fields: `documentNumber` (e.g., WI-CM40-001), `purpose`, `scope`, `referencedDocuments[]`, `responsibleRole`, `effectiveDate`, `issuedBy`
  - **All 28 WIs in mockData.ts** backfilled with full QMS data: document numbers (WI-CM40-001 through WI-CM40-008, WI-OC07-001 through WI-OC07-008, WI-US07-001/002, WI-OPTISTAR-001, WI-PP07-001/002, WI-AP01-001, WI-BOOTH-001 through WI-BOOTH-006) + purpose, scope, responsible role, effective date, referenced standards
  - **WorkInstructionViewer.tsx** enhanced: `useSearchParams` deep-link (`/work-instructions?id=XXX` pre-selects WI on load); ISO 9001 QMS document header block in detail view (doc number badge, revision, effective date, responsible role, approver, purpose, scope, referenced documents); `documentNumber` shown on InstructionCard list; doc number included in search filter; new "ISO 9001:2015 QMS Document Control" section in builder modal
  - **Hyperlinks added**: WI title in WO modal → `navigate('/work-instructions?id=XXX')`; equipment name in WO table → filter WOs by that equipment; PM schedule rows with `workInstructionId` → doc number badge + "View WI" click link; 21 booth maintenance schedules linked to their WIs (ms-booth-d01 through ms-booth-a04)
  - **Session 12 (continued) — polish pass**:
    - **43 maintenance schedules** now linked to WIs via `workInstructionId`: all 21 booth schedules + 8 CM40 + 10 OC07 + 4 PP07 (mapped to relevant procedure WIs based on task type)
    - **WO modal WI dropdown**: option labels now show `[WI-CM40-001] Title (Rev. A)` format when documentNumber is set
    - **Dashboard**: upcoming WO cards — equipment name is now a navigation button → switches to Work Orders tab filtered by that equipment; Recent Activity feed — task title opens edit modal on click, equipment abbreviation navigates to filtered Work Orders tab
    - **Analytics — Cost by Equipment table**: equipment name column is now a clickable navigation button → switches to Work Orders tab filtered by that equipment
    - **Analytics — PM Compliance table**: equipment name column also clickable → navigates to Work Orders tab
    - **AnalyticsTab** receives `onNavigateToEquipment` callback from `Maintenance()` component; `byEquipment` and `pmCompliance` maps now include `id` field for proper keying
    - **Work Orders table**: WI link icon (`BookOpen`) appears inline in title cell when `workInstructionId` is set — clicking navigates to the work instruction
    - **WorkInstructionViewer**: `issuedBy` fully surfaced — added to `DraftWI` interface, `EMPTY_DRAFT`, `wiToDraft()`, `draftToWI()`, builder form (4-column QMS grid: Doc Number / Responsible Role / Effective Date / Issued By), and QMS document header block in detail view
    - **All 28 WIs in mockData**: backfilled with `issuedBy: 'Sam Chen'` (technical document author)
- [x] Asset Registry — full CRUD, RBAC, and month-view calendar (session 13):
  - **AppContext**: `ADD_EQUIPMENT`, `UPDATE_EQUIPMENT`, `ARCHIVE_EQUIPMENT` action types + reducer cases
  - **Equipment.tsx** — full RBAC permission matrix:
    - `isAdmin` / `isManagerPlus` derived from `currentUser.role`
    - **EquipmentModal** (inline, 2-column grid): name, type, status, location, capacity, model, serial, maxTempF, maxPressure, notes — Add (manager+) and Edit (manager+)
    - **Archive / Retire**: admin-only Archive button per card → confirm modal → `ARCHIVE_EQUIPMENT` (sets `status: 'retired'`); Restore button for retired equipment → `UPDATE_EQUIPMENT` with `status: 'operational'`
    - **Show Retired toggle**: admin-only button reveals `status: 'retired'` equipment (hidden by default via `visibleEquipment` filter)
    - **Spare Parts RBAC**: Add/Edit buttons gated to `isManagerPlus`; Delete button gated to `isAdmin` with confirmation modal (`DELETE_SPARE_PART` dispatched only after confirm)
  - **MaintenanceScheduler.tsx** — full CRUD + calendar:
    - **ScheduleModal** (inline, 2-col grid): equipment select, task name, responsible role, interval-type toggle (Days ↔ Hours) with conditional interval/warn fields, WI picker (doc number format), assigned-to user select, description textarea — Add/Edit (manager+)
    - **Delete schedule**: admin-only Trash button per row → confirm modal → `DELETE_MAINTENANCE_SCHEDULE`
    - **List | Calendar segmented toggle**: switches between existing table view and new CalendarView
    - **CalendarView** (inline component, ~160 lines): pure CSS 7-column Mon–Sun grid, no external date library; events from day-based `maintenanceSchedules` (projected `lastServiceDate + intervalDays`) and `maintenanceTasks` with `scheduledDate` in the displayed month; colored status dots (green/amber/red) per cell; click cell → day detail panel below calendar showing full event list + status badge + Edit button (manager+) for schedule events; month navigation (← / →)

## GuidedTour Component

```typescript
// src/components/ui/GuidedTour.tsx
// Usage:
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const MY_TOUR: TourStep[] = [
  { selector: '[data-tour="xxx"]', title: 'Step Title', why: 'Why this matters', what: 'What to do here' },
  { selector: '[data-tour="yyy"]', title: 'Step 2', why: '...', what: '...', position: 'bottom' },
];

// In JSX (near page title, alongside WorkflowHelp):
<GuidedTourButton steps={MY_TOUR} />
// Add data-tour attributes to target elements:
<div data-tour="xxx">...</div>
```

Position options: `top` (default) | `bottom` | `left` | `right`
All 23 modules have tours (87 total selectors).

---

## WorkflowHelp Component

```typescript
// src/components/ui/WorkflowHelp.tsx
// Usage:
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';

const MY_WORKFLOW: WorkflowStep[] = [
  { type: 'start',    icon: '🚪', label: 'Step label', description: 'Detail text' },
  { type: 'action',   icon: '🔧', label: 'Action step', description: '...' },
  { type: 'decision', icon: '❓', label: 'Decision?',
    branches: [
      { label: '✓ Yes', color: 'green', steps: [{ label: 'Sub-step' }] },
      { label: '✗ No',  color: 'red',   steps: [{ label: 'Sub-step' }] },
    ]},
  { type: 'end',      icon: '✅', label: 'Done', description: '...' },
];

// In JSX (near page title):
<WorkflowHelp title="Page Workflow" description="Brief summary." steps={MY_WORKFLOW} />
// For dark headers (kiosk, brand-gradient):
<WorkflowHelp ... variant="dark" />
```

Step types: `start` (green) | `action` (blue) | `decision` (amber, supports branches) | `end` (gray) | `note` (yellow)
Branch colors: `green` | `red` | `blue` | `amber` | `gray` | `purple`

---

## Ideas / Backlog

- [x] Continue equipment knowledge base — SAT supplier documents processed (session 14):
  - TRAS-MEC MP45 conveyor (full maintenance intervals: 50h/200h/2000h/8000h, TRAMEC TF100 gearbox oil specs)
  - Riello RS burners (annual gas service, spare parts: ignition electrode 3012985, ionisation probe 3012986)
  - LOWARA pumps (1yr/2yr/5yr service intervals, mechanical seal + O-ring spares)
  - GEMÜ 610 diaphragm valves (annual + biennial diaphragm replacement, EPDM spare)
  - Neri ATEX motors (annual inspection per §7.1, 20,000h bearing replacement per §7.2)
  - Chiaravalli CHM gearboxes (CHM025–090 = synthetic ISO VG320 life-lube; CHM110–150 = mineral VG320 change 10,000h/2yr)
  - Affetti CDI-QL pumps (daily check, 6-monthly seal replacement, spare items 433/210/463/524)
  - Festo MS4 filter regulators + MSB service units (ATEX Zone 1/2, annual MS-LFP filter cartridge 526489)
  - Caleffi 5360/5362 pressure reducers (factory 3 bar, max 25 bar upstream, NBR membrane)
  - Carpanelli MRE100B6 motors (spec only — no maintenance manual extractable)
  - VIMEC/Ferrari fans (catalog data only — no maintenance data extractable)
  - IFM O5D100 sensor (German-only PDF — specs noted), Basler camera PDF unreadable (image scan)
  - 12 new equipment records, 10 spare parts, 17 maintenance schedules added to mockData.ts
  - Fields marked `___` need on-site nameplate confirmation (pump counts, valve counts, fan model #s)
- [x] GuidedTour component + 23/23 module coverage (session 15):
  - `src/components/ui/GuidedTour.tsx` — reusable tour system (spotlight overlay, step cards, navigation)
  - All 23 modules have `GuidedTourButton` + tour step arrays (87 total selectors)
  - Pattern: `const XX_TOUR: TourStep[] = [...]`, `data-tour="xxx"` attrs, `<GuidedTourButton steps={XX_TOUR} />`
- [x] ADP Workforce Now integration design (session 15):
  - Design doc: `docs/plans/2026-03-03-adp-integration-design.md`
  - Implementation plan (11 tasks): `docs/plans/2026-03-03-adp-integration-plan.md`
  - Architecture: 5 Supabase Edge Functions (adp-auth/workers/time/payroll/onboarding)
  - ADP-wins conflict resolution, 4h auto-sync via pg_cron
- [x] Self-hosted deployment guide (session 15):
  - Guide: `docs/plans/2026-03-03-deployment-guide.md`
  - Target: ASUS ROG PC (32-64GB RAM, SSD, RTX 4070, Win10/11), same LAN as shop floor
  - Stack: Docker Desktop + WSL2, self-hosted Supabase, Nginx, Cloudflare Tunnel
- [x] SAT MySQL integration planning (session 15):
  - Planning notes: `docs/plans/2026-03-03-sat-mysql-integration-notes.md`
  - Next step: schema exploration with provided MySQL credentials
- [ ] ADP Edge Functions implementation (execute 11-task plan)
- [ ] ROG PC deployment (follow deployment guide)
- [ ] SAT MySQL schema exploration + sync service
- [ ] QB Phase 2: Supabase Edge Function for OAuth token storage + live invoice push
- [ ] QB Phase 3: Bidirectional sync — pull payments from QB webhooks
- [ ] Vendor management UI (list/add/edit vendors, link to inventory items)
- [ ] Brokerage records UI (log import/export brokerage fees, ITC tracking)
- [ ] Commercial Invoice generator (PDF, includes HS codes + CUSMA certification)
- [ ] Scheduled backup to Supabase Storage bucket (server-side, not browser download)
- [ ] 2FA / TOTP enrollment for admin accounts
- [ ] IP allowlist for login (currently display-only — requires server-side enforcement)
- [ ] Barcode / QR scan in ReceivingKiosk
- [ ] Push notifications for overdue follow-ups (CRM Today tab)
- [ ] Inspection ticket PDF generation (with critical surface areas highlighted)
- [ ] Inventory reorder alerts / low-stock dashboard widget
- [ ] Customer portal (read-only job status view)
- [ ] Mobile-optimised operator view for shop floor

---

## Session Tips

- Run `tsc --noEmit` after **every** edit — catches errors immediately
- Use `offset` + `limit` when reading large files (don't read 600 lines to find 10)
- Use `/compact` in Claude before hitting context limit (every ~4-6 big edits)
- This file is the recovery anchor — update the Backlog section as features land
