// ─── Shared ──────────────────────────────────────────────────────────────────

export type Status =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'on_hold'
  | 'archived';

export type Priority = 'low' | 'normal' | 'high' | 'rush';

// ─── User / Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'operator' | 'sales' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Built-in role id OR a custom role id (prefixed 'role-') */
  customRoleId?: string;
  department: string;
  avatarInitials: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

/**
 * A manager-defined custom role.  Permission level is capped at the creator's
 * own ROLE_LEVEL — a manager (level 2) cannot grant level-1 (admin) privileges.
 */
export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  /** Numeric privilege level this role sits at (1=admin … 5=viewer). Enforced by UI. */
  level: number;
  /** List of privilege IDs explicitly enabled (from the PRIVILEGES matrix). */
  grantedPrivileges: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer ────────────────────────────────────────────────────────────────

export type CustomerType = 'commercial' | 'industrial' | 'retail' | 'government' | 'wholesale';

export interface CustomerContact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  status: 'active' | 'inactive' | 'prospect';
  accountNumber: string;
  taxExempt: boolean;
  taxId?: string;
  creditLimit: number;
  currentBalance: number;
  paymentTerms: string;
  currency?: CustomerCurrency; // CAD or USD (defaults to CAD)
  contacts: CustomerContact[];
  billingAddress: Address;
  shippingAddress: Address;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Metrics
  totalRevenue: number;
  jobCount: number;
  avgJobValue: number;
  // ── International / Tax ────────────────────────────────────────────────────
  /** Pre-computed tax jurisdiction (auto-inferred from billing address if not set) */
  taxJurisdiction?: TaxJurisdiction;
  /** Is this a registered business? Affects EU VAT reverse charge. */
  isB2B?: boolean;
  /** EU VAT registration number (e.g. DE123456789, GB123456789) */
  vatNumber?: string;
  /** US Employer Identification Number (for US B2B customers) */
  usEin?: string;
  /** GST/HST exemption certificate number (First Nations, diplomats, etc.) */
  exemptionCertNumber?: string;
  // ── QuickBooks Sync ────────────────────────────────────────────────────────
  /** QB Online customer ID (assigned by QBO after first sync) */
  qbCustomerId?: string;
  qbSyncedAt?: string;
  qbSyncStatus?: 'synced' | 'pending' | 'error' | 'never';
}

export interface Address {
  street: string;
  city: string;
  /** Province code (e.g. 'ON', 'BC') for CA, state abbreviation for US */
  state: string;
  /** Postal code (CA) or ZIP code (US) */
  zip: string;
  /** ISO 2-letter country code: 'CA', 'US', or other */
  country: string;
}

// ─── Quote ───────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  discount: number; // percentage
  serviceType: ServiceType;
  notes?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  status: QuoteStatus;
  priority: Priority;
  createdBy: string;
  assignedTo?: string;
  issueDate: string;
  expiryDate: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountAmount: number;
  /** GST rate (e.g. 0.05) */
  gstRate?: number;
  /** PST/QST rate (e.g. 0.08 for ON PST portion of HST) */
  pstRate?: number;
  /** Legacy — total combined tax rate for display */
  taxRate: number;
  taxAmount: number;
  total: number;
  currency?: CustomerCurrency;
  /** Province/state where goods are delivered — drives tax calculation */
  deliveryProvince?: string;
  /** Manual tax override (admin can override calculated rates) */
  taxOverride?: boolean;
  /** Powder coating rack/line config for this quote */
  rackConfig?: PowderCoatingRackConfig;
  notes?: string;
  internalNotes?: string;
  convertedToJobId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Job / Work Order ────────────────────────────────────────────────────────

export type ServiceType = 'powder_coating' | 'sublimation' | 'both' | 'other';
export type JobStatus =
  | 'quote'
  | 'received'
  | 'prep'
  | 'blast'
  | 'rack'
  | 'pretreat'
  | 'coat'
  | 'cure'
  | 'qc'
  | 'unrack'
  | 'awaiting_sublimation'   // powder coat complete; stored, waiting for sub phase
  | 'shipping'
  | 'complete'
  | 'on_hold'
  | 'cancelled';

export type SubJobStatus =
  | 'queued'
  | 'design'
  | 'printing'
  | 'pressing'
  | 'qc'
  | 'packaging'
  | 'complete'
  | 'on_hold';

export interface JobPart {
  id: string;
  description: string;
  material: string;
  quantity: number;
  weight?: number; // lbs
  dimensions?: string;
  partNumber?: string;
  color?: string;
  finish?: string;
  specialInstructions?: string;
}

export interface PowderCoatingSpec {
  powderManufacturer: string;
  powderProduct: string;
  colorCode: string;
  colorName: string;
  finish: 'gloss' | 'semi-gloss' | 'satin' | 'matte' | 'flat' | 'textured' | 'metallic' | 'candy' | 'chrome';
  mil: number; // target film thickness
  cure: {
    tempF: number;
    minutes: number;
  };
  pretreatment: PretreatmentStep[];
  substrate: string;
  rackId?: string;
  batchId?: string;
  ovenId?: string;
  maskingRequired: boolean;
  maskingNotes?: string;
  sandblastRequired: boolean;
  chemicalWashRequired: boolean;
}

export type PretreatmentStep =
  | 'degreasing'
  | 'iron_phosphate'
  | 'zinc_phosphate'
  | 'sandblast'
  | 'chemical_strip'
  | 'rinse'
  | 'sealer';

export interface SublimationSpec {
  substrate: string;
  substrateColor: string;
  heatPressId?: string;
  tempF: number;
  pressureLevel: 'light' | 'medium' | 'heavy';
  seconds: number;
  paperType: string;
  inkProfile: string;
  designFileRef?: string;
  proofApproved: boolean;
  artworkNotes?: string;
}

// ─── Multi-material & Two-phase Production ────────────────────────────────────

export type MaterialType = 'paint' | 'sublimation_film' | 'consumable';
export type JobPhaseType = 'powder_coating' | 'sublimation' | 'assembly' | 'packaging';
export type JobPhaseStatus = 'pending' | 'in_progress' | 'complete' | 'skipped';

/**
 * A required material for a job — must be confirmed "on-hand" before scheduling.
 * Links to an InventoryItem so stock can be checked live.
 */
