import React from 'react';
import type { User } from '../../types';
import { useApp } from '../../context/AppContext';

const ROLE_STYLE: Record<string, string> = {
  admin:    'bg-red-100 text-red-700',
  manager:  'bg-brand-100 text-brand-700',
  operator: 'bg-gray-100 text-gray-600',
  sales:    'bg-accent-100 text-accent-700',
  viewer:   'bg-slate-100 text-slate-600',
};

const ROLE_LABEL: Record<string, string> = {
  admin:    'Admin',
  manager:  'Manager',
  operator: 'Operator',
  sales:    'Sales',
  viewer:   'Viewer',
};

export function LoginPage() {
  const { state, dispatch } = useApp();

  function login(user: User) {
    dispatch({ type: 'SET_CURRENT_USER', payload: user });
    dispatch({
      type: 'ADD_AUDIT_ENTRY',
      payload: {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        action: 'login',
        entityType: 'session',
        details: `${user.name} (${user.role}) logged in`,
      },
    });
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f4f6fa' }}>
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-80 flex-shrink-0 p-10"
        style={{ background: 'var(--decora-sidebar-bg, #0b1424)' }}
      >
        <div>
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-brand-600 flex items-center justify-center mb-6">
            <img
              src="/brand/DECORA-Avatar-KO-on-PMS534-400px.png"
              alt="DECORA"
              className="w-full h-full object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="text-white font-extrabold text-2xl tracking-tight mb-1">DECORA ERP</div>
          <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Job Shop Management</div>
        </div>

        <div className="space-y-4">
          {[
            { icon: '🏭', label: 'Production Scheduling' },
            { icon: '📋', label: 'Quoting & Invoicing' },
            { icon: '🎯', label: 'Quality Control' },
            { icon: '📦', label: 'Inventory Management' },
            { icon: '📊', label: 'Reports & EOS' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.label}</span>
            </div>
          ))}
        </div>

        <div className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
          DECORA ERP v0.1.0 — Demo Mode
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-600 flex items-center justify-center mx-auto mb-3">
            <img src="/brand/DECORA-Avatar-KO-on-PMS534-400px.png" alt="DECORA" className="w-full h-full object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="font-extrabold text-xl text-brand-900">DECORA ERP</div>
        </div>

        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500">Select your profile to continue</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-700 font-medium">Demo Mode — no password required</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.users.filter(u => u.active).map(user => (
              <button
                key={user.id}
                onClick={() => login(user)}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-gray-100 hover:border-brand-300 shadow-sm hover:shadow-md transition-all text-left"
              >
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-inner"
                  style={{ background: 'linear-gradient(135deg, var(--decora-brand-blue, #1f355e), #2d4f8a)' }}
                >
                  {user.avatarInitials}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate group-hover:text-brand-700 transition-colors">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{user.department}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ROLE_STYLE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Contact your administrator to add or modify user accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
