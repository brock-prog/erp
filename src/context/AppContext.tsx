import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadSessionTimeout } from '../lib/backup';
import type {
  Customer, Job, Quote, Invoice, InventoryItem,
  Equipment, Rack, Batch, QCInspection, User, InventoryTransaction,
  MaintenanceTask, NCR, Shipment, Receipt,
  SparePart, WorkInstruction, CriticalSupplier,
  Employee, AttendanceRecord, TrainingRecord,
  ScanEvent, JobOrder,
  CRMActivity, CRMOpportunity,
  LogisticsStop, DriverRunSheet,
  WorkstationSession, CostEntry, MaintenanceSchedule,
  AuditEntry, DropdownList, EquipmentRuntimeEntry,
  IncomingShipment, PendingJobOrder, ProcessSession, SavedPart,
  OvenCureLog, ChemicalBathLog, CertificateOfConformance, ReworkRecord, CustomRole,
  Vendor, PurchaseOrder, VendorBill, BrokerageRecord, QBSettings, QBImportSession,
  VisicoatRecipe, SATBatchLog,
} from '../types';
import { dbSync, dbLoadAppState } from '../lib/db';
import { isSupabaseReady } from '../lib/supabase';
import {
  CUSTOMERS, JOBS, QUOTES, INVOICES, INVENTORY,
  EQUIPMENT, RACKS, BATCHES, QC_INSPECTIONS, USERS, INVENTORY_TRANSACTIONS,
  MAINTENANCE_TASKS, MAINTENANCE_SCHEDULES, NCRS, SHIPMENTS, RECEIPTS,
  SPARE_PARTS, WORK_INSTRUCTIONS, CRITICAL_SUPPLIERS,
  EMPLOYEES, ATTENDANCE_RECORDS, TRAINING_RECORDS,
  EQUIPMENT_RUNTIME_DATA, VISICOAT_RECIPES, SAT_BATCH_LOGS,
  VENDORS, PURCHASE_ORDERS, VENDOR_BILLS,
} from '../data/mockData';
import { api, setAccessToken, clearAccessToken, tryRestoreSession } from '../lib/api';
import { connectSocket, disconnectSocket, onSocket, getSocketId } from '../lib/socket';

