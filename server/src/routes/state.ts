// server/src/routes/state.ts
// ─── The Migration Bridge ────────────────────────────────────────────────────
// GET  /api/state      → assembles full AppState from all Prisma tables
// POST /api/mutations  → persists a dispatch action + broadcasts via Socket.io
//
// This design means ZERO changes to the 79 existing React components.
// They continue dispatching the same action types; the server handles persistence.

import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { getIo } from '../socket';

export const stateRouter = Router();

// ─── Action types that map to normalized tables ───────────────────────────────
// For these, we update the relevant DB table AND store a delta.
// For all others, we only store a delta (replayed on GET /api/state).

const NORMALIZED_HANDLERS: Record<string, (payload: any, userId: string, userName: string) => Promise<void>> = {
  // Customers
  ADD_CUSTOMER: async (p) => {
    await prisma.customer.upsert({
      where: { id: p.id },
      update: { ...customerFields(p), updatedAt: new Date() },
      create: { id: p.id, ...customerFields(p) },
    });
  },
  UPDATE_CUSTOMER: async (p) => {
    await prisma.customer.update({ where: { id: p.id }, data: { ...customerFields(p), updatedAt: new Date() } });
  },
  DELETE_CUSTOMER: async (p) => {
    await prisma.customer.update({ where: { id: p.id }, data: { status: 'inactive', updatedAt: new Date() } });
  },

  // Quotes
  ADD_QUOTE: async (p) => {
    await prisma.quote.upsert({
      where: { id: p.id },
      update: { ...quoteFields(p), updatedAt: new Date() },
      create: { id: p.id, ...quoteFields(p) },
    });
  },
  UPDATE_QUOTE: async (p) => {
    await prisma.quote.update({ where: { id: p.id }, data: { ...quoteFields(p), updatedAt: new Date() } });
  },
  DELETE_QUOTE: async (p) => {
    await prisma.quote.delete({ where: { id: p.id } }).catch(() => {});
  },

  // Jobs
  ADD_JOB: async (p) => {
    await prisma.job.upsert({
      where: { id: p.id },
      update: { ...jobFields(p), updatedAt: new Date() },
      create: { id: p.id, ...jobFields(p) },
    });
  },
  UPDATE_JOB: async (p) => {
    await prisma.job.update({ where: { id: p.id }, data: { ...jobFields(p), updatedAt: new Date() } });
  },
  UPDATE_JOB_STATUS: async (p) => {
    const job = await prisma.job.findUnique({ where: { id: p.jobId } });
    if (!job) return;
    const history = (job.statusHistory as any[]) || [];
    history.push({ status: p.status, timestamp: new Date().toISOString(), userId: p.userId, userName: p.userName });
    await prisma.job.update({
      where: { id: p.jobId },
      data: { status: p.status, statusHistory: history, updatedAt: new Date() },
    });
  },

  // Invoices
  ADD_INVOICE: async (p) => {
    await prisma.invoice.upsert({
      where: { id: p.id },
      update: { ...invoiceFields(p), updatedAt: new Date() },
      create: { id: p.id, ...invoiceFields(p) },
    });
  },
  UPDATE_INVOICE: async (p) => {
    await prisma.invoice.update({ where: { id: p.id }, data: { ...invoiceFields(p), updatedAt: new Date() } });
  },

  // Inventory
  ADD_INVENTORY_ITEM: async (p) => {
    await prisma.inventoryItem.upsert({
      where: { id: p.id },
      update: { ...inventoryFields(p), updatedAt: new Date() },
      create: { id: p.id, ...inventoryFields(p) },
    });
  },
  UPDATE_INVENTORY_ITEM: async (p) => {
    await prisma.inventoryItem.update({ where: { id: p.id }, data: { ...inventoryFields(p), updatedAt: new Date() } });
  },

  // Employees
  ADD_EMPLOYEE: async (p) => {
    await prisma.employee.upsert({
      where: { id: p.id },
      update: { ...employeeFields(p), updatedAt: new Date() },
      create: { id: p.id, ...employeeFields(p) },
    });
  },
  UPDATE_EMPLOYEE: async (p) => {
    await prisma.employee.update({ where: { id: p.id }, data: { ...employeeFields(p), updatedAt: new Date() } });
  },

  // Attendance
  ADD_ATTENDANCE: async (p) => {
    await prisma.attendanceRecord.upsert({
      where: { id: p.id },
      update: { ...attendanceFields(p), updatedAt: new Date() },
      create: { id: p.id, ...attendanceFields(p) },
    });
  },
  UPDATE_ATTENDANCE: async (p) => {
    await prisma.attendanceRecord.update({ where: { id: p.id }, data: { ...attendanceFields(p), updatedAt: new Date() } });
  },
};

