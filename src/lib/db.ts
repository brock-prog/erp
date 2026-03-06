// src/lib/db.ts — Supabase database helpers
// Each table stores one row per entity as { id, data (jsonb), updated_at }.
// This maps cleanly onto the existing AppState slices with zero schema drift.

import { supabase } from './supabase';

// ─── Table names ──────────────────────────────────────────────────────────────

export const TABLES = {
  customers:              'decora_customers',
  jobs:                   'decora_jobs',
  quotes:                 'decora_quotes',
  invoices:               'decora_invoices',
  inventory:              'decora_inventory_items',
  inventoryTransactions:  'decora_inventory_transactions',
  incomingShipments:      'decora_incoming_shipments',
  pendingJobOrders:       'decora_pending_job_orders',
  savedParts:             'decora_saved_parts',
  processSessions:        'decora_process_sessions',
  employees:              'decora_employees',
  receipts:               'decora_receipts',
  shipments:              'decora_shipments',
  maintenanceSchedules:   'decora_maintenance_schedules',
  maintenanceTasks:       'decora_maintenance_tasks',
  crmOpportunities:       'decora_crm_opportunities',
  crmActivities:          'decora_crm_activities',
  jobOrders:              'decora_job_orders',
  costEntries:            'decora_cost_entries',
  scanEvents:             'decora_scan_events',
  ncrs:                   'decora_ncrs',
  qcInspections:          'decora_qc_inspections',
  vendors:                'decora_vendors',
  purchaseOrders:         'decora_purchase_orders',
  vendorBills:            'decora_vendor_bills',
} as const;

export type TableKey = keyof typeof TABLES;

// ─── Generic CRUD helpers ─────────────────────────────────────────────────────

/** Upsert a single record. Silently no-ops when Supabase is not configured. */
export async function dbUpsert(table: string, id: string, data: object): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(table)
    .upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) console.warn(`[db] upsert(${table}, ${id}):`, error.message);
}

/** Delete a record by id. */
export async function dbDelete(table: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.warn(`[db] delete(${table}, ${id}):`, error.message);
}

/** Load all records from a table, returns array of the original objects. */
export async function dbLoadAll<T = unknown>(table: string): Promise<T[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .order('updated_at', { ascending: true });
  if (error) {
    console.warn(`[db] loadAll(${table}):`, error.message);
    return [];
  }
  return (data ?? []).map(row => row.data as T);
}

// ─── Load full app state from Supabase ────────────────────────────────────────
// Returns only the slices that have rows — missing tables return empty arrays.

export interface DbAppState {
  customers?: unknown[];
  jobs?: unknown[];
  quotes?: unknown[];
  invoices?: unknown[];
  inventory?: unknown[];
  inventoryTransactions?: unknown[];
  incomingShipments?: unknown[];
  pendingJobOrders?: unknown[];
  savedParts?: unknown[];
  processSessions?: unknown[];
  employees?: unknown[];
  receipts?: unknown[];
  shipments?: unknown[];
  maintenanceSchedules?: unknown[];
  maintenanceTasks?: unknown[];
  crmOpportunities?: unknown[];
  crmActivities?: unknown[];
  jobOrders?: unknown[];
  costEntries?: unknown[];
  scanEvents?: unknown[];
  ncrs?: unknown[];
  qcInspections?: unknown[];
  vendors?: unknown[];
  purchaseOrders?: unknown[];
  vendorBills?: unknown[];
}