interface AppState {
  customers: Customer[];
  jobs: Job[];
  quotes: Quote[];
  invoices: Invoice[];
  inventory: InventoryItem[];
  equipment: Equipment[];
  racks: Rack[];
  batches: Batch[];
  qcInspections: QCInspection[];
  users: User[];
  inventoryTransactions: InventoryTransaction[];
  maintenanceTasks: MaintenanceTask[];
  ncrs: NCR[];
  shipments: Shipment[];
  receipts: Receipt[];
  spareParts: SparePart[];
  workInstructions: WorkInstruction[];
  criticalSuppliers: CriticalSupplier[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  trainingRecords: TrainingRecord[];
  scanEvents: ScanEvent[];
  jobOrders: JobOrder[];
  crmActivities: CRMActivity[];
  crmOpportunities: CRMOpportunity[];
  logisticsStops: LogisticsStop[];
  driverRunSheets: DriverRunSheet[];
  workstationSessions: WorkstationSession[];
  costEntries: CostEntry[];
  maintenanceSchedules: MaintenanceSchedule[];
  equipmentRuntime: Record<string, EquipmentRuntimeEntry>;
  incomingShipments: IncomingShipment[];
  pendingJobOrders: PendingJobOrder[];
  savedParts: SavedPart[];
  processSessions: ProcessSession[];
  ovenCureLogs: OvenCureLog[];
  chemicalBathLogs: ChemicalBathLog[];
  certificates: CertificateOfConformance[];
  reworkRecords: ReworkRecord[];
  customRoles: CustomRole[];
  // ── International / QB ────────────────────────────────────────────────────
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  vendorBills: VendorBill[];
  brokerageRecords: BrokerageRecord[];
  qbSettings: QBSettings;
  qbImportHistory: QBImportSession[];
  // ── SAT Vertical Line / VISICOAT ─────────────────────────────────────────
  visicoatRecipes: VisicoatRecipe[];
  satBatchLogs: SATBatchLog[];
  currentUser: User;
  loggedIn: boolean;
  demoMode: boolean;
  auditLog: AuditEntry[];
  sidebarOpen: boolean;
  notifications: Notification[];
  customDropdowns: DropdownList[];
  // API sync state
  apiConnected: boolean;
  onlineUsers: OnlineUser[];
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  read: boolean;
}

interface OnlineUser {
  userId: string;
  name: string;
  role: string;
  socketId: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CUSTOMERS'; payload: Customer[] }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'SET_JOBS'; payload: Job[] }
  | { type: 'ADD_JOB'; payload: Job }
  | { type: 'UPDATE_JOB'; payload: Job }
  | { type: 'SET_QUOTES'; payload: Quote[] }
  | { type: 'ADD_QUOTE'; payload: Quote }
  | { type: 'UPDATE_QUOTE'; payload: Quote }
  | { type: 'SET_INVOICES'; payload: Invoice[] }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
  | { type: 'UPDATE_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'ADD_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'UPDATE_BATCH'; payload: Batch }
  | { type: 'ADD_BATCH'; payload: Batch }
  | { type: 'ADD_QC'; payload: QCInspection }
  | { type: 'UPDATE_QC'; payload: QCInspection }
  | { type: 'ADD_INV_TRANSACTION'; payload: InventoryTransaction }
  | { type: 'ADD_MAINTENANCE'; payload: MaintenanceTask }
  | { type: 'UPDATE_MAINTENANCE'; payload: MaintenanceTask }
  | { type: 'DELETE_MAINTENANCE'; payload: string }
  | { type: 'ADD_NCR'; payload: NCR }
  | { type: 'UPDATE_NCR'; payload: NCR }
  | { type: 'ADD_SHIPMENT'; payload: Shipment }
  | { type: 'UPDATE_SHIPMENT'; payload: Shipment }
  | { type: 'ADD_RECEIPT'; payload: Receipt }
  | { type: 'UPDATE_RECEIPT'; payload: Receipt }
  | { type: 'ADD_SPARE_PART'; payload: SparePart }
  | { type: 'UPDATE_SPARE_PART'; payload: SparePart }
  | { type: 'DELETE_SPARE_PART'; payload: string }
  | { type: 'ADD_WORK_INSTRUCTION'; payload: WorkInstruction }
  | { type: 'UPDATE_WORK_INSTRUCTION'; payload: WorkInstruction }
  | { type: 'ADD_SUPPLIER'; payload: CriticalSupplier }
  | { type: 'UPDATE_SUPPLIER'; payload: CriticalSupplier }
  | { type: 'ADD_EMPLOYEE'; payload: Employee }
  | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
  | { type: 'ADD_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'UPDATE_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'ADD_TRAINING'; payload: TrainingRecord }
  | { type: 'UPDATE_TRAINING'; payload: TrainingRecord }
  | { type: 'ADD_SCAN_EVENT'; payload: ScanEvent }
  | { type: 'ADD_JOB_ORDER'; payload: JobOrder }
  | { type: 'UPDATE_JOB_ORDER'; payload: JobOrder }
  | { type: 'ADD_CRM_ACTIVITY'; payload: CRMActivity }
  | { type: 'UPDATE_CRM_ACTIVITY'; payload: CRMActivity }
  | { type: 'ADD_CRM_OPPORTUNITY'; payload: CRMOpportunity }
  | { type: 'UPDATE_CRM_OPPORTUNITY'; payload: CRMOpportunity }
  | { type: 'DELETE_CRM_OPPORTUNITY'; payload: string }
  | { type: 'ADD_LOGISTICS_STOP'; payload: LogisticsStop }
  | { type: 'UPDATE_LOGISTICS_STOP'; payload: LogisticsStop }
  | { type: 'DELETE_LOGISTICS_STOP'; payload: string }
  | { type: 'ADD_DRIVER_RUN_SHEET'; payload: DriverRunSheet }
  | { type: 'UPDATE_DRIVER_RUN_SHEET'; payload: DriverRunSheet }
  | { type: 'ADD_WORKSTATION_SESSION'; payload: WorkstationSession }
  | { type: 'UPDATE_WORKSTATION_SESSION'; payload: WorkstationSession }
  | { type: 'ADD_COST_ENTRY'; payload: CostEntry }
  | { type: 'UPDATE_COST_ENTRY'; payload: CostEntry }
  | { type: 'ADD_MAINTENANCE_SCHEDULE'; payload: MaintenanceSchedule }
  | { type: 'UPDATE_MAINTENANCE_SCHEDULE'; payload: MaintenanceSchedule }
  | { type: 'DELETE_MAINTENANCE_SCHEDULE'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATIONS_READ' }
  | { type: 'SET_CURRENT_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'ADD_AUDIT_ENTRY'; payload: AuditEntry }
  | { type: 'CLEAR_AUDIT_LOG' }
  | { type: 'SET_DROPDOWN_LIST'; payload: DropdownList }
  | { type: 'DELETE_DROPDOWN_LIST'; payload: string }
  | { type: 'START_EQUIPMENT_RUNTIME'; payload: string }
  | { type: 'STOP_EQUIPMENT_RUNTIME'; payload: string }
  | { type: 'ADD_EQUIPMENT'; payload: Equipment }
  | { type: 'UPDATE_EQUIPMENT'; payload: Equipment }
  | { type: 'ARCHIVE_EQUIPMENT'; payload: string }
  | { type: 'LOG_MAINTENANCE_SERVICE'; payload: { scheduleId: string; serviceHours: number; completedByName?: string } }
  | { type: 'ADD_INCOMING_SHIPMENT'; payload: IncomingShipment }
  | { type: 'UPDATE_INCOMING_SHIPMENT'; payload: IncomingShipment }
  | { type: 'ADD_PENDING_JOB_ORDER'; payload: PendingJobOrder }
  | { type: 'UPDATE_PENDING_JOB_ORDER'; payload: PendingJobOrder }
  | { type: 'ADD_SAVED_PART'; payload: SavedPart }
  | { type: 'UPDATE_SAVED_PART'; payload: SavedPart }
  | { type: 'DELETE_SAVED_PART'; payload: string }
  | { type: 'ADD_PROCESS_SESSION'; payload: ProcessSession }
  | { type: 'UPDATE_PROCESS_SESSION'; payload: ProcessSession }
  // ── Quality & Compliance ──────────────────────────────────────────────────
  | { type: 'ADD_OVEN_CURE_LOG'; payload: OvenCureLog }
  | { type: 'UPDATE_OVEN_CURE_LOG'; payload: OvenCureLog }
  | { type: 'ADD_CHEMICAL_BATH_LOG'; payload: ChemicalBathLog }
  | { type: 'UPDATE_CHEMICAL_BATH_LOG'; payload: ChemicalBathLog }
  | { type: 'ADD_CERTIFICATE'; payload: CertificateOfConformance }
  | { type: 'UPDATE_CERTIFICATE'; payload: CertificateOfConformance }
  | { type: 'ADD_REWORK_RECORD'; payload: ReworkRecord }
  | { type: 'UPDATE_REWORK_RECORD'; payload: ReworkRecord }
  // ── User management ───────────────────────────────────────────────────────
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'ADD_CUSTOM_ROLE'; payload: CustomRole }
  | { type: 'UPDATE_CUSTOM_ROLE'; payload: CustomRole }
  | { type: 'DELETE_CUSTOM_ROLE'; payload: string }
  // ── Vendors ───────────────────────────────────────────────────────────────
  | { type: 'ADD_VENDOR'; payload: Vendor }
  | { type: 'UPDATE_VENDOR'; payload: Vendor }
  | { type: 'DELETE_VENDOR'; payload: string }
  | { type: 'SET_VENDORS'; payload: Vendor[] }
  // ── Purchase Orders ─────────────────────────────────────────────────────
  | { type: 'ADD_PURCHASE_ORDER'; payload: PurchaseOrder }
  | { type: 'UPDATE_PURCHASE_ORDER'; payload: PurchaseOrder }
  | { type: 'DELETE_PURCHASE_ORDER'; payload: string }
  // ── Vendor Bills ────────────────────────────────────────────────────────
  | { type: 'ADD_VENDOR_BILL'; payload: VendorBill }
  | { type: 'UPDATE_VENDOR_BILL'; payload: VendorBill }
  | { type: 'DELETE_VENDOR_BILL'; payload: string }
  // ── Brokerage ─────────────────────────────────────────────────────────────
  | { type: 'ADD_BROKERAGE_RECORD'; payload: BrokerageRecord }
  | { type: 'UPDATE_BROKERAGE_RECORD'; payload: BrokerageRecord }
  | { type: 'DELETE_BROKERAGE_RECORD'; payload: string }
  // ── QB Settings ───────────────────────────────────────────────────────────
  | { type: 'UPDATE_QB_SETTINGS'; payload: Partial<QBSettings> }
  | { type: 'ADD_QB_IMPORT_SESSION'; payload: QBImportSession }
  // ── SAT Vertical Line / VISICOAT ─────────────────────────────────────────
  | { type: 'ADD_VISICOAT_RECIPE'; payload: VisicoatRecipe }
  | { type: 'UPDATE_VISICOAT_RECIPE'; payload: VisicoatRecipe }
  | { type: 'DELETE_VISICOAT_RECIPE'; payload: string }
  | { type: 'ADD_SAT_BATCH_LOG'; payload: SATBatchLog }
  | { type: 'UPDATE_SAT_BATCH_LOG'; payload: SATBatchLog }
  // ── Demo / Live mode ──────────────────────────────────────────────────────
  | { type: 'SET_DEMO_MODE'; payload: boolean }
  // Internal sync actions (not broadcast to server)
  | { type: '_HYDRATE_STATE'; payload: Partial<AppState> }
  | { type: '_SET_API_CONNECTED'; payload: boolean }
  | { type: '_SET_ONLINE_USERS'; payload: OnlineUser[] };

// Actions that are purely local UI state — never synced to server
const LOCAL_ONLY_ACTIONS = new Set([
  'TOGGLE_SIDEBAR',
  'ADD_NOTIFICATION',
  'MARK_NOTIFICATIONS_READ',
  'SET_CURRENT_USER',
  'SET_DEMO_MODE',
  'LOGOUT',
  'ADD_AUDIT_ENTRY',   // server already logs these
  'CLEAR_AUDIT_LOG',
  'START_EQUIPMENT_RUNTIME',
  'STOP_EQUIPMENT_RUNTIME',
  '_HYDRATE_STATE',
  '_SET_API_CONNECTED',
  '_SET_ONLINE_USERS',
]);

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'coatpro_erp_state_v2';

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

// ─── Default QB Settings ─────────────────────────────────────────────────────

const DEFAULT_QB_SETTINGS: QBSettings = {
  connected: false,
  qbCountry: 'CA',
  accountMapping: {},
  autoSyncInvoices: false,
  autoSyncCustomers: false,
  autoSyncPayments: false,
  syncOnMarkSent: false,
  syncOnMarkPaid: false,
};

// ─── Default dropdowns ────────────────────────────────────────────────────────

const DEFAULT_DROPDOWNS: DropdownList[] = [
  {
    id: 'dl-finish', name: 'Finish Types', systemKey: 'finishTypes',
    description: 'Powder coating finish options shown on job forms',
    items: [
      { id: 'ft1', label: 'Gloss', value: 'gloss', active: true, sortOrder: 1 },
      { id: 'ft2', label: 'Semi-Gloss', value: 'semi-gloss', active: true, sortOrder: 2 },
      { id: 'ft3', label: 'Satin', value: 'satin', active: true, sortOrder: 3 },
      { id: 'ft4', label: 'Matte', value: 'matte', active: true, sortOrder: 4 },
      { id: 'ft5', label: 'Flat', value: 'flat', active: true, sortOrder: 5 },
      { id: 'ft6', label: 'Textured', value: 'textured', active: true, sortOrder: 6 },
      { id: 'ft7', label: 'Metallic', value: 'metallic', active: true, sortOrder: 7 },
      { id: 'ft8', label: 'Candy', value: 'candy', active: true, sortOrder: 8 },
      { id: 'ft9', label: 'Wrinkle', value: 'wrinkle', active: true, sortOrder: 9 },
      { id: 'ft10', label: 'Hammer', value: 'hammer', active: true, sortOrder: 10 },
    ],
  },
  {
    id: 'dl-paper', name: 'Sublimation Paper Types', systemKey: 'paperTypes',
    description: 'Transfer paper types used in the sublimation press',
    items: [
      { id: 'pt1', label: 'TexPrint-R', value: 'TexPrint-R', active: true, sortOrder: 1 },
      { id: 'pt2', label: 'TexPrint-DT', value: 'TexPrint-DT', active: true, sortOrder: 2 },
      { id: 'pt3', label: 'TexPrint-XPRES', value: 'TexPrint-XPRES', active: true, sortOrder: 3 },
      { id: 'pt4', label: 'Vapor Apparel', value: 'Vapor Apparel', active: true, sortOrder: 4 },
      { id: 'pt5', label: 'Other', value: 'Other', active: true, sortOrder: 5 },
    ],
  },
  {
    id: 'dl-manufacturer', name: 'Powder Manufacturers', systemKey: 'powderManufacturers',
    description: 'Powder coating product manufacturers',
    items: [
      { id: 'pm1', label: 'Tiger Drylac', value: 'Tiger Drylac', active: true, sortOrder: 1 },
      { id: 'pm2', label: 'Axalta', value: 'Axalta', active: true, sortOrder: 2 },
      { id: 'pm3', label: 'Sherwin-Williams', value: 'Sherwin-Williams', active: true, sortOrder: 3 },
      { id: 'pm4', label: 'AkzoNobel', value: 'AkzoNobel', active: true, sortOrder: 4 },
      { id: 'pm5', label: 'IGP', value: 'IGP', active: true, sortOrder: 5 },
      { id: 'pm6', label: 'Cardinal', value: 'Cardinal', active: true, sortOrder: 6 },
      { id: 'pm7', label: 'PPG', value: 'PPG', active: true, sortOrder: 7 },
      { id: 'pm8', label: 'Interpon', value: 'Interpon', active: true, sortOrder: 8 },
      { id: 'pm9', label: 'Dupont', value: 'Dupont', active: true, sortOrder: 9 },
    ],
  },
  {
    id: 'dl-material', name: 'Part Materials', systemKey: 'partMaterials',
    description: 'Substrate / part material options',
    items: [
      { id: 'mat1', label: 'Steel', value: 'Steel', active: true, sortOrder: 1 },
      { id: 'mat2', label: 'Aluminum', value: 'Aluminum', active: true, sortOrder: 2 },
      { id: 'mat3', label: 'Stainless Steel', value: 'Stainless Steel', active: true, sortOrder: 3 },
      { id: 'mat4', label: 'Galvanized Steel', value: 'Galvanized Steel', active: true, sortOrder: 4 },
      { id: 'mat5', label: 'Cast Iron', value: 'Cast Iron', active: true, sortOrder: 5 },
      { id: 'mat6', label: 'Zinc', value: 'Zinc', active: true, sortOrder: 6 },
      { id: 'mat7', label: 'Brass', value: 'Brass', active: true, sortOrder: 7 },
      { id: 'mat8', label: 'Copper', value: 'Copper', active: true, sortOrder: 8 },
      { id: 'mat9', label: 'MDF', value: 'MDF', active: true, sortOrder: 9 },
    ],
  },
  {
    id: 'dl-pretreat', name: 'Pretreatment Methods', systemKey: 'pretreatmentMethods',
    description: 'Surface preparation steps for powder coating',
    items: [
      { id: 'pre1', label: 'Chemical Wash / Degreasing', value: 'degreasing', active: true, sortOrder: 1 },
      { id: 'pre2', label: 'Iron Phosphate', value: 'iron_phosphate', active: true, sortOrder: 2 },
      { id: 'pre3', label: 'Zinc Phosphate', value: 'zinc_phosphate', active: true, sortOrder: 3 },
      { id: 'pre4', label: 'Chrome-Free (Oxsilan)', value: 'chrome_free', active: true, sortOrder: 4 },
      { id: 'pre5', label: 'Sandblast', value: 'sandblast', active: true, sortOrder: 5 },
      { id: 'pre6', label: 'DI Water Rinse', value: 'rinse', active: true, sortOrder: 6 },
      { id: 'pre7', label: 'Sealer', value: 'sealer', active: true, sortOrder: 7 },
    ],
  },
  {
    id: 'dl-service', name: 'Service Types', systemKey: 'serviceTypes',
    description: 'Types of coating services offered',
    items: [
      { id: 'sv1', label: 'Powder Coating', value: 'powder_coating', active: true, sortOrder: 1 },
      { id: 'sv2', label: 'Sublimation', value: 'sublimation', active: true, sortOrder: 2 },
      { id: 'sv3', label: 'Both', value: 'both', active: true, sortOrder: 3 },
      { id: 'sv4', label: 'Masking Only', value: 'masking_only', active: true, sortOrder: 4 },
      { id: 'sv5', label: 'Other', value: 'other', active: true, sortOrder: 5 },
    ],
  },
  {
    id: 'dl-appmethod', name: 'Application Methods', systemKey: 'applicationMethods',
    description: 'Powder application method / line type',
    items: [
      { id: 'am1', label: 'SAT Vertical Cube Line (Horizontal)', value: 'horizontal_line', active: true, sortOrder: 1 },
      { id: 'am2', label: 'Vertical Line', value: 'vertical_line', active: true, sortOrder: 2 },
      { id: 'am3', label: 'Batch Booth', value: 'batch_booth', active: true, sortOrder: 3 },
      { id: 'am4', label: 'Manual Touch-Up', value: 'manual_touchup', active: true, sortOrder: 4 },
    ],
  },
];

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // ── Hydration (from API) ──────────────────────────────────────────────────
    case '_HYDRATE_STATE': return { ...state, ...action.payload };
    case '_SET_API_CONNECTED': return { ...state, apiConnected: action.payload };
    case '_SET_ONLINE_USERS': return { ...state, onlineUsers: action.payload };

    // ── Customers ─────────────────────────────────────────────────────────────
    case 'SET_CUSTOMERS': return { ...state, customers: action.payload };
    case 'ADD_CUSTOMER': return { ...state, customers: [...state.customers, action.payload] };
    case 'UPDATE_CUSTOMER': return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) };

