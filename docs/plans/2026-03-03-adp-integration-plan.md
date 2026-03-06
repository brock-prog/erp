# ADP Workforce Now Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move ADP API calls behind Supabase Edge Functions so credentials never touch the browser, then wire all existing HR/Kiosk UI to live edge function calls.

**Architecture:** 5 Supabase Edge Functions (adp-auth, adp-workers, adp-time, adp-payroll, adp-onboarding) proxy all ADP Workforce Now API calls. The existing `adpService.ts` becomes a thin client that calls `supabase.functions.invoke()`. Credentials stored as Supabase secrets.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), existing React 18 + TypeScript + Vite frontend, Supabase JS client (`@supabase/supabase-js`).

**Design Doc:** `docs/plans/2026-03-03-adp-integration-design.md`

---

## Task 1: Scaffold Supabase Edge Functions Directory

**Files:**
- Create: `supabase/functions/adp-auth/index.ts`
- Create: `supabase/functions/adp-workers/index.ts`
- Create: `supabase/functions/adp-time/index.ts`
- Create: `supabase/functions/adp-payroll/index.ts`
- Create: `supabase/functions/adp-onboarding/index.ts`

**Step 1: Create the adp-auth edge function**

This is the OAuth token exchange. All other functions import from here.

```typescript
// supabase/functions/adp-auth/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ADP_BASE = 'https://api.adp.com';
const ADP_AUTH = `${ADP_BASE}/auth/oauth/v2/token`;

interface ADPToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  obtained_at: number;
}

let _token: ADPToken | null = null;

function isTokenValid(token: ADPToken): boolean {
  return Date.now() < token.obtained_at + (token.expires_in - 60) * 1000;
}

export async function getAccessToken(): Promise<string> {
  if (_token && isTokenValid(_token)) return _token.access_token;

  const clientId = Deno.env.get('ADP_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('ADP_CLIENT_SECRET') ?? '';

  if (!clientId || !clientSecret) {
    throw new Error('ADP credentials not configured in Supabase secrets.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(ADP_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADP auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _token = { ...data, obtained_at: Date.now() };
  return _token!.access_token;
}

export async function adpFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${ADP_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 204) return [] as unknown as T;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADP API error ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Also serve as a standalone "test connection" endpoint
serve(async (req) => {
  try {
    const { action } = await req.json();
    if (action === 'test') {
      await getAccessToken();
      return new Response(JSON.stringify({
        ok: true,
        environment: Deno.env.get('ADP_ENVIRONMENT') ?? 'sandbox',
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: String(err),
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
```

**Step 2: Create the adp-workers edge function**

Port `fetchAllWorkers`, `fetchWorker`, `syncEmployeesFromADP`, and `mapADPWorker` from the existing `src/services/adpService.ts` (lines 220-482). Change `import.meta.env` references to `Deno.env.get()` and import `adpFetch` from the shared auth module.

Note: Supabase Edge Functions can share code via a `_shared/` directory. Create `supabase/functions/_shared/adp-auth.ts` with the `getAccessToken` and `adpFetch` exports, then import from there in each function.

```typescript
// supabase/functions/adp-workers/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// Import shared auth — see Supabase docs on _shared directory
// For now, inline the auth logic or use dynamic import

// ... (port fetchAllWorkers, fetchWorker, mapADPWorker from adpService.ts lines 220-482)
// ... (serve handler with actions: 'sync-all', 'sync-one', 'test')
```

The handler should accept `{ action: 'sync-all' }` or `{ action: 'sync-one', aoid: string }` and return the normalized worker data.

**Step 3: Create adp-time, adp-payroll, adp-onboarding**

Same pattern: port the relevant functions from `adpService.ts`, wrap in a `serve()` handler with action-based routing.

- `adp-time`: actions `submit-timecards`, `fetch-accruals`, `fetch-pto-requests`, `submit-pto`
- `adp-payroll`: actions `fetch-statements`, `get-pdf-url`
- `adp-onboarding`: actions `fetch-pipeline` (new — calls ADP Onboarding API)

