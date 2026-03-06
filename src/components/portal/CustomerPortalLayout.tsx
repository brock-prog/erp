import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, FileText, Beaker, MessageCircle,
  LogOut, Menu, X, ChevronRight, User,
} from 'lucide-react';
import { useCustomerPortal } from '../../context/CustomerPortalContext';

const NAV = [
  { to: '/portal/dashboard',       label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/portal/orders',          label: 'My Orders',        icon: Package },
  { to: '/portal/quote-request',   label: 'Request a Quote',  icon: FileText },
  { to: '/portal/sample-request',  label: 'Request Samples',  icon: Beaker },
  { to: '/portal/contact',         label: 'Contact Us',       icon: MessageCircle },
];

export function CustomerPortalLayout() {
  const { portalState, portalLogout } = useCustomerPortal();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Guard — if no session, send to login
  if (!portalState.session) {
    return <Navigate to="/portal/login" replace />;
  }

  const { companyName, contactName, email } = portalState.session;
  const initials = contactName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = () => {
    portalLogout();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
      <header className="bg-[#1f355e] shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#009877] flex items-center justify-center shadow">
                <span className="text-white font-black text-sm">D</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-white font-bold text-base tracking-wide">DECORA</span>
                <span className="text-white/50 text-xs ml-2">Customer Portal</span>
              </div>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Right side — user + logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#009877] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{initials}</span>
                </div>
                <div className="text-right hidden lg:block">
                  <p className="text-white text-sm font-medium leading-tight">{contactName}</p>
                  <p className="text-white/50 text-xs leading-tight">{companyName}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(v => !v)}
                className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#1a2d52]">
            <div className="px-4 py-3 space-y-1">
              {/* User info on mobile */}
              <div className="flex items-center gap-3 pb-3 mb-2 border-b border-white/10">
                <div className="w-9 h-9 rounded-full bg-[#009877] flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{initials}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{contactName}</p>
                  <p className="text-white/50 text-xs">{email}</p>
                </div>
              </div>
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Breadcrumb strip ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 text-xs text-gray-400">
          <User className="w-3 h-3" />
          <span className="text-gray-600 font-medium">{companyName}</span>
          <ChevronRight className="w-3 h-3" />
          <span>Customer Portal</span>
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-[#1f355e] flex items-center justify-center">
              <span className="text-white font-black text-xs">D</span>
            </div>
            <div>
              <p className="text-gray-800 text-sm font-semibold">Decora Powder Coatings Inc.</p>
              <p className="text-gray-400 text-xs">24 Benfield Dr, St. Catharines, ON L2S 3V5</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="tel:+19055551000" className="hover:text-gray-600 transition-colors">905-555-1000</a>
            <a href="mailto:info@decoracoatings.com" className="hover:text-gray-600 transition-colors">info@decoracoatings.com</a>
            <span>© 2026 Decora Powder Coatings</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
