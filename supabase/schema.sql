-- ═══════════════════════════════════════════════════════════════════════════
-- DECORA ERP — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query → Run
--
-- Architecture: each table stores one JSON object per entity row.
--   id          text PRIMARY KEY  — matches the app's generateId() UUID
--   data        jsonb NOT NULL    — the full serialized TypeScript object
--   updated_at  timestamptz       — used for ordering and conflict detection
--
-- Row Level Security (RLS): enabled on all tables.
-- Policy: authenticated users can read/write all rows (single-company ERP).
-- Tighten per-role in a future phase using auth.jwt() claims.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Helper: create a standard entity table ──────────────────────────────────
-- We repeat the DDL explicitly below so each table appears in the dashboard.

-- ─── Customers ───────────────────────────────────────────────────────────────
create table if not exists decora_customers (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_customers enable row level security;
create policy "auth read"   on decora_customers for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_customers for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_customers for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_customers for delete using (auth.role() = 'authenticated');

-- ─── Jobs / Work Orders ──────────────────────────────────────────────────────
create table if not exists decora_jobs (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_jobs enable row level security;
create policy "auth read"   on decora_jobs for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_jobs for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_jobs for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_jobs for delete using (auth.role() = 'authenticated');

-- ─── Quotes ──────────────────────────────────────────────────────────────────
create table if not exists decora_quotes (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_quotes enable row level security;
create policy "auth read"   on decora_quotes for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_quotes for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_quotes for update using (auth.role() = 'authenticated');

-- ─── Invoices ────────────────────────────────────────────────────────────────
create table if not exists decora_invoices (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_invoices enable row level security;
create policy "auth read"   on decora_invoices for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_invoices for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_invoices for update using (auth.role() = 'authenticated');

-- ─── Inventory Items ─────────────────────────────────────────────────────────
create table if not exists decora_inventory_items (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_inventory_items enable row level security;
create policy "auth read"   on decora_inventory_items for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_inventory_items for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_inventory_items for update using (auth.role() = 'authenticated');

-- ─── Inventory Transactions ──────────────────────────────────────────────────
create table if not exists decora_inventory_transactions (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_inventory_transactions enable row level security;
create policy "auth read"   on decora_inventory_transactions for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_inventory_transactions for insert with check (auth.role() = 'authenticated');

-- ─── Incoming Shipments (Receiving Kiosk) ────────────────────────────────────
create table if not exists decora_incoming_shipments (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_incoming_shipments enable row level security;
create policy "auth read"   on decora_incoming_shipments for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_incoming_shipments for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_incoming_shipments for update using (auth.role() = 'authenticated');

-- ─── Pending Job Orders (Post-Inspection Queue) ──────────────────────────────
create table if not exists decora_pending_job_orders (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_pending_job_orders enable row level security;
create policy "auth read"   on decora_pending_job_orders for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_pending_job_orders for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_pending_job_orders for update using (auth.role() = 'authenticated');

-- ─── Saved Parts / Profiles Library ─────────────────────────────────────────
-- Auto-populated from ReceivingKiosk part descriptions; searchable across kiosks.
create table if not exists decora_saved_parts (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_saved_parts enable row level security;
create policy "auth read"   on decora_saved_parts for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_saved_parts for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_saved_parts for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_saved_parts for delete using (auth.role() = 'authenticated');

-- ─── Process Sessions (Timer records) ────────────────────────────────────────
create table if not exists decora_process_sessions (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_process_sessions enable row level security;
create policy "auth read"   on decora_process_sessions for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_process_sessions for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_process_sessions for update using (auth.role() = 'authenticated');

-- ─── Employees ───────────────────────────────────────────────────────────────
create table if not exists decora_employees (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_employees enable row level security;
create policy "auth read"   on decora_employees for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_employees for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_employees for update using (auth.role() = 'authenticated');

-- ─── Receipts (Purchase Orders / Expected Deliveries) ────────────────────────
create table if not exists decora_receipts (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_receipts enable row level security;
create policy "auth read"   on decora_receipts for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_receipts for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_receipts for update using (auth.role() = 'authenticated');

-- ─── Outbound Shipments ───────────────────────────────────────────────────────
create table if not exists decora_shipments (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_shipments enable row level security;
create policy "auth read"   on decora_shipments for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_shipments for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_shipments for update using (auth.role() = 'authenticated');

-- ─── Maintenance Schedules ────────────────────────────────────────────────────
create table if not exists decora_maintenance_schedules (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_maintenance_schedules enable row level security;
create policy "auth read"   on decora_maintenance_schedules for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_maintenance_schedules for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_maintenance_schedules for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_maintenance_schedules for delete using (auth.role() = 'authenticated');

-- ─── Maintenance Tasks ────────────────────────────────────────────────────────
create table if not exists decora_maintenance_tasks (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_maintenance_tasks enable row level security;
create policy "auth read"   on decora_maintenance_tasks for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_maintenance_tasks for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_maintenance_tasks for update using (auth.role() = 'authenticated');

-- ─── NCRs (Non-Conformance Reports) ──────────────────────────────────────────
create table if not exists decora_ncrs (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_ncrs enable row level security;
create policy "auth read"   on decora_ncrs for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_ncrs for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_ncrs for update using (auth.role() = 'authenticated');

-- ─── QC Inspections ──────────────────────────────────────────────────────────
create table if not exists decora_qc_inspections (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_qc_inspections enable row level security;
create policy "auth read"   on decora_qc_inspections for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_qc_inspections for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_qc_inspections for update using (auth.role() = 'authenticated');

-- ─── CRM Opportunities ────────────────────────────────────────────────────────
create table if not exists decora_crm_opportunities (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_crm_opportunities enable row level security;
create policy "auth read"   on decora_crm_opportunities for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_crm_opportunities for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_crm_opportunities for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_crm_opportunities for delete using (auth.role() = 'authenticated');

-- ─── CRM Activities ───────────────────────────────────────────────────────────
create table if not exists decora_crm_activities (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_crm_activities enable row level security;
create policy "auth read"   on decora_crm_activities for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_crm_activities for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_crm_activities for update using (auth.role() = 'authenticated');

-- ─── Job Orders (Production Queue) ────────────────────────────────────────────
create table if not exists decora_job_orders (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_job_orders enable row level security;
create policy "auth read"   on decora_job_orders for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_job_orders for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_job_orders for update using (auth.role() = 'authenticated');

-- ─── Cost Entries ─────────────────────────────────────────────────────────────
create table if not exists decora_cost_entries (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_cost_entries enable row level security;
create policy "auth read"   on decora_cost_entries for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_cost_entries for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_cost_entries for update using (auth.role() = 'authenticated');

-- ─── Scan Events ──────────────────────────────────────────────────────────────
create table if not exists decora_scan_events (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_scan_events enable row level security;
create policy "auth read"   on decora_scan_events for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_scan_events for insert with check (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES — speed up common lookups
-- ═══════════════════════════════════════════════════════════════════════════
create index if not exists idx_incoming_shipments_status on decora_incoming_shipments ((data->>'status'));
create index if not exists idx_pending_jobs_status       on decora_pending_job_orders  ((data->>'status'));
create index if not exists idx_jobs_status               on decora_jobs                ((data->>'status'));
create index if not exists idx_inventory_category        on decora_inventory_items     ((data->>'category'));
create index if not exists idx_saved_parts_customer      on decora_saved_parts         ((data->>'customerId'));
create index if not exists idx_customers_name            on decora_customers           ((data->>'name'));

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME — enable CDC for live multi-tab / multi-user sync
-- ═══════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table decora_incoming_shipments;
alter publication supabase_realtime add table decora_pending_job_orders;
alter publication supabase_realtime add table decora_jobs;
alter publication supabase_realtime add table decora_customers;
alter publication supabase_realtime add table decora_inventory_items;
alter publication supabase_realtime add table decora_saved_parts;