export async function dbLoadAppState(): Promise<DbAppState> {
  if (!supabase) return {};

  const results = await Promise.allSettled([
    dbLoadAll(TABLES.customers),
    dbLoadAll(TABLES.jobs),
    dbLoadAll(TABLES.quotes),
    dbLoadAll(TABLES.invoices),
    dbLoadAll(TABLES.inventory),
    dbLoadAll(TABLES.inventoryTransactions),
    dbLoadAll(TABLES.incomingShipments),
    dbLoadAll(TABLES.pendingJobOrders),
    dbLoadAll(TABLES.savedParts),
    dbLoadAll(TABLES.processSessions),
    dbLoadAll(TABLES.employees),
    dbLoadAll(TABLES.receipts),
    dbLoadAll(TABLES.shipments),
    dbLoadAll(TABLES.maintenanceSchedules),
    dbLoadAll(TABLES.maintenanceTasks),
    dbLoadAll(TABLES.crmOpportunities),
    dbLoadAll(TABLES.crmActivities),
    dbLoadAll(TABLES.jobOrders),
    dbLoadAll(TABLES.costEntries),
    dbLoadAll(TABLES.scanEvents),
    dbLoadAll(TABLES.ncrs),
    dbLoadAll(TABLES.qcInspections),
    dbLoadAll(TABLES.vendors),
    dbLoadAll(TABLES.purchaseOrders),
    dbLoadAll(TABLES.vendorBills),
  ]);

  const [
    customers, jobs, quotes, invoices, inventory, inventoryTransactions,
    incomingShipments, pendingJobOrders, savedParts, processSessions,
    employees, receipts, shipments, maintenanceSchedules, maintenanceTasks,
    crmOpportunities, crmActivities, jobOrders, costEntries, scanEvents,
    ncrs, qcInspections, vendors, purchaseOrders, vendorBills,
  ] = results.map(r => r.status === 'fulfilled' ? r.value : []);

  // Only include slices that actually returned data (don't clobber initial state with empty arrays)
  const state: DbAppState = {};
  const set = (key: keyof DbAppState, val: unknown[]) => { if (val.length > 0) (state as any)[key] = val; };
  set('customers',             customers as unknown[]);
  set('jobs',                  jobs as unknown[]);
  set('quotes',                quotes as unknown[]);
  set('invoices',              invoices as unknown[]);
  set('inventory',             inventory as unknown[]);
  set('inventoryTransactions', inventoryTransactions as unknown[]);
  set('incomingShipments',     incomingShipments as unknown[]);
  set('pendingJobOrders',      pendingJobOrders as unknown[]);
  set('savedParts',            savedParts as unknown[]);
  set('processSessions',       processSessions as unknown[]);
  set('employees',             employees as unknown[]);
  set('receipts',              receipts as unknown[]);
  set('shipments',             shipments as unknown[]);
  set('maintenanceSchedules',  maintenanceSchedules as unknown[]);
  set('maintenanceTasks',      maintenanceTasks as unknown[]);
  set('crmOpportunities',      crmOpportunities as unknown[]);
  set('crmActivities',         crmActivities as unknown[]);
  set('jobOrders',             jobOrders as unknown[]);
  set('costEntries',           costEntries as unknown[]);
  set('scanEvents',            scanEvents as unknown[]);
  set('ncrs',                  ncrs as unknown[]);
  set('qcInspections',         qcInspections as unknown[]);
  set('vendors',               vendors as unknown[]);
  set('purchaseOrders',        purchaseOrders as unknown[]);
  set('vendorBills',           vendorBills as unknown[]);
  return state;
}

// ─── Map action type → table + id extractor ──────────────────────────────────
// When an action fires, we upsert or delete the relevant row.

interface SyncRule {
  table: string;
  getId: (payload: any) => string;
  op: 'upsert' | 'delete';
}

