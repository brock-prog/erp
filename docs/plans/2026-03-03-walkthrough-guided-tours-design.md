# Walkthrough & Guided Tours Design

**Date**: 2026-03-03
**Status**: Approved

---

## Goal

Make the ERP usable by anyone — even someone with zero powder coating knowledge. Two deliverables:

1. **Enhanced Help Center** — scenario-driven tutorials covering every module, using a sample residential railing job as the narrative thread with commercial curtain wall "Pro Tip" callouts.
2. **GuidedTour overlay** — interactive step-by-step highlight tours on each page that explain *what* to fill in and *why* it matters.

---

## Part 1: Help Center Enhancement

### Structure (3 sections)

**Section A — Getting Started: Sample Job Walkthrough**
A top-of-page narrative banner + chapter cards following the "Smith Railing Job" through every module:

1. Customer calls for a quote (CRM)
2. Create the customer record (Customers)
3. Build and send a quote (Quotes)
4. Customer drops off parts (Receiving Kiosk)
5. Review the pending shipment (Pending Job Queue)
6. Job is created and scheduled (Jobs, Scheduling)
7. Parts are coated (production floor)
8. QC inspection (Quality)
9. Ship finished parts (Shipping)
10. Generate invoice and collect payment (Invoicing)
11. Post-job: update CRM, review reports

Each chapter card: icon, title, 2-3 sentence summary, "Go to tutorial" link, and a "Pro Tip: Commercial Job" callout explaining how an AAMA 2604 curtain wall job differs.

**Section B — Module Tutorials (enhanced)**
Existing 13 tutorials rewritten with scenario references + these new tutorials:

| New Tutorial | Role | Covers |
|---|---|---|
| Equipment & Asset Registry | manager, admin | Equipment cards, RBAC, archive/restore |
| Maintenance & Work Orders | operator, manager, admin | CMMS dashboard, WO lifecycle, PM schedule, labor/parts tracking |
| Work Instructions | operator, manager | Viewing WIs, document control fields, deep-links from maintenance |
| HR & Time Tracking | manager, admin | Employee records, time entries, HR kiosk |
| Logistics & Delivery | operator, manager | Route planning, driver run sheets |
| Costing & Margin Analysis | manager, admin | Job cost breakdown, quoted vs actual |
| Receiving Kiosk (Operator) | operator | Full-screen kiosk form, customer/part comboboxes, auto-save parts |
| Pending Job Queue (Detailed) | manager, admin | Shipment review, drawings, critical surfaces, paint assignment |
| Customer Portal | sales, manager | Portal login, order tracking, quote/sample requests |
| Settings & Preferences | all | User settings page |

**Section C — Role Quick-Start Cards** (existing, unchanged)

### Tutorial Data Structure (enhanced)

```typescript
interface Step {
  title?: string;
  description?: string;
  tip?: string;
  proTip?: string;          // NEW — commercial scenario difference
  keyField?: string;        // NEW — highlights the critical field name
  whyItMatters?: string;    // NEW — business reason for this field
}

interface Tutorial {
  id: string;
  title: string;
  role: string[];
  time: string;
  icon: React.ReactNode;
  color: string;
  summary: string;
  scenario?: string;        // NEW — sample job context sentence
  steps: Step[];
}
```

### Sample Job Scenarios

**Primary: Residential Railing Job ("Smith Railing")**
- Customer: John Smith, homeowner
- Parts: 12 aluminum railing sections, 6063-T5 alloy
- Service: Standard powder coating, RAL 9005 matte black
- Priority: Normal, Net 15 terms
- Single-phase job (powder coat only)

**Secondary: Commercial Curtain Wall ("Apex Glazing")**
- Customer: Apex Glazing Inc., glazing contractor
- Parts: 200 curtain wall extrusions, 6063-T6
- Service: AAMA 2604 compliant fluoropolymer coating
- Priority: Normal, Net 30 terms
- Compliance: AAMA 2604, certificate of conformance required
- Multi-phase if sublimation finish specified

---

## Part 2: GuidedTour Overlay Component

### File: `src/components/ui/GuidedTour.tsx`

**Exports:**
- `GuidedTour` — the overlay component (renders portal)
- `GuidedTourButton` — a "Start Tour" button to place next to WorkflowHelp
- `TourStep` type

