// ─── Customer Portal Types ─────────────────────────────────────────────────────
// Separate from staff types — customer-facing portal only.

export type PortalOrderStatus =
  | 'received'
  | 'in_pretreat'
  | 'coating'
  | 'curing'
  | 'qc_inspection'
  | 'ready_for_pickup'
  | 'shipped'
  | 'completed'
  | 'on_hold';

export interface PortalStatusEvent {
  status: PortalOrderStatus;
  timestamp: string; // ISO
  note?: string;
}

export interface PortalOrder {
  id: string;
  jobNumber: string;
  customerId: string;       // links to Customer.id
  description: string;
  profileType?: string;
  color?: string;
  finish?: string;
  quantity: number;
  unitType: 'pieces' | 'lbs' | 'ft';
  weight?: number;          // lbs total
  orderDate: string;
  expectedCompletion: string;
  status: PortalOrderStatus;
  statusHistory: PortalStatusEvent[];
  customerNotes?: string;   // visible to customer
  poNumber?: string;
  estimatedValue?: number;
  currency: 'CAD' | 'USD';
  trackingNumber?: string;
  carrier?: string;
}

export interface CustomerPortalAccount {
  id: string;
  customerId: string;       // links to Customer.id
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  password: string;         // demo plain-text; real app uses hashed + API
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface CustomerPortalSession {
  accountId: string;
  customerId: string;
  companyName: string;
  contactName: string;
  email: string;
}

export type QuoteRequestStatus = 'submitted' | 'in_review' | 'quoted' | 'accepted' | 'declined';
export type SampleRequestStatus = 'submitted' | 'processing' | 'shipped' | 'delivered';

export interface PortalQuoteRequest {
  id: string;
  customerId: string;
  submittedAt: string;
  status: QuoteRequestStatus;
  profileDescription: string;
  material: string;
  finishType: string;
  color?: string;
  quantity: number;
  unitType: 'pieces' | 'lbs' | 'ft';
  drawingNotes?: string;
  targetDate?: string;
  respondedAt?: string;
  quotedPriceCAD?: number;
  quotedPriceUSD?: number;
  quoteRef?: string;
  internalNotes?: string;   // staff-only
}

export interface PortalSampleRequest {
  id: string;
  customerId: string;
  submittedAt: string;
  status: SampleRequestStatus;
  colors: string[];
  finishTypes: string[];
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostal: string;
  notes?: string;
  shippedAt?: string;
  trackingNumber?: string;
}

export interface PortalContactMessage {
  id: string;
  customerId?: string;
  submittedAt: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  repliedAt?: string;
}