export interface MaterialRequirement {
  id: string;
  type: MaterialType;
  inventoryItemId?: string;  // link to InventoryItem for live stock check
  itemName: string;          // display name (even if no inventory link)
  quantityRequired: number;
  unit: 'kg' | 'm' | 'm2' | 'L' | 'pcs';
  /** Operator sets this to true once they physically confirm the material is pulled */
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

/**
 * An ordered production phase within a job.
 * Two-phase example: [{type:'powder_coating'}, {type:'sublimation'}]
 */
export interface JobPhase {
  type: JobPhaseType;
  status: JobPhaseStatus;
  startedAt?: string;
  completedAt?: string;
  assignedOperator?: string;
  notes?: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  quoteId?: string;
  customerId: string;
  customerName: string;
  poNumber?: string;
  serviceType: ServiceType;
  status: JobStatus;
  subStatus?: SubJobStatus; // for sublimation jobs
  priority: Priority;
  parts: JobPart[];
  powderSpec?: PowderCoatingSpec;
  sublimationSpec?: SublimationSpec;
  /** Rack/line config as quoted — set when job is created from quote */
  quotedRackConfig?: PowderCoatingRackConfig;
  /** Rack/line config as actually run — filled in during/after production */
  actualRackConfig?: PowderCoatingRackConfig;
  /** Part count from quote */
  quotedParts?: number;
  /** Actual parts processed */
  actualParts?: number;
  complianceStandards?: ComplianceStandard[]; // standards this job must meet
  dueDate: string;
  receivedDate: string;
  startDate?: string;
  completedDate?: string;
  estimatedHours: number;
  actualHours?: number;
  assignedOperator?: string;
  qcInspector?: string;
  qcPassed?: boolean;
  qcNotes?: string;
  laborCost: number;
  materialCost: number;
  totalCost: number;
  salePrice: number;
  margin?: number;
  notes?: string;
  internalNotes?: string;
  attachments: string[];
  statusHistory: JobStatusEvent[];
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
  /** Ordered production phases (powder_coating → sublimation, etc.) */
  phases?: JobPhase[];
  /** Active phase index within phases[] */
  currentPhaseIndex?: number;
  /** Materials that must be confirmed on-hand before scheduling */
  materialRequirements?: MaterialRequirement[];
  /** True once all materialRequirements are confirmed — gates scheduling */
  materialsReadyForScheduling?: boolean;
  // ── SAT Vertical Line / VISICOAT ──────────────────────────────────────────
  /** Barcode / QR code scanned at SAT loading station to link batch to this job */
  satBatchCode?: string;
  /** RAL colour code for this job (e.g. "9016") */
  ralCode?: string;
  /** Powder finish characteristic pushed to VISICOAT recipe selector */
  powderCharacteristic?: PowderCharacteristic;
  /** Selected VISICOAT recipe to auto-apply on the SAT line */
  visicoatRecipeId?: string;
  /** SATBatchLog.id — populated after batch data is imported from SAT */
  satBatchLogId?: string;
}

export interface JobStatusEvent {
  status: JobStatus | SubJobStatus;
  timestamp: string;
  userId: string;
  userName: string;
  notes?: string;
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export type EquipmentType =
  | 'horizontal_powder_line'
  | 'batch_powder_line'
  | 'vertical_powder_line'
  | 'extrusion_sublimation'
  | 'panel_sublimation_oven'
  | 'oven'
  | 'heat_press'
  | 'blast_cabinet'
  | 'washer'
  | 'spray_booth'
  | 'compressor'
  | 'other';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  model?: string;
  serialNumber?: string;
  status: 'operational' | 'maintenance' | 'down' | 'retired';
  capacity: string;
  location: string;
  maxTempF?: number;
  maxPressure?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
}

export interface Rack {
  id: string;
  name: string;
  capacity: number; // sq ft
  usedCapacity: number;
  status: 'available' | 'in_use' | 'maintenance';
  currentJobIds: string[];
  location: string;
  cycleCount?: number;          // number of coating runs since last strip
  lastStrippedAt?: string;      // ISO date; powder build-up requires strip every ~10 cycles
  stripDueAtCycles?: number;    // alert threshold (default 10)
  notes?: string;
}

export interface Batch {
  id: string;
  batchNumber: string;
  ovenId: string;
  ovenName: string;
  jobIds: string[];
  colorCode: string;
  colorName: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'scheduled' | 'loading' | 'curing' | 'cooling' | 'complete' | 'cancelled';
  cure: {
    tempF: number;
    minutes: number;
  };
  powderLotNumber?: string;    // lot number of powder used in this batch
  ovenCureLogId?: string;      // link to the actual cure profile recorded
  operatorId?: string;
  operatorName?: string;
  notes?: string;
  createdAt: string;
}

export interface ScheduleSlot {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: EquipmentType;
  jobId?: string;
  batchId?: string;
  title: string;
  start: string;
  end: string;
  color?: string;
  status: 'scheduled' | 'in_progress' | 'complete' | 'cancelled';
  notes?: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryCategory =
  | 'powder'
  | 'chemical'
  | 'sublimation_ink'
  | 'transfer_paper'
  | 'substrate'
  | 'packaging'
  | 'consumable'
  | 'equipment_part';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  manufacturer?: string;
  partNumber?: string;
  unit: string; // lbs, gal, sheets, each, etc.
  quantityOnHand: number;
  quantityAllocated: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  location: string;
  supplier?: string;
  supplierPartNumber?: string;
  leadTimeDays?: number;
  lastReceivedDate?: string;
  lastUsedDate?: string;
  active: boolean;
  notes?: string;
  // Powder-specific
  colorCode?: string;
  colorHex?: string;
  finish?: string;
  substrate?: string; // for sublimation substrates
  // Lot traceability
  lotNumber?: string;              // manufacturer lot / batch number on packaging
  lotManufactureDate?: string;     // ISO date from CoA / label
  // ── Customs / import ────────────────────────────────────────────────────
  /** Harmonized System tariff code — needed for commercial invoices */
  hsCode?: string;
  /** Country where item was manufactured (for CUSMA / USMCA) */
  countryOfOrigin?: string;
  /** Linked vendor ID */
  vendorId?: string;
  // ── QB sync ──────────────────────────────────────────────────────────────
  qbItemId?: string;
  qbSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: 'received' | 'consumed' | 'allocated' | 'released' | 'adjustment' | 'return';
  quantity: number; // positive = in, negative = out
  balanceBefore: number;
  balanceAfter: number;
  jobId?: string;
  jobNumber?: string;
  referenceNumber?: string;
  userId: string;
  userName: string;
  notes?: string;
  // Barcode/scan extensions
  weightLbs?: number;          // actual weighed quantity (powder, film)
  weightUnit?: 'lbs' | 'oz';
  scanSource?: 'manual' | 'barcode_scan';
  locationAssigned?: string;   // storage location (for received items)
  // Lot traceability
  lotNumber?: string;          // links to InventoryItem.lotNumber
  createdAt: string;
}

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'acknowledged' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;            // link to Vendor
  supplier: string;            // display name (denormalized)
  status: PurchaseOrderStatus;
  lineItems: POLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  submittedDate?: string;
  expectedDelivery?: string;
  receivedDate?: string;
  // Approval
  approvedBy?: string;         // user ID
  approvedAt?: string;
  approvalNotes?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface POLineItem {
  id: string;
  itemId?: string;             // optional — can be free-text item
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  receivedQty: number;
}

// ─── Vendor Bills (Accounts Payable) ──────────────────────────────────────────

export type VendorBillStatus = 'draft' | 'received' | 'matched' | 'approved' | 'paid' | 'disputed';

export interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  purchaseOrderId?: string;    // link to PO (optional — bill can be standalone)
  poNumber?: string;           // display (denormalized)
  status: VendorBillStatus;
  billDate: string;
  dueDate: string;
  amount: number;
  tax: number;
  totalDue: number;
  // Payment tracking
  paidAmount: number;
  paidDate?: string;
  paymentMethod?: 'cheque' | 'eft' | 'wire' | 'credit_card' | 'ach';
  paymentReference?: string;   // cheque # or EFT ref
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Quality Control ──────────────────────────────────────────────────────────

export type InspectionResult = 'pass' | 'fail' | 'conditional';
export type DefectType =
  | 'runs'
  | 'sags'
  | 'fish_eyes'
  | 'orange_peel'
  | 'contamination'
  | 'improper_coverage'
  | 'adhesion_failure'
  | 'color_mismatch'
  | 'mil_out_of_spec'
  | 'bleed_through'
  | 'fading'
  | 'ghosting'
  | 'substrate_damage'
  | 'other';

export interface QCInspection {
  id: string;
  jobId: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  serviceType: ServiceType;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: string;
  result: InspectionResult;
  // Powder coating tests
  adhesionTest?: 'pass' | 'fail';
  milThickness?: number;         // legacy single-reading (µm); prefer milReadings[]
  milSpec?: number;              // target DFT in µm
  milReadings?: MilThicknessReading[]; // multi-point per ISO 2360 / ASTM D7091
  gloss?: number;
  glossSpec?: number;
  // Visual
  visualInspection: InspectionResult;
  defects: DefectRecord[];
  reworkRequired: boolean;
  reworkNotes?: string;
  signOff?: string;
  notes?: string;
  photos: string[];
  // Compliance
  complianceStandards?: ComplianceStandard[];
  cocId?: string;                // CoC generated from this inspection
  createdAt: string;
}

export interface DefectRecord {
  id: string;
  type: DefectType;
  severity: 'minor' | 'major' | 'critical';
  location: string;
  description: string;
  resolved: boolean;
  resolution?: string;
}

// ─── Invoice / Billing ────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void' | 'writeoff';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  amount: number;
  jobId?: string;
  jobNumber?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  jobIds: string[];
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  payments: Payment[];
  notes?: string;
  internalNotes?: string;
  sentDate?: string;
  paidDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'check' | 'ach' | 'credit_card' | 'cash' | 'wire' | 'other';
  referenceNumber?: string;
  receivedDate: string;
  postedBy: string;
  notes?: string;
  createdAt: string;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export type MaintenanceType = 'preventive' | 'corrective' | 'emergency' | 'calibration' | 'inspection';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'complete' | 'overdue' | 'cancelled';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export interface LaborEntry {
  id: string;
  userId?: string;
  technicianName: string;
  date: string;           // ISO date YYYY-MM-DD
  hoursWorked: number;
  hourlyRate: number;     // CAD/hr
  notes?: string;
}

export interface MaintenancePart {
  id: string;
  sparePartId?: string;   // links to SparePart.id — enables inventory deduction + auto-fill
  partNumber?: string;
  description: string;
  quantity: number;
  unitCost: number;
  confirmedUsed?: boolean;       // operator confirmed part was installed & old part disposed
  disposalConfirmedAt?: string;  // ISO timestamp of confirmation
}

export interface MaintenanceChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface MaintenanceTask {
  id: string;
  taskNumber: string;
  equipmentId: string;
  equipmentName: string;
  type: MaintenanceType;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  scheduledDate: string;
  completedDate?: string;
  estimatedHours: number;
  actualHours?: number;
  assignedToId?: string;
  assignedToName?: string;
  parts: MaintenancePart[];
  laborCost: number;
  partsCost: number;
  checklist: MaintenanceChecklistItem[];
  nextScheduledDate?: string;
  recurrenceIntervalDays?: number;
  downtimeHours?: number;
  laborEntries?: LaborEntry[];        // per-technician time records — laborCost = Σ(h×rate)
  workInstructionId?: string;         // optional link to a WorkInstruction
  completionNotes?: string;           // separate from general notes; filled on completion
  notes?: string;
  photos?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── NCR (Non-Conformance Report) ─────────────────────────────────────────────

export type NCRStatus = 'open' | 'under_investigation' | 'corrective_action' | 'verification' | 'closed';
export type NCRSeverity = 'minor' | 'major' | 'critical';

export interface NCR {
  id: string;
  ncrNumber: string;
  title: string;
  description: string;
  status: NCRStatus;
  severity: NCRSeverity;
  jobId?: string;
  jobNumber?: string;
  customerId?: string;
  customerName?: string;
  qcInspectionId?: string;
  lineId?: string;
  lineName?: string;
  dateRaised: string;
  raisedById: string;
  raisedByName: string;
  assignedToId?: string;
  assignedToName?: string;
  dueDate?: string;
  partsAffected: number;
  costImpact?: number;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  closedDate?: string;
  closedByName?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Shipping ──────────────────────────────────────────────────────────────────

export type ShipmentStatus = 'pending' | 'packing' | 'ready' | 'picked_up' | 'in_transit' | 'delivered' | 'exception' | 'cancelled';
export type CarrierType = 'fedex' | 'ups' | 'usps' | 'freight' | 'customer_pickup' | 'own_truck' | 'other';

export interface PackingItem {
  id: string;
  jobId: string;
  jobNumber: string;
  description: string;
  partCount: number;
  weight?: number;
  boxCount: number;
  notes?: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  customerId: string;
  customerName: string;
  jobIds: string[];
  packingList: PackingItem[];
  carrier: CarrierType;
  serviceLevel?: string;
  trackingNumber?: string;
  bolNumber?: string;
  shipDate?: string;
  estimatedDelivery?: string;
  deliveredDate?: string;
  deliveryAddress: Address;
  totalWeight?: number;
  totalBoxes: number;
  declaredValue?: number;
  shippingCost?: number;
  billToCustomer: boolean;
  specialInstructions?: string;
  signedBy?: string;
  driverName?: string;
  truckNumber?: string;
  driverSignature?: string;   // base64 PNG from SignaturePad
  bolSignedAt?: string;       // ISO timestamp when BOL was confirmed
  photos?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Receiving ────────────────────────────────────────────────────────────────

export type ReceiptType = 'customer_material' | 'raw_material' | 'purchase_order' | 'return';
export type ReceiptStatus = 'expected' | 'received' | 'inspecting' | 'accepted' | 'discrepancy' | 'rejected';

export interface ReceiptItem {
  id: string;
  description: string;
  inventoryItemId?: string;
  partNumber?: string;
  quantityExpected?: number;
  quantityReceived: number;
  unit: string;
  unitCost?: number;
  condition: 'good' | 'damaged' | 'mixed';
  notes?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  type: ReceiptType;
  status: ReceiptStatus;
  vendorName?: string;
  customerId?: string;
  customerName?: string;
  jobId?: string;
  jobNumber?: string;
  poNumber?: string;
  carrierName?: string;
  trackingNumber?: string;
  bolNumber?: string;
  expectedDate?: string;
  receivedDate: string;
  acceptedDate?: string;
  receivedById: string;
  receivedByName: string;
  items: ReceiptItem[];
  overallCondition: 'good' | 'damaged' | 'mixed';
  inspectionNotes?: string;
  totalValue?: number;
  notes?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Equipment / Asset Management ─────────────────────────────────────────────

export type SparePartCriticality = 'critical' | 'high' | 'normal' | 'low';

export interface SparePart {
  id: string;
  equipmentId: string;
  equipmentName: string;
  partNumber: string;
  description: string;
  manufacturer?: string;
  supplierId?: string;
  supplierName?: string;
  leadTimeDays?: number;
  unitCost: number;         // CAD
  priceEUR?: number;        // original EUR quote price per unit
  eurCadRate?: number;      // exchange rate used at purchase
  quantityOnHand: number;
  reorderPoint: number;
  drawingRef?: string;
  criticality: SparePartCriticality;
  location?: string;        // shelf / bin
  satSection?: string;      // SAT machine section
  satLineNumber?: number;   // SAT offer line number
  unitMeasure?: string;     // PZ, MT, NR
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Custom Dropdowns (Admin-managed) ─────────────────────────────────────────

export interface DropdownItem {
  id: string;
  label: string;   // display text
  value: string;   // stored value
  active: boolean;
  sortOrder: number;
}

export interface DropdownList {
  id: string;
  name: string;           // e.g. "Finish Types"
  description?: string;
  systemKey: string;      // unique key used in components, e.g. 'finishTypes'
  items: DropdownItem[];
}

export type WorkInstructionType = 'assembly' | 'operation' | 'maintenance' | 'safety' | 'calibration';

export type SupportedLanguage = 'en' | 'fr' | 'es' | 'pt' | 'tl';

export interface StepTranslation {
  description: string;
  warning?: string;
  trainingNote?: string;
}

export interface WorkInstructionStep {
  id: string;
  stepNumber: number;
  description: string;
  warning?: string;
  imageRef?: string;
  /** Direct image URL or base64 data URI */
  imageUrl?: string;
  /** YouTube / Vimeo URL or direct MP4 URL */
  videoUrl?: string;
  /** Training callout shown to new operators */
  trainingNote?: string;
  /** Translations keyed by language code */
  translations?: Partial<Record<SupportedLanguage, StepTranslation>>;
}

export interface WorkInstruction {
  id: string;
  equipmentId?: string;
  equipmentName?: string;
  department?: string;
  title: string;
  type: WorkInstructionType;
  revision: string;
  description: string;
  steps: WorkInstructionStep[];
  estimatedMinutes?: number;
  requiredTools?: string[];
  requiredPPE?: string[];
  /** Translations for the title + description */
  translations?: Partial<Record<SupportedLanguage, { title: string; description: string }>>;
  /** Tag which job stage this instruction applies to */
  jobStages?: string[];
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  // ── ISO 9001:2015 §7.5 Document Control fields ──────────────────────────────
  /** Controlled document number, e.g. "WI-CM40-001" */
  documentNumber?: string;
  /** Purpose / objective statement (1-2 sentences) */
  purpose?: string;
  /** Scope — who it applies to and which equipment/processes */
  scope?: string;
  /** Referenced standards or documents, e.g. "GEMA Doc 1011 534 EN Rev.01" */
  referencedDocuments?: string[];
  /** Role responsible for executing this instruction, e.g. "Maintenance Technician" */
  responsibleRole?: string;
  /** ISO date string — when this revision became effective */
  effectiveDate?: string;
  /** Who issued/released this revision (may differ from approvedBy) */
  issuedBy?: string;
}

export type SupplierCategory = 'parts' | 'consumables' | 'services' | 'raw_material' | 'chemicals' | 'other';

export interface CriticalSupplier {
  id: string;
  name: string;
  accountNumber?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: Address;
  category: SupplierCategory;
  leadTimeDays?: number;
  paymentTerms?: string;
  rating: number; // 1–5
  certifications: string[];
  notes?: string;
  critical: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── HR ───────────────────────────────────────────────────────────────────────

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'seasonal';
export type PayType = 'hourly' | 'salary';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  department: string;
  position: string;
  hireDate: string;
  terminationDate?: string;
  birthDate?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  payType: PayType;
  payRate: number; // hourly rate or annual salary
  overtimeEligible: boolean;
  certifications: string[];
  skills: string[];
  notes?: string;
  avatarInitials: string;
  createdAt: string;
  updatedAt: string;
  // ADP Workforce Now integration
  adpAoid?: string;                 // ADP Associate OID — primary ADP identifier per worker
  adpLastSync?: string;             // ISO timestamp of last successful ADP sync
  adpSyncStatus?: 'synced' | 'pending' | 'error' | 'not_linked';
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'pto' | 'sick' | 'holiday';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes: number;
  totalHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
  // ADP payroll submission tracking
  adpTimecardId?: string;           // ADP timecard ID after successful submission
  adpSubmitted?: boolean;           // Whether this punch was pushed to ADP payroll
  adpSubmittedAt?: string;          // ISO timestamp of ADP submission
  jobCostingRef?: string;           // Work order reference for labor costing (e.g. "WO-2026-0104")
}

export type TrainingCategory = 'safety' | 'equipment' | 'quality' | 'hr_compliance' | 'technical' | 'leadership' | 'other';
export type TrainingStatus = 'scheduled' | 'in_progress' | 'completed' | 'expired' | 'waived';

export interface TrainingRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  trainingTitle: string;
  category: TrainingCategory;
  provider?: string;
  deliveryMethod: 'classroom' | 'online' | 'on_the_job' | 'external';
  scheduledDate?: string;
  completedDate?: string;
  expiryDate?: string;
  durationHours?: number;
  score?: number;
  passed: boolean;
  status: TrainingStatus;
  certificateRef?: string;
  notes?: string;
  createdAt: string;
}

// ─── Barcode / Scan System ────────────────────────────────────────────────────

export type BarcodeLabelType = 'inventory_item' | 'received_goods' | 'outbound_shipment' | 'job_traveler';

export interface BarcodeLabel {
  type: BarcodeLabelType;
  code: string; // value encoded in barcode, e.g. "INV:inv01"
  line1: string;
  line2?: string;
  line3?: string;
  colorSwatch?: string; // hex color for powder labels
  quantity?: string; // e.g. "50 lbs" for inventory labels
}

export type ScanAction =
  | 'receive_inventory'
  | 'consume_material'
  | 'ship_pickup'
  | 'lookup_item'
  | 'lookup_job'
  | 'create_job_order';

export interface ScanEvent {
  id: string;
  action: ScanAction;
  scannedCode: string;
  resolvedEntityId?: string;
  resolvedEntityType?: 'inventory' | 'job' | 'shipment' | 'receipt' | 'job_order';
  operatorId: string;
  operatorName: string;
  weightLbs?: number;
  jobId?: string;
  jobNumber?: string;
  locationAssigned?: string;
  notes?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

// ─── Job Order Queue ──────────────────────────────────────────────────────────

export type JobOrderStatus =
  | 'pending_review'    // scanned in, awaiting admin
  | 'materials_check'   // admin verifying materials
  | 'approved'          // sent to scheduling
  | 'rejected'          // rejected / returned
  | 'scheduled';        // now in scheduling

export interface JobOrderAttachment {
  id: string;
  name: string;
  type: 'drawing' | 'photo' | 'spec_sheet' | 'note' | 'other';
  fileRef: string; // URL or data URI
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface JobOrderMaterialCheck {
  inventoryItemId: string;
  itemName: string;
  colorCode?: string;
  requiredQty: number;
  availableQty: number;
  unit: string;
  confirmed: boolean;
}

export interface JobOrder {
  id: string;
  orderNumber: string; // JO-2026-0001
  status: JobOrderStatus;
  // Source
  scannedJobId?: string;       // if created by scanning an existing job
  scannedJobNumber?: string;
  customerId?: string;
  customerName?: string;
  // Parts info (entered/confirmed by receiver or admin)
  partDescription: string;
  partCount: number;
  serviceType: ServiceType;
  colorCode?: string;
  colorName?: string;
  finish?: string;
  notes?: string;
  // Material availability
  materialChecks: JobOrderMaterialCheck[];
  materialsConfirmed: boolean;
  // Admin review
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  adminNotes?: string;
  // Attachments (drawings, photos, spec sheets)
  attachments: JobOrderAttachment[];
  // Approval
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  // Scheduling outcome
  scheduledJobId?: string;     // job id after approval → scheduling
  priority: Priority;
  dueDate?: string;
  // Audit
  scannedById: string;
  scannedByName: string;
  receivedDate: string;
  createdAt: string;
  updatedAt: string;
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'lead'          // never purchased, initial contact
  | 'prospect'      // engaged, needs follow-up
  | 'quoted'        // active quote sent
  | 'negotiating'   // quote in discussion / revision
  | 'won'           // converted to job/order
  | 'lost'          // opportunity gone
  | 'inactive';     // past customer, no recent activity

export type ActivityType =
  | 'call' | 'email' | 'visit' | 'quote_sent'
  | 'order_placed' | 'payment_received' | 'note' | 'follow_up';

export interface CRMActivity {
  id: string;
  customerId: string;
  customerName: string;
  type: ActivityType;
  subject: string;
  notes?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
  nextAction?: string;
  nextActionDate?: string;
  linkedQuoteId?: string;
  linkedJobId?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface CRMOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  stage: PipelineStage;
  estimatedValue: number;
  probability: number;        // 0–100
  expectedCloseDate: string;
  serviceType: ServiceType;
  quoteId?: string;
  jobId?: string;
  assignedToId: string;
  assignedToName: string;
  source?: 'referral' | 'repeat' | 'cold_call' | 'web' | 'trade_show' | 'other';
  lostReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Auto-calculated customer health score (0–100) */
export interface CustomerScore {
  customerId: string;
  customerName: string;
  totalScore: number;       // 0-100
  revenueScore: number;     // 0-25  – lifetime value + growth trend
  frequencyScore: number;   // 0-20  – orders per 90 days
  paymentScore: number;     // 0-20  – payment speed/behavior
  marginScore: number;      // 0-20  – avg job margin quality
  loyaltyScore: number;     // 0-15  – relationship age + recency
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'prospect';
  lastOrderDate?: string;
  riskFlag?: 'overdue_balance' | 'declining_orders' | 'long_inactive';
  calculatedAt: string;
}

// ─── Logistics Scheduler ──────────────────────────────────────────────────────

export type LogisticsDirection = 'outbound' | 'inbound';
export type LogisticsStopStatus =
  | 'scheduled' | 'confirmed' | 'en_route' | 'arrived'
  | 'completed' | 'cancelled' | 'issue';

export interface LogisticsStop {
  id: string;
  direction: LogisticsDirection;
  scheduledDate: string;       // ISO date "YYYY-MM-DD"
  scheduledTime?: string;      // "HH:MM" 24-hr
  estimatedDuration?: number;  // minutes on site
  status: LogisticsStopStatus;
  // Linked records
  shipmentId?: string;
  shipmentNumber?: string;
  receiptId?: string;
  receiptNumber?: string;
  jobIds: string[];
  // Party info
  customerId?: string;
  customerName?: string;
  vendorName?: string;
  contactName?: string;
  contactPhone?: string;
  // Location
  address: string;
  city?: string;
  // Cargo details
  description: string;
  pieces?: number;
  weightLbs?: number;
  requiresLiftgate?: boolean;
  specialInstructions?: string;
  // Cross-department notes
  driverNotes?: string;
  receiverNotes?: string;
  dispatchNotes?: string;
  productionNotes?: string;
  // Confirmation timestamps
  confirmedByDriverAt?: string;
  confirmedByReceiverAt?: string;
  completedAt?: string;
  issueDescription?: string;
  // Metadata
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type RunSheetStatus = 'draft' | 'published' | 'in_progress' | 'complete';

export interface DriverRunSheet {
  id: string;
  date: string;             // "YYYY-MM-DD"
  driverName: string;
  vehicleName?: string;     // e.g. "Box Truck 1", "Flatbed"
  stopIds: string[];        // ordered list of LogisticsStop ids
  status: RunSheetStatus;
  startMileage?: number;
  endMileage?: number;
  dispatchNotes?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Workstation / Floor Timers ──────────────────────────────────────────────

export type WorkstationName =
  | 'blast'
  | 'pretreat'
  | 'coat'
  | 'cure'
  | 'qc'
  | 'unrack'
  | 'shipping'
  | 'design'
  | 'printing'
  | 'pressing'
  | 'packing';

export interface WorkstationSession {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  workstation: WorkstationName;
  equipmentId?: string;
  equipmentName?: string;
  operatorName: string;
  helpers?: string[];          // names of people assisting at this station
  startedAt: string;
  pausedAt?: string;
  endedAt?: string;
  durationMinutes?: number;  // calculated on end
  status: 'running' | 'paused' | 'completed' | 'abandoned';
  notes?: string;
  partsCompleted?: number;
  issueFlag?: string;
  createdAt: string;
}

// ─── Process Sessions (Receiving / Inspection / etc.) ─────────────────────────

export type ProcessType =
  | 'receiving'
  | 'incoming_inspection'
  | 'shipping_inspection';

export interface ProcessSession {
  id: string;
  processType: ProcessType;
  referenceId?: string;      // shipmentId, jobId, barcode, etc.
  referenceLabel?: string;   // human-readable label shown in reports
  operatorName: string;
  helpers: string[];
  startedAt: string;
  pausedAt?: string;
  endedAt?: string;
  totalMinutes?: number;     // net active time (excluding pauses)
  status: 'running' | 'paused' | 'completed' | 'abandoned';
  notes?: string;
  createdAt: string;
}

// ─── Advanced Costing ─────────────────────────────────────────────────────────

export type CostCategory = 'material' | 'labor' | 'overhead' | 'rework' | 'other';

export interface CostEntry {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  category: CostCategory;
  subcategory?: string;
  description: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;       // actual - planned (positive = over budget)
  variancePct: number;    // variance / planned * 100
  flagged: boolean;
  flagReason?: string;
  correctionAction?: string;
  correctionStatus?: 'open' | 'in_progress' | 'resolved';
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface OverheadRate {
  id: string;
  name: string;          // e.g. "Utilities", "Rent", "Insurance"
  category: string;
  monthlyAmount: number;
  allocationMethod: 'per_labor_hour' | 'per_job' | 'percentage_of_sale' | 'per_sq_ft';
  rate: number;          // computed allocation rate
  active: boolean;
  notes?: string;
}

// ─── Equipment Maintenance Schedules ─────────────────────────────────────────

export type MaintenanceScheduleStatus = 'ok' | 'due_soon' | 'overdue';

export interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  taskName: string;
  description?: string;
  responsibleRole?: 'operator' | 'maintenance'; // who performs this task
  intervalHours?: number;   // trigger every N operational hours
  intervalDays?: number;    // OR trigger every N calendar days
  currentHours: number;     // hours accumulated since last service (snapshot)
  lastServiceDate?: string;
  lastServiceHours?: number; // equipment runtime hours at last service
  nextDueDateCalc?: string; // calculated from intervalDays
  nextDueHours?: number;    // = lastServiceHours + intervalHours
  status: MaintenanceScheduleStatus;
  warnWithinHours?: number; // warn when this many hours remaining
  warnWithinDays?: number;
  assignedToId?: string;
  assignedToName?: string;
  notifyUserIds: string[];
  /** Optional link to a WorkInstruction for this PM schedule task */
  workInstructionId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Equipment Runtime Tracking ───────────────────────────────────────────────

export interface EquipmentRuntimeEntry {
  equipmentId: string;
  /** Total accumulated runtime hours (persisted) */
  runtimeHoursTotal: number;
  /** ISO timestamp when current run session started; undefined if stopped */
  runtimeSessionStart?: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface DashboardKPI {
  label: string;
  value: number | string;
  change?: number; // percent change vs prior period
  changeLabel?: string;
  prefix?: string;
  suffix?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'revert';
  entityType: string; // 'job' | 'quote' | 'invoice' | 'customer' | etc.
  entityId?: string;
  entityLabel?: string; // e.g. "WO-2026-0042" or "INV-2026-0088"
  details: string;      // human-readable summary
  before?: unknown;
  after?: unknown;
}

// ─── Powder Coating – Line & Rack Configuration ───────────────────────────────

export type LineType = 'horizontal_auto' | 'batch' | 'manual';

export type RackType =
  | 'standard_flat'
  | 'h_bar'
  | 'angle_rack'
  | 'tube_rack'
  | 'channel_rack'
  | 'z_bar'
  | 'wing_rack'
  | 'custom';

export type HookType =
  | 'standard_s_hook'
  | 'c_hook'
  | 'j_hook'
  | 'threaded_hook'
  | 'wire_hook'
  | 'heavy_duty_hook'
  | 'profile_clip'
  | 'double_hook';

export type SubstrateAlloy =
  | 'steel_mild'
  | 'steel_galvanized'
  | 'aluminum_6063'
  | 'aluminum_6061'
  | 'aluminum_5052'
  | 'aluminum_cast'
  | 'stainless_304'
  | 'stainless_316'
  | 'cast_iron'
  | 'other';

export interface PowderCoatingRackConfig {
  lineType: LineType;
  rackType: RackType;
  hookType: HookType;
  substrateAlloy: SubstrateAlloy;
  hooksPerRack: number;
  partsPerHook: number;
  totalParts: number;
  partsPerLoad: number;
  estimatedLoads: number;
  lineSpeedFtPerMin?: number; // horizontal auto line only
  runLengthFt?: number;       // horizontal auto line only
  estimatedRunTimeMinutes: number;
  maxPartLengthMm: number;
  maxPartWidthMm: number;
  maxPartWeightKg: number;
  notes?: string;
}

// Attach rack config to PowderCoatingSpec (optional on Job/Quote creation)
// Added as optional fields on Job itself for quoted vs actual comparison:
//   job.quotedRackConfig  — from quote
//   job.actualRackConfig  — filled in on completion
//   job.quotedParts       — parts count from quote
//   job.actualParts       — actual parts processed

// ─── Receiving / Intake Workflow ─────────────────────────────────────────────

export type ProductionLine =
  | 'vertical'       // GEMA Vertical Automatic Line
  | 'horizontal'     // Horizontal Automatic Line
  | 'batch'          // Batch Manual Line
  | 'sub-extrusion'  // Sublimation Extrusion Auto
  | 'sub-panel';     // Sublimation Panel Manual

export const PRODUCTION_LINE_LABELS: Record<ProductionLine, string> = {
  'vertical':      'Vertical Auto Line (GEMA)',
  'horizontal':    'Horizontal Auto Line',
  'batch':         'Batch Manual Line',
  'sub-extrusion': 'Sublimation – Extrusion Auto',
  'sub-panel':     'Sublimation – Panel Manual',
};

export type IncomingShipmentStatus =
  | 'received'             // logged at dock, awaiting admin review + release
  | 'awaiting_inspection'  // admin released it for QC inspection
  | 'passed'
  | 'failed'
  | 'returned';

export interface IncomingShipment {
  id: string;
  barcodeId: string;           // generated at receiving, follows job all the way through
  receivedAt: string;
  receivedBy: string;
  productionLine?: ProductionLine; // assigned at SCHEDULING, not inspection
  // Packing slip info
  customerName: string;
  customerId?: string;
  customerPO?: string;
  partDescription: string;
  quantity: number;
  rackCount?: number;
  weightLbs?: number;
  notes?: string;
  conditionNotes?: string;     // visual condition on arrival
  // Driver / delivery info
  driverName?: string;
  driverCompany?: string;
  // Photos taken at dock (base64 data URIs — in-memory only, not persisted)
  photos?: string[];
  // Staging
  stagingLocation?: string;    // e.g. "Rack A3", "Bay 2"
  // Admin review (before release for inspection)
  adminNotes?: string;
  adminAttachments?: string[]; // file names / references (legacy text list)
  // Drawings + critical surface areas (admin uploads during review)
  drawingAttachments?: PJOAttachment[];  // profile drawings, CAD files, customer specs
  criticalSurfaces?: string;             // text note: which faces/surfaces are critical (no masking marks)
  // Paint / powder selection
  paintInventoryItemId?: string;         // linked powder item from inventory
  paintRequiredKg?: number;              // kg of powder required for this job
  releasedBy?: string;
  releasedAt?: string;
  // Inspection
  status: IncomingShipmentStatus;
  inspectedBy?: string;
  inspectedAt?: string;
  inspectionNotes?: string;
  /** Quantity physically counted and verified by inspector (may differ from received quantity) */
  inspectedQuantity?: number;
  pendingJobOrderId?: string;
  // Material handler scan-in / scan-out
  scannedInAt?: string;
  scannedInBy?: string;
  scannedOutAt?: string;
  scannedOutBy?: string;
  // Damage / issues found during inspection
  inspectionIssues?: {
    hasIssues: boolean;
    description?: string;
    photos?: string[];
    notifiedAt?: string;
    notifiedBy?: string;
  };
}

// ─── Saved Parts / Profile Library ───────────────────────────────────────────

export interface SavedPart {
  id: string;
  /** Short display name, e.g. "Steel angle brackets 2″ × 4″" */
  name: string;
  /** Optional extra detail, finish type, notes, etc. */
  description?: string;
  /** Primary substrate / material */
  material?: string;
  /** Linked customer (optional — for customer-specific profiles) */
  customerId?: string;
  customerName?: string;
  /** Profile drawing — base64 data URL (PDF or image) */
  drawingData?: string;
  drawingName?: string;
  /** Critical surface areas annotation text */
  criticalSurfaces?: string;
  /** How many times this part has been received (for sort weighting) */
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  createdBy: string;
}

export type PendingJobStatus = 'pending_admin' | 'converted';

export interface PJOAttachment {
  id: string;
  name: string;
  type: string;        // MIME type, e.g. "application/pdf", "image/png"
  data: string;        // base64 data URL
  uploadedAt: string;
  uploadedBy: string;
}

export interface PendingJobOrder {
  id: string;
  barcodeId: string;
  shipmentId: string;
  createdAt: string;
  /** Assigned at SCHEDULING, not at inspection */
  productionLine?: ProductionLine;
  // Pre-populated from receiving/inspection
  customerName: string;
  customerId?: string;
  customerPO?: string;
  partDescription: string;
  quantity: number;
  rackCount?: number;
  inspectionNotes?: string;
  /** Actual quantity verified by inspector */
  inspectedQuantity?: number;
  /** Critical surfaces carried from shipment drawings */
  criticalSurfaces?: string;
  // Admin fills in
  colorSpec?: string;
  finishType?: string;
  powderProduct?: string;
  substrate?: string;
  requestedDueDate?: string;
  priority: 'normal' | 'rush' | 'urgent';
  specialInstructions?: string;
  maskingRequired?: boolean;
  sandblastRequired?: boolean;
  quoteId?: string;
  estimatedPrice?: number;
  adminNotes?: string;
  status: PendingJobStatus;
  convertedToJobId?: string;
  convertedAt?: string;
  convertedBy?: string;
  // File attachments (profile drawings, CAD files, specs)
  attachments?: PJOAttachment[];
  // Paint inventory link
  paintInventoryItemId?: string;
  paintArrivalStatus?: 'not_ordered' | 'ordered' | 'arrived';
  paintExpectedDate?: string;
  /** Required paint/powder in kg for this job */
  paintRequiredKg?: number;
  // Sublimation phase
  /** Whether this job requires a sublimation phase after powder coating */
  requiresSublimation?: boolean;
  /** Inventory item ID for the sublimation film/paper */
  sublimationFilmItemId?: string;
  /** Required sublimation film in linear metres */
  sublimationFilmRequiredM?: number;
  // Packaging
  packagingNotes?: string;
}

// ─── Compliance Standards ─────────────────────────────────────────────────────

/** Industry compliance/certification standards for powder coating jobs */
export type ComplianceStandard =
  | 'AAMA_2603'         // Minimum architectural performance, 1-yr Florida
  | 'AAMA_2604'         // Improved durability, 5-yr Florida
  | 'AAMA_2605'         // Superior durability, 10-yr Florida (PVDF or equiv)
  | 'Qualicoat_1'       // Standard durability, 60µm min, 1000h salt spray
  | 'Qualicoat_2'       // Enhanced durability, tighter UV/weather resistance
  | 'Qualicoat_3'       // Highest durability, architectural facades
  | 'GSB_AL631'         // German/Austrian/Swiss architectural aluminum
  | 'GSB_ST663'         // German steel powder coating standard
  | 'AS_NZS_4506'       // Australian/New Zealand thermosetting powder coatings
  | 'EN_12206'          // European aluminum architectural coatings
  | 'EN_13438'          // European galvanized steel powder coatings
  | 'ISO_12944'         // Corrosion protection of steel structures
  | 'ASTM_D3359'        // Adhesion by tape test
  | 'custom';           // Customer-specific or project-specific standard

export const COMPLIANCE_STANDARD_LABELS: Record<ComplianceStandard, string> = {
  AAMA_2603:    'AAMA 2603 – Minimum Architectural',
  AAMA_2604:    'AAMA 2604 – Improved Durability',
  AAMA_2605:    'AAMA 2605 – Superior Durability',
  Qualicoat_1:  'Qualicoat Class 1',
  Qualicoat_2:  'Qualicoat Class 2',
  Qualicoat_3:  'Qualicoat Class 3',
  GSB_AL631:    'GSB AL 631 – Aluminum',
  GSB_ST663:    'GSB ST 663 – Steel',
  AS_NZS_4506:  'AS/NZS 4506',
  EN_12206:     'EN 12206 – Aluminum',
  EN_13438:     'EN 13438 – Galvanized Steel',
  ISO_12944:    'ISO 12944 – Corrosion Protection',
  ASTM_D3359:   'ASTM D3359 – Adhesion',
  custom:       'Custom / Project Specific',
};

/** Minimum DFT (µm) required by each standard for architectural aluminum */
export const COMPLIANCE_MIN_DFT_UM: Partial<Record<ComplianceStandard, number>> = {
  AAMA_2603:   30,   // ~1.2 mils
  AAMA_2604:   45,   // ~1.8 mils
  AAMA_2605:   75,   // ~3.0 mils
  Qualicoat_1: 60,
  Qualicoat_2: 60,
  Qualicoat_3: 60,
  GSB_AL631:   60,
  AS_NZS_4506: 40,
};

// ─── Dry Film Thickness (DFT) Multi-Reading ────────────────────────────────

/** Individual DFT gauge reading per ISO 2360 / ASTM D7091 */
export interface MilThicknessReading {
  id: string;
  location: string;    // e.g. "Face – centre", "Top edge", "Recess area"
  readingUm: number;   // micrometres (µm); 1 mil ≈ 25.4 µm
  pass: boolean;       // vs. spec
}

// ─── Oven Cure Log ─────────────────────────────────────────────────────────

/** Single time/temperature data point from the oven data logger */
export interface OvenCureTempReading {
  elapsedMin: number;  // minutes from door-close
  probeId: string;     // e.g. "TC-1 (heavy)", "TC-2 (thin)", "TC-Air"
  tempF: number;
}

export interface OvenCureLog {
  id: string;
  batchId: string;
  batchNumber: string;
  ovenId: string;
  ovenName: string;
  startTime: string;              // ISO timestamp
  endTime?: string;
  targetTempF: number;
  targetDurationMin: number;
  readings: OvenCureTempReading[];
  peakMetalTempF?: number;        // highest probe reading achieved
  timeAtMinTempMin?: number;      // minutes all probes were above minimum cure temp
  curvePassed?: boolean;          // PMT and TAT within powder supplier's cure window
  operatorId: string;
  operatorName: string;
  loggerModel?: string;           // e.g. "Datapaq Oven Tracker", "Fluke 2640A"
  notes?: string;
  createdAt: string;
}

// ─── Chemical Pretreatment Bath Log ───────────────────────────────────────

export type ChemicalBathType =
  | 'alkaline_cleaner'
  | 'degreaser'
  | 'acid_etch'
  | 'iron_phosphate'
  | 'zinc_phosphate'
  | 'chrome_free_conversion'   // zirconium/titanium-based
  | 'sealer'
  | 'rinse';

export const BATH_TYPE_LABELS: Record<ChemicalBathType, string> = {
  alkaline_cleaner:       'Alkaline Cleaner',
  degreaser:              'Degreaser',
  acid_etch:              'Acid Etch',
  iron_phosphate:         'Iron Phosphate',
  zinc_phosphate:         'Zinc Phosphate',
  chrome_free_conversion: 'Chrome-Free Conversion (Zr/Ti)',
  sealer:                 'Sealer',
  rinse:                  'Rinse Stage',
};

export interface ChemicalBathLog {
  id: string;
  bathName: string;            // e.g. "Stage 2 – Iron Phosphate"
  bathType: ChemicalBathType;
  logDate: string;             // YYYY-MM-DD
  shift: 'day' | 'afternoon' | 'night';
  pH?: number;
  conductivityUScm?: number;   // µS/cm — final rinse target < 30 µS/cm
  temperatureF?: number;
  concentrationPct?: number;   // titration result (% by volume)
  replenishmentAdded?: string; // e.g. "1.5 L Bonderite LC-S concentrate"
  overallPass: boolean;
  operatorId: string;
  operatorName: string;
  notes?: string;
  createdAt: string;
}

// ─── Certificate of Conformance ────────────────────────────────────────────

export interface CertificateOfConformance {
  id: string;
  cocNumber: string;             // e.g. COC-2026-0001
  jobId: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPoNumber?: string;
  shipmentId?: string;
  issuedDate: string;
  issuedById: string;
  issuedByName: string;
  // Part / finish details
  partDescriptions: string[];
  quantityShipped: number;
  finishSpecification: string;   // e.g. "Powder coated per AAMA 2604"
  complianceStandards: ComplianceStandard[];
  colorName: string;
  colorCode: string;
  powderManufacturer: string;
  powderProduct: string;
  powderLotNumber?: string;
  // QC test results
  dftMeanUm?: number;
  dftMinUm?: number;
  dftMaxUm?: number;
  dftSpecUm?: number;
  glossMean?: number;
  glossSpec?: number;
  adhesionResult?: 'pass' | 'fail';
  // Cure record
  curvePassed?: boolean;
  peakMetalTempF?: number;
  timeAtTempMin?: number;
  // References
  qcInspectionId?: string;
  ovenCureLogId?: string;
  batchId?: string;
  notes?: string;
  createdAt: string;
}

// ─── Rework Record ─────────────────────────────────────────────────────────

export type ReworkMethod =
  | 'chemical_strip'    // methylene chloride or alkaline stripper
  | 'burnoff'           // thermal strip oven 350–450°C (not for thin Al)
  | 'mechanical'        // grind / abrasive
  | 'local_touchup';    // spot cure only, customer approval required

export interface ReworkRecord {
  id: string;
  reworkNumber: string;          // RW-2026-0001
  jobId: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  ncrId?: string;                // linked NCR if raised
  qcInspectionId?: string;
  partsAffected: number;
  defectTypes: DefectType[];
  reworkMethod: ReworkMethod;
  authorizedById: string;
  authorizedByName: string;
  authorizedAt: string;
  customerApprovalRequired: boolean;
  customerApprovalReceived?: boolean;
  completedById?: string;
  completedByName?: string;
  completedAt?: string;
  stripPowderKgUsed?: number;    // material consumed in stripping
  recoatPowderKgUsed?: number;
  laborHours?: number;
  reworkCost?: number;
  outcome?: 'pass' | 'fail_again' | 'scrapped';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Canadian Localization ────────────────────────────────────────────────────

export type CanadianProvince =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU'
  | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export type USState =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY' | 'DC';

export type CustomerCurrency = 'CAD' | 'USD';

/**
 * Expanded multi-currency support.
 * CAD is always the functional/reporting currency for DECORA.
 */
export type Currency = 'CAD' | 'USD' | 'EUR' | 'GBP' | 'MXN' | 'AUD' | 'CHF' | 'SEK' | 'NOK' | 'DKK';

export const CURRENCY_LABELS: Record<Currency, string> = {
  CAD: 'CAD — Canadian Dollar',
  USD: 'USD — US Dollar',
  EUR: 'EUR — Euro',
  GBP: 'GBP — British Pound',
  MXN: 'MXN — Mexican Peso',
  AUD: 'AUD — Australian Dollar',
  CHF: 'CHF — Swiss Franc',
  SEK: 'SEK — Swedish Krona',
  NOK: 'NOK — Norwegian Krone',
  DKK: 'DKK — Danish Krone',
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CAD: 'CA$', USD: 'US$', EUR: '€', GBP: '£', MXN: 'MX$',
  AUD: 'A$', CHF: 'Fr', SEK: 'kr', NOK: 'kr', DKK: 'kr',
};

/** Per-province Canadian tax rates */
export interface ProvinceTaxInfo {
  province: CanadianProvince;
  label: string;
  gstRate: number;   // 0.05 (federal)
  pstRate: number;   // 0 in AB, 0.07 in BC, etc.
  hstRate?: number;  // Combined HST (ON=0.13, NS/NB/NL/PEI=0.15) replaces GST+PST
  qstRate?: number;  // Quebec only
  totalRate: number; // effective combined rate
}

// ─── International Trade & Tax ────────────────────────────────────────────────

/**
 * Tax jurisdiction — determines which tax code to apply on invoices.
 * Covers all scenarios DECORA will encounter: Ontario-based, inter-provincial,
 * US exports, EU B2B, EU B2C, and other international.
 */
export type TaxJurisdiction =
  // ── Canadian HST provinces (single harmonized rate) ─────────────────────
  | 'CA_ON'   // Ontario          HST 13%
  | 'CA_NB'   // New Brunswick    HST 15%
  | 'CA_NS'   // Nova Scotia      HST 15%
  | 'CA_NL'   // Newfoundland     HST 15%
  | 'CA_PE'   // PEI              HST 15%
  // ── Canadian GST + separate PST ─────────────────────────────────────────
  | 'CA_BC'   // British Columbia GST 5% + PST 7%
  | 'CA_MB'   // Manitoba         GST 5% + RST 7%
  | 'CA_SK'   // Saskatchewan     GST 5% + PST 6%
  // ── Canadian GST + QST (Quebec) ─────────────────────────────────────────
  | 'CA_QC'   // Quebec           GST 5% + QST 9.975%
  // ── Canadian GST only ────────────────────────────────────────────────────
  | 'CA_AB'   // Alberta          GST 5%
  | 'CA_YT'   // Yukon            GST 5%
  | 'CA_NT'   // NWT              GST 5%
  | 'CA_NU'   // Nunavut          GST 5%
  // ── Canadian exempt ──────────────────────────────────────────────────────
  | 'CA_EXEMPT'        // GST/HST exempt (Indigenous, diplomats, zero-rated services)
  | 'CA_ZERO_RATED'    // Zero-rated (e.g. basic groceries — unlikely for DECORA)
  // ── US exports ───────────────────────────────────────────────────────────
  | 'US_EXPORT'        // Export to US — zero-rated for Canadian GST/HST purposes
  | 'US_EXPORT_TAXABLE'// US customer with nexus concern (rare — flag for accountant review)
  // ── Mexico ───────────────────────────────────────────────────────────────
  | 'MX_EXPORT'        // Export to Mexico — zero-rated
  // ── EU / UK ──────────────────────────────────────────────────────────────
  | 'EU_B2B'           // EU business-to-business (VAT reverse charge applies — customer pays VAT)
  | 'EU_B2C'           // EU business-to-consumer (complex OSS VAT — flag for accountant review)
  | 'UK_B2B'           // UK post-Brexit (reverse charge)
  | 'UK_B2C'           // UK B2C
  // ── Other international ───────────────────────────────────────────────────
  | 'INTL_EXPORT';     // All other countries — zero-rated, no Canadian tax

/** Maps each jurisdiction to its QB Online Canada tax code string */
export const QB_TAX_CODE: Record<TaxJurisdiction, string> = {
  CA_ON:            'HST ON',
  CA_NB:            'HST NB',
  CA_NS:            'HST NS',
  CA_NL:            'HST NL',
  CA_PE:            'HST PE',
  CA_BC:            'GST/PST BC',
  CA_MB:            'GST/RST MB',
  CA_SK:            'GST/PST SK',
  CA_QC:            'GST/QST',
  CA_AB:            'GST',
  CA_YT:            'GST',
  CA_NT:            'GST',
  CA_NU:            'GST',
  CA_EXEMPT:        'Exempt',
  CA_ZERO_RATED:    'Zero-Rated',
  US_EXPORT:        'OUT OF SCOPE',
  US_EXPORT_TAXABLE:'OUT OF SCOPE',
  MX_EXPORT:        'OUT OF SCOPE',
  EU_B2B:           'OUT OF SCOPE',
  EU_B2C:           'OUT OF SCOPE',
  UK_B2B:           'OUT OF SCOPE',
  UK_B2C:           'OUT OF SCOPE',
  INTL_EXPORT:      'OUT OF SCOPE',
};

/** Effective tax rate for each jurisdiction (for invoice calculations) */
export const JURISDICTION_RATE: Record<TaxJurisdiction, number> = {
  CA_ON: 0.13, CA_NB: 0.15, CA_NS: 0.15, CA_NL: 0.15, CA_PE: 0.15,
  CA_BC: 0.12, CA_MB: 0.12, CA_SK: 0.11,
  CA_QC: 0.14975,
  CA_AB: 0.05, CA_YT: 0.05, CA_NT: 0.05, CA_NU: 0.05,
  CA_EXEMPT: 0, CA_ZERO_RATED: 0,
  US_EXPORT: 0, US_EXPORT_TAXABLE: 0, MX_EXPORT: 0,
  EU_B2B: 0, EU_B2C: 0, UK_B2B: 0, UK_B2C: 0, INTL_EXPORT: 0,
};

export const JURISDICTION_LABELS: Record<TaxJurisdiction, string> = {
  CA_ON: 'Ontario — HST 13%',
  CA_NB: 'New Brunswick — HST 15%',
  CA_NS: 'Nova Scotia — HST 15%',
  CA_NL: 'Newfoundland — HST 15%',
  CA_PE: 'PEI — HST 15%',
  CA_BC: 'British Columbia — GST 5% + PST 7%',
  CA_MB: 'Manitoba — GST 5% + RST 7%',
  CA_SK: 'Saskatchewan — GST 5% + PST 6%',
  CA_QC: 'Quebec — GST 5% + QST 9.975%',
  CA_AB: 'Alberta — GST 5%',
  CA_YT: 'Yukon — GST 5%',
  CA_NT: 'Northwest Territories — GST 5%',
  CA_NU: 'Nunavut — GST 5%',
  CA_EXEMPT: 'Canada — GST/HST Exempt',
  CA_ZERO_RATED: 'Canada — Zero-Rated',
  US_EXPORT: 'United States — Export (0%)',
  US_EXPORT_TAXABLE: 'United States — Review Required',
  MX_EXPORT: 'Mexico — Export (0%)',
  EU_B2B: 'European Union — B2B Reverse Charge (0%)',
  EU_B2C: 'European Union — B2C (Review Required)',
  UK_B2B: 'United Kingdom — B2B Reverse Charge (0%)',
  UK_B2C: 'United Kingdom — B2C (Review Required)',
  INTL_EXPORT: 'International Export (0%)',
};

/**
 * Infer the correct TaxJurisdiction from a customer's billing address
 * and whether they are a registered business (B2B).
 */
export function inferTaxJurisdiction(
  country: string,
  stateProvince: string,
  taxExempt: boolean,
  isB2B = true,
): TaxJurisdiction {
  if (taxExempt) return 'CA_EXEMPT';
  if (country === 'CA') {
    const map: Partial<Record<string, TaxJurisdiction>> = {
      ON: 'CA_ON', NB: 'CA_NB', NS: 'CA_NS', NL: 'CA_NL', PE: 'CA_PE',
      BC: 'CA_BC', MB: 'CA_MB', SK: 'CA_SK', QC: 'CA_QC',
      AB: 'CA_AB', YT: 'CA_YT', NT: 'CA_NT', NU: 'CA_NU',
    };
    return map[stateProvince] ?? 'CA_AB';
  }
  if (country === 'US') return 'US_EXPORT';
  if (country === 'MX') return 'MX_EXPORT';
  if (country === 'GB') return isB2B ? 'UK_B2B' : 'UK_B2C';
  const euCountries = new Set([
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR',
    'HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  ]);
  if (euCountries.has(country)) return isB2B ? 'EU_B2B' : 'EU_B2C';
  return 'INTL_EXPORT';
}

/**
 * Vendor/Supplier — full international model.
 * Covers Canadian, US, EU, and other suppliers.
 * Separate from customers; no account balance (accounts payable tracked in QB).
 */
export type VendorType = 'supplier' | 'contractor' | 'freight_carrier' | 'customs_broker' | 'utility' | 'other';

export interface Vendor {
  id: string;
  name: string;
  /** Internal vendor/account code */
  accountNumber?: string;
  type: VendorType;
  status: 'active' | 'inactive';
  country: string;           // ISO 2-letter
  currency: Currency;
  contacts: CustomerContact[]; // reuse CustomerContact
  billingAddress: Address;
  paymentTerms: string;       // 'Net 30', 'Net 60', 'COD', 'Prepaid', etc.
  // ── Tax / compliance ──────────────────────────────────────────────────────
  /** Does this vendor charge us GST/HST? (needed for ITC claim) */
  chargesGst: boolean;
  /** Vendor's CRA Business Number / GST registration */
  gstHstNumber?: string;
  /** EU VAT registration number (validated format, e.g. DE123456789) */
  vatNumber?: string;
  /** US EIN (Employer Identification Number) — for 1099-NEC / W-8BEN-E */
  usEin?: string;
  // ── Customs / import ─────────────────────────────────────────────────────
  /** Default HS (Harmonized System) code for items from this vendor */
  defaultHsCode?: string;
  /** ISO country of origin for CUSMA / USMCA preferential tariff */
  countryOfOrigin?: string;
  /** Vendor's exporter ID / CERS # (required for Canadian imports) */
  exporterIdNumber?: string;
  // ── Payment ───────────────────────────────────────────────────────────────
  preferredPaymentMethod?: 'cheque' | 'eft' | 'wire' | 'credit_card' | 'ach';
  /** Free-text wire/EFT instructions (NEVER store actual account numbers here) */
  paymentInstructions?: string;
  // ── QB sync ───────────────────────────────────────────────────────────────
  qbVendorId?: string;
  qbSyncedAt?: string;
  // ── Meta ──────────────────────────────────────────────────────────────────
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Customs Brokerage Record — tracks import/export brokerage fees and duties.
 * Links to incoming shipments (imports) or outgoing shipments (exports).
 * All fees are ITC-eligible on the brokerage portion if vendor charges HST.
 */
export interface BrokerageRecord {
  id: string;
  direction: 'import' | 'export';
  /** Link to IncomingShipment (imports) or Shipping record (exports) */
  shipmentId?: string;
  purchaseOrderId?: string;
  /** e.g. "Livingston International", "UPS Customs Brokerage", "FedEx Trade" */
  brokerName: string;
  brokerRef?: string;          // Broker's own entry / file reference
  /** CBSA (Canada) or CBP (US) entry number */
  entryNumber?: string;
  entryDate: string;           // ISO date customs entry filed
  // ── Cargo details ─────────────────────────────────────────────────────────
  supplierName?: string;
  countryOfOrigin?: string;
  /** Harmonized System tariff code */
  hsCode?: string;
  declaredValue: number;
  declaredCurrency: Currency;
  /** Incoterms 2020 — determines who pays duty/freight */
  incoterm?: 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP' | 'FAS' | 'FOB' | 'CFR' | 'CIF';
  // ── Charges (all in CAD unless noted) ────────────────────────────────────
  customsDuty: number;         // tariff assessed by CBSA
  exciseTax: number;           // if applicable (alcohol, tobacco — unlikely)
  gstOnImport: number;         // 5% GST assessed at border (fully ITC-claimable)
  brokerageFee: number;        // broker's service fee
  disbursements: number;       // fees/taxes advanced by broker on your behalf
  hstOnBrokerage: number;      // HST on broker's fee (ITC-claimable)
  otherFees: number;
  totalCharges: number;        // sum of all above
  currency: Currency;          // currency charges billed in
  /** QB expense ID after posting to QBO Accounts Payable */
  qbExpenseId?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Commercial Invoice / Export Document — required for international shipments.
 * Used for customs clearance at the destination country.
 * Also serves as basis for CUSMA / USMCA Certificate of Origin.
 */
export interface CommercialInvoice {
  id: string;
  /** Linked DECORA invoice (AR) */
  invoiceId?: string;
  exportDate: string;
  shipToCountry: string;
  shipToAddress: Address;
  /** Incoterms 2020 */
  incoterm: string;
  currency: Currency;
  exchangeRateToCAD?: number;  // snapshot at time of export
  carrier?: string;
  trackingNumber?: string;
  lineItems: CommercialInvoiceLineItem[];
  totalDeclaredValue: number;
  /** Harmonized description of goods */
  goodsDescription?: string;
  /** Reason for export */
  exportReason: 'permanent_sale' | 'repair_return' | 'warranty' | 'sample' | 'gift';
  // ── CUSMA / USMCA (Canada–US–Mexico trade) ────────────────────────────────
  /** Is this shipment eligible for CUSMA preferential tariff treatment? */
  cusmaEligible?: boolean;
  /** Certifier's full legal name */
  cusmaCertifierName?: string;
  cusmaCertifierTitle?: string;
  cusmaCertifiedDate?: string;
  /** Statement: "I certify that the goods described in this document qualify…" */
  cusmaStatementText?: string;
  // ── Export permit ─────────────────────────────────────────────────────────
  /** Required for controlled goods (military, dual-use tech) */
  exportPermitNumber?: string;
  createdAt: string;
  createdBy: string;
}

export interface CommercialInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitValue: number;
  totalValue: number;
  /** HS (Harmonized System) tariff code — 6-10 digits */
  hsCode: string;
  countryOfOrigin: string;
  /** Material composition (customs may require this for powders/coatings) */
  materials?: string;
}

/**
 * QB Integration Settings — stored in AppState.
 * Persisted to Supabase like all other state.
 */
export interface QBSettings {
  /** Whether OAuth connection is active (token exists on server side) */
  connected: boolean;
  /** QBO company / realm ID */
  realmId?: string;
  companyName?: string;
  /** Country setting in QBO — should be 'CA' for Canadian companies */
  qbCountry?: 'CA' | 'US';
  /** Last successful token refresh */
  tokenRefreshedAt?: string;
  /** Last time a full sync was run */
  lastSyncAt?: string;
  // ── Chart of accounts mapping ────────────────────────────────────────────
  /** QB account IDs for each DECORA revenue category */
  accountMapping: QBAccountMapping;
  // ── Tax agency settings ───────────────────────────────────────────────────
  /** DECORA's CRA Business Number (BN) / GST/HST registration */
  gstHstNumber?: string;
  /** QST registration number (if registered in Quebec) */
  qstNumber?: string;
  // ── Sync preferences ─────────────────────────────────────────────────────
  autoSyncInvoices: boolean;
  autoSyncCustomers: boolean;
  autoSyncPayments: boolean;
  syncOnMarkSent: boolean;      // push invoice to QB when marked "Sent"
  syncOnMarkPaid: boolean;      // pull payment from QB webhook
}

export interface QBAccountMapping {
  powderCoatingRevenue?: string;    // QB account ID
  sublimationRevenue?: string;
  otherServicesRevenue?: string;
  paintCOGS?: string;               // Cost of Goods Sold — paint/powder
  labourCOGS?: string;
  freightIncome?: string;
  discountsGiven?: string;
  accountsReceivable?: string;
  accountsPayable?: string;
  customsDutyExpense?: string;
  brokerageExpense?: string;
  generalSupplies?: string;
  equipmentParts?: string;
}

/**
 * QB Import Result — returned by the CSV import parser.
 * Wraps parsed records with validation metadata.
 */
export interface QBImportRecord<T> {
  row: number;
  data: T;
  status: 'new' | 'duplicate' | 'update' | 'error';
  /** Existing record ID if status = 'duplicate' | 'update' */
  existingId?: string;
  errors: string[];
  warnings: string[];
}

export interface QBImportSession {
  id: string;
  type: 'customers' | 'vendors' | 'products' | 'invoices';
  filename: string;
  totalRows: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  completedAt?: string;
  importedBy: string;
}

// ─── SAT Vertical Line / VISICOAT ────────────────────────────────────────────

/**
 * Powder characteristic — maps to VISICOAT recipe distinction parameter.
 * SAT VISICOAT uses this (combined with RAL + supplier) to select the
 * correct gun recipe automatically at the coating booth.
 */
export type PowderCharacteristic =
  | 'solid'
  | 'metallic'
  | 'matt'
  | 'texture'
  | 'glossy'
  | 'satin'
  | 'wrinkle'
  | 'candy'
  | 'hammer';

/**
 * A VISICOAT coating recipe — links a profile type (SavedPart) to the
 * specific gun parameters required for a given RAL / powder combination.
 * The SAT Advanced ERP integration selects the correct recipe automatically
 * when the batch barcode is scanned at the loading station.
 */
export interface VisicoatRecipe {
  id: string;
  /** Human-readable name, e.g. "6063 Casement — RAL 9016 Gloss White" */
  name: string;
  /** Links to SavedPart.id (profile / extrusion type) */
  savedPartId?: string;
  savedPartName?: string;
  // ── Coating specification ──────────────────────────────────────────────────
  ralCode: string;             // e.g. "9016", "7016"
  ralDescription?: string;    // e.g. "Traffic White", "Anthracite Grey"
  powderCharacteristic: PowderCharacteristic;
  /** Powder supplier / brand name */
  powderSupplier?: string;
  /** Links to InventoryItem.id for live stock check */
  powderInventoryItemId?: string;
  // ── VISICOAT gun parameters (set in SAT recipe library) ────────────────────
  /** Electrostatic voltage (kV) */
  voltageKV?: number;
  /** Corona current (µA) */
  currentUA?: number;
  /** Powder output (g/min) */
  powderOutputGmin?: number;
  /** Air flow (m³/h or bar — as set in OptiStar) */
  airFlow?: number;
  /** Conveyor speed override for this recipe (m/min) — blank = use line default */
  conveyorSpeedMmin?: number;
  // ── Meta ──────────────────────────────────────────────────────────────────
  /** Operator notes visible on SAT HMI at coating booth */
  boothNotes?: string;
  /** Packing / unload notes shown at unload station */
  packingNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Process data record for a single batch run on the SAT vertical line.
 * Populated by importing the SAT orders.csv export or via future live API.
 * Links back to an ERP Job via jobId.
 */
export interface SATBatchLog {
  id: string;
  /** ERP Job linked to this batch */
  jobId?: string;
  /** Batch barcode / QR code scanned at SAT loading station */
  satBatchCode: string;
  /** VISICOAT recipe applied */
  visicoatRecipeId?: string;
  ralCode?: string;
  powderCharacteristic?: PowderCharacteristic;
  // ── Timestamps ────────────────────────────────────────────────────────────
  firstProfileLoadedAt?: string;
  lastProfileLoadedAt?: string;
  lastProfileUnloadedAt?: string;
  // ── Production counts ─────────────────────────────────────────────────────
  hookCount?: number;
  profileCount?: number;
  /** Conveyor speed (m/min) as run */
  conveyorSpeedMmin?: number;
  // ── Zone temperatures — min / avg / max (°C) ──────────────────────────────
  degreaseTemp?: { min: number; avg: number; max: number };
  etchTemp?:     { min: number; avg: number; max: number };
  chromeTemp?:   { min: number; avg: number; max: number };
  dryingTemp?:   { min: number; avg: number; max: number };
  polyTemp?:     { min: number; avg: number; max: number };
  // ── Zone transit times (seconds) ──────────────────────────────────────────
  tunnelTimeS?: number;
  dryingTimeS?: number;
  boothTimeS?:  number;
  polyTimeS?:   number;
  // ── Import metadata ───────────────────────────────────────────────────────
  importedAt: string;
  importSource: 'csv_manual' | 'csv_auto' | 'api';
  notes?: string;
}
