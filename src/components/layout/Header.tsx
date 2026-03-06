import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Search, Plus, LogOut, Settings, Shield,
  HardDrive, BarChart3, ChevronRight, UserCog,
  LayoutDashboard, Users, ClipboardList, FlaskConical,
} from 'lucide-react';
import { clsx } from '../../utils';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { useSmartAlerts } from '../alerts/AlertCenter';

const PAGE_TITLES: Record<string, { title: string; desc: string }> = {
  '/':            { title: 'Dashboard',          desc: 'Overview of your operation' },
  '/customers':   { title: 'Customers',          desc: 'Manage accounts and contacts' },
  '/quotes':      { title: 'Quotes',             desc: 'Estimates and proposals' },
  '/jobs':        { title: 'Jobs / Work Orders', desc: 'Production job tracking' },
  '/scheduling':  { title: 'Scheduling',         desc: 'Oven, press, and batch scheduling' },
  '/inventory':   { title: 'Inventory',          desc: 'Powder, chemicals, and substrates' },
  '/quality':     { title: 'Quality Control',    desc: 'Inspections and defect tracking' },
  '/invoices':    { title: 'Invoicing',          desc: 'Billing and payment management' },
  '/reports':     { title: 'Reports',            desc: 'Analytics and business insights' },
  '/equipment':   { title: 'Equipment',          desc: 'Ovens, presses, and maintenance' },
  '/costing':     { title: 'Costing & Analysis', desc: 'Cost tracking and variance analysis' },
  '/crm':         { title: 'CRM & Pipeline',     desc: 'Leads, pipeline, and accounts' },
  '/logistics':   { title: 'Logistics',          desc: 'Route scheduling and delivery' },
  '/job-queue':   { title: 'Job Order Queue',    desc: 'Incoming orders pending review' },
  '/maintenance': { title: 'Maintenance',        desc: 'Equipment maintenance logs' },
  '/shipping':    { title: 'Shipping',           desc: 'Outbound shipment management' },
  '/receiving':   { title: 'Receiving',          desc: 'Inbound materials and POs' },
  '/hr':          { title: 'HR Terminal',        desc: 'Staff management and timesheets' },
  '/pricing':     { title: 'Pricing Tool',       desc: 'Rate calculator and estimating' },
  '/settings':    { title: 'Settings',           desc: 'System configuration' },
};

const CREATE_ACTIONS: Record<string, { label: string; route: string }> = {
  '/customers':  { label: 'New Customer', route: '/customers?new=1' },
  '/quotes':     { label: 'New Quote',    route: '/quotes?new=1' },
  '/jobs':       { label: 'New Job',      route: '/jobs?new=1' },
  '/inventory':  { label: 'Add Item',     route: '/inventory?new=1' },
  '/invoices':   { label: 'New Invoice',  route: '/invoices?new=1' },
};

const ROLE_BADGE: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  manager:    'bg-brand-100 text-brand-700',
  supervisor: 'bg-blue-100 text-blue-700',
  operator:   'bg-emerald-100 text-emerald-700',
  sales:      'bg-amber-100 text-amber-700',
  viewer:     'bg-gray-100 text-gray-600',
};

/* ── Quick-nav links shown in profile dropdown ──────────────────────────── */
interface QuickLink {
  icon: React.ReactNode;
  label: string;
  desc: string;
  route: string;
  adminOnly?: boolean;
  managerPlus?: boolean;
}

const QUICK_LINKS: QuickLink[] = [
  {
    icon: <LayoutDashboard size={14} />,
    label: 'Dashboard',
    desc: 'Overview & KPIs',
    route: '/',
  },
  {
    icon: <BarChart3 size={14} />,
    label: 'Reports',
    desc: 'Analytics & insights',
    route: '/reports',
  },
  {
    icon: <ClipboardList size={14} />,
    label: 'CRM & Pipeline',
    desc: 'Leads & opportunities',
    route: '/crm',
  },
  {
    icon: <Settings size={14} />,
    label: 'Settings',
    desc: 'System configuration',
    route: '/settings',
  },
  {
    icon: <Users size={14} />,
    label: 'Admin Console',
    desc: 'Users, RBAC & audit',
    route: '/admin',
    managerPlus: true,
  },
  {
    icon: <Shield size={14} />,
    label: 'Security',
    desc: 'Sessions & lockdown',
    route: '/admin?tab=security',
    adminOnly: true,
  },
  {
    icon: <HardDrive size={14} />,
    label: 'Backups',
    desc: 'Download & restore',
    route: '/admin?tab=backups',
    adminOnly: true,
  },
  {
    icon: <FlaskConical size={14} />,
    label: 'Demo / Live Mode',
    desc: 'Toggle environment',
    route: '/admin?tab=system',
    adminOnly: true,
  },
];

