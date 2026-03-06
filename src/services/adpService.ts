/**
 * ADP Workforce Now API Integration Service
 *
 * Handles OAuth 2.0 authentication and all API calls to ADP Workforce Now.
 * ADP is used as the system of record for employee identity, pay rates, and benefits.
 * The ERP reads from ADP and writes timecards + PTO requests back.
 *
 * ─── SETUP REQUIREMENTS ──────────────────────────────────────────────────────
 * 1. Contact your ADP account rep to enable API access on your WFN subscription
 * 2. Register your application in ADP API Central: https://apps.adp.com
 *    → Install "ADP API Central for ADP Workforce Now"
 *    → Create a "Data Connector" application type (machine-to-machine)
 * 3. Obtain Client ID + Client Secret from API Central
 * 4. For production: request a Web Services Certificate (mTLS) from ADP
 * 5. Add these environment variables to your .env file:
 *    VITE_ADP_CLIENT_ID=your_client_id_here
 *    VITE_ADP_CLIENT_SECRET=your_client_secret_here
 *    VITE_ADP_ENVIRONMENT=sandbox           # or "production"
 *
 * ─── DOCUMENTATION ───────────────────────────────────────────────────────────
 * ADP Developer Portal:     https://developers.adp.com
 * Worker Management Guide:  https://developers.adp.com/articles/guides/worker-management-api-guide-for-adp-workforce-now
 * Time Off Request Guide:   https://developers.adp.com/articles/guides/time-off-request-api-guide-for-adp-workforce-now
 * API Catalog:              https://developers.adp.com/articles/guides/adp-workforce-now-api-catalog
 *
 * ─── INTEGRATION PATTERN ─────────────────────────────────────────────────────
 * ADP is the system of record for employees. This ERP:
 *   READS  from ADP → employee master data, pay rates, PTO balances, schedules
 *   WRITES to ADP  → time off requests (from kiosk), timecard hours (end of pay period)
 *
 * Key identifier: each ADP worker has an "Associate OID" (AOID) stored as
 * employee.adpAoid in this system. Always use AOID (not employee number) for
 * subsequent per-worker API calls.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const ADP_ENV = (import.meta.env.VITE_ADP_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';
const ADP_CLIENT_ID     = import.meta.env.VITE_ADP_CLIENT_ID     ?? '';
const ADP_CLIENT_SECRET = import.meta.env.VITE_ADP_CLIENT_SECRET ?? '';

const ADP_BASE  = ADP_ENV === 'production'
  ? 'https://api.adp.com'
  : 'https://api.adp.com';          // ADP sandbox uses the same base URL; credentials differ

const ADP_AUTH  = `${ADP_BASE}/auth/oauth/v2/token`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ADPToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  obtained_at: number;        // epoch ms — we add this ourselves on receipt
}

/** ADP worker as returned by GET /hr/v2/workers */
export interface ADPWorker {
  associateOID: string;
  workerID: { idValue: string };
  workerDates?: {
    originalHireDate?: string;
    terminationDate?: string;
  };
  person: {
    legalName: {
      givenName: string;
      middleName?: string;
      familyName1: string;
    };
    preferredName?: { givenName: string };
    birthDate?: string;
    communication?: {
      emails?: { emailUri: string; nameCode?: { codeValue: string } }[];
      phones?: { dialNumber: string; nameCode?: { codeValue: string } }[];
    };
    legalAddress?: {
      lineOne?: string;
      cityName?: string;
      countrySubdivisionLevel1?: { codeValue: string };
      postalCode?: string;
    };
  };
  workAssignments?: {
    primaryIndicator: boolean;
    hireDate?: string;
    jobCode?: { codeValue: string; shortName: string };
    homeOrganizationalUnits?: {
      typeCode?: { codeValue: string };
      nameCode?: { codeValue: string; shortName: string };
    }[];
    payrollProcessingStatusCode?: { codeValue: string; shortName: string };
    baseRemuneration?: {
      payPeriodRateAmount?: { amountValue: number; currencyCode: string };
      hourlyRateAmount?: { amountValue: number; currencyCode: string };
      annualRateAmount?: { amountValue: number; currencyCode: string };
    };
    workerTypeCode?: { codeValue: string; shortName: string };
  }[];
}

/** ADP time off accrual balance */
export interface ADPAccrual {
  timeOffTypeCode: { codeValue: string; shortName: string };
  entitlementPeriod?: { codeValue: string; shortName: string };
  accrualBalance?: { unitCode: { codeValue: string }; quantityValue: number };
  scheduledBalance?: { unitCode: { codeValue: string }; quantityValue: number };
}