**Step 4: Verify edge functions deploy locally**

```bash
# Install Supabase CLI if not present
brew install supabase/tap/supabase

# Start local Supabase (requires Docker)
supabase start

# Set local secrets for testing
supabase secrets set ADP_CLIENT_ID=test ADP_CLIENT_SECRET=test ADP_ENVIRONMENT=sandbox

# Serve functions locally
supabase functions serve
```

Expected: functions start on `http://localhost:54321/functions/v1/adp-auth` etc.

---

## Task 2: Create Shared Auth Module

**Files:**
- Create: `supabase/functions/_shared/adp-auth.ts`
- Modify: `supabase/functions/adp-auth/index.ts` — import from shared
- Modify: `supabase/functions/adp-workers/index.ts` — import from shared

**Step 1: Extract shared auth into `_shared/adp-auth.ts`**

Move `getAccessToken()`, `adpFetch()`, token cache, and all ADP type interfaces into the shared module. Each edge function imports:

```typescript
import { adpFetch, getAccessToken } from '../_shared/adp-auth.ts';
import type { ADPWorker, ADPAccrual, ADPPayStatement, ADPTimeOffRequest } from '../_shared/adp-auth.ts';
```

**Step 2: Update all 5 edge functions to import from shared**

Remove duplicated auth code. Each function's `index.ts` should only contain its own action handler logic.

---

## Task 3: Add New Types to `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add ADPSyncLog type**

Add after the existing ADP-related Employee fields (search for `adpSyncStatus`):

```typescript
export interface ADPSyncLog {
  id: string;
  syncedAt: string;          // ISO timestamp
  trigger: 'manual' | 'scheduled' | 'startup';
  status: 'success' | 'partial' | 'failed';
  workersProcessed: number;
  workersCreated: number;
  workersUpdated: number;
  errors: string[];
  changes: string[];         // Human-readable change descriptions
  durationMs: number;
}
```

**Step 2: Add OnboardingApplicant type**

```typescript
export interface OnboardingApplicant {
  id: string;
  adpApplicantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  position: string;
  department?: string;
  startDate?: string;        // Expected start date
  onboardingStatus: 'documents_pending' | 'i9_complete' | 'tax_forms_complete' | 'ready_to_start' | 'completed';
  lastCheckedAt: string;     // ISO timestamp
}
```

**Step 3: Run TypeScript check**

```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```

Expected: Clean pass.

---

## Task 4: Add State Slices + Actions to AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

**Step 1: Add state slices to AppState interface**

Find `AppState` interface and add:

```typescript
adpSyncLogs: ADPSyncLog[];
onboardingApplicants: OnboardingApplicant[];
```

**Step 2: Add action types**

Add to the `Action` union type:

```typescript
| { type: 'ADD_ADP_SYNC_LOG';           payload: ADPSyncLog }
| { type: 'SET_ONBOARDING_APPLICANTS';  payload: OnboardingApplicant[] }
| { type: 'SYNC_EMPLOYEES_FROM_ADP';    payload: { employees: Partial<Employee> & { adpAoid: string }[] } }
```

**Step 3: Add reducer cases**

```typescript
case 'ADD_ADP_SYNC_LOG':
  return { ...state, adpSyncLogs: [action.payload, ...state.adpSyncLogs].slice(0, 100) };

case 'SET_ONBOARDING_APPLICANTS':
  return { ...state, onboardingApplicants: action.payload };

case 'SYNC_EMPLOYEES_FROM_ADP': {
  const updated = [...state.employees];
  for (const incoming of action.payload.employees) {
    const idx = updated.findIndex(e => e.adpAoid === incoming.adpAoid);
    if (idx >= 0) {
      // ADP wins for shared fields, preserve local-only fields
      updated[idx] = {
        ...updated[idx],
        ...incoming,
        // Preserve local-only fields
        certifications: updated[idx].certifications,
        skills: updated[idx].skills,
        avatarInitials: updated[idx].avatarInitials,
        adpLastSync: new Date().toISOString(),
        adpSyncStatus: 'synced',
      };
    } else {
      // New employee from ADP
      updated.push({
        ...incoming as Employee,
        id: generateId(),
        adpLastSync: new Date().toISOString(),
        adpSyncStatus: 'synced',
      });
    }
  }
  return { ...state, employees: updated };
}
```

