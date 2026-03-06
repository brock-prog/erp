# Implementation Plan — Session 15

**Date**: 2026-03-03

---

## This Session: Walkthroughs & Guided Tours

### Step 1: Build GuidedTour component
- Create `src/components/ui/GuidedTour.tsx`
- Spotlight overlay with SVG mask cutout
- Tooltip card with why/what/step counter
- Navigation: Back / Next / Skip / Finish
- ESC to close
- `GuidedTourButton` export (play icon, sits next to WorkflowHelp `?`)
- Export `TourStep` type

### Step 2: Enhance Help Center — Getting Started section
- Add "Sample Job Walkthrough" narrative section at top of HelpCenter
- 11 chapter cards following Smith Railing Job through all modules
- Each chapter has "Pro Tip: Commercial Job" callout for Apex Glazing scenario
- Link each chapter to its module tutorial below

### Step 3: Add missing module tutorials to Help Center
- Equipment & Asset Registry
- Maintenance & Work Orders (CMMS)
- Work Instructions
- HR & Time Tracking
- Logistics & Delivery
- Costing & Margin Analysis
- Receiving Kiosk (operator)
- Pending Job Queue (detailed)
- Customer Portal
- Settings & Preferences

### Step 4: Enhance existing tutorials with scenario context
- Add `scenario` field to each existing tutorial tying it to the Smith Railing narrative
- Add `proTip` callouts for commercial job differences
- Add `keyField` and `whyItMatters` to critical steps

### Step 5: Add tour definitions to each page
- Add `data-tour="xxx"` attributes to key elements across all modules
- Define `PAGE_TOUR: TourStep[]` arrays in each component
- Add `GuidedTourButton` next to existing `WorkflowHelp` buttons

### Step 6: TypeScript check + visual QA
- Run tsc --noEmit
- Preview each module to verify tours work
- Test Help Center layout

---

## Next Session: Supplier Module

(Deferred — full design in supplier-module-design.md)

1. Add PurchaseOrder, VendorDocument types
2. Add state slices + actions
3. Build Suppliers.tsx (5 tabs)
4. Mock data
5. Cross-module integration
6. Alert Center supplier category
7. Dashboard widget

---

## Future Session: Netlify Deployment

1. netlify.toml config
2. Production build test
3. Staging deploy
4. Custom domain + SSL
5. Go-live checklist