### TourStep Type

```typescript
interface TourStep {
  selector: string;          // CSS selector for the element to highlight
  title: string;             // e.g. "Customer Field"
  why: string;               // e.g. "Links the job to billing. Wrong customer = wrong invoice."
  what: string;              // e.g. "Search by name. Click + to add new customer."
  position?: 'top' | 'bottom' | 'left' | 'right';  // tooltip placement
}
```

### UX Behavior

1. User clicks "Start Tour" button on any page
2. Page dims with a semi-transparent overlay (z-9998)
3. A "spotlight" cutout highlights the element matching `selector`
4. A tooltip card appears near the highlighted element:
   - Step title (bold)
   - "Why it matters" paragraph (italic, smaller)
   - "What to do" paragraph
   - Step counter: "Step 2 of 8"
   - Buttons: Back | Next | Skip Tour
5. If selector doesn't match (element not visible), skip to next step
6. On last step, "Next" becomes "Finish Tour"
7. ESC key closes the tour

### Visual Design

- Overlay: `rgba(15, 23, 42, 0.6)` with CSS `mix-blend-mode` or SVG mask for spotlight
- Tooltip: white card, rounded-xl, shadow-2xl, brand-colored top border
- Spotlight: 8px padding around highlighted element, rounded corners
- Step dots at bottom of tooltip showing progress

### Integration Pattern

Each page defines its tour steps alongside its existing workflow steps:

```typescript
// In any page component:
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const PAGE_TOUR: TourStep[] = [
  { selector: '[data-tour="customer-select"]',
    title: 'Customer Field',
    why: 'This links the job to billing. Wrong customer = wrong invoice.',
    what: 'Type to search. Click + to add a new customer.' },
  // ...more steps
];

// In JSX (next to WorkflowHelp button):
<GuidedTourButton steps={PAGE_TOUR} />
```

Pages add `data-tour="xxx"` attributes to key elements for stable selectors.

---

## Modules Needing Tour Definitions

All modules get both enhanced Help Center tutorials AND interactive tours:

| Module | Tour Steps (approx) |
|---|---|
| Dashboard | 6 (KPI cards, alerts, recent jobs, charts) |
| Customers | 6 (search, add, contacts, health score, notes) |
| Quotes | 8 (new quote, line items, rack config, tax, currency, send) |
| CRM | 7 (pipeline, add opp, log activity, follow-ups, scores, forecast) |
| Receiving Kiosk | 6 (customer combo, parts combo, qty, notes, confirm) |
| Pending Job Queue | 8 (shipment review, drawings, critical surfaces, paint, release) |
| Jobs | 8 (status flow, new job, phases, materials, rack config, QC) |
| Scheduling | 6 (kanban, drag, calendar, batch, floor display) |
| Inventory | 5 (stock list, transactions, reorder, lot tracking) |
| Quality | 7 (inspections, NCR, cure logs, bath logs, certificates, mil readings) |
| Shipping | 5 (new shipment, carrier, tracking, weight, logistics) |
| Invoicing | 5 (new invoice, status, payments, overdue, currency) |
| Equipment | 5 (cards, add/edit, archive, spare parts, status) |
| Maintenance | 8 (dashboard, WO lifecycle, PM schedule, labor, parts, analytics) |
| Work Instructions | 5 (list, detail, QMS header, builder, deep-links) |
| HR | 4 (employees, time, kiosk) |
| Reports | 4 (report types, date filter, export) |
| Costing | 4 (job costs, margin, quoted vs actual) |
| Logistics | 4 (routes, run sheets, drivers) |
| EOS | 5 (rocks, scorecard, issues, L10) |
| Alerts | 4 (categories, severity, dismiss, bell) |
| Admin Console | 6 (users, audit, roles, backups, security, QB) |

---

## Implementation Order

1. Build `GuidedTour.tsx` + `GuidedTourButton.tsx` components
2. Enhance Help Center: add Getting Started section + new tutorials
3. Add tour definitions to each module (data-tour attributes + step arrays)
4. Add `GuidedTourButton` next to `WorkflowHelp` on each page
5. TypeScript check + visual QA on all modules