**Step 4: Add initial state defaults**

In the initialState object:

```typescript
adpSyncLogs: [],
onboardingApplicants: [],
```

**Step 5: Run TypeScript check**

```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```

Expected: Clean pass.

---

## Task 5: Rewrite adpService.ts as Thin Client

**Files:**
- Modify: `src/services/adpService.ts`

**Step 1: Replace direct ADP calls with Edge Function invocations**

The entire file gets rewritten. Keep the demo constants and exported types, but all API functions now call `supabase.functions.invoke()`:

```typescript
// src/services/adpService.ts — Thin client (all logic runs in Supabase Edge Functions)

import { supabase, isSupabaseReady } from '../lib/supabase';

// Re-export types for consumers (actual ADP types live in Edge Functions)
export type { ADPSyncResult } from './adpTypes'; // or inline

export const ADP_IS_CONFIGURED = isSupabaseReady; // ADP requires Supabase

// ─── Edge Function Helpers ──────────────────────────────────────────────────

async function invokeADP<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: JSON.stringify(body),
  });

  if (error) throw new Error(`ADP edge function error: ${error.message}`);
  if (data?.ok === false) throw new Error(data.error ?? 'Unknown ADP error');

  return data as T;
}

// ─── Public API (same signatures as before, different implementation) ────────

export async function testADPConnection() {
  try {
    const result = await invokeADP<{ ok: boolean; environment: string }>('adp-auth', { action: 'test' });
    return { connected: result.ok, environment: result.environment };
  } catch (err) {
    return { connected: false, environment: 'unknown', error: String(err) };
  }
}

export async function syncEmployeesFromADP() {
  return invokeADP<ADPSyncResult & { workers: { aoid: string; updates: Record<string, unknown> }[] }>(
    'adp-workers', { action: 'sync-all' }
  );
}

export async function fetchAccrualBalances(aoid: string) {
  return invokeADP<{ accruals: { vacation: number; sick: number; personal: number } }>(
    'adp-time', { action: 'fetch-accruals', aoid }
  );
}

export async function fetchTimeOffRequests(aoid: string) {
  return invokeADP<{ requests: unknown[] }>('adp-time', { action: 'fetch-pto-requests', aoid });
}

export async function submitTimeOffRequest(aoid: string, request: unknown) {
  return invokeADP<{ requestId: string }>('adp-time', { action: 'submit-pto', aoid, request });
}

export async function fetchPayStatements(aoid: string) {
  return invokeADP<{ statements: unknown[] }>('adp-payroll', { action: 'fetch-statements', aoid });
}

export async function getPayStatementPdfUrl(aoid: string, statementId: string) {
  return invokeADP<{ url: string }>('adp-payroll', { action: 'get-pdf-url', aoid, statementId });
}

export async function submitTimecardBatch(entries: unknown[]) {
  return invokeADP<{ submitted: number; errors: string[] }>('adp-time', { action: 'submit-timecards', entries });
}

export async function fetchOnboardingPipeline() {
  return invokeADP<{ applicants: unknown[] }>('adp-onboarding', { action: 'fetch-pipeline' });
}

// ─── Demo Data (unchanged) ──────────────────────────────────────────────────

export const DEMO_ACCRUALS = { vacation: 48, sick: 24, personal: 8 };
export const DEMO_PAY_STATEMENT = {
  payDate: 'Feb 14, 2026',
  period: 'Feb 1 – Feb 14, 2026',
  grossPay: 1680.00,
  netPay: 1274.52,
  deductions: 405.48,
};
```

