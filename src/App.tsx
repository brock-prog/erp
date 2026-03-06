import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { CustomerPortalProvider } from './context/CustomerPortalContext';

// Staff ERP imports
import { Layout } from './components/layout/Layout';
import { LoginPage } from './components/auth/LoginPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { Customers, CustomerDetail } from './components/customers/Customers';
import { Quotes } from './components/quotes/Quotes';
import { Jobs, JobDetail } from './components/jobs/Jobs';
import { Scheduling } from './components/scheduling/Scheduling';
import { Inventory } from './components/inventory/Inventory';
import { Quality } from './components/quality/Quality';
import { Invoicing } from './components/invoicing/Invoicing';
import { Reports } from './components/reports/Reports';
import { Equipment } from './components/equipment/Equipment';
import { Settings } from './components/settings/Settings';
import { Maintenance } from './components/maintenance/Maintenance';
import { Shipping } from './components/shipping/Shipping';
import { Receiving } from './components/receiving/Receiving';
import { HR } from './components/hr/HR';
import { PricingTool } from './components/pricing/PricingTool';
import { ScanStation } from './components/scan/ScanStation';
import { JobQueue } from './components/jobqueue/JobQueue';
import { CRM } from './components/crm/CRM';
import { Logistics } from './components/logistics/Logistics';
import { Costing } from './components/costing/Costing';
import { EOS } from './components/eos/EOS';
import { AlertCenter } from './components/alerts/AlertCenter';
import { AdminConsole } from './components/admin/AdminConsole';
import { HelpCenter } from './components/help/HelpCenter';
import { ProductionBoard } from './components/production/ProductionBoard';
import { LineProductionBoard } from './components/production/LineProductionBoard';
import { WorkstationTerminal } from './components/workstation/WorkstationTerminal';
import { HRKiosk } from './components/hr/HRKiosk';
import { WorkInstructions } from './components/work-instructions/WorkInstructionViewer';
import { ReceivingKiosk } from './components/workstations/ReceivingKiosk';
import { InspectionKiosk } from './components/workstations/InspectionKiosk';
import { PendingJobQueue } from './components/jobs/PendingJobQueue';
import { Procurement } from './components/procurement/Procurement';

// Customer Portal imports
import { CustomerPortalLogin } from './components/portal/CustomerPortalLogin';
import { CustomerPortalLayout } from './components/portal/CustomerPortalLayout';
import { CustomerPortalDashboard } from './components/portal/CustomerPortalDashboard';
import { CustomerPortalOrders, CustomerPortalOrderDetail } from './components/portal/CustomerPortalOrders';
import { CustomerPortalQuoteRequest } from './components/portal/CustomerPortalQuoteRequest';
import { CustomerPortalSampleRequest } from './components/portal/CustomerPortalSampleRequest';
import { CustomerPortalContact } from './components/portal/CustomerPortalContact';

// ─── App Routes ───────────────────────────────────────────────────────────────
// The BrowserRouter lives at App level so portal routes work regardless of
// staff login state. Customer portal routes (/portal/*) are fully independent.
// Staff routes require state.loggedIn from AppContext.

function DemoBanner() {
  const { state } = useApp();
  if (!state.demoMode) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-amber-500 text-white text-center text-xs font-bold py-1.5 tracking-wide shadow-sm select-none">
      DEMO MODE — changes are local only and not synced to production
    </div>
  );
}

function AppRoutes() {
  const { state } = useApp();

  return (
    <>
    <DemoBanner />
    <Routes>

      {/* ── Customer Portal — no staff auth required ────────────────────── */}
      <Route path="/portal/login" element={<CustomerPortalLogin />} />
      <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
      <Route path="/portal/*" element={<CustomerPortalLayout />}>
        <Route path="dashboard"      element={<CustomerPortalDashboard />} />
        <Route path="orders"         element={<CustomerPortalOrders />} />
        <Route path="orders/:id"     element={<CustomerPortalOrderDetail />} />
        <Route path="quote-request"  element={<CustomerPortalQuoteRequest />} />
        <Route path="sample-request" element={<CustomerPortalSampleRequest />} />
        <Route path="contact"        element={<CustomerPortalContact />} />
        <Route index                 element={<Navigate to="dashboard" replace />} />
        <Route path="*"              element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* ── Staff ERP — require staff login ────────────────────────────── */}
      {!state.loggedIn ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <>
          {/* Full-screen kiosks (no sidebar) */}
          <Route path="scan"               element={<ScanStation />} />
          <Route path="production-board"   element={<ProductionBoard />} />
          <Route path="workstation"        element={<WorkstationTerminal />} />
          <Route path="hr-kiosk"           element={<HRKiosk />} />
          <Route path="receiving-kiosk"    element={<ReceivingKiosk />} />
          <Route path="inspection-kiosk"   element={<InspectionKiosk />} />

          {/* Line-specific production boards (TV kiosks) */}
          <Route path="vertical-board"   element={<LineProductionBoard boardId="vertical" />} />
          <Route path="horizontal-board" element={<LineProductionBoard boardId="horizontal" />} />
          <Route path="batch-board"      element={<LineProductionBoard boardId="batch" />} />
          <Route path="extrusion-board"  element={<LineProductionBoard boardId="extrusion-sub" />} />
          <Route path="panel-board"      element={<LineProductionBoard boardId="panel-sub" />} />

          {/* Main app with Layout wrapper */}
          <Route element={<Layout />}>
            <Route index                       element={<Dashboard />} />
            <Route path="customers"            element={<Customers />} />
            <Route path="customers/:id"        element={<CustomerDetail />} />
            <Route path="quotes"               element={<Quotes />} />
            <Route path="pricing"              element={<PricingTool />} />
            <Route path="jobs"                 element={<Jobs />} />
            <Route path="jobs/:id"             element={<JobDetail />} />
            <Route path="pending-jobs"         element={<PendingJobQueue />} />
            <Route path="scheduling"           element={<Scheduling />} />
            <Route path="inventory"            element={<Inventory />} />
            <Route path="quality"              element={<Quality />} />
            <Route path="maintenance"          element={<Maintenance />} />
            <Route path="shipping"             element={<Shipping />} />
            <Route path="receiving"            element={<Receiving />} />
            <Route path="procurement"          element={<Procurement />} />
            <Route path="invoices"             element={<Invoicing />} />
            <Route path="reports"              element={<Reports />} />
            <Route path="equipment"            element={<Equipment />} />
            <Route path="hr"                   element={<HR />} />
            <Route path="job-queue"            element={<JobQueue />} />
            <Route path="crm"                  element={<CRM />} />
            <Route path="logistics"            element={<Logistics />} />
            <Route path="costing"              element={<Costing />} />
            <Route path="eos"                  element={<EOS />} />
            <Route path="alerts"               element={<AlertCenter />} />
            <Route path="work-instructions"    element={<WorkInstructions />} />
            <Route path="admin"                element={<AdminConsole />} />
            <Route path="help"                 element={<HelpCenter />} />
            <Route path="settings"             element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <CustomerPortalProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CustomerPortalProvider>
    </AppProvider>
  );
}