/** ADP pay statement summary */
export interface ADPPayStatement {
  payStatementID: { idValue: string };
  paymentDate: string;
  payPeriod: { startDate: string; endDate: string };
  grossPayAmount?: { amountValue: number; currencyCode: string };
  netPayAmount?: { amountValue: number; currencyCode: string };
  totalDeductionsAmount?: { amountValue: number; currencyCode: string };
}

/** ADP time off request */
export interface ADPTimeOffRequest {
  timeOffRequestID?: { idValue: string };
  requestStatusCode?: { codeValue: string; shortName: string };
  timeOffTypeCode: { codeValue: string; shortName: string };
  dayEntries: {
    date: string;                 // ISO date e.g. "2026-03-10"
    dailyQuantity?: { unitCode: { codeValue: string }; quantityValue: number };
  }[];
  requestComments?: { textValue: string }[];
}

/** Result of a sync operation */
export interface ADPSyncResult {
  success: boolean;
  workersProcessed: number;
  errors: string[];
  syncedAt: string;
}

// ─── Token Cache ──────────────────────────────────────────────────────────────

let _token: ADPToken | null = null;

function isTokenValid(token: ADPToken): boolean {
  const expiresAt = token.obtained_at + (token.expires_in - 60) * 1000; // 60s buffer
  return Date.now() < expiresAt;
}

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Obtains an OAuth 2.0 access token using the client_credentials grant.
 * Tokens are cached in memory and reused until they expire.
 *
 * NOTE: In a production deployment, this call MUST be made from your backend
 * server — never expose client credentials to the browser. This service is
 * structured for a Node.js/Express backend or a Vite SSR environment.
 */