**Step 2: Run TypeScript check**

```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```

Fix any import/type errors in HR.tsx and HRKiosk.tsx that depended on the old exports.

---

## Task 6: Wire HR.tsx "Sync Now" Button

**Files:**
- Modify: `src/components/hr/HR.tsx`

**Step 1: Import the thin-client functions**

Replace or augment the existing `ADP_IS_CONFIGURED` import:

```typescript
import { ADP_IS_CONFIGURED, syncEmployeesFromADP, testADPConnection } from '../../services/adpService';
```

**Step 2: Add sync state + handler**

Inside the HR component, add state and a handler:

```typescript
const [syncing, setSyncing] = useState(false);
const [syncResult, setSyncResult] = useState<string | null>(null);

async function handleSyncNow() {
  setSyncing(true);
  setSyncResult(null);
  try {
    const result = await syncEmployeesFromADP();
    // Dispatch updates to AppContext
    dispatch({ type: 'SYNC_EMPLOYEES_FROM_ADP', payload: { employees: result.workers.map(w => ({ adpAoid: w.aoid, ...w.updates })) } });
    dispatch({ type: 'ADD_ADP_SYNC_LOG', payload: {
      id: generateId(),
      syncedAt: new Date().toISOString(),
      trigger: 'manual',
      status: result.success ? 'success' : 'partial',
      workersProcessed: result.workersProcessed,
      workersCreated: 0, // TODO: count from result
      workersUpdated: result.workersProcessed,
      errors: result.errors,
      changes: [],
      durationMs: 0,
    }});
    setSyncResult(`Synced ${result.workersProcessed} employees`);
  } catch (err) {
    setSyncResult(`Sync failed: ${String(err)}`);
  } finally {
    setSyncing(false);
  }
}
```

**Step 3: Wire the existing "Sync Now" button in the ADP status banner**

Find the existing `Sync Now` button (around line 195-209) and connect it to `handleSyncNow()`. Show `syncing` state with a spinner.

**Step 4: Run TypeScript check**

```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```

---

## Task 7: Wire HRKiosk.tsx Live Calls

**Files:**
- Modify: `src/components/hr/HRKiosk.tsx`

**Step 1: Wire PTO form submission**

Find the PTO submit handler (around line 315-330). When `ADP_IS_CONFIGURED`, call:

```typescript
const result = await submitTimeOffRequest(employee.adpAoid!, {
  timeOffTypeCode: { codeValue: ptoForm.type, shortName: ptoForm.type },
  dayEntries: [{ date: ptoForm.date, dailyQuantity: { unitCode: { codeValue: 'H' }, quantityValue: 8 } }],
  requestComments: ptoForm.reason ? [{ textValue: ptoForm.reason }] : [],
});
```

**Step 2: Wire pay statement fetch**

Find the pay/accruals screen (around line 807-864). When `ADP_IS_CONFIGURED` and employee has `adpAoid`, fetch live data:

```typescript
useEffect(() => {
  if (ADP_IS_CONFIGURED && selectedEmployee?.adpAoid) {
    fetchAccrualBalances(selectedEmployee.adpAoid).then(setAccruals);
    fetchPayStatements(selectedEmployee.adpAoid).then(setStatements);
  }
}, [selectedEmployee]);
```

Fall back to `DEMO_ACCRUALS` / `DEMO_PAY_STATEMENT` when ADP is not configured (existing behavior).

**Step 3: Run TypeScript check**

---

## Task 8: Add ADP Tab to AdminConsole

**Files:**
- Modify: `src/components/admin/AdminConsole.tsx`

**Step 1: Add 'adp' to TabId union**

Change: `type TabId = 'users' | 'roles' | ... | 'quickbooks';`
To: `type TabId = 'users' | 'roles' | ... | 'quickbooks' | 'adp';`