const SYNC_RULES: Partial<Record<string, SyncRule>> = {
  ADD_CUSTOMER:             { table: TABLES.customers,             getId: p => p.id, op: 'upsert' },
  UPDATE_CUSTOMER:          { table: TABLES.customers,             getId: p => p.id, op: 'upsert' },
  ADD_JOB:                  { table: TABLES.jobs,                  getId: p => p.id, op: 'upsert' },
  UPDATE_JOB:               { table: TABLES.jobs,                  getId: p => p.id, op: 'upsert' },
  ADD_QUOTE:                { table: TABLES.quotes,                getId: p => p.id, op: 'upsert' },
  UPDATE_QUOTE:             { table: TABLES.quotes,                getId: p => p.id, op: 'upsert' },
  ADD_INVOICE:              { table: TABLES.invoices,              getId: p => p.id, op: 'upsert' },
  UPDATE_INVOICE:           { table: TABLES.invoices,              getId: p => p.id, op: 'upsert' },
  ADD_INVENTORY_ITEM:       { table: TABLES.inventory,             getId: p => p.id, op: 'upsert' },
  UPDATE_INVENTORY_ITEM:    { table: TABLES.inventory,             getId: p => p.id, op: 'upsert' },
  ADD_INV_TRANSACTION:      { table: TABLES.inventoryTransactions, getId: p => p.id, op: 'upsert' },
  ADD_INCOMING_SHIPMENT:    { table: TABLES.incomingShipments,     getId: p => p.id, op: 'upsert' },
  UPDATE_INCOMING_SHIPMENT: { table: TABLES.incomingShipments,     getId: p => p.id, op: 'upsert' },
  ADD_PENDING_JOB_ORDER:    { table: TABLES.pendingJobOrders,      getId: p => p.id, op: 'upsert' },
  UPDATE_PENDING_JOB_ORDER: { table: TABLES.pendingJobOrders,      getId: p => p.id, op: 'upsert' },
  ADD_SAVED_PART:           { table: TABLES.savedParts,            getId: p => p.id, op: 'upsert' },
  UPDATE_SAVED_PART:        { table: TABLES.savedParts,            getId: p => p.id, op: 'upsert' },
  ADD_PROCESS_SESSION:      { table: TABLES.processSessions,       getId: p => p.id, op: 'upsert' },
  UPDATE_PROCESS_SESSION:   { table: TABLES.processSessions,       getId: p => p.id, op: 'upsert' },
  ADD_EMPLOYEE:             { table: TABLES.employees,             getId: p => p.id, op: 'upsert' },
  UPDATE_EMPLOYEE:          { table: TABLES.employees,             getId: p => p.id, op: 'upsert' },
  ADD_RECEIPT:              { table: TABLES.receipts,              getId: p => p.id, op: 'upsert' },
  UPDATE_RECEIPT:           { table: TABLES.receipts,              getId: p => p.id, op: 'upsert' },
  ADD_SHIPMENT:             { table: TABLES.shipments,             getId: p => p.id, op: 'upsert' },
  UPDATE_SHIPMENT:          { table: TABLES.shipments,             getId: p => p.id, op: 'upsert' },
  ADD_MAINTENANCE_SCHEDULE: { table: TABLES.maintenanceSchedules,  getId: p => p.id, op: 'upsert' },
  UPDATE_MAINTENANCE_SCHEDULE: { table: TABLES.maintenanceSchedules, getId: p => p.id, op: 'upsert' },
  DELETE_MAINTENANCE_SCHEDULE: { table: TABLES.maintenanceSchedules, getId: p => p,   op: 'delete' },
  ADD_MAINTENANCE:          { table: TABLES.maintenanceTasks,      getId: p => p.id, op: 'upsert' },
  UPDATE_MAINTENANCE:       { table: TABLES.maintenanceTasks,      getId: p => p.id, op: 'upsert' },
  ADD_CRM_OPPORTUNITY:      { table: TABLES.crmOpportunities,      getId: p => p.id, op: 'upsert' },
  UPDATE_CRM_OPPORTUNITY:   { table: TABLES.crmOpportunities,      getId: p => p.id, op: 'upsert' },
  DELETE_CRM_OPPORTUNITY:   { table: TABLES.crmOpportunities,      getId: p => p,    op: 'delete' },
  ADD_CRM_ACTIVITY:         { table: TABLES.crmActivities,         getId: p => p.id, op: 'upsert' },
  UPDATE_CRM_ACTIVITY:      { table: TABLES.crmActivities,         getId: p => p.id, op: 'upsert' },
  ADD_JOB_ORDER:            { table: TABLES.jobOrders,             getId: p => p.id, op: 'upsert' },
  UPDATE_JOB_ORDER:         { table: TABLES.jobOrders,             getId: p => p.id, op: 'upsert' },
  ADD_COST_ENTRY:           { table: TABLES.costEntries,           getId: p => p.id, op: 'upsert' },
  UPDATE_COST_ENTRY:        { table: TABLES.costEntries,           getId: p => p.id, op: 'upsert' },
  ADD_SCAN_EVENT:           { table: TABLES.scanEvents,            getId: p => p.id, op: 'upsert' },
  ADD_NCR:                  { table: TABLES.ncrs,                  getId: p => p.id, op: 'upsert' },
  UPDATE_NCR:               { table: TABLES.ncrs,                  getId: p => p.id, op: 'upsert' },
  ADD_QC:                   { table: TABLES.qcInspections,         getId: p => p.id, op: 'upsert' },
  UPDATE_QC:                { table: TABLES.qcInspections,         getId: p => p.id, op: 'upsert' },
  // ── Procurement ──────────────────────────────────────────────────────────
  ADD_VENDOR:               { table: TABLES.vendors,               getId: p => p.id, op: 'upsert' },
  UPDATE_VENDOR:            { table: TABLES.vendors,               getId: p => p.id, op: 'upsert' },
  DELETE_VENDOR:            { table: TABLES.vendors,               getId: p => p,    op: 'delete' },
  ADD_PURCHASE_ORDER:       { table: TABLES.purchaseOrders,        getId: p => p.id, op: 'upsert' },
  UPDATE_PURCHASE_ORDER:    { table: TABLES.purchaseOrders,        getId: p => p.id, op: 'upsert' },
  DELETE_PURCHASE_ORDER:    { table: TABLES.purchaseOrders,        getId: p => p,    op: 'delete' },
  ADD_VENDOR_BILL:          { table: TABLES.vendorBills,           getId: p => p.id, op: 'upsert' },
  UPDATE_VENDOR_BILL:       { table: TABLES.vendorBills,           getId: p => p.id, op: 'upsert' },
  DELETE_VENDOR_BILL:       { table: TABLES.vendorBills,           getId: p => p,    op: 'delete' },
};

/** Called after every dispatched action to persist the change to Supabase. */
export function dbSync(actionType: string, payload: unknown): void {
  const rule = SYNC_RULES[actionType];
  if (!rule || !supabase) return;
  const id = rule.getId(payload);
  if (rule.op === 'upsert') {
    dbUpsert(rule.table, id, payload as object);
  } else {
    dbDelete(rule.table, id);
  }
}