export function Header() {
  const { state, dispatch, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const smartAlerts = useSmartAlerts();
  const criticalAlertCount = smartAlerts.filter(a => a.severity === 'critical').length;

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);

  /* Close dropdowns on outside click */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const page = PAGE_TITLES[location.pathname] ?? { title: 'DECORA ERP', desc: '' };
  const createAction = CREATE_ACTIONS[location.pathname];
  const unreadCount = state.notifications.filter(n => !n.read).length + criticalAlertCount;

  const user = state.currentUser;
  const isAdmin      = user.role === 'admin';
  const isManagerPlus = ['admin', 'manager'].includes(user.role);

  const visibleLinks = QUICK_LINKS.filter(l => {
    if (l.adminOnly)   return isAdmin;
    if (l.managerPlus) return isManagerPlus;
    return true;
  });

  function goTo(route: string) {
    setShowProfile(false);
    // Handle tab query params for admin console
    const [path, qs] = route.split('?');
    navigate(path + (qs ? `?${qs}` : ''));
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_0_rgba(31,53,94,0.06)]">
      {/* Left: page title */}
      <div>
        <h1 className="text-base font-bold text-gray-900 leading-tight">{page.title}</h1>
        {page.desc && <p className="text-xs text-gray-400 mt-0.5">{page.desc}</p>}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search jobs, customers…"
            className="pl-8 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 bg-gray-50 text-gray-700 placeholder-gray-400 transition-all"
          />
        </div>

        {/* Create action */}
        {createAction && (
          <Button
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => navigate(createAction.route)}
          >
            {createAction.label}
          </Button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(v => !v); setShowProfile(false); }}
            className="relative p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-card-hover border border-gray-100 z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-sm text-gray-900">Notifications</span>
                <button
                  onClick={() => { dispatch({ type: 'MARK_NOTIFICATIONS_READ' }); setShowNotifications(false); }}
                  className="text-xs text-accent-600 hover:text-accent-700 font-medium hover:underline transition-colors"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {state.notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-400">No notifications</div>
                ) : state.notifications.map(n => (
                  <div key={n.id} className={clsx('px-4 py-3 flex gap-3', !n.read && 'bg-brand-50/60')}>
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', {
                      'bg-brand-500': n.type === 'info',
                      'bg-accent-500': n.type === 'success',
                      'bg-amber-500': n.type === 'warning',
                      'bg-red-500':   n.type === 'error',
                    })} />
                    <p className="text-xs text-gray-700 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── User profile button + dropdown ─────────────────────────────── */}
        <div className="relative pl-2 border-l border-gray-100 ml-1" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(v => !v); setShowNotifications(false); }}
            className={clsx(
              'flex items-center gap-2 rounded-xl px-2 py-1 transition-colors',
              showProfile
                ? 'bg-brand-50 ring-1 ring-brand-200'
                : 'hover:bg-gray-50',
            )}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
              style={{ background: 'var(--decora-gradient)' }}
            >
              {user.avatarInitials}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-gray-900 leading-tight">{user.name}</div>
              <div className="text-[10px] text-gray-400 capitalize">{user.role}</div>
            </div>
          </button>

          {/* Dropdown panel */}
          {showProfile && (
            <div className="absolute right-0 top-12 w-72 bg-white rounded-xl shadow-card-hover border border-gray-100 z-50 animate-fade-in overflow-hidden">

              {/* Profile card */}
              <div className="px-4 py-4 bg-gradient-to-br from-brand-50 to-white border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow"
                    style={{ background: 'var(--decora-gradient)' }}
                  >
                    {user.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize', ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600')}>
                        {user.role}
                      </span>
                      {user.department && (
                        <span className="text-[10px] text-gray-400">{user.department}</span>
                      )}
                    </div>
                  </div>
                </div>
                {user.lastLogin && (
                  <p className="mt-2.5 text-[10px] text-gray-400">
                    Last login: {new Date(user.lastLogin).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Edit profile shortcut */}
              <button
                onClick={() => goTo('/admin?tab=users')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-brand-600 hover:bg-brand-50 transition-colors border-b border-gray-100 font-medium"
              >
                <UserCog size={13} />
                Edit profile &amp; preferences
                <ChevronRight size={11} className="ml-auto text-gray-300" />
              </button>

              {/* Quick links */}
              <div className="py-1">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Quick links
                </div>
                {visibleLinks.map(link => (
                  <button
                    key={link.route}
                    onClick={() => goTo(link.route)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0">
                      {link.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        {link.label}
                      </span>
                      <span className="block text-[10px] text-gray-400 truncate">{link.desc}</span>
                    </span>
                    <ChevronRight size={11} className="text-gray-200 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>

              {/* Demo mode indicator */}
              {state.demoMode && (
                <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
                  <FlaskConical size={12} className="text-amber-600 flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-amber-700">Demo Mode active — not syncing to production</span>
                </div>
              )}

              {/* Sign out */}
              <div className="border-t border-gray-100 p-2">
                <button
                  onClick={() => { setShowProfile(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