    // ── Jobs ──────────────────────────────────────────────────────────────────
    case 'SET_JOBS': return { ...state, jobs: action.payload };
    case 'ADD_JOB': return { ...state, jobs: [...state.jobs, action.payload] };
    case 'UPDATE_JOB': return { ...state, jobs: state.jobs.map(j => j.id === action.payload.id ? action.payload : j) };

    // ── Quotes ────────────────────────────────────────────────────────────────
    case 'SET_QUOTES': return { ...state, quotes: action.payload };
    case 'ADD_QUOTE': return { ...state, quotes: [...state.quotes, action.payload] };
    case 'UPDATE_QUOTE': return { ...state, quotes: state.quotes.map(q => q.id === action.payload.id ? action.payload : q) };

    // ── Invoices ──────────────────────────────────────────────────────────────
    case 'SET_INVOICES': return { ...state, invoices: action.payload };
    case 'ADD_INVOICE': return { ...state, invoices: [...state.invoices, action.payload] };
    case 'UPDATE_INVOICE': return { ...state, invoices: state.invoices.map(i => i.id === action.payload.id ? action.payload : i) };

    // ── Inventory ─────────────────────────────────────────────────────────────
    case 'SET_INVENTORY': return { ...state, inventory: action.payload };
    case 'UPDATE_INVENTORY_ITEM': return { ...state, inventory: state.inventory.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'ADD_INVENTORY_ITEM': return { ...state, inventory: [...state.inventory, action.payload] };

    // ── Batches / QC / Transactions ───────────────────────────────────────────
    case 'UPDATE_BATCH': return { ...state, batches: state.batches.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'ADD_BATCH': return { ...state, batches: [...state.batches, action.payload] };
    case 'ADD_QC': return { ...state, qcInspections: [...state.qcInspections, action.payload] };
    case 'UPDATE_QC': return { ...state, qcInspections: state.qcInspections.map(q => q.id === action.payload.id ? action.payload : q) };
    case 'ADD_INV_TRANSACTION': return { ...state, inventoryTransactions: [...state.inventoryTransactions, action.payload] };

    // ── Maintenance ───────────────────────────────────────────────────────────
    case 'ADD_MAINTENANCE': return { ...state, maintenanceTasks: [...state.maintenanceTasks, action.payload] };
    case 'UPDATE_MAINTENANCE': return { ...state, maintenanceTasks: state.maintenanceTasks.map(m => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MAINTENANCE': return { ...state, maintenanceTasks: state.maintenanceTasks.filter(m => m.id !== action.payload) };

    // ── NCR / Shipments / Receipts ────────────────────────────────────────────
    case 'ADD_NCR': return { ...state, ncrs: [...state.ncrs, action.payload] };
    case 'UPDATE_NCR': return { ...state, ncrs: state.ncrs.map(n => n.id === action.payload.id ? action.payload : n) };
    case 'ADD_SHIPMENT': return { ...state, shipments: [...state.shipments, action.payload] };
    case 'UPDATE_SHIPMENT': return { ...state, shipments: state.shipments.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_RECEIPT': return { ...state, receipts: [...state.receipts, action.payload] };
    case 'UPDATE_RECEIPT': return { ...state, receipts: state.receipts.map(r => r.id === action.payload.id ? action.payload : r) };

    // ── Spare Parts / Work Instructions / Suppliers ───────────────────────────
    case 'ADD_SPARE_PART': return { ...state, spareParts: [...state.spareParts, action.payload] };
    case 'UPDATE_SPARE_PART': return { ...state, spareParts: state.spareParts.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SPARE_PART': return { ...state, spareParts: state.spareParts.filter(s => s.id !== action.payload) };
    case 'ADD_WORK_INSTRUCTION': return { ...state, workInstructions: [...state.workInstructions, action.payload] };
    case 'UPDATE_WORK_INSTRUCTION': return { ...state, workInstructions: state.workInstructions.map(w => w.id === action.payload.id ? action.payload : w) };
    case 'ADD_SUPPLIER': return { ...state, criticalSuppliers: [...state.criticalSuppliers, action.payload] };
    case 'UPDATE_SUPPLIER': return { ...state, criticalSuppliers: state.criticalSuppliers.map(s => s.id === action.payload.id ? action.payload : s) };

    // ── Employees / HR ────────────────────────────────────────────────────────
    case 'ADD_EMPLOYEE': return { ...state, employees: [...state.employees, action.payload] };
    case 'UPDATE_EMPLOYEE': return { ...state, employees: state.employees.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'ADD_ATTENDANCE': return { ...state, attendanceRecords: [...state.attendanceRecords, action.payload] };
    case 'UPDATE_ATTENDANCE': return { ...state, attendanceRecords: state.attendanceRecords.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'ADD_TRAINING': return { ...state, trainingRecords: [...state.trainingRecords, action.payload] };
    case 'UPDATE_TRAINING': return { ...state, trainingRecords: state.trainingRecords.map(t => t.id === action.payload.id ? action.payload : t) };

    // ── CRM / Logistics / Costing ─────────────────────────────────────────────
    case 'ADD_SCAN_EVENT': return { ...state, scanEvents: [action.payload, ...state.scanEvents] };
    case 'ADD_JOB_ORDER': return { ...state, jobOrders: [...state.jobOrders, action.payload] };
    case 'UPDATE_JOB_ORDER': return { ...state, jobOrders: state.jobOrders.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'ADD_CRM_ACTIVITY': return { ...state, crmActivities: [action.payload, ...state.crmActivities] };
    case 'UPDATE_CRM_ACTIVITY': return { ...state, crmActivities: state.crmActivities.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'ADD_CRM_OPPORTUNITY': return { ...state, crmOpportunities: [...state.crmOpportunities, action.payload] };
    case 'UPDATE_CRM_OPPORTUNITY': return { ...state, crmOpportunities: state.crmOpportunities.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'DELETE_CRM_OPPORTUNITY': return { ...state, crmOpportunities: state.crmOpportunities.filter(o => o.id !== action.payload) };
    case 'ADD_LOGISTICS_STOP': return { ...state, logisticsStops: [...state.logisticsStops, action.payload] };
    case 'UPDATE_LOGISTICS_STOP': return { ...state, logisticsStops: state.logisticsStops.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_LOGISTICS_STOP': return { ...state, logisticsStops: state.logisticsStops.filter(s => s.id !== action.payload) };
    case 'ADD_DRIVER_RUN_SHEET': return { ...state, driverRunSheets: [...state.driverRunSheets, action.payload] };
    case 'UPDATE_DRIVER_RUN_SHEET': return { ...state, driverRunSheets: state.driverRunSheets.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'ADD_WORKSTATION_SESSION': return { ...state, workstationSessions: [action.payload, ...state.workstationSessions] };
    case 'UPDATE_WORKSTATION_SESSION': return { ...state, workstationSessions: state.workstationSessions.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_COST_ENTRY': return { ...state, costEntries: [...state.costEntries, action.payload] };
    case 'UPDATE_COST_ENTRY': return { ...state, costEntries: state.costEntries.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'ADD_MAINTENANCE_SCHEDULE': return { ...state, maintenanceSchedules: [...state.maintenanceSchedules, action.payload] };
    case 'UPDATE_MAINTENANCE_SCHEDULE': return { ...state, maintenanceSchedules: state.maintenanceSchedules.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_MAINTENANCE_SCHEDULE': return { ...state, maintenanceSchedules: state.maintenanceSchedules.filter(s => s.id !== action.payload) };

    // ── UI / Auth ─────────────────────────────────────────────────────────────
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'ADD_NOTIFICATION': return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATIONS_READ': return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case 'SET_CURRENT_USER': return { ...state, currentUser: action.payload, loggedIn: true };
    case 'LOGOUT': return { ...state, loggedIn: false, apiConnected: false, onlineUsers: [] };
    case 'SET_DEMO_MODE': return { ...state, demoMode: action.payload };
    case 'ADD_USER': return { ...state, users: [...state.users, action.payload] };
    case 'UPDATE_USER': return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
    case 'ADD_CUSTOM_ROLE': return { ...state, customRoles: [...state.customRoles, action.payload] };
    case 'UPDATE_CUSTOM_ROLE': return { ...state, customRoles: state.customRoles.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_CUSTOM_ROLE': return { ...state, customRoles: state.customRoles.filter(r => r.id !== action.payload) };
    // ── Vendors ───────────────────────────────────────────────────────────────
    case 'ADD_VENDOR': return { ...state, vendors: [...state.vendors, action.payload] };
    case 'UPDATE_VENDOR': return { ...state, vendors: state.vendors.map(v => v.id === action.payload.id ? action.payload : v) };
    case 'DELETE_VENDOR': return { ...state, vendors: state.vendors.filter(v => v.id !== action.payload) };
    case 'SET_VENDORS': return { ...state, vendors: action.payload };
    // ── Purchase Orders ──────────────────────────────────────────────────────
    case 'ADD_PURCHASE_ORDER': return { ...state, purchaseOrders: [...state.purchaseOrders, action.payload] };
    case 'UPDATE_PURCHASE_ORDER': return { ...state, purchaseOrders: state.purchaseOrders.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PURCHASE_ORDER': return { ...state, purchaseOrders: state.purchaseOrders.filter(p => p.id !== action.payload) };
    // ── Vendor Bills ─────────────────────────────────────────────────────────
    case 'ADD_VENDOR_BILL': return { ...state, vendorBills: [...state.vendorBills, action.payload] };
    case 'UPDATE_VENDOR_BILL': return { ...state, vendorBills: state.vendorBills.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_VENDOR_BILL': return { ...state, vendorBills: state.vendorBills.filter(b => b.id !== action.payload) };
    // ── Brokerage ─────────────────────────────────────────────────────────────
    case 'ADD_BROKERAGE_RECORD': return { ...state, brokerageRecords: [action.payload, ...state.brokerageRecords] };
    case 'UPDATE_BROKERAGE_RECORD': return { ...state, brokerageRecords: state.brokerageRecords.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_BROKERAGE_RECORD': return { ...state, brokerageRecords: state.brokerageRecords.filter(r => r.id !== action.payload) };
    // ── QB Settings ───────────────────────────────────────────────────────────
    case 'UPDATE_QB_SETTINGS': return { ...state, qbSettings: { ...state.qbSettings, ...action.payload } };
    case 'ADD_QB_IMPORT_SESSION': return { ...state, qbImportHistory: [action.payload, ...state.qbImportHistory].slice(0, 50) };
    // ── SAT Vertical Line / VISICOAT ─────────────────────────────────────────
    case 'ADD_VISICOAT_RECIPE': return { ...state, visicoatRecipes: [...state.visicoatRecipes, action.payload] };
    case 'UPDATE_VISICOAT_RECIPE': return { ...state, visicoatRecipes: state.visicoatRecipes.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_VISICOAT_RECIPE': return { ...state, visicoatRecipes: state.visicoatRecipes.filter(r => r.id !== action.payload) };
    case 'ADD_SAT_BATCH_LOG': return { ...state, satBatchLogs: [action.payload, ...state.satBatchLogs] };
    case 'UPDATE_SAT_BATCH_LOG': return { ...state, satBatchLogs: state.satBatchLogs.map(l => l.id === action.payload.id ? action.payload : l) };

    case 'ADD_AUDIT_ENTRY': return { ...state, auditLog: [action.payload, ...state.auditLog].slice(0, 500) };
    case 'CLEAR_AUDIT_LOG': return { ...state, auditLog: [] };
    case 'SET_DROPDOWN_LIST': return {
      ...state,
      customDropdowns: state.customDropdowns.some(d => d.id === action.payload.id)
        ? state.customDropdowns.map(d => d.id === action.payload.id ? action.payload : d)
        : [...state.customDropdowns, action.payload],
    };
    case 'DELETE_DROPDOWN_LIST': return { ...state, customDropdowns: state.customDropdowns.filter(d => d.id !== action.payload) };

    // ── Equipment Runtime ─────────────────────────────────────────────────────
    case 'START_EQUIPMENT_RUNTIME': {
      const id = action.payload;
      const existing = state.equipmentRuntime[id] ?? { equipmentId: id, runtimeHoursTotal: 0 };
      if (existing.runtimeSessionStart) return state;
      return { ...state, equipmentRuntime: { ...state.equipmentRuntime, [id]: { ...existing, runtimeSessionStart: new Date().toISOString() } } };
    }
    case 'STOP_EQUIPMENT_RUNTIME': {
      const id = action.payload;
      const existing = state.equipmentRuntime[id];
      if (!existing?.runtimeSessionStart) return state;
      const elapsed = (Date.now() - new Date(existing.runtimeSessionStart).getTime()) / 3_600_000;
      return { ...state, equipmentRuntime: { ...state.equipmentRuntime, [id]: { ...existing, runtimeHoursTotal: existing.runtimeHoursTotal + elapsed, runtimeSessionStart: undefined } } };
    }
    case 'ADD_EQUIPMENT':
      return { ...state, equipment: [...state.equipment, action.payload] };
    case 'UPDATE_EQUIPMENT':
      return { ...state, equipment: state.equipment.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'ARCHIVE_EQUIPMENT':
      return { ...state, equipment: state.equipment.map(e => e.id === action.payload ? { ...e, status: 'retired' as const } : e) };
    case 'LOG_MAINTENANCE_SERVICE': {
      const { scheduleId, serviceHours, completedByName } = action.payload;
      const now = new Date().toISOString();
      return {
        ...state,
        maintenanceSchedules: state.maintenanceSchedules.map(s => {
          if (s.id !== scheduleId) return s;
          return { ...s, lastServiceHours: serviceHours, lastServiceDate: now.slice(0, 10), currentHours: 0, status: 'ok' as const, updatedAt: now.slice(0, 10), ...(completedByName ? { assignedToName: completedByName } : {}) };
        }),
      };
    }

    // ── Incoming Shipments ────────────────────────────────────────────────────
    case 'ADD_INCOMING_SHIPMENT':
      return { ...state, incomingShipments: [action.payload, ...state.incomingShipments] };
    case 'UPDATE_INCOMING_SHIPMENT':
      return { ...state, incomingShipments: state.incomingShipments.map(s => s.id === action.payload.id ? action.payload : s) };

    // ── Pending Job Orders ────────────────────────────────────────────────────
    case 'ADD_PENDING_JOB_ORDER':
      return { ...state, pendingJobOrders: [action.payload, ...state.pendingJobOrders] };
    case 'UPDATE_PENDING_JOB_ORDER':
      return { ...state, pendingJobOrders: state.pendingJobOrders.map(p => p.id === action.payload.id ? action.payload : p) };

    // ── Saved Parts Library ───────────────────────────────────────────────────
    case 'ADD_SAVED_PART':
      return { ...state, savedParts: [action.payload, ...state.savedParts] };
    case 'UPDATE_SAVED_PART':
      return { ...state, savedParts: state.savedParts.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_SAVED_PART':
      return { ...state, savedParts: state.savedParts.filter(p => p.id !== action.payload) };

    // ── Process Sessions ──────────────────────────────────────────────────────
    case 'ADD_PROCESS_SESSION':
      return { ...state, processSessions: [action.payload, ...state.processSessions] };
    case 'UPDATE_PROCESS_SESSION':
      return { ...state, processSessions: state.processSessions.map(s => s.id === action.payload.id ? action.payload : s) };

    // ── Quality & Compliance ──────────────────────────────────────────────────
    case 'ADD_OVEN_CURE_LOG':
      return { ...state, ovenCureLogs: [action.payload, ...state.ovenCureLogs] };
    case 'UPDATE_OVEN_CURE_LOG':
      return { ...state, ovenCureLogs: state.ovenCureLogs.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'ADD_CHEMICAL_BATH_LOG':
      return { ...state, chemicalBathLogs: [action.payload, ...state.chemicalBathLogs] };
    case 'UPDATE_CHEMICAL_BATH_LOG':
      return { ...state, chemicalBathLogs: state.chemicalBathLogs.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'ADD_CERTIFICATE':
      return { ...state, certificates: [action.payload, ...state.certificates] };
    case 'UPDATE_CERTIFICATE':
      return { ...state, certificates: state.certificates.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'ADD_REWORK_RECORD':
      return { ...state, reworkRecords: [action.payload, ...state.reworkRecords] };
    case 'UPDATE_REWORK_RECORD':
      return { ...state, reworkRecords: state.reworkRecords.map(r => r.id === action.payload.id ? action.payload : r) };

    default: return state;
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

const saved = loadState();

const initialState: AppState = {
  customers: saved.customers ?? CUSTOMERS,
  jobs: saved.jobs ?? JOBS,
  quotes: saved.quotes ?? QUOTES,
  invoices: saved.invoices ?? INVOICES,
  inventory: saved.inventory ?? INVENTORY,
  equipment: EQUIPMENT,
  racks: saved.racks ?? RACKS,
  batches: saved.batches ?? BATCHES,
  qcInspections: saved.qcInspections ?? QC_INSPECTIONS,
  users: USERS,
  inventoryTransactions: saved.inventoryTransactions ?? INVENTORY_TRANSACTIONS,
  maintenanceTasks: saved.maintenanceTasks ?? MAINTENANCE_TASKS,
  ncrs: saved.ncrs ?? NCRS,
  shipments: saved.shipments ?? SHIPMENTS,
  receipts: saved.receipts ?? RECEIPTS,
  spareParts: saved.spareParts ?? SPARE_PARTS,
  workInstructions: saved.workInstructions ?? WORK_INSTRUCTIONS,
  criticalSuppliers: saved.criticalSuppliers ?? CRITICAL_SUPPLIERS,
  employees: saved.employees ?? EMPLOYEES,
  attendanceRecords: saved.attendanceRecords ?? ATTENDANCE_RECORDS,
  trainingRecords: saved.trainingRecords ?? TRAINING_RECORDS,
  scanEvents: saved.scanEvents ?? [],
  jobOrders: saved.jobOrders ?? [],
  crmActivities: saved.crmActivities ?? [],
  crmOpportunities: saved.crmOpportunities ?? [],
  logisticsStops: saved.logisticsStops ?? [],
  driverRunSheets: saved.driverRunSheets ?? [],
  workstationSessions: saved.workstationSessions ?? [],
  costEntries: saved.costEntries ?? [],
  maintenanceSchedules: saved.maintenanceSchedules ?? MAINTENANCE_SCHEDULES,
  equipmentRuntime: saved.equipmentRuntime ?? EQUIPMENT_RUNTIME_DATA,
  incomingShipments: saved.incomingShipments ?? [],
  pendingJobOrders: saved.pendingJobOrders ?? [],
  savedParts: saved.savedParts ?? [],
  processSessions: saved.processSessions ?? [],
  ovenCureLogs: saved.ovenCureLogs ?? [],
  chemicalBathLogs: saved.chemicalBathLogs ?? [],
  certificates: saved.certificates ?? [],
  reworkRecords: saved.reworkRecords ?? [],
  customRoles: saved.customRoles ?? [],
  vendors: saved.vendors ?? VENDORS,
  purchaseOrders: saved.purchaseOrders ?? PURCHASE_ORDERS,
  vendorBills: saved.vendorBills ?? VENDOR_BILLS,
  brokerageRecords: saved.brokerageRecords ?? [],
  qbSettings: saved.qbSettings ?? DEFAULT_QB_SETTINGS,
  qbImportHistory: saved.qbImportHistory ?? [],
  visicoatRecipes: saved.visicoatRecipes ?? VISICOAT_RECIPES,
  satBatchLogs: saved.satBatchLogs ?? SAT_BATCH_LOGS,
  customDropdowns: saved.customDropdowns ?? DEFAULT_DROPDOWNS,
  currentUser: (saved.currentUser ? USERS.find(u => u.id === (saved.currentUser as User).id) ?? USERS[0] : USERS[0]),
  loggedIn: saved.loggedIn ?? false,
  demoMode: localStorage.getItem('coatpro_demo_mode') === 'true',
  auditLog: saved.auditLog ?? [],
  sidebarOpen: saved.sidebarOpen ?? true,
  notifications: [
    { id: 'n1', type: 'warning', message: 'Low stock: Axalta Pure White Gloss — 18 lbs remaining', timestamp: new Date().toISOString(), read: false },
    { id: 'n2', type: 'info', message: 'Job WO-2026-0104 ready for QC inspection', timestamp: new Date().toISOString(), read: false },
    { id: 'n3', type: 'error', message: 'Maintenance overdue: Batch Powder Line — Element Inspection', timestamp: new Date().toISOString(), read: false },
    { id: 'n4', type: 'success', message: 'Invoice INV-2026-0088 marked as paid', timestamp: new Date().toISOString(), read: true },
  ],
  apiConnected: false,
  onlineUsers: [],
};

// ─── RBAC helpers (exported for use across the app) ──────────────────────────

/** Numeric rank: lower = more privileged. admin=1, manager=2, supervisor=3, operator=4, sales/viewer=5 */
export const ROLE_LEVEL: Record<string, number> = {
  admin: 1, manager: 2, supervisor: 3, operator: 4, sales: 5, viewer: 5,
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Owner / Admin', manager: 'Manager', supervisor: 'Supervisor',
  operator: 'Operator', sales: 'Sales', viewer: 'Viewer',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Current user's numeric rank level (1=admin … 5=viewer) */
  roleLevel: number;
  /**
   * Returns true if the current user has at least the required privilege level.
   * `minLevel` matches the PRIVILEGES matrix in AdminConsole:
   *   1 = admin only, 2 = manager+, 3 = supervisor+, 4 = operator+, 5 = all
   */
  can: (minLevel: number) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);

  // ── Ref to track demoMode in the dispatch closure without stale state ───────
  const demoModeRef = useRef(initialState.demoMode);
  useEffect(() => { demoModeRef.current = state.demoMode; }, [state.demoMode]);

  // ── Persist demoMode to its own localStorage key ──────────────────────────
  useEffect(() => {
    localStorage.setItem('coatpro_demo_mode', state.demoMode ? 'true' : 'false');
  }, [state.demoMode]);

  // ── syncedDispatch: wraps rawDispatch with API background sync ──────────────
  const dispatch = useCallback((action: Action) => {
    // 1. Apply locally immediately (optimistic update)
    rawDispatch(action);

    // 2. Skip sync for local-only and internal actions
    if (LOCAL_ONLY_ACTIONS.has(action.type)) return;

    // 3a. Sync to Supabase — skipped in demo mode
    if (isSupabaseReady && !demoModeRef.current) {
      dbSync(action.type, (action as any).payload ?? null);
    }

    // 3b. Sync to legacy REST API if connected (optional — remove once Supabase is sole backend)
    const socketId = getSocketId();
    api.mutation(action.type, (action as any).payload ?? null, socketId);
  }, []);

  // ── Persist to localStorage (offline fallback) ────────────────────────────
  useEffect(() => {
    const { equipment, notifications, workInstructions, scanEvents: _se, apiConnected: _ac, onlineUsers: _ou, ...persistable } = state;
    void equipment; void notifications; void workInstructions; void _se; void _ac; void _ou;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable)); } catch {}
  }, [state]);

  // ── On login: load state from Supabase + legacy API + connect socket ────────
  useEffect(() => {
    if (!state.loggedIn) return;

    let cancelled = false;

    // Run both sources in parallel — Supabase is authoritative when configured
    Promise.allSettled([
      isSupabaseReady ? dbLoadAppState() : Promise.resolve({}),
      api.loadState(getSocketId()).catch(() => ({})),
    ]).then(([supabaseResult, apiResult]) => {
      if (cancelled) return;

      const supabaseState = supabaseResult.status === 'fulfilled' ? supabaseResult.value : {};
      const apiState      = apiResult.status      === 'fulfilled' ? apiResult.value      : {};

      // Layer: API state first (base), then Supabase on top (authoritative)
      // Supabase wins for every slice it has data for
      const merged: Partial<AppState> = { ...(apiState as Partial<AppState>), ...(supabaseState as Partial<AppState>) };

      if (Object.keys(merged).length > 0) {
        rawDispatch({ type: '_HYDRATE_STATE', payload: merged });
      }
      rawDispatch({ type: '_SET_API_CONNECTED', payload: true });
    }).catch((err) => {
      console.warn('[AppContext] Could not load remote state, using localStorage fallback:', (err as Error).message);
    });

    return () => { cancelled = true; };
  }, [state.loggedIn]);

  // ── Socket.io: receive mutations from other clients ────────────────────────
  useEffect(() => {
    if (!state.loggedIn) return;

    const unsubMutation = onSocket<{ type: string; payload: unknown }>('state:mutation', ({ type, payload }) => {
      // Apply the incoming mutation directly via rawDispatch (not syncedDispatch — no re-broadcast)
      rawDispatch({ type: type as Action['type'], payload } as Action);
    });

    const unsubOnline = onSocket<OnlineUser[]>('users:online', (users) => {
      rawDispatch({ type: '_SET_ONLINE_USERS', payload: users });
    });

    return () => {
      unsubMutation();
      unsubOnline();
    };
  }, [state.loggedIn]);

  // ── Login function ─────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const { accessToken, user } = await api.login(email, password);
    setAccessToken(accessToken);

    // Map API user to the User type expected by existing components
    const erpUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatarInitials: user.avatarInitials || user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      phone: user.phone,
      active: user.active,
      createdAt: user.createdAt ?? new Date().toISOString(),
    };

    rawDispatch({ type: 'SET_CURRENT_USER', payload: erpUser });

    // Connect socket with the fresh token
    connectSocket(accessToken);
  }, []);

  // ── Logout function ────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    await api.logout().catch(() => {});
    clearAccessToken();
    disconnectSocket();
    rawDispatch({ type: 'LOGOUT' });
  }, []);

  // ── Session timeout — auto-logout on inactivity ───────────────────────────
  const logoutRef = useRef(logout);
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  useEffect(() => {
    if (!state.loggedIn) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      const ms = loadSessionTimeout() * 60_000;
      if (ms > 0) timer = setTimeout(() => { void logoutRef.current(); }, ms);
    };

    const reset = () => schedule();
    const events = ['mousedown', 'keydown', 'touchstart', 'pointermove'] as const;
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [state.loggedIn]);

  // ── On app load: try to restore session from refresh cookie ───────────────
  useEffect(() => {
    if (state.loggedIn) return; // Already logged in

    tryRestoreSession().then((session) => {
      if (!session) return;
      const erpUser: User = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        department: session.user.department,
        avatarInitials: session.user.avatarInitials || '',
        phone: session.user.phone,
        active: session.user.active,
        createdAt: session.user.createdAt ?? new Date().toISOString(),
      };
      rawDispatch({ type: 'SET_CURRENT_USER', payload: erpUser });
      connectSocket(session.accessToken);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const roleLevel = ROLE_LEVEL[state.currentUser?.role ?? 'viewer'] ?? 5;
  const can = useCallback((minLevel: number) => roleLevel <= minLevel, [roleLevel]);

  const contextValue = useMemo(
    () => ({ state, dispatch, login, logout, roleLevel, can }),
    [state, dispatch, login, logout, roleLevel, can],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// Export login/logout for components that need them directly
export function useAuth() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAuth must be used within AppProvider');
  return { login: ctx.login, logout: ctx.logout, user: ctx.state.currentUser, loggedIn: ctx.state.loggedIn };
}