**Step 2: Add ADP tab definition to TABS array**

```typescript
{ id: 'adp', label: 'ADP', icon: <Users size={15} />, hidden: !isAdmin },
```

**Step 3: Create ADPTab component (inline or separate)**

Build an ADP Connection card with:
- Connection status indicator (green/red circle + "Connected" / "Not Configured")
- Last sync time + result from `state.adpSyncLogs[0]`
- "Test Connection" button → calls `testADPConnection()`
- "Sync Now" button → calls `syncEmployeesFromADP()` + dispatches
- Sync interval selector (manual / 1h / 4h / 8h) — stored in localStorage for now
- Sync history table showing last 10 `adpSyncLogs` entries (timestamp, status, workers processed, errors)
- ADP environment badge (sandbox / production)

**Step 4: Render the tab**

```typescript
{tab === 'adp' && isAdmin && <ADPTab />}
```

**Step 5: Run TypeScript check**

---

## Task 9: Add Onboarding Pipeline to HR.tsx

**Files:**
- Modify: `src/components/hr/HR.tsx`

**Step 1: Add 'onboarding' to the HR TABS array**

```typescript
{ id: 'onboarding', label: 'Onboarding Pipeline', icon: <UserPlus size={15} /> },
```

**Step 2: Create OnboardingTab component**

Displays `state.onboardingApplicants` as cards:
- Name, position, department, expected start date
- Onboarding status badge (documents_pending → i9_complete → tax_forms_complete → ready_to_start → completed)
- "Refresh from ADP" button → calls `fetchOnboardingPipeline()` + dispatches `SET_ONBOARDING_APPLICANTS`
- When status = 'completed', show "Create Employee" button → auto-fills Add Employee modal

**Step 3: Run TypeScript check**

---

## Task 10: Supabase Migration — Sync Log Table + pg_cron

**Files:**
- Create: `supabase/migrations/20260303_adp_sync_log.sql`

**Step 1: Create migration file**

```sql
-- ADP sync audit log
CREATE TABLE IF NOT EXISTS adp_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'startup')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  workers_processed INT NOT NULL DEFAULT 0,
  workers_created INT NOT NULL DEFAULT 0,
  workers_updated INT NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  changes JSONB DEFAULT '[]',
  duration_ms INT DEFAULT 0
);

-- Index for dashboard queries
CREATE INDEX idx_adp_sync_log_synced_at ON adp_sync_log(synced_at DESC);

-- pg_cron: roster sync every 4 hours (requires pg_cron extension enabled in Supabase dashboard)
-- SELECT cron.schedule('adp-roster-sync', '0 */4 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/adp-workers',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
--     body := '{"action":"sync-all","trigger":"scheduled"}'::jsonb
--   )$$
-- );
-- NOTE: Uncomment the pg_cron block after enabling pg_cron + pg_net in Supabase dashboard.
```

**Step 2: Apply migration**

```bash
supabase db push
```

---

## Task 11: Visual QA + Integration Test

**Step 1: Start dev server**

```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/npm run dev
```

**Step 2: Verify HR module**

- Navigate to HR Terminal
- Confirm ADP status banner shows correctly (Not Configured without creds, or Connected with creds)
- Click "Sync Now" — should call edge function (or show error if not configured)
- Check Onboarding Pipeline tab renders

**Step 3: Verify HR Kiosk**

- Open `/hr-kiosk` in new tab
- Log in with demo PIN (1234)
- Navigate to PTO request — verify submit button text
- Navigate to Pay & Accruals — verify demo data shows when ADP not configured

**Step 4: Verify Admin Console**

- Navigate to Admin Console → ADP tab
- Confirm connection status card renders
- Click "Test Connection"
- Check sync history table

**Step 5: Run full TypeScript check**

```bash
/Users/brock/.local/node-v22.14.0-darwin-arm64/bin/node /Users/brock/erp/node_modules/.bin/tsc --noEmit
```

Expected: Clean pass.
