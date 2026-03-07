-- ═══════════════════════════════════════════════════════════════════════════
-- DECORA ERP — Full Supabase Setup (tables + indexes + RLS + backup protection)
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ─── Incoming Shipments ──────────────────────────────────────────────────────
create table if not exists decora_incoming_shipments (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_incoming_shipments enable row level security;
create policy "auth read"   on decora_incoming_shipments for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_incoming_shipments for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_incoming_shipments for update using (auth.role() = 'authenticated');

-- ─── Pending Job Orders ──────────────────────────────────────────────────────
create table if not exists decora_pending_job_orders (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_pending_job_orders enable row level security;
create policy "auth read"   on decora_pending_job_orders for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_pending_job_orders for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_pending_job_orders for update using (auth.role() = 'authenticated');

-- ─── Saved Parts ─────────────────────────────────────────────────────────────
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

-- ─── Process Sessions ────────────────────────────────────────────────────────
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

-- ─── Receipts ────────────────────────────────────────────────────────────────
create table if not exists decora_receipts (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_receipts enable row level security;
create policy "auth read"   on decora_receipts for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_receipts for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_receipts for update using (auth.role() = 'authenticated');

-- ─── Shipments ───────────────────────────────────────────────────────────────
create table if not exists decora_shipments (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_shipments enable row level security;
create policy "auth read"   on decora_shipments for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_shipments for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_shipments for update using (auth.role() = 'authenticated');

-- ─── Maintenance Schedules ───────────────────────────────────────────────────
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

-- ─── Maintenance Tasks ───────────────────────────────────────────────────────
create table if not exists decora_maintenance_tasks (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_maintenance_tasks enable row level security;
create policy "auth read"   on decora_maintenance_tasks for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_maintenance_tasks for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_maintenance_tasks for update using (auth.role() = 'authenticated');

-- ─── CRM Opportunities ──────────────────────────────────────────────────────
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

-- ─── CRM Activities ─────────────────────────────────────────────────────────
create table if not exists decora_crm_activities (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_crm_activities enable row level security;
create policy "auth read"   on decora_crm_activities for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_crm_activities for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_crm_activities for update using (auth.role() = 'authenticated');

-- ─── Job Orders ──────────────────────────────────────────────────────────────
create table if not exists decora_job_orders (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_job_orders enable row level security;
create policy "auth read"   on decora_job_orders for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_job_orders for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_job_orders for update using (auth.role() = 'authenticated');

-- ─── Cost Entries ────────────────────────────────────────────────────────────
create table if not exists decora_cost_entries (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_cost_entries enable row level security;
create policy "auth read"   on decora_cost_entries for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_cost_entries for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_cost_entries for update using (auth.role() = 'authenticated');

-- ─── Scan Events ─────────────────────────────────────────────────────────────
create table if not exists decora_scan_events (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_scan_events enable row level security;
create policy "auth read"   on decora_scan_events for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_scan_events for insert with check (auth.role() = 'authenticated');

-- ─── NCRs ────────────────────────────────────────────────────────────────────
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

-- ─── Vendors (Procurement) ───────────────────────────────────────────────────
create table if not exists decora_vendors (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_vendors enable row level security;
create policy "auth read"   on decora_vendors for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_vendors for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_vendors for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_vendors for delete using (auth.role() = 'authenticated');

-- ─── Purchase Orders (Procurement) ───────────────────────────────────────────
create table if not exists decora_purchase_orders (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_purchase_orders enable row level security;
create policy "auth read"   on decora_purchase_orders for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_purchase_orders for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_purchase_orders for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_purchase_orders for delete using (auth.role() = 'authenticated');

-- ─── Vendor Bills (Procurement) ──────────────────────────────────────────────
create table if not exists decora_vendor_bills (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table decora_vendor_bills enable row level security;
create policy "auth read"   on decora_vendor_bills for select using (auth.role() = 'authenticated');
create policy "auth write"  on decora_vendor_bills for insert with check (auth.role() = 'authenticated');
create policy "auth update" on decora_vendor_bills for update using (auth.role() = 'authenticated');
create policy "auth delete" on decora_vendor_bills for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
create index if not exists idx_incoming_shipments_status on decora_incoming_shipments ((data->>'status'));
create index if not exists idx_pending_jobs_status       on decora_pending_job_orders  ((data->>'status'));
create index if not exists idx_jobs_status               on decora_jobs                ((data->>'status'));
create index if not exists idx_inventory_category        on decora_inventory_items     ((data->>'category'));
create index if not exists idx_saved_parts_customer      on decora_saved_parts         ((data->>'customerId'));
create index if not exists idx_customers_name            on decora_customers           ((data->>'name'));

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table decora_incoming_shipments;
alter publication supabase_realtime add table decora_pending_job_orders;
alter publication supabase_realtime add table decora_jobs;
alter publication supabase_realtime add table decora_customers;
alter publication supabase_realtime add table decora_inventory_items;
alter publication supabase_realtime add table decora_saved_parts;

-- ═══════════════════════════════════════════════════════════════════════════
-- BACKUP PROTECTION — blocks mass deletes (> 50 rows)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION decora_prevent_mass_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_count  integer;
  threshold  integer := 50;
  override   text;
BEGIN
  BEGIN
    override := current_setting('decora.allow_mass_delete', true);
  EXCEPTION WHEN OTHERS THEN
    override := 'false';
  END;

  IF override = 'true' THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO row_count FROM old_table;

  IF row_count > threshold THEN
    RAISE EXCEPTION
      'DECORA SAFETY: Mass deletion blocked — attempted to delete % rows from %. '
      'To override, run: SET decora.allow_mass_delete = ''true''; before your DELETE.',
      row_count, TG_TABLE_NAME;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'decora_customers', 'decora_jobs', 'decora_quotes', 'decora_invoices',
    'decora_inventory_items', 'decora_inventory_transactions',
    'decora_incoming_shipments', 'decora_pending_job_orders',
    'decora_saved_parts', 'decora_process_sessions', 'decora_employees',
    'decora_receipts', 'decora_shipments', 'decora_maintenance_schedules',
    'decora_maintenance_tasks', 'decora_crm_opportunities', 'decora_crm_activities',
    'decora_job_orders', 'decora_cost_entries', 'decora_scan_events',
    'decora_ncrs', 'decora_qc_inspections',
    'decora_vendors', 'decora_purchase_orders', 'decora_vendor_bills'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_mass_delete ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_prevent_mass_delete '
      'AFTER DELETE ON %I '
      'REFERENCING OLD TABLE AS old_table '
      'FOR EACH STATEMENT '
      'EXECUTE FUNCTION decora_prevent_mass_delete()',
      tbl
    );
    RAISE NOTICE 'Protected: %', tbl;
  END LOOP;
END;
$$;
