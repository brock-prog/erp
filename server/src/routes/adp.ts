// server/src/routes/adp.ts — ADP Workforce Now proxy
// ⚠️  ADP credentials live ONLY here on the server — never exposed to the browser.
// The frontend's adpService.ts now calls these endpoints instead of ADP directly.

import { Router, Request, Response } from 'express';
import { config } from '../config';
import { requireRole } from '../middleware/rbac';
import { prisma } from '../db';

export const adpRouter = Router();

// ─── Token cache (in-memory, server restarts clear it) ────────────────────────
interface ADPToken { access_token: string; expires_at: number; }
let cachedToken: ADPToken | null = null;

async function getADPToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.adp.clientId,
    client_secret: config.adp.clientSecret,
  });

  const resp = await fetch('https://api.adp.com/auth/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) throw new Error(`ADP auth failed: ${resp.status}`);

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return cachedToken.access_token;
}

async function adpFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getADPToken();
  const resp = await fetch(`https://api.adp.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ADP API ${path} → ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

// ─── Demo data (when ADP not configured) ─────────────────────────────────────

const DEMO_ACCRUALS = [
  { timeOffTypeCode: { codeValue: 'VAC', shortName: 'Vacation' }, accrualBalance: { unitCode: { codeValue: 'HRS' }, quantityValue: 48.0 } },
  { timeOffTypeCode: { codeValue: 'SICK', shortName: 'Sick' }, accrualBalance: { unitCode: { codeValue: 'HRS' }, quantityValue: 24.0 } },
  { timeOffTypeCode: { codeValue: 'PER', shortName: 'Personal' }, accrualBalance: { unitCode: { codeValue: 'HRS' }, quantityValue: 8.0 } },
];

const DEMO_PAY_STATEMENT = {
  payStatementID: { idValue: 'demo-ps-001' },
  paymentDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
  payPeriod: { startDate: new Date(Date.now() - 21 * 86400000).toISOString().split('T')[0], endDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] },
  grossPayAmount: { amountValue: 2800.00, currencyCode: 'CAD' },
  netPayAmount: { amountValue: 2156.50, currencyCode: 'CAD' },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/adp/status
adpRouter.get('/status', requireRole('manager'), (_req: Request, res: Response) => {
  res.json({ configured: config.adp.isConfigured, environment: config.adp.environment });
});

// GET /api/adp/workers
adpRouter.get('/workers', requireRole('manager'), async (_req: Request, res: Response) => {
  if (!config.adp.isConfigured) {
    res.json({ workers: [], demo: true });
    return;
  }
  try {
    const data = await adpFetch<{ workers: any[] }>('/hr/v2/workers?$top=500');
    res.json({ workers: data.workers || [], demo: false });
  } catch (err: any) {
    res.status(502).json({ error: `ADP error: ${err.message}` });
  }
});

// GET /api/adp/accruals/:aoid
adpRouter.get('/accruals/:aoid', requireRole('operator'), async (req: Request, res: Response) => {
  if (!config.adp.isConfigured) {
    res.json({ accruals: DEMO_ACCRUALS, demo: true });
    return;
  }
  try {
    const data = await adpFetch<{ timeOffAccruals: any[] }>(`/time/v1/workers/${req.params.aoid}/time-off-accruals`);
    res.json({ accruals: data.timeOffAccruals || [], demo: false });
  } catch (err: any) {
    res.status(502).json({ error: `ADP error: ${err.message}` });
  }
});

// GET /api/adp/paystubs/:aoid
adpRouter.get('/paystubs/:aoid', requireRole('operator'), async (req: Request, res: Response) => {
  if (!config.adp.isConfigured) {
    res.json({ payStatements: [DEMO_PAY_STATEMENT], demo: true });
    return;
  }
  try {
    const data = await adpFetch<{ payStatements: any[] }>(`/payroll/v1/workers/${req.params.aoid}/pay-statements?$top=6`);
    res.json({ payStatements: data.payStatements || [], demo: false });
  } catch (err: any) {
    res.status(502).json({ error: `ADP error: ${err.message}` });
  }
});

// POST /api/adp/pto/:aoid
adpRouter.post('/pto/:aoid', requireRole('operator'), async (req: Request, res: Response) => {
  if (!config.adp.isConfigured) {
    res.json({ ok: true, demo: true, message: 'PTO request logged (ADP not configured)' });
    return;
  }
  try {
    await adpFetch(`/events/time/v1/worker.time-off-request.add`, {
      method: 'POST',
      body: JSON.stringify({
        events: [{
          data: {
            transform: {
              associateOID: req.params.aoid,
              ...req.body,
            },
          },
        }],
      }),
    });
    res.json({ ok: true, demo: false });
  } catch (err: any) {
    res.status(502).json({ error: `ADP error: ${err.message}` });
  }
});

// POST /api/adp/timecard-batch
adpRouter.post('/timecard-batch', requireRole('manager'), async (req: Request, res: Response) => {
  if (!config.adp.isConfigured) {
    res.json({ ok: true, demo: true, submitted: req.body?.entries?.length || 0 });
    return;
  }
  try {
    await adpFetch('/payroll/v1/payroll-inputs', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json({ ok: true, demo: false });
  } catch (err: any) {
    res.status(502).json({ error: `ADP error: ${err.message}` });
  }
});

// POST /api/adp/sync — full employee sync from ADP
adpRouter.post('/sync', requireRole('manager'), async (req: Request, res: Response) => {
  if (!config.adp.isConfigured) {
    res.json({ ok: true, demo: true, synced: 0, message: 'ADP not configured — no sync performed' });
    return;
  }
  try {
    let skip = 0;
    const allWorkers: any[] = [];
    while (true) {
      const data = await adpFetch<{ workers: any[] }>(`/hr/v2/workers?$top=500&$skip=${skip}`);
      const workers = data.workers || [];
      allWorkers.push(...workers);
      if (workers.length < 500) break;
      skip += 500;
    }

    // Upsert employees from ADP data
    let synced = 0;
    for (const w of allWorkers) {
      const aoid = w.associateOID;
      if (!aoid) continue;
      const person = w.person?.legalName || {};
      const name = [person.givenName, person.familyName].filter(Boolean).join(' ');
      const assignment = w.workAssignments?.[0] || {};
      const email = w.businessCommunication?.emails?.[0]?.emailUri;

      await prisma.employee.upsert({
        where: { adpAoid: aoid },
        update: { name: name || 'Unknown', email, adpLastSync: new Date().toISOString(), adpSyncStatus: 'synced', updatedAt: new Date() },
        create: {
          employeeNumber: w.workerID?.idValue || aoid,
          name: name || 'Unknown',
          email,
          department: assignment.homeOrganizationalUnits?.[0]?.nameCode?.shortName || '',
          position: assignment.jobCode?.shortName || '',
          status: w.workerStatus?.statusCode?.codeValue === 'Terminated' ? 'terminated' : 'active',
          hireDate: assignment.hireDate || new Date().toISOString().split('T')[0],
          adpAoid: aoid,
          adpLastSync: new Date().toISOString(),
          adpSyncStatus: 'synced',
        },
      });
      synced++;
    }

    res.json({ ok: true, demo: false, synced, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(502).json({ error: `ADP sync error: ${err.message}` });
  }
});
