// server/prisma/seed.ts — Seeds the database from mockData values
// Default password for all users: Decora2026!

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'Decora2026!';

async function main() {
  console.log('🌱 Seeding Decora ERP database...\n');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // ─── Users ──────────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const users = [
    { id: 'u1', name: 'Alex Rivera',   email: 'alex@decoraerp.com',   role: 'admin',    department: 'Management',      avatarInitials: 'AR' },
    { id: 'u2', name: 'Sam Chen',      email: 'sam@decoraerp.com',    role: 'manager',  department: 'Production',      avatarInitials: 'SC' },
    { id: 'u3', name: 'Jordan Patel',  email: 'jordan@decoraerp.com', role: 'operator', department: 'Powder Coating',  avatarInitials: 'JP' },
    { id: 'u4', name: 'Taylor Nguyen', email: 'taylor@decoraerp.com', role: 'operator', department: 'Sublimation',     avatarInitials: 'TN' },
    { id: 'u5', name: 'Casey Moore',   email: 'casey@decoraerp.com',  role: 'sales',    department: 'Sales',           avatarInitials: 'CM' },
    { id: 'u6', name: 'Drew Williams', email: 'drew@decoraerp.com',   role: 'operator', department: 'QC',              avatarInitials: 'DW' },
  ] as const;

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { id: u.id, ...u, passwordHash, active: true },
    });
  }
  console.log(`   ✅ ${users.length} users created (password: ${DEFAULT_PASSWORD})\n`);

  // ─── Customers ──────────────────────────────────────────────────────────────
  console.log('🏢 Creating customers...');
  const customers = [
    {
      id: 'c1', accountNumber: 'ACC-0001', name: 'Ironclad Fabrication', type: 'industrial',
      email: 'orders@ironclad.com', phone: '313-555-0142', currency: 'CAD', paymentTerms: 'Net 30',
      billingAddress: { street: '4821 Industrial Dr', city: 'Detroit', state: 'MI', zip: '48201', country: 'US' },
      contacts: [{ name: 'Mike Donovan', title: 'Plant Manager', email: 'mdonovan@ironclad.com', phone: '313-555-0142', primary: true }],
      tags: ['heavy-industrial', 'steel', 'high-volume'],
      notes: 'Large volume steel parts. Prefers batch processing.',
      totalRevenue: 284000, totalJobs: 142, avgJobValue: 2000,
    },
    {
      id: 'c2', accountNumber: 'ACC-0002', name: 'BrightSport Promo', type: 'wholesale',
      email: 'sarah@brightsport.com', phone: '614-555-0198', currency: 'CAD', paymentTerms: 'Net 15',
      taxExempt: true, taxNumber: 'EXEMPT-OH-2024',
      billingAddress: { street: '230 Commerce Blvd', city: 'Columbus', state: 'OH', zip: '43215', country: 'US' },
      contacts: [{ name: 'Sarah Bloom', title: 'Owner', email: 'sarah@brightsport.com', phone: '614-555-0198', primary: true }],
      tags: ['sublimation', 'promo-goods', 'tax-exempt'],
      totalRevenue: 96000, totalJobs: 380, avgJobValue: 253,
    },
    {
      id: 'c3', accountNumber: 'ACC-0003', name: 'Apex Automotive', type: 'commercial',
      email: 'operations@apexauto.com', phone: '616-555-0271', currency: 'CAD', paymentTerms: 'Net 30',
      billingAddress: { street: '1590 Auto Park Way', city: 'Grand Rapids', state: 'MI', zip: '49503', country: 'US' },
      contacts: [
        { name: 'Tom Garcia', title: 'Operations Director', email: 'tgarcia@apexauto.com', phone: '616-555-0271', primary: true },
        { name: 'Nina Park', title: 'QC Lead', email: 'npark@apexauto.com', primary: false },
      ],
      tags: ['automotive', 'precision', 'aluminum'],
      totalRevenue: 412000, totalJobs: 215, avgJobValue: 1916,
    },
    {
      id: 'c4', accountNumber: 'ACC-0004', name: 'Coastal Custom Signs', type: 'commercial',
      email: 'dana@coastalsigns.com', phone: '813-555-0334', currency: 'CAD', paymentTerms: 'Net 15',
      billingAddress: { street: '88 Bayshore Blvd', city: 'Tampa', state: 'FL', zip: '33602', country: 'US' },
      contacts: [{ name: 'Dana Lee', title: 'Owner', email: 'dana@coastalsigns.com', primary: true }],
      tags: ['signs', 'aluminum', 'combo-job'],
      totalRevenue: 54000, totalJobs: 88, avgJobValue: 614,
    },
    {
      id: 'c5', accountNumber: 'ACC-0005', name: 'TuffRack Storage', type: 'industrial',
      email: 'ben@tuffrack.com', phone: '513-555-0417', currency: 'CAD', paymentTerms: 'Net 45',
      billingAddress: { street: '2200 Warehouse Way', city: 'Cincinnati', state: 'OH', zip: '45202', country: 'US' },
      contacts: [{ name: 'Ben Carter', title: 'Plant Manager', email: 'ben@tuffrack.com', primary: true }],
      tags: ['heavy-steel', 'racking', 'bulk'],
      totalRevenue: 178000, totalJobs: 96, avgJobValue: 1854,
    },
    {
      id: 'c6', accountNumber: 'ACC-0006', name: 'Sunrise Gifts & Apparel', type: 'retail',
      email: 'maria@sunrisegifts.com', phone: '407-555-0589', currency: 'CAD', paymentTerms: 'COD',
      billingAddress: { street: '1025 Tourist Mile', city: 'Orlando', state: 'FL', zip: '32801', country: 'US' },
      contacts: [{ name: 'Maria Santos', title: 'Owner', email: 'maria@sunrisegifts.com', primary: true }],
      tags: ['sublimation', 'retail', 'seasonal'],
      totalRevenue: 32000, totalJobs: 210, avgJobValue: 152,
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }
  console.log(`   ✅ ${customers.length} customers created\n`);

  // ─── Quotes ─────────────────────────────────────────────────────────────────
  console.log('📋 Creating quotes...');
  const quotes = [
    {
      id: 'q1', quoteNumber: 'Q-2026-0041', customerId: 'c1', customerName: 'Ironclad Fabrication',
      status: 'sent', priority: 'normal', createdBy: 'Casey Moore',
      issueDate: '2026-02-20', expiryDate: '2026-03-20',
      lineItems: [{ id: 'li1', description: '200 ea Steel Gate Frames — powder coat (Matte Black) + sandblast', quantity: 200, unitPrice: 21.05, unit: 'ea', discount: 0, serviceType: 'powder_coating' }],
      subtotal: 4210.00, discountAmount: 0, taxRate: 6, taxAmount: 252.60, total: 4462.60, currency: 'CAD',
    },
    {
      id: 'q2', quoteNumber: 'Q-2026-0042', customerId: 'c2', customerName: 'BrightSport Promo',
      status: 'approved', priority: 'high', createdBy: 'Casey Moore',
      issueDate: '2026-02-18', expiryDate: '2026-03-18',
      lineItems: [{ id: 'li2', description: '500 ea 11oz Sublimation Mugs — full wrap, 4-colour', quantity: 500, unitPrice: 5.625, unit: 'ea', discount: 0, serviceType: 'sublimation' }],
      subtotal: 2812.50, discountAmount: 0, taxRate: 0, taxAmount: 0, total: 2812.50, currency: 'CAD',
      convertedToJobId: 'j3',
    },
    {
      id: 'q3', quoteNumber: 'Q-2026-0043', customerId: 'c3', customerName: 'Apex Automotive',
      status: 'draft', priority: 'rush', createdBy: 'Casey Moore',
      issueDate: '2026-02-25', expiryDate: '2026-03-25',
      lineItems: [{ id: 'li3', description: '800 ea Aluminum Engine Brackets — Pure White Gloss + Iron Phosphate pretreat', quantity: 800, unitPrice: 14.44, unit: 'ea', discount: 0, serviceType: 'powder_coating' }],
      subtotal: 11552.00, discountAmount: 0, taxRate: 6.5, taxAmount: 750.88, total: 12302.88, currency: 'CAD',
    },
  ];

  for (const q of quotes) {
    await prisma.quote.upsert({ where: { id: q.id }, update: {}, create: q });
  }
  console.log(`   ✅ ${quotes.length} quotes created\n`);

  // ─── Jobs ────────────────────────────────────────────────────────────────────
  console.log('🔧 Creating jobs...');
  const baseHistory = (status: string) => [{ status, timestamp: '2026-02-01T08:00:00.000Z', userId: 'u2', userName: 'Sam Chen' }];

  const jobs = [
    {
      id: 'j1', jobNumber: 'WO-2026-0101', customerId: 'c1', customerName: 'Ironclad Fabrication',
      serviceType: 'powder_coating', status: 'cure', priority: 'normal',
      parts: [{ id: 'p1', name: 'Steel Gate Frame', quantity: 50, weight: 8.5, material: 'Mild Steel A36' }],
      dueDate: '2026-03-01', receivedDate: '2026-02-18',
      estimatedHours: 6, laborCost: 240, materialCost: 95, totalCost: 335, salePrice: 681.25,
      notes: 'Matte Black RAL 9005. Sandblast required before coat.',
      statusHistory: baseHistory('cure'), attachments: [],
      operatorId: 'u3', qcInspectorId: 'u6',
    },
    {
      id: 'j2', jobNumber: 'WO-2026-0102', customerId: 'c5', customerName: 'TuffRack Storage',
      serviceType: 'powder_coating', status: 'pretreat', priority: 'normal',
      parts: [{ id: 'p2', name: 'Steel Upright Post', quantity: 120, weight: 12.0, material: 'Mild Steel' }],
      dueDate: '2026-03-05', receivedDate: '2026-02-20',
      estimatedHours: 14, laborCost: 560, materialCost: 280, totalCost: 840, salePrice: 2100,
      notes: 'Tricorn Black semi-gloss. Heavy parts — check oven load.',
      statusHistory: baseHistory('pretreat'), attachments: [],
      operatorId: 'u3',
    },
    {
      id: 'j3', jobNumber: 'WO-2026-0103', quoteId: 'q2', customerId: 'c2', customerName: 'BrightSport Promo',
      serviceType: 'sublimation', status: 'coat', priority: 'high',
      parts: [{ id: 'p3', name: '11oz Sublimation Mug', quantity: 500, material: 'Ceramic' }],
      dueDate: '2026-02-28', receivedDate: '2026-02-19',
      estimatedHours: 20, laborCost: 600, materialCost: 250, totalCost: 850, salePrice: 2812.50,
      notes: 'Full wrap 4-colour. All mugs must pass colour consistency check.',
      statusHistory: baseHistory('coat'), attachments: [],
      operatorId: 'u4', qcInspectorId: 'u6',
    },
    {
      id: 'j4', jobNumber: 'WO-2026-0104', customerId: 'c3', customerName: 'Apex Automotive',
      serviceType: 'powder_coating', status: 'qc', priority: 'rush',
      parts: [{ id: 'p4', name: 'Aluminum Engine Bracket', quantity: 200, weight: 0.9, material: 'Aluminum 6061' }],
      dueDate: '2026-02-27', receivedDate: '2026-02-22',
      estimatedHours: 10, laborCost: 480, materialCost: 195, totalCost: 675, salePrice: 2888,
      notes: 'Pure White Gloss. RUSH — Apex needs these by end of week.',
      statusHistory: baseHistory('qc'), attachments: [],
      operatorId: 'u3', qcInspectorId: 'u6',
    },
    {
      id: 'j5', jobNumber: 'WO-2026-0105', customerId: 'c4', customerName: 'Coastal Custom Signs',
      serviceType: 'both', status: 'shipping', priority: 'normal',
      parts: [{ id: 'p5', name: 'Aluminum Sign Blank', quantity: 100, weight: 1.2, material: 'Aluminum 5052' }],
      dueDate: '2026-03-01', receivedDate: '2026-02-15',
      estimatedHours: 12, laborCost: 480, materialCost: 190, totalCost: 670, salePrice: 1285,
      notes: 'White base coat then sublimate. QC passed 2026-02-25.',
      statusHistory: baseHistory('shipping'), attachments: [],
      operatorId: 'u4', qcInspectorId: 'u6',
    },
    {
      id: 'j6', jobNumber: 'WO-2026-0106', customerId: 'c6', customerName: 'Sunrise Gifts & Apparel',
      serviceType: 'sublimation', status: 'complete', priority: 'normal',
      parts: [{ id: 'p6', name: 'Ceramic Ornament', quantity: 250, material: 'Ceramic' }],
      dueDate: '2026-02-22', receivedDate: '2026-02-10',
      completedDate: '2026-02-22',
      estimatedHours: 8, laborCost: 240, materialCost: 110, totalCost: 350, salePrice: 660,
      notes: '5 holiday variants, 50 pcs each. Completed on time.',
      statusHistory: baseHistory('complete'), attachments: [],
      operatorId: 'u4', qcInspectorId: 'u6',
    },
  ];

  for (const j of jobs) {
    await prisma.job.upsert({ where: { id: j.id }, update: {}, create: j });
  }
  console.log(`   ✅ ${jobs.length} jobs created\n`);

  // ─── Inventory ───────────────────────────────────────────────────────────────
  console.log('📦 Creating inventory...');
  const inventory = [
    { id: 'inv1', sku: 'PWD-RAL9005-5KG', name: 'Matte Black Powder (RAL 9005)', category: 'powder', unit: 'kg', quantity: 45.5, reorderPoint: 10, reorderQuantity: 25, unitCost: 12.50, supplier: 'Tiger Drylac', location: 'Powder Room A' },
    { id: 'inv2', sku: 'PWD-RAL9010-5KG', name: 'Pure White Powder (RAL 9010)', category: 'powder', unit: 'kg', quantity: 8.0, reorderPoint: 10, reorderQuantity: 25, unitCost: 12.75, supplier: 'Tiger Drylac', location: 'Powder Room A' },
    { id: 'inv3', sku: 'CHM-IRNPHO-20L', name: 'Iron Phosphate (20L)', category: 'chemical', unit: 'L', quantity: 120, reorderPoint: 40, reorderQuantity: 80, unitCost: 4.25, supplier: 'Chemetall', location: 'Chemical Storage' },
    { id: 'inv4', sku: 'SUB-PAP-ROLL-24', name: 'Sublimation Paper Roll 24"', category: 'sublimation_supply', unit: 'roll', quantity: 6, reorderPoint: 3, reorderQuantity: 10, unitCost: 45.00, supplier: 'TexPrint', location: 'Sub Room' },
    { id: 'inv5', sku: 'PKG-CORR-BOX-LG', name: 'Corrugated Box (Large)', category: 'packaging', unit: 'ea', quantity: 200, reorderPoint: 50, reorderQuantity: 200, unitCost: 2.10, supplier: 'Uline', location: 'Shipping Dock' },
  ];

  for (const item of inventory) {
    await prisma.inventoryItem.upsert({ where: { id: item.id }, update: {}, create: item });
  }
  console.log(`   ✅ ${inventory.length} inventory items created\n`);

  // ─── Employees ───────────────────────────────────────────────────────────────
  console.log('👷 Creating employees...');
  const employees = [
    { id: 'emp1', employeeNumber: 'EMP-001', name: 'Jordan Patel',  department: 'Powder Coating', position: 'Lead Operator',    hireDate: '2020-03-15', status: 'active', payType: 'hourly', hourlyRate: 22.50 },
    { id: 'emp2', employeeNumber: 'EMP-002', name: 'Taylor Nguyen', department: 'Sublimation',    position: 'Operator',          hireDate: '2021-07-01', status: 'active', payType: 'hourly', hourlyRate: 20.00 },
    { id: 'emp3', employeeNumber: 'EMP-003', name: 'Drew Williams', department: 'QC',             position: 'QC Inspector',      hireDate: '2019-11-12', status: 'active', payType: 'hourly', hourlyRate: 24.00 },
    { id: 'emp4', employeeNumber: 'EMP-004', name: 'Marco Reyes',   department: 'Powder Coating', position: 'Operator',          hireDate: '2022-01-10', status: 'active', payType: 'hourly', hourlyRate: 19.50 },
    { id: 'emp5', employeeNumber: 'EMP-005', name: 'Priya Sharma',  department: 'Shipping',       position: 'Shipper/Receiver',  hireDate: '2023-05-22', status: 'active', payType: 'hourly', hourlyRate: 18.75 },
    { id: 'emp6', employeeNumber: 'EMP-006', name: 'Kyle Thompson', department: 'Maintenance',    position: 'Maintenance Tech',  hireDate: '2018-08-30', status: 'active', payType: 'hourly', hourlyRate: 26.00 },
    { id: 'emp7', employeeNumber: 'EMP-007', name: 'Aisha Johnson', department: 'Production',     position: 'Production Mgr',   hireDate: '2017-04-01', status: 'active', payType: 'salary', salary: 72000 },
    { id: 'emp8', employeeNumber: 'EMP-008', name: 'Luis Morales',  department: 'Powder Coating', position: 'Operator',          hireDate: '2024-02-15', status: 'active', payType: 'hourly', hourlyRate: 18.00 },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({ where: { id: emp.id }, update: {}, create: emp });
  }
  console.log(`   ✅ ${employees.length} employees created\n`);

  // ─── Equipment ───────────────────────────────────────────────────────────────
  console.log('⚙️  Creating equipment...');
  const equipment = [
    { id: 'eq1', name: 'Oven 1 — Walk-in Cure',    type: 'oven',      status: 'operational',  location: 'Line 1', model: 'Precision Quincy 888',    lastMaintenanceDate: '2026-01-15', nextMaintenanceDate: '2026-04-15' },
    { id: 'eq2', name: 'Oven 2 — Batch Cure',       type: 'oven',      status: 'operational',  location: 'Line 2', model: 'Wisconsin Oven HT-Series', lastMaintenanceDate: '2026-01-20', nextMaintenanceDate: '2026-04-20' },
    { id: 'eq3', name: 'Spray Booth 1',             type: 'booth',     status: 'operational',  location: 'Line 1', model: 'Nordson Prodigy IG' },
    { id: 'eq4', name: 'Blast Cabinet',             type: 'blaster',   status: 'operational',  location: 'Prep Bay' },
    { id: 'eq5', name: 'Sub Press 1 — Mug',         type: 'press',     status: 'operational',  location: 'Sub Room', model: 'Hotronix Craft' },
    { id: 'eq6', name: 'Sub Press 2 — Flat',        type: 'press',     status: 'maintenance',  location: 'Sub Room', model: 'Stahls Hotronix Air' },
    { id: 'eq7', name: 'Pretreat Washer',           type: 'washer',    status: 'operational',  location: 'Prep Bay' },
    { id: 'eq8', name: 'Conveyor — Line 1',         type: 'conveyor',  status: 'operational',  location: 'Line 1' },
  ];

  for (const eq of equipment) {
    await prisma.equipment.upsert({ where: { id: eq.id }, update: {}, create: eq });
  }
  console.log(`   ✅ ${equipment.length} equipment records created\n`);

  // ─── Invoices ────────────────────────────────────────────────────────────────
  console.log('🧾 Creating invoices...');
  await prisma.invoice.upsert({
    where: { id: 'inv-1' },
    update: {},
    create: {
      id: 'inv-1', invoiceNumber: 'INV-2026-0001',
      customerId: 'c6', customerName: 'Sunrise Gifts & Apparel',
      jobId: 'j6', status: 'paid',
      issueDate: '2026-02-22', dueDate: '2026-02-22', paidDate: '2026-02-22',
      lineItems: [{ id: 'ili1', description: 'Sublimation — 250 Ceramic Ornaments (5 variants)', quantity: 250, unitPrice: 2.64, unit: 'ea', discount: 0 }],
      subtotal: 660, discountAmount: 0, taxRate: 13, taxAmount: 85.80, total: 745.80, amountPaid: 745.80, currency: 'CAD',
    },
  });
  console.log('   ✅ 1 invoice created\n');

  // ─── Notifications ────────────────────────────────────────────────────────────
  console.log('🔔 Creating sample notifications...');
  await prisma.notification.createMany({
    data: [
      { userId: null, type: 'info', title: 'System Ready', message: 'Decora ERP is now running with a live database. All users share real-time data.', read: false },
      { userId: null, type: 'warning', title: 'Low Inventory', message: 'Pure White Powder (RAL 9010) is below reorder point (8 kg remaining).', read: false, link: '/inventory' },
    ],
    skipDuplicates: true,
  });
  console.log('   ✅ 2 notifications created\n');

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Seed complete!\n');
  console.log('👤 Login credentials (all users):');
  console.log(`   Email:    <firstname>@decoraerp.com`);
  console.log(`   Password: ${DEFAULT_PASSWORD}\n`);
  console.log('   e.g. alex@decoraerp.com / Decora2026!');
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
