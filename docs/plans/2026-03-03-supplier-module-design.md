# Supplier Module Design

**Date**: 2026-03-03
**Status**: Approved

---

## Goal

Build a comprehensive Supplier Hub that centralizes all vendor information, purchase orders, performance tracking, pricing history, and compliance documents — with deep cross-module integration throughout the ERP.

---

## Architecture

### New Route: `/suppliers`

**5 Tabs**: Directory | Purchase Orders | Scorecard | Price Book | Documents

### Tab 1: Directory

- Supplier cards with status badge, type tag (supplier/contractor/freight/broker/utility), contact info, spend YTD
- Full CRUD using existing `Vendor` type (already has tax/customs/payment fields from session 8)
- Quick filters: by type, status, country
- Search across name, account number, tags
- Reverse lookup: which inventory items + spare parts this vendor supplies
- RBAC: Add/Edit = manager+, Delete/Archive = admin only

### Tab 2: Purchase Orders

- PO lifecycle: Draft -> Sent -> Acknowledged -> Partially Received -> Received -> Closed (or Cancelled)
- Create PO: select vendor -> add line items from inventory catalog (auto-fills last price)
- Fields: PO number (auto-generated PO-YYYY-NNNN), expected delivery date, shipping method, tracking, notes
- Receive against PO: operator marks items received with actual qty -> auto-increments inventory `quantityOnHand` + creates `InventoryTransaction`
- PO history per vendor with total spend
- RBAC: Create/Edit = manager+, Approve/Close = manager+, Delete = admin only

### Tab 3: Scorecard

Auto-calculated metrics per vendor (rolling 12 months):
- **On-time delivery rate**: % of POs received by expected date
- **Quality rate**: % of received items passing QC (linked via powder lot -> job -> QC inspection)
- **Price stability**: coefficient of variation of unit prices
- **Lead time average**: days from PO sent to received
- **Responsiveness**: days from PO sent to acknowledged
- Overall weighted score (0-100) with letter grade (A/B/C/D/F)
- Trend sparklines per metric
- Comparison view: side-by-side scorecard of 2-3 vendors

### Tab 4: Price Book

- Historical pricing per item per vendor (every PO line item logs a price point)
- Price trend chart per item (line chart, rolling 12 months)
- Cross-vendor comparison table for same inventory item
- "Best Price" indicator per item
- Price alert: flag when vendor price exceeds average by >10%

### Tab 5: Documents

- Upload and track vendor documents
- Categories: Tax (W-9, W-8BEN-E), Insurance, Compliance, Contract, SDS, Other
- Expiration date tracking with auto-alerts in Alert Center
- Document viewer inline (PDF/image preview)
- RBAC: Upload/Edit = manager+, Delete = admin only

---

## New Types

```typescript
// Purchase Order
type POStatus = 'draft' | 'sent' | 'acknowledged' | 'partial' | 'received' | 'closed' | 'cancelled';

interface POLineItem {
  id: string;
  inventoryItemId?: string;
  sparePartId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  unit: string;   // 'kg', 'ea', 'L', 'box', 'set'
}

interface PurchaseOrder {
  id: string;
  poNumber: string;           // PO-2026-0001
  vendorId: string;
  status: POStatus;
  lineItems: POLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: Currency;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Vendor Document
type VendorDocCategory = 'tax' | 'insurance' | 'compliance' | 'contract' | 'sds' | 'other';

interface VendorDocument {
  id: string;
  vendorId: string;
  name: string;
  category: VendorDocCategory;
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  expiresAt?: string;
  uploadedBy?: string;
  uploadedAt: string;
  notes?: string;
}

// Vendor Scorecard (computed, not stored)
interface VendorScorecard {
  vendorId: string;
  onTimeDeliveryRate: number;   // 0-100
  qualityRate: number;          // 0-100
  priceStability: number;       // 0-100 (100 = no variance)
  avgLeadTimeDays: number;
  responsivenessScore: number;  // 0-100
  overallScore: number;         // weighted average
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// Price Book Entry (derived from PO line items)
interface PricePoint {
  vendorId: string;
  inventoryItemId?: string;
  sparePartId?: string;
  unitPrice: number;
  currency: Currency;
  date: string;
  poId: string;
}
```

---

## AppState Extensions

```typescript
// New slices
state.purchaseOrders    // PurchaseOrder[]
state.vendorDocuments   // VendorDocument[]

// New action types
ADD_PURCHASE_ORDER | UPDATE_PURCHASE_ORDER | DELETE_PURCHASE_ORDER
ADD_VENDOR_DOCUMENT | UPDATE_VENDOR_DOCUMENT | DELETE_VENDOR_DOCUMENT
ADD_VENDOR | UPDATE_VENDOR | ARCHIVE_VENDOR  (ADD_VENDOR already exists from session 8)
```

---

## Cross-Module Integration

### Inventory -> Supplier
- InventoryItem detail shows "Supplied by: [Vendor Name]" with last price, lead time
- "Reorder" button pre-fills a new PO for that vendor with the item

### Maintenance -> Supplier
- Spare parts link to vendor via `vendorId`
- When WO uses a part, cost flows to vendor YTD spend
- "Reorder" button on low-stock spare parts creates PO

### Equipment -> Supplier
- Equipment cards show manufacturer/service vendor
- Link to vendor record for service contact info

### Quality -> Supplier
- QC failures on powder lot trace to vendor scorecard quality metric
- Vendor quality rate auto-degrades when lots fail inspection

### Alert Center
- New "Supplier" alert category:
  - Expiring vendor documents (30/14/7 day warnings)
  - Overdue POs (past expected delivery date)
  - Low vendor scores (grade D or F)
  - Vendor with no PO activity in 90+ days (stale relationship)

### Jobs -> Supplier
- Job costing breakdown shows material costs by vendor

### Dashboard
- "Supplier Health" widget:
  - Top 5 vendors by YTD spend
  - Vendors with expiring docs (next 30 days)
  - Open PO count + value
  - Lowest-scoring vendor

---

## Implementation Order

1. Add new types to `types/index.ts`
2. Add state slices + actions to `AppContext.tsx`
3. Build Suppliers.tsx component with all 5 tabs
4. Add mock data for POs, documents, scorecards
5. Wire cross-module integrations (inventory, maintenance, equipment links)
6. Add supplier alerts to Alert Center
7. Add dashboard widget
8. Add route + sidebar entry
9. TypeScript check + visual QA