export async function getAccessToken(): Promise<string> {
  if (_token && isTokenValid(_token)) return _token.access_token;

  if (!ADP_CLIENT_ID || !ADP_CLIENT_SECRET) {
    throw new Error(
      'ADP credentials not configured. Set VITE_ADP_CLIENT_ID and VITE_ADP_CLIENT_SECRET in your .env file.'
    );
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     ADP_CLIENT_ID,
    client_secret: ADP_CLIENT_SECRET,
  });

  const res = await fetch(ADP_AUTH, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADP auth failed (${res.status}): ${text}`);
  }

  const data = await res.json() as Omit<ADPToken, 'obtained_at'>;
  _token = { ...data, obtained_at: Date.now() };
  return _token.access_token;
}

// ─── Request Helper ───────────────────────────────────────────────────────────

async function adpFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${ADP_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
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

// ─── Workers / Employees ──────────────────────────────────────────────────────

/**
 * Fetch all workers from ADP with automatic pagination.
 * ADP uses OData $top/$skip. Continue until a 204 or empty page.
 *
 * Endpoint: GET /hr/v2/workers
 */
export async function fetchAllWorkers(): Promise<ADPWorker[]> {
  const PAGE_SIZE = 500;
  const workers: ADPWorker[] = [];
  let skip = 0;

  while (true) {
    const data = await adpFetch<{ workers?: ADPWorker[] }>(
      `/hr/v2/workers?$top=${PAGE_SIZE}&$skip=${skip}`
    );

    const page = data.workers ?? [];
    workers.push(...page);

    if (page.length < PAGE_SIZE) break; // last page
    skip += PAGE_SIZE;
  }

  return workers;
}

/**
 * Fetch a single worker by their ADP Associate OID.
 * Endpoint: GET /hr/v2/workers/{aoid}
 */
export async function fetchWorker(aoid: string): Promise<ADPWorker> {
  const data = await adpFetch<{ workers: ADPWorker[] }>(`/hr/v2/workers/${aoid}`);
  return data.workers[0];
}

// ─── Time Off / PTO ───────────────────────────────────────────────────────────

/**
 * Get PTO accrual balances for a worker.
 * Returns vacation, sick, personal balances in hours.
 * Endpoint: GET /time/v1/workers/{aoid}/time-off-accruals
 */
export async function fetchAccrualBalances(aoid: string): Promise<ADPAccrual[]> {
  const data = await adpFetch<{ timeOffAccruals?: ADPAccrual[] }>(
    `/time/v1/workers/${aoid}/time-off-accruals`
  );
  return data.timeOffAccruals ?? [];
}

/**
 * Get existing time off requests for a worker.
 * Endpoint: GET /time/v1/workers/{aoid}/time-off-requests
 */
export async function fetchTimeOffRequests(aoid: string): Promise<ADPTimeOffRequest[]> {
  const data = await adpFetch<{ timeOffRequests?: ADPTimeOffRequest[] }>(
    `/time/v1/workers/${aoid}/time-off-requests`
  );
  return data.timeOffRequests ?? [];
}

/**
 * Submit a time off request on behalf of a worker.
 * Endpoint: POST /events/time/v1/worker.time-off-request.add
 *
 * @param aoid   - Worker's ADP Associate OID
 * @param request - Time off request details
 */
export async function submitTimeOffRequest(
  aoid: string,
  request: ADPTimeOffRequest,
): Promise<{ requestId: string }> {
  const body = {
    events: [{
      data: {
        transform: {
          workerID: { associateOID: aoid },
          timeOffRequest: request,
        },
      },
    }],
  };

  const data = await adpFetch<{ events: { data: { output: { timeOffRequest: { timeOffRequestID: { idValue: string } } } } }[] }>(
    '/events/time/v1/worker.time-off-request.add',
    { method: 'POST', body: JSON.stringify(body) },
  );

  const requestId = data.events?.[0]?.data?.output?.timeOffRequest?.timeOffRequestID?.idValue ?? '';
  return { requestId };
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

/**
 * Fetch recent pay statements for a worker.
 * Returns up to 12 months of pay stubs.
 * Endpoint: GET /payroll/v1/workers/{aoid}/pay-statements
 */
export async function fetchPayStatements(aoid: string): Promise<ADPPayStatement[]> {
  const data = await adpFetch<{ payStatements?: ADPPayStatement[] }>(
    `/payroll/v1/workers/${aoid}/pay-statements?$top=10`
  );
  return data.payStatements ?? [];
}

/**
 * Get the download URL for a pay statement PDF.
 * Endpoint: GET /payroll/v1/workers/{aoid}/pay-statement-images/{statementId}
 */
export async function getPayStatementPdfUrl(aoid: string, statementId: string): Promise<string> {
  // ADP returns a pre-signed URL to download the PDF
  const data = await adpFetch<{ payStatementImages: { links?: { href: string }[] }[] }>(
    `/payroll/v1/workers/${aoid}/pay-statement-images/${statementId}`
  );
  return data.payStatementImages?.[0]?.links?.[0]?.href ?? '';
}

/**
 * Submit timecard data to ADP Payroll Data Input.
 * Call this at end of pay period to push hours from ERP → ADP for payroll processing.
 *
 * @param entries - Array of {aoid, regularHours, overtimeHours, payPeriodEndDate}
 */
export async function submitTimecardBatch(entries: {
  aoid: string;
  regularHours: number;
  overtimeHours: number;
  jobCostingRef?: string;
  payPeriodEndDate: string;        // ISO date e.g. "2026-02-28"
}[]): Promise<{ submitted: number; errors: string[] }> {
  const errors: string[] = [];
  let submitted = 0;

  // ADP Payroll Data Input processes one worker at a time
  for (const entry of entries) {
    try {
      const body = {
        payrollInputs: [{
          workerID: { associateOID: entry.aoid },
          payPeriodEndDate: entry.payPeriodEndDate,
          earnings: [
            { codeValue: 'REG', hoursQuantity: entry.regularHours },
            ...(entry.overtimeHours > 0
              ? [{ codeValue: 'OT', hoursQuantity: entry.overtimeHours }]
              : []),
          ],
          memos: entry.jobCostingRef ? [{ textValue: `Job: ${entry.jobCostingRef}` }] : [],
        }],
      };
      await adpFetch('/payroll/v1/payroll-inputs', { method: 'POST', body: JSON.stringify(body) });
      submitted++;
    } catch (err) {
      errors.push(`${entry.aoid}: ${String(err)}`);
    }
  }

  return { submitted, errors };
}

// ─── Full Sync ────────────────────────────────────────────────────────────────

/**
 * Perform a full employee sync from ADP → ERP.
 * Returns a normalized mapping of AOID → local employee fields.
 *
 * Call this on a schedule (e.g. every 60 minutes via a server-side cron job).
 * New hires appear in ADP first; ERP picks them up on the next sync cycle.
 *
 * Usage example (in your sync job):
 * ```typescript
 * const result = await syncEmployeesFromADP();
 * for (const worker of result.workers) {
 *   const existing = db.employees.findByAdpAoid(worker.aoid);
 *   if (existing) {
 *     db.employees.update(existing.id, { ...worker.updates, adpLastSync: new Date().toISOString(), adpSyncStatus: 'synced' });
 *   } else {
 *     db.employees.create({ ...worker.newEmployee, adpAoid: worker.aoid, adpSyncStatus: 'synced' });
 *   }
 * }
 * ```
 */
export async function syncEmployeesFromADP(): Promise<ADPSyncResult & {
  workers: {
    aoid: string;
    updates: {
      firstName: string;
      lastName: string;
      preferredName?: string;
      email: string;
      phone?: string;
      department?: string;
      position?: string;
      payType: 'hourly' | 'salary';
      payRate: number;
      status: 'active' | 'inactive' | 'terminated';
    };
  }[];
}> {
  const syncedAt = new Date().toISOString();
  const errors: string[] = [];
  const workers: {
    aoid: string;
    updates: ReturnType<typeof mapADPWorker>;
  }[] = [];

  try {
    const adpWorkers = await fetchAllWorkers();

    for (const w of adpWorkers) {
      try {
        workers.push({ aoid: w.associateOID, updates: mapADPWorker(w) });
      } catch (err) {
        errors.push(`Worker ${w.associateOID}: ${String(err)}`);
      }
    }

    return { success: errors.length === 0, workersProcessed: workers.length, errors, syncedAt, workers };
  } catch (err) {
    return {
      success: false,
      workersProcessed: 0,
      errors: [String(err)],
      syncedAt,
      workers: [],
    };
  }
}

/** Map an ADP worker record to normalized ERP employee fields */
function mapADPWorker(w: ADPWorker) {
  const primary = w.workAssignments?.find(a => a.primaryIndicator) ?? w.workAssignments?.[0];
  const email = w.person.communication?.emails?.[0]?.emailUri ?? '';
  const phone = w.person.communication?.phones?.[0]?.dialNumber;

  // Determine pay type and rate
  const hourly  = primary?.baseRemuneration?.hourlyRateAmount?.amountValue;
  const annual  = primary?.baseRemuneration?.annualRateAmount?.amountValue;
  const payType = hourly != null ? 'hourly' as const : 'salary' as const;
  const payRate = payType === 'hourly' ? (hourly ?? 0) : (annual ?? 0);

  // Map ADP worker status
  const adpStatus = primary?.payrollProcessingStatusCode?.codeValue ?? 'active';
  const status: 'active' | 'inactive' | 'terminated' =
    adpStatus === 'Terminated' ? 'terminated' :
    adpStatus === 'Leave'      ? 'inactive'   : 'active';

  // Department from home org unit
  const deptUnit = primary?.homeOrganizationalUnits?.find(u => u.typeCode?.codeValue === 'Department');
  const department = deptUnit?.nameCode?.shortName;

  return {
    firstName:     w.person.legalName.givenName,
    lastName:      w.person.legalName.familyName1,
    preferredName: w.person.preferredName?.givenName,
    email,
    phone,
    department,
    position:      primary?.jobCode?.shortName,
    payType,
    payRate,
    status,
  };
}

// ─── Connection Test ──────────────────────────────────────────────────────────

/**
 * Test the ADP API connection. Returns true if credentials are valid.
 * Safe to call on page load to show connection status in the UI.
 */
export async function testADPConnection(): Promise<{
  connected: boolean;
  environment: string;
  error?: string;
}> {
  try {
    await getAccessToken();
    return { connected: true, environment: ADP_ENV };
  } catch (err) {
    return { connected: false, environment: ADP_ENV, error: String(err) };
  }
}

// ─── Mock data for UI demo (when ADP is not configured) ──────────────────────

export const ADP_IS_CONFIGURED =
  Boolean(import.meta.env.VITE_ADP_CLIENT_ID) &&
  Boolean(import.meta.env.VITE_ADP_CLIENT_SECRET);

/** Demo PTO balances returned when ADP is not configured */
export const DEMO_ACCRUALS = {
  vacation: 48,
  sick: 24,
  personal: 8,
};

/** Demo pay statement returned when ADP is not configured */
export const DEMO_PAY_STATEMENT = {
  payDate:   'Feb 14, 2026',
  period:    'Feb 1 – Feb 14, 2026',
  grossPay:  1680.00,
  netPay:    1274.52,
  deductions: 405.48,
};
