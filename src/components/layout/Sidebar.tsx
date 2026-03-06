import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Briefcase,
  CalendarDays, Package, ShieldCheck, Receipt,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  Wrench, Truck, PackageOpen, ClipboardList,
  UserCog, Calculator, ScanLine, ListTodo,
  TrendingUp, Route, TrendingDown, Monitor, Tablet,
  Target, Bell, Shield, BookOpen, ShoppingCart,
} from 'lucide-react';
import { clsx } from '../../utils';
import { useApp } from '../../context/AppContext';
import { useSmartAlerts } from '../alerts/AlertCenter';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/crm', icon: TrendingUp, label: 'CRM & Pipeline' },
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/quotes', icon: FileText, label: 'Quotes' },
      { to: '/pricing', icon: Calculator, label: 'Pricing Tool' },
      { to: '/invoices', icon: Receipt, label: 'Invoicing' },
    ],
  },
  {
    label: 'Production',
    items: [
      { to: '/pending-jobs', icon: PackageOpen, label: 'Pending Job Orders' },
      { to: '/jobs', icon: Briefcase, label: 'Jobs / Work Orders' },
      { to: '/job-queue', icon: ListTodo, label: 'Job Order Queue' },
      { to: '/scheduling', icon: CalendarDays, label: 'Scheduling' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/logistics', icon: Route, label: 'Logistics Scheduler' },
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/quality', icon: ShieldCheck, label: 'Quality Control' },
      { to: '/maintenance', icon: ClipboardList, label: 'Maintenance' },
      { to: '/shipping', icon: Truck, label: 'Shipping' },
      { to: '/receiving', icon: PackageOpen, label: 'Receiving' },
      { to: '/procurement', icon: ShoppingCart, label: 'Procurement' },
      { to: '/work-instructions', icon: BookOpen, label: 'Work Instructions' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports',  icon: BarChart3,    label: 'Reports' },
      { to: '/costing',  icon: TrendingDown, label: 'Costing & Analysis' },
      { to: '/alerts',   icon: Bell,         label: 'Alert Center' },
      { to: '/eos',      icon: Target,       label: 'EOS Dashboard' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/equipment', icon: Wrench, label: 'Equipment' },
      { to: '/hr', icon: UserCog, label: 'HR Terminal' },
      { to: '/admin', icon: Shield, label: 'Admin Console' },
      { to: '/help', icon: BookOpen, label: 'Help & Training' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export function Sidebar() {
  const { state, dispatch } = useApp();
  const { sidebarOpen } = state;
  const pendingJobOrders = state.jobOrders.filter(o => o.status === 'pending_review' || o.status === 'materials_check').length;
  const receivedShipments = state.incomingShipments?.filter(s => s.status === 'received').length ?? 0;
  const pendingInspectionJobs = (state.pendingJobOrders?.filter(p => p.status === 'pending_admin').length ?? 0) + receivedShipments;
  const maintenanceAlerts = state.maintenanceSchedules.filter(s => s.status !== 'ok').length;
  const smartAlerts = useSmartAlerts();
  const criticalAlerts = smartAlerts.filter(a => a.severity === 'critical').length;
  const today = new Date().toISOString().slice(0, 10);
  const receivingBadge = (state.receipts ?? []).filter(
    r => r.status === 'expected' && r.expectedDate && r.expectedDate <= today,
  ).length || null;

  return (
    <aside
      className={clsx(
        'flex-shrink-0 flex flex-col transition-all duration-300 h-screen sticky top-0 dark-scroll',
        sidebarOpen ? 'w-60' : 'w-16',
      )}
      style={{ background: 'var(--decora-sidebar-bg)', borderRight: '1px solid var(--decora-sidebar-border)' }}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 px-4 py-5',
        !sidebarOpen && 'justify-center',
        'border-b',
      )}
        style={{ borderColor: 'var(--decora-sidebar-border)' }}
      >
        {/* DECORA avatar mark */}
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-brand-600">
          <img
            src="/brand/DECORA-Avatar-KO-on-PMS534-400px.png"
            alt="DECORA"
            className="w-full h-full object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-tight tracking-wide">DECORA ERP</div>
            <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Job Shop Management
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 dark-scroll" style={{ scrollbarWidth: 'thin' }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-1">
            {sidebarOpen && (
              <div
                className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const badge =
                item.to === '/pending-jobs' && pendingInspectionJobs > 0 ? pendingInspectionJobs
                : item.to === '/job-queue' && pendingJobOrders > 0 ? pendingJobOrders
                : item.to === '/costing' && maintenanceAlerts > 0 ? maintenanceAlerts
                : item.to === '/alerts' && criticalAlerts > 0 ? criticalAlerts
                : item.to === '/receiving' && receivingBadge ? receivingBadge
                : null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'relative flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'text-white'
                        : 'hover:text-white',
                      !sidebarOpen && 'justify-center',
                    )
                  }
                  style={({ isActive }) => isActive
                    ? { background: 'var(--decora-sublimation-green)', color: '#fff' }
                    : { color: 'rgba(255,255,255,0.5)' }
                  }
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    if (!el.classList.contains('active') && !el.getAttribute('aria-current')) {
                      el.style.background = 'rgba(255,255,255,0.06)';
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    if (!el.getAttribute('aria-current')) {
                      el.style.background = '';
                    }
                  }}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                  {badge && (
                    <span className={clsx(
                      'text-[10px] font-bold rounded-full bg-orange-500 text-white leading-none',
                      sidebarOpen ? 'px-1.5 py-0.5' : 'absolute top-1 right-1 w-4 h-4 flex items-center justify-center',
                    )}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 brand-divider opacity-20" />

      {/* Kiosk shortcuts */}
      <div className="px-3 pt-3 pb-1 space-y-1">
        {sidebarOpen && (
          <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Kiosks
          </div>
        )}
        <a
          href="/production-board"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            !sidebarOpen && 'justify-center',
          )}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          title="Open Production Board"
        >
          <Monitor size={17} className="flex-shrink-0" />
          {sidebarOpen && <span>Production Board</span>}
        </a>
        <a
          href="/workstation"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            !sidebarOpen && 'justify-center',
          )}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          title="Open Workstation Terminal"
        >
          <Tablet size={17} className="flex-shrink-0" />
          {sidebarOpen && <span>Workstation</span>}
        </a>
        <a
          href="/hr-kiosk"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            !sidebarOpen && 'justify-center',
          )}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          title="Open HR Employee Kiosk"
        >
          <Users size={17} className="flex-shrink-0" />
          {sidebarOpen && <span>HR Kiosk</span>}
        </a>
        <a
          href="/receiving-kiosk"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            !sidebarOpen && 'justify-center',
          )}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          title="Open Receiving Kiosk"
        >
          <PackageOpen size={17} className="flex-shrink-0" />
          {sidebarOpen && <span>Receiving Kiosk</span>}
        </a>
        <a
          href="/inspection-kiosk"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            !sidebarOpen && 'justify-center',
          )}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          title="Open Incoming Inspection Kiosk"
        >
          <ShieldCheck size={17} className="flex-shrink-0" />
          {sidebarOpen && <span>Inspection Kiosk</span>}
        </a>
      </div>

      {/* Scan Station */}
      <div className="px-3 pb-2 pt-1">
        <a
          href="/scan"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150',
            !sidebarOpen && 'justify-center',
          )}
          style={{ background: 'var(--decora-sublimation-green)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ''; }}
          title="Open Scan Station"
        >
          <ScanLine size={17} className="flex-shrink-0" />
          {sidebarOpen && <span>Scan Station</span>}
        </a>
      </div>

      {/* Toggle */}
      <div className="p-3 flex justify-end" style={{ borderTop: '1px solid var(--decora-sidebar-border)' }}>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
    </aside>
  );
}
