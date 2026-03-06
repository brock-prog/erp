-- backup-protection.sql — Supabase deletion protection for DECORA ERP
--
-- Prevents mass-deletion of data across all 22 decora_* tables.
-- Inspired by the DataTalks.Club incident where `terraform destroy`
-- wiped an entire production database including all snapshots.
--
-- This trigger blocks any single DELETE statement that would affect
-- more than 50 rows. Individual deletes (normal app operations) are
-- unaffected. To perform legitimate bulk deletes (e.g., data migration),
-- first set the session variable:
--
--   SET decora.allow_mass_delete = 'true';
--   DELETE FROM decora_customers WHERE ...;
--   RESET decora.allow_mass_delete;
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query).

-- ─── 1. Create the guard function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION decora_prevent_mass_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_count  integer;
  threshold  integer := 50;
  override   text;
BEGIN
  -- Check for explicit override
  BEGIN
    override := current_setting('decora.allow_mass_delete', true);
  EXCEPTION WHEN OTHERS THEN
    override := 'false';
  END;

  IF override = 'true' THEN
    RETURN NULL; -- Allow the delete
  END IF;

  -- Count how many rows this statement is deleting
  GET DIAGNOSTICS row_count = ROW_COUNT;

  -- For BEFORE triggers we can't use ROW_COUNT, so count affected rows
  -- We use a statement-level AFTER trigger with transition tables instead
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

-- ─── 2. Apply the trigger to all 22 decora_* tables ────────────────────────

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'decora_customers',
    'decora_jobs',
    'decora_quotes',
    'decora_invoices',
    'decora_inventory_items',
    'decora_inventory_transactions',
    'decora_incoming_shipments',
    'decora_pending_job_orders',
    'decora_saved_parts',
    'decora_process_sessions',
    'decora_employees',
    'decora_receipts',
    'decora_shipments',
    'decora_maintenance_schedules',
    'decora_maintenance_tasks',
    'decora_crm_opportunities',
    'decora_crm_activities',
    'decora_job_orders',
    'decora_cost_entries',
    'decora_scan_events',
    'decora_ncrs',
    'decora_qc_inspections'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Drop existing trigger if present (idempotent)
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_prevent_mass_delete ON %I',
      tbl
    );

    -- Create statement-level AFTER DELETE trigger with transition table
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

-- ─── 3. Verify ─────────────────────────────────────────────────────────────

-- Check that triggers are installed:
SELECT
  tgname AS trigger_name,
  relname AS table_name,
  tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname = 'trg_prevent_mass_delete'
ORDER BY relname;

-- Test (should fail):
-- DELETE FROM decora_customers;
--
-- Test override:
-- SET decora.allow_mass_delete = 'true';
-- DELETE FROM decora_customers WHERE id IN (...);
-- RESET decora.allow_mass_delete;