// ─── Field mappers ────────────────────────────────────────────────────────────

function customerFields(p: any) {
  return {
    accountNumber: p.accountNumber,
    name: p.name,
    type: p.type || 'commercial',
    email: p.email,
    phone: p.phone,
    website: p.website,
    status: p.status || 'active',
    currency: p.currency || 'CAD',
    paymentTerms: p.paymentTerms,
    creditLimit: p.creditLimit,
    taxExempt: p.taxExempt || false,
    taxNumber: p.taxNumber,
    billingAddress: p.billingAddress,
    shippingAddress: p.shippingAddress,
    contacts: p.contacts,
    tags: p.tags || [],
    notes: p.notes,
    totalRevenue: p.totalRevenue || 0,
    totalJobs: p.totalJobs || 0,
    avgJobValue: p.avgJobValue || 0,
  };
}

function quoteFields(p: any) {
  return {
    quoteNumber: p.quoteNumber,
    customerId: p.customerId,
    customerName: p.customerName || '',
    status: p.status || 'draft',
    priority: p.priority || 'normal',
    createdBy: p.createdBy || '',
    issueDate: p.issueDate || '',
    expiryDate: p.expiryDate,
    lineItems: p.lineItems || [],
    subtotal: p.subtotal || 0,
    discountAmount: p.discountAmount || 0,
    taxRate: p.taxRate || 0,
    taxAmount: p.taxAmount || 0,
    total: p.total || 0,
    notes: p.notes,
    internalNotes: p.internalNotes,
    currency: p.currency || 'CAD',
    deliveryProvince: p.deliveryProvince,
    taxOverride: p.taxOverride || false,
    rackConfig: p.rackConfig,
    convertedToJobId: p.convertedToJobId,
  };
}

function jobFields(p: any) {
  return {
    jobNumber: p.jobNumber,
    quoteId: p.quoteId,
    customerId: p.customerId,
    customerName: p.customerName || '',
    serviceType: p.serviceType || 'powder_coating',
    status: p.status || 'received',
    priority: p.priority || 'normal',
    parts: p.parts || [],
    quotedRackConfig: p.quotedRackConfig,
    dueDate: p.dueDate || '',
    receivedDate: p.receivedDate || '',
    completedDate: p.completedDate,
    estimatedHours: p.estimatedHours || 0,
    laborCost: p.laborCost || 0,
    materialCost: p.materialCost || 0,
    totalCost: p.totalCost || 0,
    salePrice: p.salePrice || 0,
    notes: p.notes,
    internalNotes: p.internalNotes,
    statusHistory: p.statusHistory || [],
    attachments: p.attachments,
    operatorId: p.operatorId,
    qcInspectorId: p.qcInspectorId,
    scheduledDate: p.scheduledDate,
  };
}

function invoiceFields(p: any) {
  return {
    invoiceNumber: p.invoiceNumber,
    customerId: p.customerId,
    customerName: p.customerName || '',
    jobId: p.jobId,
    quoteId: p.quoteId,
    status: p.status || 'draft',
    issueDate: p.issueDate || '',
    dueDate: p.dueDate || '',
    paidDate: p.paidDate,
    lineItems: p.lineItems || [],
    subtotal: p.subtotal || 0,
    discountAmount: p.discountAmount || 0,
    taxRate: p.taxRate || 0,
    taxAmount: p.taxAmount || 0,
    total: p.total || 0,
    amountPaid: p.amountPaid || 0,
    notes: p.notes,
    paymentTerms: p.paymentTerms,
    currency: p.currency || 'CAD',
  };
}

function inventoryFields(p: any) {
  return {
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category || 'consumable',
    unit: p.unit || 'ea',
    quantity: p.quantity || 0,
    reorderPoint: p.reorderPoint || 0,
    reorderQuantity: p.reorderQuantity || 0,
    unitCost: p.unitCost || 0,
    location: p.location,
    supplier: p.supplier,
    supplierSku: p.supplierSku,
    notes: p.notes,
    active: p.active !== false,
  };
}

