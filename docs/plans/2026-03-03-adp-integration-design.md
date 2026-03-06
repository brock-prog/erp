# ADP Workforce Now Integration — Design Document

**Date**: 2026-03-03
**Status**: Approved
**Stack**: Supabase Edge Functions (Deno) + existing React/Supabase frontend

---

## Problem

The existing `src/services/adpService.ts` (524 lines) implements full ADP Workforce Now API integration — OAuth 2.0, roster sync, timecards, PTO, pay statements — but all calls run directly from the browser. This exposes ADP Client ID and Client Secret in the network tab, making it unsafe for production.

## Decision

**Supabase Edge Functions** proxy all ADP API calls. Credentials stored as Supabase secrets (encrypted), never sent to the browser. The frontend calls Edge Functions via `supabase.functions.invoke()`.

Alternatives considered:
- Express proxy server — adds a deployment target to maintain
- Vite SSR / Next.js migration — overkill for one integration

---

## Architecture

### Edge Functions (5 total)

| Function | ADP API Scope | Operations |
|----------|--------------|------------|
| `adp-auth` | OAuth 2.0 | Token exchange, caching (60s buffer). Called internally by other functions. |
| `adp-workers` | Worker Management | `sync-all`: fetch + normalize all workers. `sync-one`: fetch single worker by AOID. |
| `adp-time` | Time & Attendance, Time Off | `submit-timecards`: batch timecard submission. `fetch-accruals`: PTO balances. `fetch-pto-requests`: existing requests. `submit-pto`: new PTO request. |
| `adp-payroll` | Payroll | `fetch-statements`: 12-month pay history. `get-pdf-url`: pre-signed statement PDF download. |
| `adp-onboarding` | Applicant Onboarding | `fetch-pipeline`: pending new hires + onboarding status. Auto-create Employee on completion. |

### Data Flow

**Reads (ADP -> ERP):**
```
React UI
  -> supabase.functions.invoke('adp-workers', { body: { action: 'sync-all' } })
  -> Edge Function authenticates via adp-auth (server-side)
  -> Edge Function fetches from ADP API
  -> Returns normalized Employee[] to frontend
  -> Frontend dispatches UPDATE_EMPLOYEE for each worker
```

**Writes (ERP -> ADP):**
```
Kiosk PTO form
  -> supabase.functions.invoke('adp-time', { body: { action: 'submit-pto', aoid, request } })
  -> Edge Function posts to ADP Events API
  -> Returns confirmation
  -> Frontend updates record with adpSubmitted: true
```

### Credential Management

```bash
supabase secrets set ADP_CLIENT_ID=xxx ADP_CLIENT_SECRET=xxx ADP_ENVIRONMENT=production
```

Accessed inside Edge Functions via `Deno.env.get('ADP_CLIENT_ID')`. Never exposed to the browser. The Supabase session token (which users already have from login) authenticates the Edge Function call itself.

---

## Scheduled Sync

- **Interval**: Every 4 hours via Supabase `pg_cron`
- **What syncs**: Full employee roster (`adp-workers` with `action: sync-all`)
- **On failure**: Retry once after 15 minutes, then log error and alert
- **Manual trigger**: "Sync Now" button in Admin Console and HR module

---

## Conflict Resolution

**ADP wins** for all shared fields (name, department, pay rate, status, employment type). ADP is the system of record for payroll/identity data.

**Local-only fields preserved**: certifications, skills, avatarInitials, training records — these don't exist in ADP, so no conflict is possible.

**Sync log**: Every sync records what changed:
```
"Pay rate updated: $22.50 -> $23.00 (from ADP)"
"New worker added: Riley Kim (AOID: AOI-XYZ-789)"
"Department changed: Production -> Quality (from ADP)"
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| ADP API unavailable | Toast notification, retry in 15 min, log to sync_log |
| OAuth token expired | Auto-refresh (60s buffer in token cache) |
| Timecard batch partially fails | Return success count + error array, queue retries |
| PTO request rejected by ADP | Return ADP's error message to kiosk user |
| Scheduled sync fails | Alert Center notification: "ADP sync failed — N employees not updated" |

---

## Codebase Changes

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/adp-auth/index.ts` | OAuth token exchange + caching |
| `supabase/functions/adp-workers/index.ts` | Worker roster sync |
| `supabase/functions/adp-time/index.ts` | Timecards + PTO |
| `supabase/functions/adp-payroll/index.ts` | Pay statements |
| `supabase/functions/adp-onboarding/index.ts` | Applicant onboarding pipeline |
| `supabase/migrations/YYYYMMDD_adp_sync_log.sql` | Sync log table + pg_cron job |

### Modified Files

| File | Change |
|------|--------|
| `src/services/adpService.ts` | Rewrite to thin client — each function calls `supabase.functions.invoke()` instead of ADP directly |
| `src/types/index.ts` | Add `ADPSyncLog`, `OnboardingApplicant` types |
| `src/context/AppContext.tsx` | Add `adpSyncLogs[]`, `onboardingApplicants[]` state slices + actions |
| `src/components/admin/AdminConsole.tsx` | ADP Connection card: status, test connection, sync now, interval selector |
| `src/components/hr/HR.tsx` | Wire "Sync Now" to edge function. Add Onboarding Pipeline tab/section. |
| `src/components/hr/HRKiosk.tsx` | Wire PTO form to `adp-time`. Wire pay stubs to `adp-payroll`. |

### Unchanged

- Employee, AttendanceRecord, TrainingRecord types — already have ADP fields (`adpAoid`, `adpSyncStatus`, `adpTimecardId`, `adpSubmitted`, `jobCostingRef`)
- Demo data in mockData.ts — continues to work when ADP is not configured

---

## ADP API Setup (User Steps)

1. Contact ADP account rep to enable API access on WFN subscription
2. Register in ADP API Central: https://apps.adp.com
   - Install "ADP API Central for ADP Workforce Now"
   - Create "Data Connector" application (machine-to-machine)
3. Obtain Client ID + Client Secret
4. For production: request Web Services Certificate (mTLS) from ADP
5. Store credentials: `supabase secrets set ADP_CLIENT_ID=xxx ADP_CLIENT_SECRET=xxx`

---

## Out of Scope (Future)

- ADP benefits enrollment API
- ADP org chart / reporting structure sync
- Bidirectional employee edits (ERP -> ADP write-back for non-payroll fields)
- mTLS certificate automation (manual setup for now)
