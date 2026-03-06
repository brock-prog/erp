import React, { useState } from 'react';
import {
  BookOpen, ChevronRight, ChevronDown, Search, Play,
  LayoutDashboard, TrendingUp, Briefcase, Package,
  Receipt, BarChart3, Shield, Users, CalendarDays,
  ShieldCheck, Truck, Calculator, Bell, Target, Wrench,
  Settings, MapPin, DollarSign, ClipboardList, FileText,
  Warehouse, HardHat, Monitor, Globe, ArrowRight,
} from 'lucide-react';
import { clsx } from '../../utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  title?: string;
  description?: string;
  tip?: string;
  proTip?: string;
}

interface Tutorial {
  id: string;
  title: string;
  role: string[];
  time: string;
  icon: React.ReactNode;
  color: string;
  summary: string;
  scenario?: string;
  steps: Step[];
}

// ─── Getting Started Chapters ──────────────────────────────────────────────────

interface Chapter {
  step: number;
  title: string;
  module: string;
  icon: React.ReactNode;
  description: string;
  proTip: string;
  tutorialId: string;
}

const CHAPTERS: Chapter[] = [
  {
    step: 1,
    title: 'Customer Calls for a Quote',
    module: 'CRM',
    icon: <TrendingUp size={16} />,
    description: 'John Smith calls about coating 12 aluminum railing sections matte black. Log this as a new CRM opportunity so the sales team can track the lead and follow up.',
    proTip: 'For Apex Glazing (commercial): Log the opportunity with a higher value ($15K+), tag it with the compliance standard (AAMA 2604), and note the expected volume (200 pieces).',
    tutorialId: 'crm',
  },
  {
    step: 2,
    title: 'Create the Customer Record',
    module: 'Customers',
    icon: <Users size={16} />,
    description: 'Add John Smith as a new customer with his contact info, billing address, and payment terms (Net 15). This record links to every quote, job, and invoice going forward.',
    proTip: 'For Apex Glazing: Set payment terms to Net 30, add multiple contacts (project manager + AP), set currency to CAD, and note the tax jurisdiction for auto-calculating HST.',
    tutorialId: 'customers',
  },
  {
    step: 3,
    title: 'Build and Send a Quote',
    module: 'Quotes',
    icon: <Calculator size={16} />,
    description: 'Create a quote for John: 12 railing sections, RAL 9005 matte black powder coat. Add line items, set the rack configuration (line type, hook type, part dimensions), and the system calculates the price. Send it and wait for approval.',
    proTip: 'For Apex Glazing: Add AAMA 2604 as the compliance standard on the quote. The rack config needs a different line type (batch oven vs automated). Include a Certificate of Conformance as a deliverable.',
    tutorialId: 'quoting',
  },
  {
    step: 4,
    title: 'Customer Drops Off Parts',
    module: 'Receiving Kiosk',
    icon: <Warehouse size={16} />,
    description: 'John drops off his 12 railing sections. At the receiving kiosk, search for his customer record, enter the part description ("6063-T5 aluminum railing section"), scan or note the quantity, and confirm the shipment.',
    proTip: 'For Apex Glazing: The 200 extrusions arrive on a flatbed. Use the receiving kiosk to log the shipment, upload any CAD drawings, and mark critical surfaces (faces that need perfect finish).',
    tutorialId: 'receiving-kiosk',
  },
  {
    step: 5,
    title: 'Review the Pending Shipment',
    module: 'Pending Job Queue',
    icon: <ClipboardList size={16} />,
    description: 'A manager reviews the pending shipment in the job queue. Check the part details, assign the paint (RAL 9005 from inventory), review any drawings or notes, and release the shipment to create a production job.',
    proTip: 'For Apex Glazing: Attach the architectural drawings showing critical surfaces in red. Select the AAMA 2604-rated fluoropolymer paint from inventory. Check that enough paint is in stock for 200 pieces.',
    tutorialId: 'pending-jobs',
  },
  {
    step: 6,
    title: 'Job is Created and Scheduled',
    module: 'Jobs & Scheduling',
    icon: <CalendarDays size={16} />,
    description: 'The job is now live with status "Received". It appears on the scheduling board. Drag it into the production pipeline, assign it to a batch, and set the target completion date.',
    proTip: 'For Apex Glazing: This becomes a multi-phase job if sublimation is needed after powder coating. The system tracks both phases and blocks the second phase until the first passes QC.',
    tutorialId: 'jobs',
  },
  {
    step: 7,
    title: 'Parts are Coated',
    module: 'Production Floor',
    icon: <HardHat size={16} />,
    description: 'Operators prep, rack, pre-treat, coat, and cure the parts. At each workstation, they scan the job barcode to log progress. The job status advances automatically through each stage.',
    proTip: 'For Apex Glazing: The oven cure log must be recorded (PMT temperature, time-at-temp) because AAMA 2604 requires proof of proper cure. The operator logs this in the Quality module.',
    tutorialId: 'scan',
  },
  {
    step: 8,
    title: 'QC Inspection',
    module: 'Quality',
    icon: <ShieldCheck size={16} />,
    description: 'The QC inspector checks film thickness at multiple points on each part, runs a visual inspection, and records pass/fail. If any part fails, an NCR (non-conformance report) is created and the part goes to rework.',
    proTip: 'For Apex Glazing: QC must record mil thickness readings at 5+ points per part (ISO 2360 standard). All readings must meet the AAMA 2604 minimum DFT. A Certificate of Conformance (CoC) is generated for the entire batch.',
    tutorialId: 'quality',
  },
  {
    step: 9,
    title: 'Ship Finished Parts',
    module: 'Shipping',
    icon: <Truck size={16} />,
    description: 'Create a shipment for John\'s completed railing sections. Record the carrier, weight, and tracking number. The job status moves to "Shipping" and John gets notified his parts are ready.',
    proTip: 'For Apex Glazing: The shipment includes the CoC document. Use the Logistics module to schedule the delivery route if you\'re using your own truck. International shipments need a commercial invoice with HS codes.',
    tutorialId: 'shipping',
  },
  {
    step: 10,
    title: 'Generate Invoice and Collect Payment',
    module: 'Invoicing',
    icon: <Receipt size={16} />,
    description: 'Create an invoice from the completed job. The system pulls in the customer, line items, and pricing from the quote. Send the invoice and track payment. When John pays, mark it as Paid.',
    proTip: 'For Apex Glazing: The invoice is Net 30 with HST calculated automatically based on their Ontario address. CAD currency. The costing module shows your actual margin vs quoted margin for this job.',
    tutorialId: 'invoicing',
  },
  {
    step: 11,
    title: 'Post-Job: Update CRM and Review',
    module: 'CRM & Reports',
    icon: <BarChart3 size={16} />,
    description: 'Mark the CRM opportunity as "Won". The gamification system awards points to the salesperson. Review the job in Reports to see throughput, margin, and any quality issues for continuous improvement.',
    proTip: 'For Apex Glazing: The won deal ($15K+) earns bonus points on the CRM leaderboard. Review the vendor scorecard for the paint supplier to track delivery and quality performance over time.',
    tutorialId: 'reports',
  },
];

// ─── Tutorial Data ────────────────────────────────────────────────────────────