function employeeFields(p: any) {
  return {
    employeeNumber: p.employeeNumber,
    name: p.name,
    email: p.email,
    phone: p.phone,
    department: p.department || '',
    position: p.position || '',
    employmentType: p.employmentType || 'full_time',
    payType: p.payType || 'hourly',
    hourlyRate: p.hourlyRate,
    salary: p.salary,
    status: p.status || 'active',
    hireDate: p.hireDate || '',
    terminationDate: p.terminationDate,
    address: p.address,
    emergencyContact: p.emergencyContact,
    certifications: p.certifications,
    adpAoid: p.adpAoid,
    adpLastSync: p.adpLastSync,
    adpSyncStatus: p.adpSyncStatus,
  };
}

function attendanceFields(p: any) {
  return {
    employeeId: p.employeeId,
    date: p.date || '',
    clockIn: p.clockIn,
    clockOut: p.clockOut,
    breakMinutes: p.breakMinutes || 0,
    totalHours: p.totalHours,
    overtime: p.overtime,
    notes: p.notes,
    jobCostingRef: p.jobCostingRef,
    adpTimecardId: p.adpTimecardId,
    adpSubmitted: p.adpSubmitted || false,
    adpSubmittedAt: p.adpSubmittedAt,
  };
}

// ─── GET /api/state ───────────────────────────────────────────────────────────

stateRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [
      customers, quotes, jobs, invoices,
      inventoryItems, employees, attendanceRecords,
      equipment, maintenanceTasks, notifications,
      deltas,
    ] = await Promise.all([
      prisma.customer.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.quote.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.job.findMany({ orderBy: { receivedDate: 'desc' } }),
      prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } }),
      prisma.employee.findMany({ orderBy: { name: 'asc' } }),
      prisma.attendanceRecord.findMany({ orderBy: { date: 'desc' } }),
      prisma.equipment.findMany({ orderBy: { name: 'asc' } }),
      prisma.maintenanceTask.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.notification.findMany({
        where: {
          OR: [
            { userId: req.user!.userId },
            { userId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Replay deltas for non-normalized entities
      prisma.appStateDelta.findMany({
        where: { reverted: false },
        orderBy: { appliedAt: 'asc' },
      }),
    ]);

    // Build state by replaying deltas for non-normalized entities
    const deltaState: Record<string, any[]> = {};
    const normalizedTypes = new Set(Object.keys(NORMALIZED_HANDLERS));

    for (const delta of deltas) {
      if (normalizedTypes.has(delta.actionType)) continue; // skip — handled by tables

      const payload = delta.payload as any;
      const entityKey = getEntityKeyFromActionType(delta.actionType);
      if (!entityKey) continue;

      if (!deltaState[entityKey]) deltaState[entityKey] = [];

      if (delta.actionType.startsWith('ADD_')) {
        deltaState[entityKey].push(payload);
      } else if (delta.actionType.startsWith('UPDATE_')) {
        const idx = deltaState[entityKey].findIndex((e: any) => e.id === payload.id);
        if (idx >= 0) deltaState[entityKey][idx] = payload;
        else deltaState[entityKey].push(payload);
      } else if (delta.actionType.startsWith('DELETE_')) {
        deltaState[entityKey] = deltaState[entityKey].filter((e: any) => e.id !== payload.id);
      }
    }

    // Assemble the full AppState shape (matches AppContext's AppState interface)
    const appState = {
      customers,
      quotes,
      jobs,
      invoices,
      inventory: inventoryItems,
      employees,
      attendanceRecords,
      equipment,
      maintenanceTasks,
      notifications,
      // Non-normalized entities from deltas:
      racks: deltaState.racks || [],
      batches: deltaState.batches || [],
      qcInspections: deltaState.qcInspections || [],
      inventoryTransactions: deltaState.inventoryTransactions || [],
      ncrs: deltaState.ncrs || [],
      shipments: deltaState.shipments || [],
      receipts: deltaState.receipts || [],
      spareParts: deltaState.spareParts || [],
      workInstructions: deltaState.workInstructions || [],
      criticalSuppliers: deltaState.criticalSuppliers || [],
      trainingRecords: deltaState.trainingRecords || [],
      scanEvents: deltaState.scanEvents || [],
      jobOrders: deltaState.jobOrders || [],
      crmActivities: deltaState.crmActivities || [],
      crmOpportunities: deltaState.crmOpportunities || [],
      logisticsStops: deltaState.logisticsStops || [],
      driverRunSheets: deltaState.driverRunSheets || [],
      workstationSessions: deltaState.workstationSessions || [],
      costEntries: deltaState.costEntries || [],
      maintenanceSchedules: deltaState.maintenanceSchedules || [],
      equipmentRuntime: deltaState.equipmentRuntime || [],
      // UI state is not synced (client-managed)
      loggedIn: true,
      sidebarOpen: true,
      auditLog: deltaState.auditLog || [],
      customDropdowns: deltaState.customDropdowns || null,
    };

    res.json(appState);
  } catch (err) {
    console.error('GET /api/state error:', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

// ─── POST /api/mutations ──────────────────────────────────────────────────────

stateRouter.post('/mutations', async (req: Request, res: Response) => {
  const { type, payload } = req.body;

  if (!type || payload === undefined) {
    res.status(400).json({ error: 'Missing type or payload' });
    return;
  }

  const userId = req.user!.userId;
  const userName = req.user!.name;
  const originSocketId = req.socketId;

  try {
    // 1. Apply to normalized table if handler exists
    const handler = NORMALIZED_HANDLERS[type];
    if (handler) {
      await handler(payload, userId, userName);
    }

    // 2. Always store as delta (for replay and audit)
    await prisma.appStateDelta.create({
      data: { actionType: type, payload, userId, userName },
    });

    // 3. Audit log for significant mutations
    if (type.includes('DELETE') || type.includes('UPDATE') || type.includes('ADD')) {
      await prisma.auditLog.create({
        data: {
          userId,
          userName,
          action: type,
          entityType: getEntityTypeFromActionType(type),
          entityId: payload?.id,
          details: { payload },
          ipAddress: req.ip,
        },
      });
    }

    // 4. Broadcast to all other connected clients
    const io = getIo();
    if (io) {
      io.to('default').except(originSocketId || '').emit('state:mutation', {
        type,
        payload,
        _originSocketId: originSocketId,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(`Mutation error [${type}]:`, err);
    res.status(500).json({ error: 'Failed to persist mutation' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEntityKeyFromActionType(actionType: string): string | null {
  const map: Record<string, string> = {
    ADD_RACK: 'racks', UPDATE_RACK: 'racks', DELETE_RACK: 'racks',
    ADD_BATCH: 'batches', UPDATE_BATCH: 'batches', DELETE_BATCH: 'batches',
    ADD_QC_INSPECTION: 'qcInspections', UPDATE_QC_INSPECTION: 'qcInspections',
    ADD_INVENTORY_TRANSACTION: 'inventoryTransactions',
    ADD_NCR: 'ncrs', UPDATE_NCR: 'ncrs',
    ADD_SHIPMENT: 'shipments', UPDATE_SHIPMENT: 'shipments',
    ADD_RECEIPT: 'receipts', UPDATE_RECEIPT: 'receipts',
    ADD_SPARE_PART: 'spareParts', UPDATE_SPARE_PART: 'spareParts',
    ADD_WORK_INSTRUCTION: 'workInstructions', UPDATE_WORK_INSTRUCTION: 'workInstructions',
    ADD_TRAINING_RECORD: 'trainingRecords', UPDATE_TRAINING_RECORD: 'trainingRecords',
    ADD_CRM_ACTIVITY: 'crmActivities', UPDATE_CRM_ACTIVITY: 'crmActivities',
    ADD_CRM_OPPORTUNITY: 'crmOpportunities', UPDATE_CRM_OPPORTUNITY: 'crmOpportunities',
    ADD_LOGISTICS_STOP: 'logisticsStops', UPDATE_LOGISTICS_STOP: 'logisticsStops',
    ADD_DRIVER_RUN_SHEET: 'driverRunSheets', UPDATE_DRIVER_RUN_SHEET: 'driverRunSheets',
    ADD_COST_ENTRY: 'costEntries', UPDATE_COST_ENTRY: 'costEntries',
    ADD_JOB_ORDER: 'jobOrders', UPDATE_JOB_ORDER: 'jobOrders',
    ADD_SCAN_EVENT: 'scanEvents',
    UPDATE_CUSTOM_DROPDOWN: 'customDropdowns',
    ADD_AUDIT_LOG: 'auditLog',
  };
  return map[actionType] || null;
}

function getEntityTypeFromActionType(actionType: string): string {
  const parts = actionType.split('_');
  // e.g. ADD_QUOTE → Quote, UPDATE_JOB_STATUS → Job
  if (parts.length >= 2) return parts.slice(1).map(p => p.charAt(0) + p.slice(1).toLowerCase()).join('');
  return actionType;
}