const TUTORIALS: Tutorial[] = [
  // ── GETTING STARTED ─────────────────────────────────────────────────────
  {
    id: 'login',
    title: 'Logging In',
    role: ['all'],
    time: '2 min',
    icon: <Shield size={18} />,
    color: 'bg-brand-100 text-brand-700',
    summary: 'How to access the system and navigate the main layout.',
    scenario: 'Before you can do anything in DECORA, you need to log in. Here is how the login process works and what you will see.',
    steps: [
      { title: 'Select your user profile', description: 'On the login screen, click your name card. In demo mode, no password is needed. In production, enter your PIN or password, and complete 2FA verification if enabled on your account.' },
      { title: 'Sidebar navigation', description: 'The left sidebar contains all sections: Sales (CRM, Quotes, Customers), Production (Jobs, Scheduling, Pending Jobs), Operations (Inventory, Quality, Shipping, Receiving), Insights (Reports, Alerts, EOS), and Admin. Click any section to navigate.' },
      { title: 'Collapse the sidebar', description: 'Click the arrow button at the bottom of the sidebar to collapse it to icon-only mode. Useful on smaller screens or when you want more workspace.' },
      { title: 'Notification bell', description: 'The bell icon in the top-right header shows your unread alert count. Click it for a quick dropdown of recent critical and warning alerts.' },
      { tip: 'Your active page is highlighted in green in the sidebar. You can always see where you are at a glance.' },
      { proTip: 'Admins can set session timeouts in Admin Console > Security. If your session times out, you will need to log in again. Activity (clicking, typing) resets the timeout timer.' },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    role: ['all'],
    time: '3 min',
    icon: <LayoutDashboard size={18} />,
    color: 'bg-indigo-100 text-indigo-700',
    summary: 'Your command centre: live KPIs, charts, and recent job activity at a glance.',
    scenario: 'The Dashboard is the first thing you see after login. It gives you a live snapshot of the entire operation so you can prioritize your day.',
    steps: [
      { title: 'KPI Cards', description: 'The top row shows 8 key metrics: Active Jobs, Revenue This Month, Outstanding AR (money owed to you), Average Margin, Completed Jobs, Rush Orders, Low Stock Alerts, and Overdue Jobs. Click any card to jump to that module.' },
      { title: 'Revenue Trend Chart', description: 'The area chart shows monthly revenue split by service type (Powder Coating vs Sublimation) over the last 6 months. Hover over data points to see exact dollar amounts.' },
      { title: 'Active Jobs by Service Pie', description: 'This pie chart shows the current mix of active jobs. If one service is overwhelming the others, you may need to adjust scheduling or capacity.' },
      { title: 'Weekly Throughput Chart', description: 'Bar chart showing jobs completed and total parts processed each week. Use this to spot trends in production volume.' },
      { title: 'Recent Jobs Table', description: 'The 8 most recently updated jobs appear here. Click any row to open that job\'s full detail page in the Jobs module.' },
      { tip: 'Check the Dashboard every morning. If the amber alert bar appears at the top, it means there are overdue jobs or critically low stock items that need immediate attention.' },
      { proTip: 'For commercial operations: watch the Outstanding AR card closely. If it climbs above your comfort threshold, investigate which invoices are aging in the Invoicing module.' },
    ],
  },

  // ── CUSTOMERS ───────────────────────────────────────────────────────────
  {
    id: 'customers',
    title: 'Customer Management',
    role: ['sales', 'manager', 'admin'],
    time: '4 min',
    icon: <Users size={18} />,
    color: 'bg-sky-100 text-sky-700',
    summary: 'Adding, editing, and managing customer records. Every quote, job, and invoice ties back to a customer.',
    scenario: 'In the Smith Railing job, we first need to add John Smith as a customer. Without a customer record, we cannot create quotes or jobs.',
    steps: [
      { title: 'View your customer list', description: 'The Customers page shows all customers in a searchable table. You can see each customer\'s name, primary contact, phone, email, health score, total revenue, and status.' },
      { title: 'Add a new customer', description: 'Click "Add Customer". Fill in the company name (or person\'s name for individuals), add at least one contact with email and phone, and set the billing address. This is the foundation for all future transactions.' },
      { title: 'Contacts array', description: 'Each customer can have multiple contacts (e.g., project manager, accounts payable, site supervisor). Mark one as "Primary" — this is who receives invoices and notifications by default.' },
      { title: 'Payment terms and currency', description: 'Set the customer\'s default payment terms (Net 15, Net 30, COD, etc.) and currency (CAD or USD). These carry through automatically to quotes and invoices.' },
      { title: 'Customer health score', description: 'The system calculates a health score (0-100) based on revenue, order frequency, payment behavior, and margin. This helps sales prioritize accounts that need attention.' },
      { title: 'Customer detail page', description: 'Click any customer row to see their full profile: contact list, recent jobs, open quotes, invoices, notes, and activity history.' },
      { tip: 'Always verify the billing address and email before creating the first invoice. A wrong email means the invoice never reaches AP.' },
      { proTip: 'For commercial customers like Apex Glazing: add their tax jurisdiction (e.g., Ontario) so HST is calculated automatically. Add their PO number requirement in the notes so invoicing never misses it.' },
    ],
  },

  // ── SALES ───────────────────────────────────────────────────────────────
  {
    id: 'quoting',
    title: 'Creating a Quote',
    role: ['sales', 'manager', 'admin'],
    time: '5 min',
    icon: <Calculator size={18} />,
    color: 'bg-purple-100 text-purple-700',
    summary: 'From customer inquiry to approved quote, including rack configuration for powder coating.',
    scenario: 'John Smith approved the idea of coating his railings. Now we build a formal quote with pricing, rack configuration, and tax calculation.',
    steps: [
      { title: 'Open the Quotes module', description: 'Click "Quotes" in the Sales section of the sidebar. You will see all existing quotes with their status, customer, value, and expiry date.' },
      { title: 'Click "New Quote"', description: 'Fill in: Customer (select John Smith), Priority (Normal), Expiry Date (typically 30 days out), and Service Type (Powder Coating).' },
      { title: 'Add line items', description: 'Each line item represents a service or product. For John\'s railings: Description = "Powder coat 6063-T5 aluminum railing sections - RAL 9005 Matte Black", Quantity = 12, Unit Price = your rate per piece.' },
      { title: 'Rack Configuration', description: 'This is critical for powder coating. Select: Line Type (Automated Horizontal for railings), Substrate Alloy (Aluminum 6063), Rack Type (H-Bar for profile shapes), Hook Type, and enter part dimensions (length, width, height in mm) and weight in kg. The system auto-calculates estimated loads per rack and run time.' },
      { title: 'Tax calculation', description: 'Select the delivery province/state. HST in Ontario (13%), GST+PST in BC (12%), GST only in Alberta (5%), or no Canadian tax for US/international. You can override taxes manually if needed.' },
      { title: 'Currency', description: 'Set to CAD or USD depending on the customer. All amounts display with the correct symbol. Currency is inherited from the customer record by default.' },
      { title: 'Save and send', description: 'Click "Save" to create a draft. Review all details, then change status to "Sent" when you email it. The quote tracks when it was sent and when the customer responds.' },
      { tip: 'Use the Pricing Tool (/pricing) to estimate cost per part before creating a formal quote. It helps you set competitive prices while maintaining your target margin.' },
      { proTip: 'For Apex Glazing: Include the AAMA 2604 compliance standard on the quote. The rack config will differ (batch line vs automated). Add a line item for the Certificate of Conformance as a deliverable.' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM & Sales Pipeline',
    role: ['sales', 'manager', 'admin'],
    time: '4 min',
    icon: <TrendingUp size={18} />,
    color: 'bg-green-100 text-green-700',
    summary: 'Tracking leads, opportunities, follow-ups, and the gamification leaderboard.',
    scenario: 'When John first called, we logged it as a CRM opportunity. Now we track it through the pipeline from Lead to Won.',
    steps: [
      { title: 'Pipeline view (Today tab)', description: 'The Today tab shows your scheduled activities for the day: follow-up calls, emails to send, visits planned. This is your daily action list.' },
      { title: 'Pipeline tab (Kanban)', description: 'Opportunities flow through columns: Lead, Prospect, Quoted, Negotiating, Won, Lost. Drag cards between columns as deals progress.' },
      { title: 'Add an opportunity', description: 'Click "Add Opportunity". Fill in: Customer, Estimated Value (what you think the deal is worth), Expected Close Date, Service Type, and any notes. This creates a trackable lead.' },
      { title: 'Log activities', description: 'Open any opportunity and log activities: calls, emails, visits, quote-sent, etc. Each activity earns gamification points for the salesperson.' },
      { title: 'Gamification & Leaderboard', description: 'The Scores tab shows your current level (Rookie to Legend) and points earned. The Leaderboard tab ranks all salespeople. Points are earned for activities and winning deals.' },
      { title: 'Forecast tab', description: 'Shows projected revenue based on pipeline value and probability. Managers use this for planning.' },
      { tip: 'Log at least one activity per opportunity per week. The Alert Center flags opportunities with no activity in 7+ days as "stale".' },
      { proTip: 'For Apex Glazing: tag the opportunity with the higher value tier. Won deals over $10K earn bonus leaderboard points. The forecast tab helps predict quarterly revenue from your commercial pipeline.' },
    ],
  },
  {
    id: 'invoicing',
    title: 'Invoicing & Payments',
    role: ['sales', 'manager', 'admin'],
    time: '3 min',
    icon: <Receipt size={18} />,
    color: 'bg-yellow-100 text-yellow-700',
    summary: 'Generating invoices from completed jobs and tracking payments through to collection.',
    scenario: 'John\'s railing job is complete and shipped. Now we create an invoice so we get paid.',
    steps: [
      { title: 'Create invoice from completed job', description: 'In the Invoices module, click "New Invoice". Select the completed job and the system auto-fills: customer, line items, pricing, and tax from the original quote. Review and save.' },
      { title: 'Invoice statuses', description: 'Draft (not yet sent) -> Sent (emailed to customer) -> Partial (some payment received) -> Paid (fully settled). Or Overdue if past the due date.' },
      { title: 'Track payments', description: 'When a payment arrives, open the invoice and record the payment amount and date. The balance updates automatically. Partial payments are tracked until the full amount is received.' },
      { title: 'Overdue tracking', description: 'The Alert Center flags invoices past their due date. The Finance alert category shows total outstanding AR. Follow up on overdue invoices promptly.' },
      { title: 'Currency handling', description: 'Invoices inherit currency from the customer record. CAD shows "CA$", USD shows "US$". All calculations respect the selected currency.' },
      { tip: 'Net 30 means payment is due 30 days after the invoice date. The system calculates due dates automatically based on the customer\'s payment terms.' },
      { proTip: 'For Apex Glazing: their PO number must appear on the invoice or their AP department will reject it. Check the customer notes for any special invoicing requirements before sending.' },
    ],
  },

  // ── PRODUCTION ──────────────────────────────────────────────────────────
  {
    id: 'receiving-kiosk',
    title: 'Receiving Kiosk (Operator Guide)',
    role: ['operator', 'manager', 'admin'],
    time: '3 min',
    icon: <Warehouse size={18} />,
    color: 'bg-lime-100 text-lime-700',
    summary: 'Full-screen kiosk for receiving customer parts at the dock. Searches customers, saves parts to the library.',
    scenario: 'John drops off his 12 railing sections at the dock. The receiving operator uses this kiosk to log the incoming shipment.',
    steps: [
      { title: 'Open Receiving Kiosk', description: 'Click "Receiving Kiosk" in the Kiosks section of the sidebar. It opens a full-screen interface designed for a touch screen or tablet at the receiving dock.' },
      { title: 'Search for the customer', description: 'Start typing the customer name in the combobox. The system searches as you type. Select "John Smith" from the results. If the customer is new, you can add them from here.' },
      { title: 'Enter the part description', description: 'Type the part description (e.g., "6063-T5 Aluminum Railing Section"). The system checks the saved parts library. If it matches an existing part, it auto-fills details. If new, it saves it for next time.' },
      { title: 'Enter quantity and notes', description: 'Enter the number of pieces (12). Add any notes about condition, special handling, or customer instructions.' },
      { title: 'Confirm the shipment', description: 'Click "Confirm" to create the incoming shipment record. This sends it to the Pending Job Queue for manager review.' },
      { tip: 'The parts library learns over time. The more you use it, the faster receiving becomes because frequently used parts auto-suggest.' },
      { proTip: 'For Apex Glazing: upload CAD drawings showing critical surfaces (areas that must be flawless). Mark any damaged pieces in the notes so they are flagged before coating.' },
    ],
  },
  {
    id: 'pending-jobs',
    title: 'Pending Job Queue (Manager Review)',
    role: ['manager', 'admin'],
    time: '4 min',
    icon: <ClipboardList size={18} />,
    color: 'bg-fuchsia-100 text-fuchsia-700',
    summary: 'Reviewing received shipments, assigning paint, uploading drawings, and releasing jobs to production.',
    scenario: 'John\'s shipment arrived and was logged at the kiosk. Now a manager reviews it before it becomes a production job.',
    steps: [
      { title: 'Open the Pending Job Queue', description: 'Navigate to Production > Pending Jobs. You will see all received shipments waiting for review. Each card shows the customer, part description, quantity, and date received.' },
      { title: 'Review shipment details', description: 'Click on John\'s shipment card to expand it. Verify the customer, part count, and any notes from the receiving operator.' },
      { title: 'Assign paint from inventory', description: 'Select the powder coat paint from the inventory combobox (e.g., "RAL 9005 Matte Black - Tiger Powder"). The system shows current stock level so you know if you have enough.' },
      { title: 'Upload drawings (optional)', description: 'Click "Attach Drawing" to upload CAD files or PDFs. These appear on the job for operators to reference during production.' },
      { title: 'Mark critical surfaces', description: 'If any surfaces require extra attention (e.g., visible faces on architectural pieces), add them in the Critical Surfaces field. These appear highlighted in red on the job card.' },
      { title: 'Release to production', description: 'Click "Release Job" to create the production job. The shipment moves out of the pending queue and appears in Jobs and Scheduling.' },
      { tip: 'Always check paint stock before releasing a job. If stock is low, create a purchase order for the supplier before committing the job to the schedule.' },
      { proTip: 'For Apex Glazing: verify the compliance standard (AAMA 2604) is tagged on the job. Check that the selected paint meets the standard. Upload the architectural specifications as a drawing attachment.' },
    ],
  },
  {
    id: 'jobs',
    title: 'Managing Jobs / Work Orders',
    role: ['operator', 'manager', 'admin'],
    time: '5 min',
    icon: <Briefcase size={18} />,
    color: 'bg-brand-100 text-brand-700',
    summary: 'The lifecycle of a work order from receiving through to completion, including multi-phase jobs.',
    scenario: 'John\'s railing job is now in the system. Here is how it flows through production and what each status means.',
    steps: [
      { title: 'Job status flow', description: 'Jobs progress through: Received -> Prep -> Blast -> Rack -> Pre-Treat -> Coat -> Cure -> QC -> Unrack -> Shipping -> Complete. Jobs can also be On Hold or Cancelled at any stage.' },
      { title: 'Create a new job manually', description: 'Click "New Job" and fill in: Customer, Service Type (Powder Coating, Sublimation, or Both), Priority (Normal/Rush), Due Date, and Parts description. For powder coating, add the powder spec.' },
      { title: 'Rack configuration', description: 'When a job is created from a quote, the quoted rack config (line type, hook type, part dimensions) is shown on the Job Detail page. Operators reference this when loading parts onto racks.' },
      { title: 'Update job status', description: 'Open any job and use the status dropdown to advance it. Or use the Scheduling Board to drag the card to the next column. Every status change is logged with timestamp and operator name.' },
      { title: 'Rush orders', description: 'Set Priority to "Rush" for time-sensitive jobs. Rush jobs appear at the top of every queue, show a red badge, and trigger an alert if they sit unassigned for too long.' },
      { title: 'Multi-phase jobs', description: 'Some jobs need two phases (e.g., powder coat then sublimation). The system tracks each phase separately. Phase 2 is blocked until Phase 1 passes QC.' },
      { title: 'QC sign-off', description: 'When a job reaches QC, the inspector records pass/fail results. Failed jobs generate a Non-Conformance Report (NCR) and may require rework. Passed jobs advance to Unrack.' },
      { title: 'Quoted vs Actual comparison', description: 'On completed jobs, the detail page shows a side-by-side comparison of the quoted rack config vs what was actually used. Differences are highlighted in amber for continuous improvement.' },
      { tip: 'Check the Job Queue (/job-queue) for a priority-sorted view of all active jobs. This is the best way to see what needs attention right now.' },
      { proTip: 'For Apex Glazing: the compliance standards (AAMA 2604) appear as badges on the job card. The material requirements section tracks whether enough paint and sublimation film are confirmed before scheduling.' },
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling & Board View',
    role: ['operator', 'manager', 'admin'],
    time: '4 min',
    icon: <CalendarDays size={18} />,
    color: 'bg-cyan-100 text-cyan-700',
    summary: 'Using the kanban board, calendar, and batching to schedule production.',
    scenario: 'John\'s job needs to be scheduled into this week\'s production run. Use the scheduling board to slot it in.',
    steps: [
      { title: 'Board view (Kanban)', description: 'The default view shows jobs as cards in production columns: Incoming, Pre-Treat, Coating, Curing, QC/Unrack, and Dispatch. Each card shows job number, customer, priority, and due date.' },
      { title: 'Drag to advance', description: 'Grab a job card by the grip handle and drag it to the next column. The job status updates instantly and the change is logged in the audit trail.' },
      { title: 'Calendar view', description: 'Switch to Calendar view to see jobs plotted by their due date. Drag a job pill to a different day to reschedule it. This changes the due date automatically.' },
      { title: 'Schedule a batch', description: 'Click "Schedule Batch" to group multiple jobs into one production run. Batching is efficient because you can coat several jobs in the same color in one oven load.' },
      { title: 'Floor Display', description: 'Click "Floor Display" to open a large-screen production board in a new tab. Put this on a TV on the shop floor so all operators can see the current job lineup.' },
      { tip: 'On-hold jobs appear in a separate strip below the kanban columns. Drag them back into the main flow when they are ready to resume.' },
      { proTip: 'For Apex Glazing: batch all 200 extrusions into the same production run. The batch system lets you assign the entire group to one oven cycle, which is more efficient than individual jobs.' },
    ],
  },

  // ── OPERATIONS ──────────────────────────────────────────────────────────
  {
    id: 'inventory',
    title: 'Inventory Management',
    role: ['operator', 'manager', 'admin'],
    time: '3 min',
    icon: <Package size={18} />,
    color: 'bg-amber-100 text-amber-700',
    summary: 'Tracking powder stock, chemicals, consumables, and lot traceability.',
    scenario: 'Before coating John\'s railings, we need to confirm we have enough RAL 9005 powder in stock. Inventory tracks this automatically.',
    steps: [
      { title: 'Inventory overview', description: 'The Inventory module shows all stock items: powder coats, chemicals, consumables. Each row shows the item name, current quantity on hand, allocated quantity (committed to jobs), reorder point, and stock status.' },
      { title: 'Stock status indicators', description: 'Green (OK) = plenty of stock. Amber (Low) = at or below reorder point, order soon. Red (Out) = zero available, production will be blocked. The Alert Center auto-tracks these.' },
      { title: 'Record a transaction', description: 'Click any inventory item to open it. Add a transaction: Receive (stock arriving from supplier), Issue (stock going to a production job), or Adjust (correction for count discrepancies).' },
      { title: 'Lot tracking', description: 'Each powder lot has a lot number and manufacture date. When you receive stock, enter the lot number. This creates a chain of custody: lot -> job -> QC inspection -> CoC.' },
      { title: 'Reorder points', description: 'Set the reorder point for each item. When stock falls to this level, an alert fires. Set it high enough that you have time to order before running out (account for supplier lead time).' },
      { tip: 'All quantities are metric: kg for powder, litres for chemicals. Match reorder quantities to your supplier\'s standard order sizes to minimize waste.' },
      { proTip: 'For Apex Glazing: the lot number on the fluoropolymer powder will appear on the Certificate of Conformance. Always record it at receiving. If a quality issue arises later, the lot number traces back to the exact supplier batch.' },
    ],
  },
  {
    id: 'quality',
    title: 'Quality Control & Compliance',
    role: ['operator', 'manager', 'admin'],
    time: '5 min',
    icon: <ShieldCheck size={18} />,
    color: 'bg-orange-100 text-orange-700',
    summary: 'QC inspections, NCRs, cure logs, bath logs, certificates, and compliance standards.',
    scenario: 'John\'s railing job is coated and cured. Now the QC inspector checks film thickness and visual quality before it can ship.',
    steps: [
      { title: 'QC Inspections tab', description: 'When a job reaches QC stage, it appears here. Open the inspection form: record film thickness (DFT) readings at multiple points on each part, run visual inspection, and perform adhesion testing if required.' },
      { title: 'Film thickness (DFT) readings', description: 'Use a coating thickness gauge to measure DFT at multiple points on each part. Enter readings in micrometers (um). The system checks if readings meet the compliance standard minimum.' },
      { title: 'Pass or Fail', description: 'If all readings and visual checks pass, mark the inspection as "Pass". The job advances to Unrack. If any check fails, mark "Fail" and an NCR is automatically created.' },
      { title: 'NCR (Non-Conformance Report)', description: 'NCRs record: what failed, defect type, root cause analysis, and corrective action. NCRs are tracked over time to identify recurring issues.' },
      { title: 'Cure Logs tab', description: 'For each oven run, record: Peak Metal Temperature (PMT), time at temperature, and whether it meets the cure window for the powder product. This proves proper cure for compliance.' },
      { title: 'Bath Logs tab', description: 'Pre-treatment baths (wash, phosphate, rinse) need daily monitoring: pH, conductivity, and concentration. The system warns if conductivity exceeds 30 uS/cm on rinse baths (ISO requirement).' },
      { title: 'Certificates tab', description: 'Generate a Certificate of Conformance (CoC) for any completed job. The CoC includes job details, powder lot, DFT readings, compliance standard met, and inspector sign-off.' },
      { tip: 'Record QC results immediately after inspection while details are fresh. Delayed data entry leads to inaccurate records.' },
      { proTip: 'For Apex Glazing: AAMA 2604 requires minimum 30um DFT, documented cure logs, and a formal CoC. All three must be completed before shipping. The Certificates tab auto-generates the CoC from inspection data.' },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping & Dispatch',
    role: ['operator', 'manager', 'admin'],
    time: '3 min',
    icon: <Truck size={18} />,
    color: 'bg-teal-100 text-teal-700',
    summary: 'Creating shipments, recording carriers and tracking, and dispatching finished jobs.',
    scenario: 'John\'s railings passed QC. Now we pack them and create a shipment record so he knows they are coming.',
    steps: [
      { title: 'Create a shipment', description: 'Go to Shipping, click "New Shipment". Select the jobs to include (John\'s railing job), enter the carrier name, tracking number, total weight, and number of packages.' },
      { title: 'Job status update', description: 'Creating a shipment automatically advances the included jobs to "Shipping" status. When the delivery is confirmed, the jobs move to "Complete".' },
      { title: 'Delivery tracking', description: 'The tracking number is stored on the shipment record. If the customer calls asking about their order, anyone in the office can look up the tracking info instantly.' },
      { tip: 'Always weigh outbound shipments and record the actual weight. This is needed for billing freight charges and comparing against quoted weights for margin accuracy.' },
      { proTip: 'For Apex Glazing: include the CoC document in the shipment package. Use the Logistics module to plan the delivery route if using your own truck. International shipments require a commercial invoice with HS codes.' },
    ],
  },
  {
    id: 'receiving',
    title: 'Receiving (Materials & Supplies)',
    role: ['operator', 'manager', 'admin'],
    time: '2 min',
    icon: <Warehouse size={18} />,
    color: 'bg-emerald-100 text-emerald-700',
    summary: 'Logging incoming powder, chemicals, and consumables to update inventory.',
    scenario: 'A shipment of RAL 9005 powder arrived from the supplier. Log it in Receiving to update inventory quantities.',
    steps: [
      { title: 'Open Receiving', description: 'Navigate to Operations > Receiving. This module handles incoming materials and supplies (not customer parts — those go through the Receiving Kiosk).' },
      { title: 'Log the receipt', description: 'Enter the supplier, item received, quantity, lot number (for powder), and any notes. This creates an inventory transaction that increases the on-hand quantity.' },
      { title: 'Verify against PO', description: 'If a purchase order exists for this delivery, match the receipt against the PO. The PO status updates to "Partially Received" or "Received" based on the quantities.' },
      { tip: 'Always record the lot number for powder coats. This enables full traceability from supplier batch through production to the customer\'s CoC.' },
    ],
  },

  // ── EQUIPMENT & MAINTENANCE ─────────────────────────────────────────────
  {
    id: 'equipment',
    title: 'Equipment & Asset Registry',
    role: ['manager', 'admin'],
    time: '4 min',
    icon: <Wrench size={18} />,
    color: 'bg-stone-100 text-stone-700',
    summary: 'Managing equipment records, spare parts, and asset lifecycle. The foundation for your maintenance program.',
    scenario: 'The powder booth, oven, conveyor, and all equipment need to be tracked. Equipment records are the basis for maintenance scheduling.',
    steps: [
      { title: 'Equipment cards', description: 'Each piece of equipment has a card showing: name, type, model, serial number, status (Operational / Under Maintenance / Retired), location, and runtime hours.' },
      { title: 'Add new equipment', description: 'Managers can click "Add Equipment" to create a new record. Fill in all identifying information: manufacturer, model, serial number, capacity, and location on the plant floor.' },
      { title: 'Equipment status', description: 'Operational (green) = running normally. Under Maintenance (amber) = currently being serviced. Retired (red, admin only) = decommissioned. Only admins can archive/retire equipment.' },
      { title: 'Spare parts', description: 'Each equipment record links to its spare parts. You can see part number, manufacturer, criticality level, quantity on hand, and reorder point. Managers can add/edit parts; only admins can delete.' },
      { title: 'Archive and restore', description: 'Admins can archive retired equipment. Archived items are hidden by default but can be revealed with the "Show Retired" toggle for historical reference.' },
      { tip: 'Keep serial numbers accurate — they are needed for warranty claims and service calls with manufacturers like GEMA.' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance & Work Orders (CMMS)',
    role: ['operator', 'manager', 'admin'],
    time: '6 min',
    icon: <Wrench size={18} />,
    color: 'bg-orange-100 text-orange-700',
    summary: 'The full maintenance management system: dashboard, work orders, PM schedules, labor tracking, parts consumption, and analytics.',
    scenario: 'Keeping the coating line running requires proactive maintenance. This module tracks everything from daily checks to annual overhauls.',
    steps: [
      { title: 'Dashboard tab', description: 'Shows KPIs: overdue work orders, in-progress count, scheduled this week, monthly cost, mean time to repair (MTTR), and PM compliance rate. The alert strip highlights overdue items.' },
      { title: 'Work Orders tab', description: 'All maintenance work orders in a filterable table. Each WO has: task number, equipment, type (preventive/corrective/emergency), priority, status, assigned technician, and cost tracking.' },
      { title: 'Create a work order', description: 'Click "New Work Order". Select the equipment, type, priority, title, description, and assign a technician. Link it to a work instruction if one exists for this task.' },
      { title: 'WO lifecycle', description: 'Open -> In Progress -> Complete (or Cancelled). When an operator starts work, they click "Start" and the timer begins. When finished, click "Complete" and add completion notes.' },
      { title: 'Labor tracking', description: 'Inside a WO, add labor entries: technician name, date, hours worked, hourly rate. The system calculates total labor cost automatically.' },
      { title: 'Parts consumption', description: 'Add parts used from the spare parts inventory. Select from the parts picker, confirm usage on completion. Inventory is automatically decremented.' },
      { title: 'PM Schedule tab', description: 'Shows all preventive maintenance schedules. Each schedule has an interval (days or runtime hours), last service date, next due date, and status (OK / Due Soon / Overdue).' },
      { title: 'Analytics tab', description: 'Cost by equipment, monthly trends, technician utilization, and PM compliance per equipment. Click equipment names to jump to their work orders.' },
      { tip: 'Generate work orders from the PM Schedule tab when items are due. This ensures nothing gets missed and creates an audit trail of all maintenance performed.' },
    ],
  },
  {
    id: 'work-instructions',
    title: 'Work Instructions',
    role: ['operator', 'manager', 'admin'],
    time: '3 min',
    icon: <FileText size={18} />,
    color: 'bg-indigo-100 text-indigo-700',
    summary: 'ISO 9001-compliant work instructions for every equipment procedure. Step-by-step guides with document control.',
    scenario: 'When an operator needs to perform the daily gun inspection or a technician needs to replace pinch valves, work instructions provide the step-by-step procedure.',
    steps: [
      { title: 'Browse work instructions', description: 'The Work Instructions page lists all procedures grouped by equipment. Each shows a document number (e.g., WI-CM40-001), title, equipment, and revision.' },
      { title: 'View a work instruction', description: 'Click any WI to see the full procedure: ISO 9001 document header (doc number, revision, effective date, responsible role, issuer), and numbered steps with descriptions.' },
      { title: 'Document control fields', description: 'Every WI has ISO 9001 Section 7.5 fields: document number, purpose, scope, referenced standards/documents, responsible role, effective date, and issued by. These ensure traceability and compliance.' },
      { title: 'Link to maintenance WOs', description: 'Work instructions can be linked to maintenance work orders and PM schedules. When a technician opens a WO, they can click the WI link to see the exact procedure.' },
      { tip: 'Work instructions are "living documents" — update them whenever a procedure changes. The effective date and revision number track the history.' },
    ],
  },

  // ── INSIGHTS ────────────────────────────────────────────────────────────
  {
    id: 'alerts',
    title: 'Alert Center',
    role: ['all'],
    time: '2 min',
    icon: <Bell size={18} />,
    color: 'bg-red-100 text-red-700',
    summary: 'Smart alerts generated from live ERP data. Your daily health check for the entire operation.',
    scenario: 'Every morning, check the Alert Center for anything that needs immediate attention. It watches everything so you do not have to.',
    steps: [
      { title: 'Alert categories', description: 'Alerts are grouped into 6 categories: Production (overdue/rush jobs), Sales (expiring quotes, stale CRM opportunities), Quality (jobs stuck in QC), Maintenance (overdue PM, low spare parts), Inventory (low/out of stock), and Finance (overdue invoices, high AR).' },
      { title: 'Severity levels', description: 'Critical (red) = needs immediate attention today. Warning (amber) = action needed this week. Info (blue) = awareness, no urgency.' },
      { title: 'Dismiss and restore', description: 'Click X on any alert to dismiss it. Dismissed alerts are not deleted — click "Restore dismissed" to bring them back. This prevents alert fatigue while keeping the audit trail.' },
      { title: 'Bell badge in header', description: 'The bell icon shows a count of critical alerts. Click it for a quick dropdown. Navigate to the full Alert Center for the complete view.' },
      { tip: 'Review the Alert Center first thing every morning. Address all Critical items before starting normal work. This prevents small problems from becoming expensive ones.' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    role: ['manager', 'admin'],
    time: '3 min',
    icon: <BarChart3 size={18} />,
    color: 'bg-violet-100 text-violet-700',
    summary: 'Revenue, throughput, margin, quality, and customer profitability reports.',
    scenario: 'After completing John\'s job, review the reports to see how it affected revenue, margin, and throughput metrics.',
    steps: [
      { title: 'Report types', description: 'Available reports: Revenue by Period, Job Throughput (parts/week), Margin Analysis (quoted vs actual), Customer Profitability (revenue/cost per customer), and QC Pass Rates (by operator, line, or powder).' },
      { title: 'Date filtering', description: 'Use the date range pickers to filter any report to a specific period. Compare this month vs last month, or this quarter vs last year.' },
      { title: 'Margin analysis', description: 'Shows quoted margin vs actual margin for each job. If actual margins consistently fall below quoted, investigate: are material costs higher than estimated? Is labor taking longer? This drives pricing accuracy.' },
      { tip: 'Export any table to CSV by clicking the export button. Import into Excel or Google Sheets for further analysis or sharing with your accountant.' },
    ],
  },
  {
    id: 'costing',
    title: 'Costing & Margin Analysis',
    role: ['manager', 'admin'],
    time: '3 min',
    icon: <DollarSign size={18} />,
    color: 'bg-emerald-100 text-emerald-700',
    summary: 'Breaking down job costs: labor, materials, overhead. Understanding your true margins.',
    scenario: 'John\'s railing job is complete. The Costing module shows exactly what it cost to produce and whether you made money.',
    steps: [
      { title: 'Job cost breakdown', description: 'Open any completed job in the Costing module to see: material costs (powder, chemicals), labor costs (operator hours * rate), overhead allocation, and total cost.' },
      { title: 'Quoted vs actual margin', description: 'Compare the price you quoted to the customer against the actual cost of production. The system highlights jobs where margin fell below your target.' },
      { title: 'Cost trends', description: 'View cost trends over time by material, by customer, or by service type. This helps identify where costs are rising and where you can improve efficiency.' },
      { tip: 'Review costing data monthly with your management team. If margins are shrinking on a particular service type, adjust pricing or investigate production inefficiencies.' },
    ],
  },
  {
    id: 'eos',
    title: 'EOS Dashboard',
    role: ['manager', 'admin'],
    time: '5 min',
    icon: <Target size={18} />,
    color: 'bg-rose-100 text-rose-700',
    summary: 'Running your business on the Entrepreneurial Operating System: Rocks, Scorecard, Issues, and L10 meetings.',
    scenario: 'EOS is a business management framework. Use these tools to set quarterly goals, track weekly metrics, and run structured leadership meetings.',
    steps: [
      { title: 'Rocks (Quarterly Goals)', description: 'Rocks are your 3-5 most important priorities for this quarter. Add them with an owner, due date, and progress tracker (0-100%). Review weekly in your L10 meeting.' },
      { title: 'Scorecard (Weekly Measurables)', description: 'Define weekly KPIs (e.g., "Jobs completed this week: goal = 40"). Enter actuals each week. Green = on track, Red = off track. This creates accountability.' },
      { title: 'Issues (IDS)', description: 'Issues are problems or opportunities to Identify, Discuss, and Solve. Add them as they arise during the week. Discuss and resolve them in your weekly L10 meeting.' },
      { title: 'L10 Meeting', description: 'The L10 tab runs your weekly 90-minute leadership meeting with a built-in agenda timer. Segue (good news), Scorecard review, Rock review, To-Do review, IDS (Issues), and Conclude.' },
      { tip: 'EOS works best when the entire leadership team commits to the weekly L10 rhythm. Consistency is more important than perfection.' },
    ],
  },

  // ── LOGISTICS & HR ──────────────────────────────────────────────────────
  {
    id: 'logistics',
    title: 'Logistics & Delivery Planning',
    role: ['operator', 'manager', 'admin'],
    time: '3 min',
    icon: <MapPin size={18} />,
    color: 'bg-sky-100 text-sky-700',
    summary: 'Planning delivery routes, driver run sheets, and coordinating customer pickups and deliveries.',
    scenario: 'John wants his railings delivered. Use Logistics to plan the route and create a driver run sheet.',
    steps: [
      { title: 'Route planning', description: 'The Logistics module lets you plan delivery routes by grouping shipments going to the same area. This minimizes driving time and fuel costs.' },
      { title: 'Driver run sheets', description: 'Generate a run sheet for each driver: list of stops, customer names, contact numbers, addresses, and items to deliver. Print or display on a tablet.' },
      { title: 'Pickup scheduling', description: 'For customers dropping off parts, schedule pickup appointments so the receiving dock is not overwhelmed. Coordinate with the receiving kiosk workflow.' },
      { tip: 'Group deliveries by geographic area and schedule them for the same day. One well-planned route is cheaper than multiple individual trips.' },
    ],
  },
  {
    id: 'hr',
    title: 'HR & Time Tracking',
    role: ['manager', 'admin'],
    time: '3 min',
    icon: <Users size={18} />,
    color: 'bg-pink-100 text-pink-700',
    summary: 'Employee records, time tracking, and the HR kiosk for shop floor clock-in/out.',
    scenario: 'Your operators clock in at the HR kiosk. Their hours feed into job costing so you know the true labor cost per job.',
    steps: [
      { title: 'Employee directory', description: 'The HR module shows all employees with their role, department, hire date, and status. Click any employee to see their full profile and time history.' },
      { title: 'Time tracking', description: 'Employees log their hours either through the HR kiosk (shop floor) or manually in the HR module. Hours are associated with their role for labor cost calculations.' },
      { title: 'HR Kiosk', description: 'The HR Kiosk (/hr-kiosk) is a full-screen interface for the shop floor. Operators clock in at the start of shift and out at the end. Breaks and overtime are tracked.' },
      { tip: 'Accurate time tracking is essential for job costing. If operators are not clocking in, your margin calculations will be inaccurate.' },
    ],
  },

  // ── KIOSKS ──────────────────────────────────────────────────────────────
  {
    id: 'scan',
    title: 'Scan Station & Workstation Terminal',
    role: ['operator'],
    time: '3 min',
    icon: <Monitor size={18} />,
    color: 'bg-gray-100 text-gray-700',
    summary: 'Full-screen kiosk interfaces for the shop floor: barcode scanning, job status updates, and operator task views.',
    scenario: 'As John\'s railings move through the production line, operators scan them at each station to update their status.',
    steps: [
      { title: 'Scan Station', description: 'Open from Kiosks > Scan Station. A full-screen interface for scanning job barcodes or QR codes. Scan a code and the job details appear. Log an event: Start, Complete, Move, Hold, or QC Pass/Fail.' },
      { title: 'Workstation Terminal', description: 'The Workstation Terminal (/workstation) shows an operator\'s assigned jobs for the day. They can see priorities, due dates, and instructions without leaving the station.' },
      { title: 'Production Board', description: 'The Production Board is a large-screen display for a shop floor TV. It shows all active jobs in real-time with color-coded status. Great for team visibility.' },
      { title: 'Line Production Boards', description: 'Dedicated boards for each production line (Vertical, Horizontal, Batch, Extrusion, Panel). Each shows only the jobs assigned to that line.' },
      { tip: 'Keep the Scan Station open on a dedicated tablet at each workstation. One scan per station keeps job tracking accurate without slowing down operators.' },
    ],
  },

  // ── CUSTOMER PORTAL ─────────────────────────────────────────────────────
  {
    id: 'customer-portal',
    title: 'Customer Portal',
    role: ['sales', 'manager', 'admin'],
    time: '3 min',
    icon: <Globe size={18} />,
    color: 'bg-indigo-100 text-indigo-700',
    summary: 'The customer-facing portal where your clients can track their orders, request quotes, and request samples.',
    scenario: 'John can log into the customer portal to check the status of his railing job without calling your office.',
    steps: [
      { title: 'Portal login', description: 'Customers access the portal at /portal/login. They log in with their email and a unique access code. No ERP access is granted — they only see their own data.' },
      { title: 'Order tracking (Dashboard)', description: 'The portal dashboard shows the customer\'s active jobs with current status, expected completion date, and progress indicator. They can see where their parts are in the process.' },
      { title: 'Order history', description: 'The Orders tab shows all past and current orders. Click any order to see full details: parts, powder color, quantities, dates, and status history.' },
      { title: 'Quote requests', description: 'Customers can submit new quote requests through the portal. These appear in your CRM/Quotes module for follow-up.' },
      { title: 'Sample requests', description: 'The portal includes a sample request form for customers who want to see a powder color or finish before committing to a full order.' },
      { tip: 'Encourage customers to use the portal for status checks. It saves your office staff time on phone calls and gives customers 24/7 visibility.' },
    ],
  },

  // ── ADMIN ───────────────────────────────────────────────────────────────
  {
    id: 'admin',
    title: 'Admin Console',
    role: ['admin'],
    time: '5 min',
    icon: <Shield size={18} />,
    color: 'bg-red-100 text-red-700',
    summary: 'User management, audit log, roles/hierarchy, backups, security settings, QuickBooks integration, and system configuration.',
    scenario: 'The Admin Console is where system administrators manage users, review audit logs, configure security, and maintain the system.',
    steps: [
      { title: 'Users tab', description: 'View all system users with role, department, last login, and active status. Add new users with the "Add User" button. Edit any user to change their role, department, or active status. Only admins can manage users.' },
      { title: 'Audit Log tab', description: 'Every action is logged: creates, updates, deletes, logins, logouts. Filter by action type or search by user name. For update actions, click "Revert" to undo a specific change. The revert is also logged.' },
      { title: 'Roles & Hierarchy tab', description: 'Shows the RBAC pyramid: Admin > Manager > Supervisor > Operator > Viewer/Sales. Each role has specific permissions. The privilege matrix shows exactly what each role can access.' },
      { title: 'Backups tab', description: 'Download a full backup of your ERP data (JSON file). Enable auto-backups on a schedule (hourly/6h/daily). View backup history. Restore from a backup file if needed.' },
      { title: 'Security tab', description: 'Security health score (5 checks), session timeout configuration, active sessions panel, login history. Emergency lockdown deactivates all non-admin users instantly.' },
      { title: 'QuickBooks tab', description: 'Configure QuickBooks integration: tax registration numbers, Canadian tax code matrix, chart of accounts mapping, CSV import wizard for customers/vendors/products/invoices.' },
      { title: 'System tab', description: 'Demo/Live mode toggle, system information, and developer tools. Demo mode disables Supabase sync so you can experiment without affecting real data.' },
      { tip: 'Review the audit log weekly. Check for unexpected changes, unauthorized access attempts, or patterns that suggest training needs.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Preferences',
    role: ['all'],
    time: '1 min',
    icon: <Settings size={18} />,
    color: 'bg-gray-100 text-gray-700',
    summary: 'Personal settings and preferences for your ERP experience.',
    steps: [
      { title: 'User profile', description: 'View and update your display name, email, and contact information. Your role and permissions are managed by an admin.' },
      { title: 'Notification preferences', description: 'Configure which alerts you want to see in the bell dropdown and which categories are most important to your role.' },
      { tip: 'If you are unsure about your role or permissions, check with your admin or view the Hierarchy tab in the Admin Console.' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ROLE_FILTERS = [
  { id: 'all', label: 'All Roles' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'sales', label: 'Sales' },
  { id: 'operator', label: 'Operator' },
];

export function HelpCenter() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showGettingStarted, setShowGettingStarted] = useState(true);

  const filtered = TUTORIALS.filter(t => {
    if (roleFilter !== 'all' && !t.role.includes('all') && !t.role.includes(roleFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) ||
        (t.scenario ?? '').toLowerCase().includes(q) ||
        t.steps.some(s => (s.title ?? '').toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q) || (s.proTip ?? '').toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-brand-gradient text-white rounded-xl px-5 py-4 shadow-brand">
        <div className="flex items-center gap-3">
          <BookOpen size={22} />
          <div>
            <div className="font-bold tracking-tight">Help Center & Training Guide</div>
            <div className="text-white/60 text-xs mt-0.5">Step-by-step tutorials for every module. Follow the sample job walkthrough to learn the complete workflow.</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-extrabold">{TUTORIALS.length}</div>
            <div className="text-white/60 text-xs">tutorials</div>
          </div>
        </div>
      </div>

      {/* ── Getting Started: Sample Job Walkthrough ─────────────────────────── */}
      <div className="border-2 border-brand-200 rounded-xl bg-brand-50/30 overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-brand-50 transition-colors text-left"
          onClick={() => setShowGettingStarted(!showGettingStarted)}
        >
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 text-lg">
            &#x1F3ED;
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900 text-sm">Getting Started: Follow a Job from Start to Finish</div>
            <p className="text-xs text-gray-500 mt-0.5">
              Follow John Smith's railing job through every module to learn how the ERP works end-to-end. Each step links to the detailed tutorial.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-semibold text-brand-600 bg-brand-100 px-2 py-1 rounded-full">11 chapters</span>
            {showGettingStarted ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          </div>
        </button>

        {showGettingStarted && (
          <div className="px-5 pb-5 border-t border-brand-200">
            {/* Scenario intro */}
            <div className="mt-4 mb-4 p-3 rounded-xl bg-white border border-gray-200 shadow-sm">
              <div className="text-xs font-bold text-gray-700 mb-1">The Sample Job</div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Customer:</strong> John Smith (homeowner) &mdash; <strong>Parts:</strong> 12 aluminum railing sections (6063-T5) &mdash;
                <strong> Service:</strong> Powder coat RAL 9005 Matte Black &mdash; <strong>Terms:</strong> Net 15, Normal priority
              </p>
              <p className="text-[11px] text-gray-400 mt-1 italic">
                Each chapter also shows a "Pro Tip" for how a commercial job (Apex Glazing, 200 curtain wall extrusions, AAMA 2604) would differ.
              </p>
            </div>

            {/* Chapter cards */}
            <div className="space-y-2">
              {CHAPTERS.map((ch) => (
                <div key={ch.step} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* Step number */}
                    <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {ch.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900">{ch.title}</span>
                        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">{ch.module}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{ch.description}</p>
                      {/* Pro tip */}
                      <div className="flex gap-2 mt-2 p-2 rounded-lg bg-purple-50 border border-purple-200">
                        <span className="text-[10px] font-bold text-purple-600 flex-shrink-0 mt-0.5">PRO</span>
                        <p className="text-[11px] text-purple-800 leading-relaxed">{ch.proTip}</p>
                      </div>
                    </div>
                    {/* Link to tutorial */}
                    <button
                      onClick={() => { setExpanded(ch.tutorialId); setShowGettingStarted(false); }}
                      className="flex-shrink-0 mt-1 text-brand-500 hover:text-brand-700 transition-colors"
                      title="Open tutorial"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick-start cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Sales Team', desc: 'Quotes, CRM, Invoicing', filter: 'sales', color: 'border-purple-200 bg-purple-50', icon: <TrendingUp size={20} className="text-purple-600" /> },
          { label: 'Operators', desc: 'Jobs, Scanning, QC', filter: 'operator', color: 'border-brand-200 bg-brand-50', icon: <Briefcase size={20} className="text-brand-600" /> },
          { label: 'Managers', desc: 'Reports, EOS, Maintenance', filter: 'manager', color: 'border-accent-200 bg-accent-50', icon: <BarChart3 size={20} className="text-accent-600" /> },
          { label: 'Admins', desc: 'Users, Security, Backups', filter: 'admin', color: 'border-red-200 bg-red-50', icon: <Shield size={20} className="text-red-600" /> },
        ].map(c => (
          <button
            key={c.filter}
            onClick={() => setRoleFilter(c.filter)}
            className={clsx('text-left p-3 rounded-xl border-2 transition-all hover:shadow-md', c.color, roleFilter === c.filter && 'ring-2 ring-brand-400')}
          >
            <div className="mb-1">{c.icon}</div>
            <div className="text-sm font-bold text-gray-800">{c.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
          </button>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
            placeholder="Search tutorials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                roleFilter === f.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tutorial list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No tutorials match your search.</p>
          </div>
        )}
        {filtered.map(tutorial => (
          <div key={tutorial.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
            {/* Tutorial header */}
            <button
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpanded(expanded === tutorial.id ? null : tutorial.id)}
            >
              <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', tutorial.color)}>
                {tutorial.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{tutorial.title}</span>
                  <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-0.5">
                    <Play size={9} fill="currentColor" /> {tutorial.time}
                  </span>
                  {tutorial.role.filter(r => r !== 'all').map(r => (
                    <span key={r} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">
                      {r}
                    </span>
                  ))}
                  {tutorial.role.includes('all') && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 uppercase tracking-wide">
                      All roles
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{tutorial.summary}</p>
              </div>
              {expanded === tutorial.id ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
            </button>

            {/* Steps */}
            {expanded === tutorial.id && (
              <div className="px-5 pb-5 border-t border-gray-100">
                {/* Scenario context */}
                {tutorial.scenario && (
                  <div className="mt-3 mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <Briefcase size={9} className="text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Sample Job Context</span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">{tutorial.scenario}</p>
                  </div>
                )}
                <div className="mt-3 space-y-3">
                  {tutorial.steps.map((step, i) => (
                    <React.Fragment key={i}>
                      {step.tip ? (
                        <div className="flex gap-3 p-3 rounded-xl bg-accent-50 border border-accent-200">
                          <span className="text-accent-600 font-bold text-sm flex-shrink-0">&#x1F4A1;</span>
                          <p className="text-xs text-accent-800">{step.tip}</p>
                        </div>
                      ) : step.proTip ? (
                        <div className="flex gap-3 p-3 rounded-xl bg-purple-50 border border-purple-200">
                          <span className="text-[10px] font-bold text-purple-600 flex-shrink-0 mt-0.5">PRO</span>
                          <div>
                            <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-0.5">Commercial Job Difference</div>
                            <p className="text-xs text-purple-800 leading-relaxed">{step.proTip}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4">
                          <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-800 mb-0.5">{step.title}</div>
                            <div className="text-xs text-gray-600 leading-relaxed">{step.description}</div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
