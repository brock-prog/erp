import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Users, Shield, History, Settings2, LogOut, RotateCcw,
  Search, AlertTriangle, CheckCircle, ChevronRight, Trash2, List,
  Database, X, Code, Edit2, Crown, Briefcase, Star, Wrench, Eye,
  Check, Minus, GitBranch, Plus,
  HardDrive, Download, Upload, Lock, Timer, UserPlus,
  ToggleLeft, ToggleRight, ShieldCheck, ShieldAlert, RefreshCw,
  Clock, Wifi, WifiOff, Save, UserX, FlaskConical,
  BookOpen, FileText, Link, Package, Globe, Building2,
  Server, Activity, Loader2,
} from 'lucide-react';
import { useApp, ROLE_LEVEL, ROLE_LABEL } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { DropdownManager } from './DropdownManager';
import { clsx, generateId } from '../../utils';
import type { AuditEntry, User, CustomRole, QBSettings, QBImportSession } from '../../types';
import { JURISDICTION_LABELS, QB_TAX_CODE, type TaxJurisdiction } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
import { isSupabaseReady } from '../../lib/supabase';
import {
  downloadBackup, readBackupFile, loadHistory, loadBackupSettings,
  saveBackupSettings, formatBytes, loadSessionTimeout, saveSessionTimeout,
  type BackupHistoryEntry, type BackupSettings,
} from '../../lib/backup';
import {
  parseCSV, detectQBCSVType, importQBCustomers, importQBVendors,
  importQBProducts, importQBInvoices, buildImportSession,
  type QBCSVType,
} from '../../lib/qbImport';

const ADMIN_TOUR: TourStep[] = [
  { selector: '[data-tour="admin-tabs"]',    title: 'Admin Tabs',         why: 'Each tab controls a different admin area: users, roles, audit, dropdowns, backups, security, QB, and system.',   what: 'Click a tab to manage that area. Most tabs are admin-only for security.' },
  { selector: '[data-tour="admin-logout"]',  title: 'Log Out',            why: 'Secure logout ends your session and returns to the login screen.',                                               what: 'Always log out when leaving a shared workstation. Session timeouts are set in Security tab.' },
];

const ADMIN_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🛡️', label: 'Admin Logs In',
    description: 'Only users with Manager level or above can access the Admin Console.' },
  { type: 'action', icon: '👤', label: 'Manage Users',
    description: 'Add, edit, or deactivate users. Assign roles: Owner, Manager, Supervisor, Operator, or Guest/Sales.' },
  { type: 'action', icon: '🏛️', label: 'Review Hierarchy',
    description: 'Hierarchy tab shows the rank pyramid and full privilege matrix — which roles can do what.' },
  { type: 'action', icon: '📋', label: 'Manage Dropdown Options',
    description: 'Customise status labels, categories, service types and other system-wide dropdown values.' },
  { type: 'action', icon: '🔍', label: 'Audit Log',
    description: 'Review a timestamped log of all state-changing actions performed across the system.' },
  { type: 'end', icon: '✅', label: 'Changes Auto-Saved',
    description: 'All changes are persisted to Supabase automatically via the wrapped dispatch.' },
];

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  admin:    'bg-red-100 text-red-700',
  manager:  'bg-brand-100 text-brand-700',
  operator: 'bg-gray-100 text-gray-600',
  sales:    'bg-accent-100 text-accent-700',
  viewer:   'bg-slate-100 text-slate-600',
};

const ACTION_STYLE: Record<string, string> = {
  create:  'bg-green-100 text-green-700',
  update:  'bg-blue-100 text-blue-700',
  delete:  'bg-red-100 text-red-700',
  login:   'bg-accent-100 text-accent-700',
  logout:  'bg-gray-100 text-gray-600',
  revert:  'bg-purple-100 text-purple-700',
};

type TabId = 'users' | 'roles' | 'hierarchy' | 'audit' | 'dropdowns' | 'system' | 'devmode' | 'backups' | 'security' | 'quickbooks';

// ─── Rank / Hierarchy definitions ────────────────────────────────────────────

interface RankDef {
  id: string;
  label: string;
  roles: string[];         // maps to User.role values
  level: number;           // 1 = highest
  color: string;
  bg: string;
  icon: React.ReactNode;
  description: string;
}

const RANKS: RankDef[] = [
  {
    id: 'owner', label: 'Owner', roles: ['admin'], level: 1,
    color: '#7c3aed', bg: '#f5f3ff',
    icon: <Crown size={16} className="text-purple-600" />,
    description: 'Full unrestricted access. Manages users, system config, financials, and all data.',
  },
  {
    id: 'manager', label: 'Manager', roles: ['manager'], level: 2,
    color: '#1f355e', bg: '#eff6ff',
    icon: <Briefcase size={16} className="text-blue-700" />,
    description: 'Approves quotes & invoices, manages jobs, views all reports and CRM pipeline.',
  },
  {
    id: 'supervisor', label: 'Supervisor', roles: ['supervisor'], level: 3,
    color: '#0891b2', bg: '#ecfeff',
    icon: <Star size={16} className="text-cyan-600" />,
    description: 'Runs the production floor — assigns tasks, manages QC, operates kiosks.',
  },
  {
    id: 'operator', label: 'Operator', roles: ['operator'], level: 4,
    color: '#059669', bg: '#ecfdf5',
    icon: <Wrench size={16} className="text-emerald-600" />,
    description: 'Processes jobs, logs work times, scans barcodes, updates statuses.',
  },
  {
    id: 'guest', label: 'Guest / Sales', roles: ['viewer', 'sales'], level: 5,
    color: '#9ca3af', bg: '#f9fafb',
    icon: <Eye size={16} className="text-gray-500" />,
    description: 'Read-only access to jobs and CRM. Can enter leads and view assigned tasks.',
  },
];

interface Privilege {
  id: string;
  category: string;
  label: string;
  /** 1=owner, 2=manager, 3=supervisor, 4=operator, 5=guest (all ranks ≤ this have access) */
  minLevel: number;
}

const PRIVILEGES: Privilege[] = [
  // Data access
  { id: 'view_jobs',        category: 'Production',  label: 'View Jobs & Work Orders',         minLevel: 5 },
  { id: 'create_jobs',      category: 'Production',  label: 'Create / Edit Work Orders',        minLevel: 3 },
  { id: 'process_prod',     category: 'Production',  label: 'Process Production (timer, scan)', minLevel: 4 },
  { id: 'receiving_kiosk',  category: 'Production',  label: 'Receiving Kiosk',                  minLevel: 4 },
  { id: 'qc_inspection',    category: 'Production',  label: 'QC Inspection Kiosk',              minLevel: 3 },
  { id: 'manage_inventory', category: 'Inventory',   label: 'Manage Inventory',                 minLevel: 3 },
  { id: 'view_inventory',   category: 'Inventory',   label: 'View Inventory',                   minLevel: 4 },
  { id: 'view_quotes',      category: 'Finance',     label: 'View Quotes & Invoices',           minLevel: 2 },
  { id: 'approve_quotes',   category: 'Finance',     label: 'Approve / Send Quotes & Invoices', minLevel: 2 },
  { id: 'view_financials',  category: 'Finance',     label: 'View Financial Reports',           minLevel: 2 },
  { id: 'view_crm',         category: 'CRM',         label: 'View CRM Pipeline',                minLevel: 5 },
  { id: 'edit_crm',         category: 'CRM',         label: 'Enter Leads & Edit Opportunities', minLevel: 5 },
  { id: 'crm_approve',      category: 'CRM',         label: 'Approve / Convert Opportunities',  minLevel: 2 },
  { id: 'manage_employees', category: 'HR',          label: 'Manage Employees & HR',            minLevel: 2 },
  { id: 'view_employees',   category: 'HR',          label: 'View Employee Directory',          minLevel: 3 },
  { id: 'export_data',      category: 'System',      label: 'Export Data',                      minLevel: 2 },
  { id: 'manage_users',     category: 'System',      label: 'Manage Users & Roles',             minLevel: 1 },
  { id: 'system_config',    category: 'System',      label: 'System Configuration',             minLevel: 1 },
  { id: 'admin_console',    category: 'System',      label: 'Admin Console Access',             minLevel: 2 },
  { id: 'audit_log',        category: 'System',      label: 'View Audit Log',                   minLevel: 2 },
  { id: 'dev_mode',         category: 'System',      label: 'Developer Mode (JSON editor)',     minLevel: 1 },
];

// ─── User Hierarchy Tab ───────────────────────────────────────────────────────

function UserHierarchyTab() {
  const { state } = useApp();
  const [activeRankId, setActiveRankId] = useState<string | null>(null);

  const getRankForRole = (role: string): RankDef => {
    return RANKS.find(r => r.roles.includes(role)) ?? RANKS[RANKS.length - 1];
  };

  const usersByRank = useMemo(() => {
    const map: Record<string, typeof state.users> = {};
    for (const rank of RANKS) {
      map[rank.id] = state.users.filter(u => rank.roles.includes(u.role));
    }
    return map;
  }, [state.users]);

  const categories = Array.from(new Set(PRIVILEGES.map(p => p.category)));

  return (
    <div className="space-y-6">

      {/* ── Hierarchy Pyramid ─────────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
          <GitBranch size={15} className="text-brand-600" /> User Hierarchy
        </h3>
        <p className="text-xs text-gray-400 mb-5">Click a rank to see members and their access level</p>

        <div className="space-y-2">
          {RANKS.map((rank, i) => {
            const members = usersByRank[rank.id] ?? [];
            const isActive = activeRankId === rank.id;
            const width = `${60 + i * 10}%`;  // tapers narrower at top = wider at bottom

            return (
              <div key={rank.id} className="flex justify-center">
                <button
                  onClick={() => setActiveRankId(isActive ? null : rank.id)}
                  style={{
                    width,
                    background: isActive ? rank.color : rank.bg,
                    borderColor: rank.color,
                    transition: 'all 0.15s',
                  }}
                  className={`border-2 rounded-xl px-4 py-3 flex items-center gap-3 text-left hover:shadow-md ${
                    isActive ? 'shadow-lg' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-white/20' : 'bg-white'
                  }`} style={{ border: `1px solid ${rank.color}20` }}>
                    {rank.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-800'}`}>
                      {rank.label}
                    </div>
                    <div className={`text-[11px] truncate ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                      {rank.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* User avatars */}
                    {members.slice(0, 3).map(u => (
                      <div
                        key={u.id}
                        title={u.name}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: isActive ? 'rgba(255,255,255,0.3)' : rank.color }}
                      >
                        {u.avatarInitials}
                      </div>
                    ))}
                    {members.length > 3 && (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          isActive ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        +{members.length - 3}
                      </div>
                    )}
                    {members.length === 0 && (
                      <span className={`text-[11px] italic ${isActive ? 'text-white/50' : 'text-gray-400'}`}>
                        No users
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded: members list */}
                {isActive && members.length > 0 && (
                  <div
                    className="absolute mt-1 z-10 bg-white rounded-xl shadow-xl border p-3"
                    style={{ borderColor: rank.color, width, marginTop: '3.5rem', left: '50%', transform: 'translateX(-50%)' }}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {members.map(u => (
                        <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: rank.color }}
                          >
                            {u.avatarInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate">{u.name}</div>
                            <div className="text-[10px] text-gray-400 truncate">{u.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Privilege Matrix ──────────────────────────────────────────── */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Shield size={15} className="text-brand-600" /> Privilege Matrix
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">What each rank can do across the system</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap min-w-[200px]">
                  Permission
                </th>
                {RANKS.map(rank => (
                  <th key={rank.id} className="px-3 py-3 text-center min-w-[90px]">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: rank.bg, border: `1px solid ${rank.color}40` }}
                      >
                        {rank.icon}
                      </div>
                      <span className="text-[10px] font-bold text-gray-600 whitespace-nowrap">{rank.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <React.Fragment key={category}>
                  {/* Category header row */}
                  <tr className="bg-gray-50">
                    <td colSpan={RANKS.length + 1} className="px-4 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {category}
                      </span>
                    </td>
                  </tr>
                  {/* Privilege rows */}
                  {PRIVILEGES.filter(p => p.category === category).map(priv => (
                    <tr key={priv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{priv.label}</td>
                      {RANKS.map(rank => {
                        const hasAccess = rank.level <= priv.minLevel;
                        return (
                          <td key={rank.id} className="px-3 py-2.5 text-center">
                            {hasAccess ? (
                              <div
                                className="inline-flex w-5 h-5 rounded-full items-center justify-center mx-auto"
                                style={{ background: rank.bg, border: `1px solid ${rank.color}60` }}
                              >
                                <Check size={11} style={{ color: rank.color }} strokeWidth={2.5} />
                              </div>
                            ) : (
                              <div className="inline-flex w-5 h-5 rounded-full items-center justify-center mx-auto bg-gray-100">
                                <Minus size={9} className="text-gray-300" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Users by Rank ─────────────────────────────────────────────── */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <Users size={15} className="text-brand-600" /> Users by Rank
        </h3>
        <div className="space-y-4">
          {RANKS.map(rank => {
            const members = usersByRank[rank.id] ?? [];
            return (
              <div key={rank.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: rank.bg }}
                  >
                    {rank.icon}
                  </div>
                  <span className="text-xs font-bold text-gray-700">{rank.label}</span>
                  <span
                    className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: rank.bg, color: rank.color }}
                  >
                    {members.length}
                  </span>
                </div>
                {members.length === 0 ? (
                  <div className="text-xs text-gray-400 italic pl-7">No users assigned to this rank</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-7">
                    {members.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
                        style={{ borderColor: `${rank.color}30`, background: rank.bg }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: rank.color }}
                        >
                          {u.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{u.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{u.department}</div>
                        </div>
                        {u.id === state.currentUser.id && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 rounded-full bg-white text-brand-700 border border-brand-200 flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Developer Mode Tab ───────────────────────────────────────────────────────

const DEV_COLLECTIONS = [
  { key: 'jobs',             label: 'Jobs',              updateAction: 'UPDATE_JOB',              labelField: 'jobNumber' },
  { key: 'customers',        label: 'Customers',         updateAction: 'UPDATE_CUSTOMER',         labelField: 'name' },
  { key: 'quotes',           label: 'Quotes',            updateAction: 'UPDATE_QUOTE',            labelField: 'quoteNumber' },
  { key: 'invoices',         label: 'Invoices',          updateAction: 'UPDATE_INVOICE',          labelField: 'invoiceNumber' },
  { key: 'batches',          label: 'Batches',           updateAction: 'UPDATE_BATCH',            labelField: 'batchNumber' },
  { key: 'inventory',        label: 'Inventory',         updateAction: 'UPDATE_INVENTORY_ITEM',   labelField: 'name' },
  { key: 'spareParts',       label: 'Spare Parts',       updateAction: 'UPDATE_SPARE_PART',       labelField: 'name' },
  { key: 'workInstructions', label: 'Work Instructions', updateAction: 'UPDATE_WORK_INSTRUCTION', labelField: 'title' },
  { key: 'employees',        label: 'Employees',         updateAction: 'UPDATE_EMPLOYEE',         labelField: 'name' },
  { key: 'maintenanceTasks', label: 'Maint. Tasks',      updateAction: 'UPDATE_MAINTENANCE_TASK', labelField: 'title' },
  { key: 'shipments',        label: 'Shipments',         updateAction: null,                      labelField: 'id' },
  { key: 'receipts',         label: 'Receipts',          updateAction: null,                      labelField: 'id' },
  { key: 'ncrs',             label: 'NCRs',              updateAction: null,                      labelField: 'id' },
  { key: 'criticalSuppliers',label: 'Suppliers',         updateAction: 'UPDATE_SUPPLIER',         labelField: 'name' },
  { key: 'crmOpportunities', label: 'CRM Opportunities', updateAction: 'UPDATE_CRM_OPPORTUNITY',  labelField: 'title' },
  { key: 'crmActivities',    label: 'CRM Activities',    updateAction: 'UPDATE_CRM_ACTIVITY',     labelField: 'type' },
  { key: 'racks',            label: 'Racks',             updateAction: null,                      labelField: 'name' },
] as const;

function DevModeTab() {
  const { state, dispatch } = useApp();
  const [selectedColl, setSelectedColl] = useState<string>('jobs');
  const [search, setSearch] = useState('');
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [editJson, setEditJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saved, setSaved] = useState(false);

  const coll = DEV_COLLECTIONS.find(c => c.key === selectedColl) ?? DEV_COLLECTIONS[0];
  const items: Record<string, unknown>[] = ((state as unknown as Record<string, unknown>)[coll.key] as Record<string, unknown>[]) ?? [];

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(item => {
      const label = (item[coll.labelField] ?? item['id'] ?? '') as string;
      const id = (item['id'] ?? '') as string;
      return label.toLowerCase().includes(q) || id.toLowerCase().includes(q);
    });
  }, [items, search, coll]);

  function openEdit(record: Record<string, unknown>) {
    setEditingRecord(record);
    setEditJson(JSON.stringify(record, null, 2));
    setJsonError('');
    setSaved(false);
  }

  function formatJson() {
    try {
      setEditJson(JSON.stringify(JSON.parse(editJson), null, 2));
      setJsonError('');
    } catch (e) {
      setJsonError('Invalid JSON — fix syntax first');
    }
  }

  function handleSave() {
    if (!coll.updateAction) return;
    try {
      const parsed = JSON.parse(editJson);
      dispatch({ type: coll.updateAction as never, payload: parsed as never });
      setSaved(true);
      setTimeout(() => { setEditingRecord(null); setSaved(false); }, 800);
    } catch (e) {
      setJsonError('JSON parse error: ' + (e as Error).message);
    }
  }

  return (
    <div>
      {/* Warning banner */}
      <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Developer Mode</span> — Direct record editing. Changes take effect immediately but
          may not persist on page refresh for non-persisted collections (equipment, work instructions, etc.).
          Use with care. All edits are appended to the audit log.
        </div>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
        {/* Collection sidebar */}
        <div className="w-44 flex-shrink-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex-shrink-0">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
              <Database size={11} /> Collections
            </p>
          </div>
          <div className="overflow-y-auto flex-1">
            {DEV_COLLECTIONS.map(c => {
              const count = ((state as unknown as Record<string, unknown>)[c.key] as unknown[])?.length ?? 0;
              const active = c.key === selectedColl;
              return (
                <button
                  key={c.key}
                  onClick={() => { setSelectedColl(c.key); setSearch(''); }}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 text-xs text-left border-b border-gray-100 last:border-0 transition-colors',
                    active ? 'bg-[#1f355e] text-white' : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <span className="font-medium truncate">{c.label}</span>
                  <span className={clsx('text-xs rounded-full px-1.5 leading-5 flex-shrink-0 ml-1', active ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Record list */}
        <div className="flex-1 min-w-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          {/* List header */}
          <div className="flex-shrink-0 bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-gray-800">{coll.label}</h4>
              <span className="text-xs text-gray-400">{items.length} records</span>
              {!coll.updateAction && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">read-only</span>
              )}
            </div>
            <div className="relative ml-auto">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-gray-100 shadow-sm">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-semibold">ID</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-semibold">Name / Label</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const id = (item['id'] as string) ?? '';
                  const label = (item[coll.labelField as string] as string) ?? id;
                  return (
                    <tr key={id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-gray-400 truncate" style={{ maxWidth: '130px' }}>
                        {id.length > 18 ? id.slice(0, 18) + '…' : id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 truncate" style={{ maxWidth: '200px' }}>
                        {label}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => openEdit(item)}
                          className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ml-auto',
                            coll.updateAction
                              ? 'bg-[#1f355e] text-white hover:bg-[#2a4a80]'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                          )}
                        >
                          <Code size={10} /> {coll.updateAction ? 'Edit' : 'View'} JSON
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-gray-400">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* JSON Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
            {/* Modal header */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Edit2 size={15} className="text-[#1f355e]" />
                  {coll.updateAction ? 'Edit' : 'View'} — {coll.label}
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{editingRecord['id'] as string}</p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-600 rounded-lg p-1">
                <X size={18} />
              </button>
            </div>

            {/* Editor area */}
            <div className="flex-1 overflow-auto p-4">
              {jsonError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle size={12} /> {jsonError}
                </div>
              )}
              {saved && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                  <CheckCircle size={12} /> Saved successfully
                </div>
              )}
              {!coll.updateAction && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  This collection is read-only in developer mode. Editing is not supported for this type.
                </div>
              )}
              <textarea
                value={editJson}
                onChange={e => { setEditJson(e.target.value); setJsonError(''); setSaved(false); }}
                readOnly={!coll.updateAction}
                rows={20}
                className={clsx(
                  'w-full font-mono text-xs border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y',
                  !coll.updateAction && 'bg-gray-50 text-gray-500 cursor-default',
                )}
                spellCheck={false}
              />
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={formatJson}
                disabled={!coll.updateAction}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 transition-colors"
              >
                Format JSON
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {coll.updateAction ? 'Cancel' : 'Close'}
                </button>
                {coll.updateAction && (
                  <button
                    onClick={handleSave}
                    className="px-5 py-2 text-sm font-semibold bg-[#1f355e] text-white rounded-lg hover:bg-[#2a4a80] transition-colors"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Backups Tab ──────────────────────────────────────────────────────────────

// ─── Server Backup Health types ───────────────────────────────────────────────

interface ServerBackupHealth {
  schedulerRunning: boolean;
  cronSchedule: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | 'never';
  lastError: string | null;
  consecutiveFailures: number;
  totalRunsSinceStart: number;
  serverStartedAt: string;
  disk: { totalBytes: number; fileCount: number };
  latestBackup: { fileName: string; sizeBytes: number; createdAt: string; totalRecords: number; verified: boolean; source: string } | null;
  backupCount: number;
  maxBackups: number;
}

interface ServerBackupFile {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  totalRecords: number;
  verified: boolean;
  source: string;
}

function ServerBackupCard() {
  const [health, setHealth] = useState<ServerBackupHealth | null>(null);
  const [serverHistory, setServerHistory] = useState<ServerBackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const token = localStorage.getItem('coatpro_jwt');
      if (!token) { setError('Not authenticated'); setLoading(false); return; }
      const [healthRes, historyRes] = await Promise.all([
        fetch('/api/backup/health', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/backup/history?limit=10', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!healthRes.ok) throw new Error(`Health: ${healthRes.status}`);
      if (!historyRes.ok) throw new Error(`History: ${historyRes.status}`);
      const healthData = await healthRes.json();
      const historyData = await historyRes.json();
      setHealth(healthData);
      setServerHistory(historyData.backups ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); const id = setInterval(fetchHealth, 60_000); return () => clearInterval(id); }, [fetchHealth]);

  async function handleTrigger() {
    setTriggering(true);
    try {
      const token = localStorage.getItem('coatpro_jwt');
      const res = await fetch('/api/backup/trigger', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) throw new Error(`Trigger failed: ${res.status}`);
      await fetchHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-6 justify-center text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Connecting to backup server...</span>
        </div>
      </Card>
    );
  }

  if (error && !health) {
    return (
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
          <Server size={14} className="text-gray-400" /> Server Backups
        </h3>
        <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
          <WifiOff size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-700">Server not reachable</p>
            <p className="mt-1">The ERP server is not running or not accessible. Server-side automated backups require the Express server to be running on your ROG PC.</p>
            <p className="mt-1 text-gray-400">Error: {error}</p>
          </div>
        </div>
      </Card>
    );
  }

  const h = health!;
  const hoursSinceLast = h.lastRunAt
    ? (Date.now() - new Date(h.lastRunAt).getTime()) / 3_600_000
    : Infinity;
  const isHealthy = h.lastRunStatus === 'success' && hoursSinceLast < 8;
  const isWarning = h.lastRunStatus === 'success' && hoursSinceLast >= 8 && hoursSinceLast < 24;
  const isDanger = h.lastRunStatus === 'failed' || hoursSinceLast >= 24 || h.consecutiveFailures > 0;

  const statusColor = isDanger ? 'red' : isWarning ? 'amber' : 'green';

  return (
    <div className="space-y-4">
      {/* Server Health Banner */}
      <div className={clsx(
        'flex items-center gap-3 rounded-xl px-4 py-3 border',
        statusColor === 'green' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
        statusColor === 'amber' && 'bg-amber-50 border-amber-200 text-amber-800',
        statusColor === 'red' && 'bg-red-50 border-red-200 text-red-800',
      )}>
        <Server size={18} className={clsx(
          'flex-shrink-0',
          statusColor === 'green' && 'text-emerald-600',
          statusColor === 'amber' && 'text-amber-500',
          statusColor === 'red' && 'text-red-500',
        )} />
        <div className="flex-1">
          <span className="font-semibold">Server Backup</span>
          {' — '}
          {h.lastRunStatus === 'never'
            ? 'No backups yet (scheduler just started)'
            : h.lastRunStatus === 'success'
              ? <>Last backup {h.lastRunAt ? new Date(h.lastRunAt).toLocaleString() : 'never'} ({h.latestBackup?.totalRecords ?? 0} records, {h.latestBackup?.verified ? 'verified' : 'unverified'})</>
              : <>Last backup failed{h.lastError ? `: ${h.lastError}` : ''}</>
          }
          {h.consecutiveFailures > 0 && (
            <span className="ml-2 text-red-600 font-bold">({h.consecutiveFailures} consecutive failures)</span>
          )}
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 hover:bg-white border text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {triggering ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {triggering ? 'Running...' : 'Backup Now'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Schedule info */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-brand-600" />
            <h4 className="font-bold text-gray-900 text-xs">Schedule</h4>
          </div>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Cron</span>
              <span className="font-mono font-semibold text-gray-800">{h.cronSchedule}</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className={clsx('font-semibold', h.schedulerRunning ? 'text-green-600' : 'text-red-600')}>
                {h.schedulerRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Runs since start</span>
              <span className="font-semibold text-gray-800">{h.totalRunsSinceStart}</span>
            </div>
          </div>
        </Card>

        {/* Storage info */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={14} className="text-brand-600" />
            <h4 className="font-bold text-gray-900 text-xs">Storage</h4>
          </div>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Backups on disk</span>
              <span className="font-semibold text-gray-800">{h.backupCount} / {h.maxBackups}</span>
            </div>
            <div className="flex justify-between">
              <span>Disk usage</span>
              <span className="font-semibold text-gray-800">{formatBytes(h.disk.totalBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span>Retention</span>
              <span className="font-semibold text-gray-800">~30 days</span>
            </div>
          </div>
        </Card>

        {/* Latest backup */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-brand-600" />
            <h4 className="font-bold text-gray-900 text-xs">Latest Backup</h4>
          </div>
          {h.latestBackup ? (
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Records</span>
                <span className="font-semibold text-gray-800">{h.latestBackup.totalRecords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Size</span>
                <span className="font-semibold text-gray-800">{formatBytes(h.latestBackup.sizeBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Verified</span>
                <span className={clsx('font-semibold', h.latestBackup.verified ? 'text-green-600' : 'text-amber-600')}>
                  {h.latestBackup.verified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No backups yet</p>
          )}
        </Card>
      </div>

      {/* Server backup history */}
      {serverHistory.length > 0 && (
        <Card>
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <Server size={14} className="text-brand-600" /> Server Backup History
            <span className="ml-auto text-[11px] font-normal text-gray-400">Last 10 (on disk)</span>
          </h3>
          <div className="divide-y divide-gray-50">
            {serverHistory.map((entry, i) => (
              <div key={entry.fileName} className="flex items-center gap-3 py-2.5">
                <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', i === 0 ? 'bg-emerald-500' : 'bg-gray-300')} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{entry.fileName}</div>
                  <div className="text-[11px] text-gray-400">
                    {new Date(entry.createdAt).toLocaleString()} · {entry.source}
                    {entry.verified && <span className="ml-1 text-green-600">· verified</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold text-gray-700">{formatBytes(entry.sizeBytes)}</div>
                  <div className="text-[11px] text-gray-400">{entry.totalRecords.toLocaleString()} records</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function BackupsTab() {
  const { state } = useApp();
  const [history, setHistory] = useState<BackupHistoryEntry[]>(() => loadHistory());
  const [settings, setSettings] = useState<BackupSettings>(() => loadBackupSettings());
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<{ manifest: BackupHistoryEntry & { recordCounts: Record<string, number> }; state: Record<string, unknown> } | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showSsdGuide, setShowSsdGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoBackupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { dispatch } = useApp();

  const lastBackup = history[0] ?? null;
  const hoursSinceLast = lastBackup
    ? (Date.now() - new Date(lastBackup.timestamp).getTime()) / 3_600_000
    : Infinity;
  const backupHealthy = hoursSinceLast < 24;

  // Auto-backup interval
  useEffect(() => {
    if (autoBackupRef.current) clearInterval(autoBackupRef.current);
    if (!settings.enabled) return;
    const ms = settings.intervalHours * 3_600_000;
    autoBackupRef.current = setInterval(() => {
      const entry = downloadBackup(state as unknown as Record<string, unknown>, state.currentUser.name);
      setHistory(loadHistory());
      void entry;
    }, ms);
    return () => { if (autoBackupRef.current) clearInterval(autoBackupRef.current); };
  }, [settings.enabled, settings.intervalHours]);

  function handleDownloadNow() {
    downloadBackup(state as unknown as Record<string, unknown>, state.currentUser.name);
    setHistory(loadHistory());
  }

  function handleSettingsChange(patch: Partial<BackupSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveBackupSettings(next);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreError('');
    setRestorePreview(null);
    try {
      const data = await readBackupFile(file);
      setRestorePreview({
        manifest: {
          id: 'preview',
          timestamp: data.manifest.createdAt,
          sizeBytes: data.manifest.sizeEstimateBytes,
          fileName: file.name,
          createdBy: data.manifest.createdBy,
          totalRecords: data.manifest.totalRecords,
          recordCounts: data.manifest.recordCounts,
        },
        state: data.state,
      });
    } catch (err) {
      setRestoreError((err as Error).message);
    }
  }

  function handleRestore() {
    if (!restorePreview) return;
    setRestoring(true);
    try {
      dispatch({ type: '_HYDRATE_STATE', payload: restorePreview.state as any });
      setShowRestoreConfirm(false);
      setRestorePreview(null);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* Server-Side Automated Backups */}
      <ServerBackupCard />

      {/* Divider between server and client-side backups */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Browser-Side Backups</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Backup Health Banner */}
      <div className={clsx(
        'flex items-center gap-3 rounded-xl px-4 py-3 border',
        backupHealthy
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      )}>
        {backupHealthy
          ? <ShieldCheck size={18} className="text-green-600 flex-shrink-0" />
          : <ShieldAlert size={18} className="text-amber-500 flex-shrink-0" />}
        <div className="flex-1">
          {backupHealthy
            ? <><span className="font-semibold">Backup healthy</span> — last backup {lastBackup ? new Date(lastBackup.timestamp).toLocaleString() : 'never'}</>
            : <><span className="font-semibold">No recent backup</span> — last backup was {lastBackup ? Math.floor(hoursSinceLast) + 'h ago' : 'never'}. Download a backup now.</>
          }
        </div>
        <button
          onClick={handleDownloadNow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 hover:bg-white border text-xs font-semibold transition-colors"
        >
          <Download size={12} /> Backup Now
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Manual Backup */}
        <Card>
          <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
            <Download size={14} className="text-brand-600" /> Manual Backup
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Download a complete snapshot of all ERP data as a JSON file.
            Save it to your external SSD for safekeeping.
          </p>
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 mb-3">
            <div className="text-xs text-gray-600">
              <div className="font-semibold text-gray-800">Estimated size</div>
              <div>{formatBytes((state as unknown as Record<string, unknown[]>).jobs?.length * 200 + (state as unknown as Record<string, unknown[]>).customers?.length * 150 + 50_000 || 50_000)}</div>
            </div>
            <div className="text-xs text-gray-600 text-right">
              <div className="font-semibold text-gray-800">Records</div>
              <div>{(state.jobs?.length ?? 0) + (state.customers?.length ?? 0) + (state.invoices?.length ?? 0)} key</div>
            </div>
          </div>
          <button
            onClick={handleDownloadNow}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            <Download size={14} /> Download Full Backup
          </button>
        </Card>

        {/* Auto-Backup */}
        <Card>
          <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
            <Clock size={14} className="text-brand-600" /> Auto-Backup
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Automatically download a backup file at a set interval while the app is open.
          </p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-700">Enabled</span>
            <button
              onClick={() => handleSettingsChange({ enabled: !settings.enabled })}
              className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', settings.enabled ? 'bg-brand-600' : 'bg-gray-200')}
            >
              <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', settings.enabled ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
          <div className={clsx('space-y-2 transition-opacity', !settings.enabled && 'opacity-40 pointer-events-none')}>
            <label className="text-xs font-semibold text-gray-600">Interval</label>
            <div className="flex gap-2">
              {([1, 6, 24] as const).map(h => (
                <button
                  key={h}
                  onClick={() => handleSettingsChange({ intervalHours: h })}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    settings.intervalHours === h ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
                  )}
                >
                  {h === 1 ? 'Every hour' : `Every ${h}h`}
                </button>
              ))}
            </div>
            {settings.enabled && (
              <p className="text-[11px] text-gray-400">
                Next backup in {settings.intervalHours}h (while app is open in this browser tab)
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Backup History */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <History size={14} className="text-brand-600" /> Backup History
          <span className="ml-auto text-[11px] font-normal text-gray-400">Last 10</span>
        </h3>
        {history.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <HardDrive size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-semibold">No backups yet</p>
            <p className="text-xs mt-1">Download your first backup above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5">
                <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', i === 0 ? 'bg-green-500' : 'bg-gray-300')} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{entry.fileName}</div>
                  <div className="text-[11px] text-gray-400">{new Date(entry.timestamp).toLocaleString()} · by {entry.createdBy}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold text-gray-700">{formatBytes(entry.sizeBytes)}</div>
                  <div className="text-[11px] text-gray-400">{entry.totalRecords} records</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Restore */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
          <Upload size={14} className="text-brand-600" /> Restore from Backup
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Load a previously downloaded backup file. This overwrites current data immediately.
          <span className="font-semibold text-amber-600"> Admin only. Cannot be undone.</span>
        </p>

        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
          <Upload size={18} className="text-gray-400" />
          <span className="text-sm text-gray-500">{restoreFile ? restoreFile.name : 'Click to select a .json backup file'}</span>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
        </label>

        {restoreError && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {restoreError}
          </div>
        )}

        {restorePreview && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
            <div className="text-xs font-semibold text-blue-800">Backup preview</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-700">
              <span>Created:</span><span className="font-semibold">{new Date(restorePreview.manifest.timestamp).toLocaleString()}</span>
              <span>Created by:</span><span className="font-semibold">{restorePreview.manifest.createdBy}</span>
              <span>Total records:</span><span className="font-semibold">{restorePreview.manifest.totalRecords}</span>
              <span>File size:</span><span className="font-semibold">{formatBytes(restorePreview.manifest.sizeBytes)}</span>
            </div>
            <button
              onClick={() => setShowRestoreConfirm(true)}
              className="w-full mt-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
            >
              Restore This Backup
            </button>
          </div>
        )}
      </Card>

      {/* SSD Setup Guide */}
      <Card>
        <button
          className="w-full flex items-center justify-between text-sm font-bold text-gray-900"
          onClick={() => setShowSsdGuide(!showSsdGuide)}
        >
          <span className="flex items-center gap-2"><HardDrive size={14} className="text-brand-600" /> External SSD Auto-Copy Guide</span>
          <ChevronRight size={14} className={clsx('text-gray-400 transition-transform', showSsdGuide && 'rotate-90')} />
        </button>
        {showSsdGuide && (
          <div className="mt-4 space-y-4 text-xs text-gray-600">
            <p className="text-gray-500">
              Since DECORA ERP runs in a browser, backups download to your <strong>Downloads</strong> folder.
              Set up an OS-level task to automatically mirror Downloads to your external SSD drive.
            </p>
            <div>
              <div className="font-bold text-gray-800 mb-1">macOS — rsync via Terminal / Automator</div>
              <pre className="bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed">{`# Run once to copy latest backup to SSD
rsync -av ~/Downloads/decora-erp-backup-*.json \\
  /Volumes/YourSSD/DECORA-Backups/

# Add to crontab (crontab -e) to run every 6 hours:
0 */6 * * * rsync -av ~/Downloads/decora-erp-backup-*.json \\
  /Volumes/YourSSD/DECORA-Backups/`}</pre>
            </div>
            <div>
              <div className="font-bold text-gray-800 mb-1">Windows — Task Scheduler + robocopy</div>
              <pre className="bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed">{`robocopy "%USERPROFILE%\\Downloads" "E:\\DECORA-Backups" ^
  decora-erp-backup-*.json /MOV

# Schedule in Task Scheduler → Create Basic Task
# Trigger: Daily / every 6 hours
# Action: Start a program → robocopy with above args`}</pre>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              Keep at least 3 backups on your SSD. Label your SSD "DECORA-Backups" and keep it in the office.
            </div>
          </div>
        )}
      </Card>

      {/* Restore confirmation modal */}
      <Modal
        open={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        title="Confirm Restore"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowRestoreConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {restoring ? 'Restoring…' : 'Yes, Restore Now'}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-sm text-gray-700">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">This will overwrite all current ERP data.</p>
            <p className="text-gray-500 mt-1">All jobs, customers, invoices, and other records will be replaced with the backup data. This cannot be undone.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { state, dispatch } = useApp();
  const [timeoutMin, setTimeoutMin] = useState(loadSessionTimeout);
  const [lockdownConfirm, setLockdownConfirm] = useState(false);
  const [lockdownDone, setLockdownDone] = useState(false);

  const loginHistory = useMemo(
    () => state.auditLog.filter(e => e.action === 'login').slice(0, 20),
    [state.auditLog],
  );

  const lastBackupEntry = loadHistory()[0] ?? null;
  const backupAge = lastBackupEntry
    ? (Date.now() - new Date(lastBackupEntry.timestamp).getTime()) / 3_600_000
    : Infinity;

  function handleTimeoutChange(min: number) {
    setTimeoutMin(min);
    saveSessionTimeout(min);
  }

  function doLockdown() {
    state.users.forEach(u => {
      if (u.role !== 'admin' && u.active) {
        dispatch({ type: 'UPDATE_USER', payload: { ...u, active: false } });
      }
    });
    dispatch({
      type: 'ADD_AUDIT_ENTRY',
      payload: {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        action: 'update',
        entityType: 'system',
        details: 'EMERGENCY LOCKDOWN activated — all non-admin users deactivated',
      },
    });
    setLockdownConfirm(false);
    setLockdownDone(true);
  }

  const HEALTH_CHECKS = [
    {
      id: 'supabase',
      label: 'Supabase cloud sync configured',
      pass: isSupabaseReady,
      tip: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local',
    },
    {
      id: 'demo',
      label: 'Running in Live Mode (not Demo)',
      pass: !state.demoMode,
      tip: 'Switch to Live Mode in Admin → System to enable cloud persistence',
    },
    {
      id: 'backup',
      label: 'Backup taken within 24 hours',
      pass: backupAge < 24,
      tip: 'Go to the Backups tab and download a backup now',
    },
    {
      id: 'admin',
      label: 'Admin account has email set',
      pass: !!(state.currentUser?.email),
      tip: 'Ensure the admin account has a valid email address',
    },
    {
      id: 'timeout',
      label: 'Session timeout configured',
      pass: timeoutMin > 0,
      tip: 'Set a session timeout below to auto-logout inactive users',
    },
  ];
  const passCount = HEALTH_CHECKS.filter(h => h.pass).length;

  return (
    <div className="space-y-4">

      {/* Security Score */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={passCount >= 4 ? '#16a34a' : passCount >= 2 ? '#d97706' : '#dc2626'}
                strokeWidth="3"
                strokeDasharray={`${(passCount / HEALTH_CHECKS.length) * 100} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-extrabold text-gray-800">{passCount}/{HEALTH_CHECKS.length}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-900">Security Health</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {passCount === HEALTH_CHECKS.length
                ? 'All checks passing — system is well-configured'
                : `${HEALTH_CHECKS.length - passCount} item${HEALTH_CHECKS.length - passCount !== 1 ? 's' : ''} need attention`}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {HEALTH_CHECKS.map(h => (
            <div key={h.id} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100">
              <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', h.pass ? 'bg-green-100' : 'bg-red-50')}>
                {h.pass
                  ? <Check size={11} className="text-green-600" strokeWidth={3} />
                  : <X size={11} className="text-red-500" strokeWidth={3} />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-800">{h.label}</div>
                {!h.pass && <div className="text-[11px] text-gray-400 mt-0.5">{h.tip}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Session Timeout */}
        <Card>
          <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
            <Timer size={14} className="text-brand-600" /> Session Timeout
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Auto-logout users after inactivity. Applies immediately to this browser.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Off', value: 0 },
              { label: '15 min', value: 15 },
              { label: '30 min', value: 30 },
              { label: '1 hour', value: 60 },
              { label: '4 hours', value: 240 },
              { label: '8 hours', value: 480 },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleTimeoutChange(opt.value)}
                className={clsx(
                  'py-2 rounded-lg text-xs font-semibold border transition-colors',
                  timeoutMin === opt.value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {timeoutMin > 0 && (
            <p className="text-[11px] text-amber-600 mt-3">
              Users are logged out after {timeoutMin >= 60 ? `${timeoutMin / 60}h` : `${timeoutMin}m`} of inactivity.
            </p>
          )}
        </Card>

        {/* Active Sessions */}
        <Card>
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <Wifi size={14} className="text-brand-600" /> Active Sessions
          </h3>
          {state.onlineUsers.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
              <WifiOff size={14} className="text-gray-300" />
              No other sessions detected (WebSocket server may be offline)
            </div>
          ) : (
            <div className="space-y-2">
              {state.onlineUsers.map(u => (
                <div key={u.socketId} className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl border border-green-100">
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{u.name}</div>
                    <div className="text-[11px] text-gray-500">{u.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 p-2.5 bg-brand-50 rounded-xl border border-brand-100">
            <div className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
              <span className="font-semibold text-brand-800">{state.currentUser.name}</span>
              <span className="text-brand-500 ml-1">(you)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Login History */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <History size={14} className="text-brand-600" /> Login History
          <span className="ml-auto text-[11px] font-normal text-gray-400">Last 20</span>
        </h3>
        {loginHistory.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No login events recorded yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {loginHistory.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Users size={12} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800">{entry.userName}</div>
                  <div className="text-[11px] text-gray-400">{entry.details}</div>
                </div>
                <div className="text-[11px] text-gray-400 flex-shrink-0 font-mono">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Security Notes */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <Lock size={14} className="text-brand-600" /> Data Security Notes
        </h3>
        <div className="space-y-2 text-xs text-gray-600">
          {[
            ['AES-256 at rest', 'All data stored in Supabase is encrypted at rest using AES-256.'],
            ['TLS in transit', 'All API calls use HTTPS/TLS 1.3 — data is encrypted in transit.'],
            ['Row Level Security', 'Supabase RLS policies restrict data access to authenticated users only.'],
            ['No password storage', 'Passwords are hashed server-side (bcrypt). DECORA ERP never stores plaintext passwords.'],
            ['Audit trail', 'Every create/update/delete action is timestamped and attributed to a user in the audit log.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50">
              <ShieldCheck size={12} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div><span className="font-semibold text-gray-800">{title}</span> — {desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Emergency Lockdown */}
      <Card>
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2 text-red-700">
          <AlertTriangle size={14} className="text-red-500" /> Emergency Lockdown
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Immediately deactivates all non-admin accounts. Use if you suspect a security incident.
          Users can be re-activated manually from the Users tab.
        </p>
        {lockdownDone ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-semibold">
            <CheckCircle size={14} /> Lockdown complete — all non-admin users deactivated
          </div>
        ) : (
          <button
            onClick={() => setLockdownConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-semibold transition-colors"
          >
            <UserX size={14} /> Activate Emergency Lockdown
          </button>
        )}
      </Card>

      {/* Lockdown confirm modal */}
      <Modal
        open={lockdownConfirm}
        onClose={() => setLockdownConfirm(false)}
        title="Confirm Emergency Lockdown"
        size="sm"
        footer={
          <>
            <button onClick={() => setLockdownConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={doLockdown} className="px-5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
              Lock Down Now
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-sm text-gray-700">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">This will deactivate {state.users.filter(u => u.role !== 'admin' && u.active).length} non-admin user account{state.users.filter(u => u.role !== 'admin' && u.active).length !== 1 ? 's' : ''}.</p>
            <p className="text-gray-500 mt-1">They will not be able to log in until you manually re-activate each account from the Users tab.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── User modal (Add / Edit) ──────────────────────────────────────────────────

const ROLE_OPTIONS = ['admin', 'manager', 'supervisor', 'operator', 'sales', 'viewer'] as const;

/** Compact permissions grid used inside UserModal */
function PermissionsGrid({ role }: { role: string }) {
  const level = ROLE_LEVEL[role] ?? 5;
  const categories = Array.from(new Set(PRIVILEGES.map(p => p.category)));
  return (
    <div className="space-y-2">
      {categories.map(cat => (
        <div key={cat}>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{cat}</div>
          <div className="space-y-0.5">
            {PRIVILEGES.filter(p => p.category === cat).map(p => {
              const granted = level <= p.minLevel;
              return (
                <div key={p.id} className={clsx('flex items-center gap-2 px-2 py-1 rounded-lg text-xs', granted ? 'bg-emerald-50' : 'bg-gray-50')}>
                  {granted
                    ? <Check size={11} className="text-emerald-500 flex-shrink-0" />
                    : <Minus size={11} className="text-gray-300 flex-shrink-0" />}
                  <span className={granted ? 'text-gray-700' : 'text-gray-400'}>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function UserModal({
  user,
  onClose,
  initialMode = 'edit',
}: {
  user: User | null;
  onClose: () => void;
  initialMode?: 'view' | 'edit';
}) {
  const { state, dispatch } = useApp();
  const isSelf = !!user && user.id === state.currentUser.id;
  const isNew  = !user;
  const [mode, setMode] = useState<'view' | 'edit'>(isNew ? 'edit' : initialMode);

  const [form, setForm] = useState({
    name:       user?.name       ?? '',
    email:      user?.email      ?? '',
    role:       (user?.role      ?? 'operator') as User['role'],
    department: user?.department ?? '',
    phone:      user?.phone      ?? '',
    active:     user?.active     ?? true,
  });
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setError('');
  }

  function handleSave() {
    if (!form.name.trim())  { setError('Name is required');  return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (state.users.some(u => u.email === form.email.trim() && u.id !== user?.id)) {
      setError('A user with this email already exists');
      return;
    }
    if (isSelf && !form.active) {
      setError("You can't deactivate your own account");
      return;
    }

    const initials = form.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const saved: User = {
      id:             user?.id        ?? generateId(),
      name:           form.name.trim(),
      email:          form.email.trim(),
      role:           form.role,
      department:     form.department.trim(),
      phone:          form.phone.trim(),
      active:         form.active,
      avatarInitials: initials,
      createdAt:      user?.createdAt ?? new Date().toISOString(),
      lastLogin:      user?.lastLogin,
    };

    dispatch({ type: isNew ? 'ADD_USER' : 'UPDATE_USER', payload: saved });
    dispatch({
      type: 'ADD_AUDIT_ENTRY',
      payload: {
        id:          `audit-${Date.now()}`,
        timestamp:   new Date().toISOString(),
        userId:      state.currentUser.id,
        userName:    state.currentUser.name,
        action:      isNew ? 'create' : 'update',
        entityType:  'user',
        entityId:    saved.id,
        entityLabel: saved.name,
        details:     `${isNew ? 'Created' : 'Updated'} user ${saved.name} (${saved.role})`,
      },
    });
    onClose();
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (mode === 'view' && user) {
    return (
      <Modal
        open
        onClose={onClose}
        title={`User Profile — ${user.name}`}
        size="md"
        footer={
          <>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Close</button>
            <button
              onClick={() => setMode('edit')}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-2"
            >
              <Edit2 size={13} /> Edit User
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Profile card */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-brand-50 to-white rounded-xl border border-brand-100">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow"
              style={{ background: 'linear-gradient(135deg, #1f355e, #2d4f8a)' }}
            >
              {user.avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
              {user.phone && <div className="text-xs text-gray-500">{user.phone}</div>}
              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', ROLE_STYLE[user.role] ?? 'bg-gray-100 text-gray-600')}>
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
                {user.department && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-semibold">{user.department}</span>
                )}
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                  {user.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          {user.lastLogin && (
            <div className="text-xs text-gray-400 text-right -mt-2">
              Last login: {new Date(user.lastLogin).toLocaleString()}
            </div>
          )}
          {/* Permissions grid */}
          <div>
            <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <Shield size={12} className="text-brand-500" /> Permissions for this role
            </div>
            <PermissionsGrid role={user.role} />
          </div>
        </div>
      </Modal>
    );
  }

  // ── EDIT / CREATE MODE ─────────────────────────────────────────────────────
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add New User' : `Edit User — ${user!.name}`}
      size="lg"
      footer={
        <>
          {!isNew && mode === 'edit' && (
            <button onClick={() => setMode('view')} className="mr-auto px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors flex items-center gap-1.5">
              <Eye size={13} /> View Profile
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-2">
            <Save size={13} /> {isNew ? 'Create User' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="flex gap-5">
        {/* Left: form */}
        <div className="flex-1 space-y-3">
          {isSelf && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
              <AlertTriangle size={13} className="flex-shrink-0" /> You are editing your own account
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
          {[
            { label: 'Full Name *',  key: 'name'       as const, type: 'text',  placeholder: 'e.g. Sarah Chen' },
            { label: 'Email *',      key: 'email'      as const, type: 'email', placeholder: 'sarah@example.com' },
            { label: 'Department',   key: 'department' as const, type: 'text',  placeholder: 'e.g. Production' },
            { label: 'Phone',        key: 'phone'      as const, type: 'tel',   placeholder: '+1 555-000-0000' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key] as string}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          ))}

          {/* Role selector */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Role & Permissions *</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value as User['role'])}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              <optgroup label="Built-in Roles">
                {ROLE_OPTIONS.map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r] ?? r} — Level {ROLE_LEVEL[r]}</option>
                ))}
              </optgroup>
              {state.customRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {state.customRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} — Level {r.level}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {isSelf && form.role !== user?.role && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">Warning: changing your own role affects your access immediately.</p>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <span className="text-sm font-semibold text-gray-700">Account Active</span>
              {isSelf && <p className="text-[10px] text-gray-400">You cannot deactivate your own account</p>}
            </div>
            <button
              disabled={isSelf}
              onClick={() => !isSelf && set('active', !form.active)}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.active ? 'bg-brand-600' : 'bg-gray-200',
                isSelf && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', form.active ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
        </div>

        {/* Right: live permissions preview */}
        <div className="w-52 flex-shrink-0 border-l border-gray-100 pl-5">
          <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5 sticky top-0 bg-white pb-1">
            <Shield size={12} className="text-brand-500" /> Permissions
          </div>
          <div className="max-h-80 overflow-y-auto pr-1">
            <PermissionsGrid role={form.role} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Custom Roles Tab ─────────────────────────────────────────────────────────

function CustomRoleModal({
  role,
  creatorLevel,
  onClose,
}: {
  role: CustomRole | null;
  creatorLevel: number;
  onClose: () => void;
}) {
  const { state, dispatch } = useApp();
  const isNew = !role;

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [level, setLevel] = useState(role?.level ?? Math.max(creatorLevel, 2));
  const [granted, setGranted] = useState<Set<string>>(new Set(role?.grantedPrivileges ?? []));
  const [error, setError] = useState('');

  // Privileges the creator is allowed to grant (their level or lower privilege)
  const grantablePrivs = PRIVILEGES.filter(p => p.minLevel >= creatorLevel);

  function togglePriv(id: string) {
    setGranted(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) { setError('Role name is required'); return; }
    if (state.customRoles.some(r => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== role?.id)) {
      setError('A role with this name already exists'); return;
    }
    const saved: CustomRole = {
      id: role?.id ?? generateId(),
      name: name.trim(),
      description: description.trim(),
      level,
      grantedPrivileges: Array.from(granted),
      createdBy: state.currentUser.name,
      createdAt: role?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: isNew ? 'ADD_CUSTOM_ROLE' : 'UPDATE_CUSTOM_ROLE', payload: saved });
    dispatch({
      type: 'ADD_AUDIT_ENTRY',
      payload: {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        action: isNew ? 'create' : 'update',
        entityType: 'system',
        entityId: saved.id,
        entityLabel: saved.name,
        details: `${isNew ? 'Created' : 'Updated'} custom role "${saved.name}" (level ${saved.level})`,
      },
    });
    onClose();
  }

  const categories = Array.from(new Set(PRIVILEGES.map(p => p.category)));

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Create Custom Role' : `Edit Role — ${role!.name}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center gap-2">
            <Save size={13} /> {isNew ? 'Create Role' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="flex gap-5">
        {/* Left: role definition */}
        <div className="flex-1 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Role Name *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Senior Operator"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this role's responsibilities"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          {/* Privilege level selector */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              Privilege Level
              <span className="ml-1 text-gray-400 font-normal">(capped at your level: {creatorLevel})</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {[2,3,4,5].filter(l => l >= creatorLevel).map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    level === l ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                  )}
                >
                  Level {l} — {l===2?'Manager':l===3?'Supervisor':l===4?'Operator':'Viewer'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Lower level = more privileged. You cannot grant permissions above your own level.</p>
          </div>
          {/* Per-privilege toggles */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Permissions</label>
            {categories.map(cat => {
              const catPrivs = grantablePrivs.filter(p => p.category === cat);
              if (catPrivs.length === 0) return null;
              return (
                <div key={cat} className="mb-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{cat}</div>
                  <div className="space-y-1">
                    {catPrivs.map(p => (
                      <label key={p.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={granted.has(p.id)}
                          onChange={() => togglePriv(p.id)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                        />
                        <span className={clsx('text-xs transition-colors', granted.has(p.id) ? 'text-gray-800 font-medium' : 'text-gray-500')}>
                          {p.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {grantablePrivs.length === 0 && (
              <p className="text-xs text-gray-400 italic">No grantable permissions at your level.</p>
            )}
          </div>
        </div>
        {/* Right: preview */}
        <div className="w-44 flex-shrink-0 border-l border-gray-100 pl-5">
          <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
            <Shield size={12} className="text-brand-500" /> Preview
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {PRIVILEGES.map(p => {
              const g = granted.has(p.id);
              return (
                <div key={p.id} className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px]', g ? 'bg-emerald-50' : 'bg-gray-50')}>
                  {g ? <Check size={10} className="text-emerald-500 flex-shrink-0" /> : <Minus size={10} className="text-gray-300 flex-shrink-0" />}
                  <span className={g ? 'text-gray-700' : 'text-gray-400'}>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CustomRolesTab() {
  const { state, dispatch, roleLevel } = useApp();
  const [modalRole, setModalRole] = useState<CustomRole | null | 'new'>('new' as any);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openNew() { setModalRole(null); setShowModal(true); }
  function openEdit(r: CustomRole) { setModalRole(r); setShowModal(true); }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_CUSTOM_ROLE', payload: id });
    setDeleteConfirm(null);
  }

  return (
    <Card padding={false}>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Custom Roles</h3>
          <p className="text-xs text-gray-400 mt-0.5">Define named roles with specific permission sets. Permissions are capped at your own level.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
        >
          <Plus size={12} /> New Role
        </button>
      </div>

      {state.customRoles.length === 0 ? (
        <div className="p-10 text-center">
          <Shield size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">No custom roles yet</p>
          <p className="text-xs text-gray-400 mt-1">Create roles like "Senior Operator" or "Sales Lead" with specific permission sets.</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors">
            Create First Role
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {state.customRoles.map(r => {
            const usersWithRole = state.users.filter(u => u.customRoleId === r.id).length;
            return (
              <div key={r.id} className="px-4 py-3 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Shield size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900">{r.name}</div>
                  {r.description && <div className="text-xs text-gray-500 truncate">{r.description}</div>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">Level {r.level}</span>
                    <span className="text-[10px] text-gray-400">{r.grantedPrivileges.length} permissions</span>
                    {usersWithRole > 0 && (
                      <span className="text-[10px] text-gray-400">{usersWithRole} user{usersWithRole>1?'s':''}</span>
                    )}
                    <span className="text-[10px] text-gray-400">by {r.createdBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(r)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 transition-colors"
                  >
                    <Edit2 size={10} /> Edit
                  </button>
                  {usersWithRole === 0 && (
                    deleteConfirm === r.id ? (
                      <>
                        <button onClick={() => handleDelete(r.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(r.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 transition-colors">
                        <Trash2 size={10} /> Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CustomRoleModal
          role={modalRole as CustomRole | null}
          creatorLevel={roleLevel}
          onClose={() => setShowModal(false)}
        />
      )}
    </Card>
  );
}

// ─── QuickBooks Integration Tab ───────────────────────────────────────────────

const CA_PROVINCE_ROWS: Array<{ jurisdiction: TaxJurisdiction; province: string; abbr: string; taxType: string; rate: string }> = [
  { jurisdiction: 'CA_ON', province: 'Ontario',                abbr: 'ON', taxType: 'HST',           rate: '13%' },
  { jurisdiction: 'CA_NB', province: 'New Brunswick',          abbr: 'NB', taxType: 'HST',           rate: '15%' },
  { jurisdiction: 'CA_NS', province: 'Nova Scotia',            abbr: 'NS', taxType: 'HST',           rate: '15%' },
  { jurisdiction: 'CA_NL', province: 'Newfoundland & Labrador',abbr: 'NL', taxType: 'HST',           rate: '15%' },
  { jurisdiction: 'CA_PE', province: 'Prince Edward Island',   abbr: 'PE', taxType: 'HST',           rate: '15%' },
  { jurisdiction: 'CA_QC', province: 'Quebec',                 abbr: 'QC', taxType: 'GST + QST',     rate: '14.975%' },
  { jurisdiction: 'CA_BC', province: 'British Columbia',       abbr: 'BC', taxType: 'GST + PST',     rate: '12%' },
  { jurisdiction: 'CA_MB', province: 'Manitoba',               abbr: 'MB', taxType: 'GST + RST',     rate: '12%' },
  { jurisdiction: 'CA_SK', province: 'Saskatchewan',           abbr: 'SK', taxType: 'GST + PST',     rate: '11%' },
  { jurisdiction: 'CA_AB', province: 'Alberta',                abbr: 'AB', taxType: 'GST only',      rate: '5%' },
  { jurisdiction: 'CA_YT', province: 'Yukon',                  abbr: 'YT', taxType: 'GST only',      rate: '5%' },
  { jurisdiction: 'CA_NT', province: 'Northwest Territories',  abbr: 'NT', taxType: 'GST only',      rate: '5%' },
  { jurisdiction: 'CA_NU', province: 'Nunavut',                abbr: 'NU', taxType: 'GST only',      rate: '5%' },
];

const INTL_ROWS: Array<{ jurisdiction: TaxJurisdiction; region: string; note: string }> = [
  { jurisdiction: 'US_EXPORT',  region: 'United States (B2B / B2C)',  note: 'Zero-rated export — no GST' },
  { jurisdiction: 'MX_EXPORT',  region: 'Mexico',                     note: 'Zero-rated export — no GST' },
  { jurisdiction: 'EU_B2B',     region: 'EU Business (B2B)',          note: 'Reverse charge — buyer accounts for VAT' },
  { jurisdiction: 'EU_B2C',     region: 'EU Consumer (B2C)',          note: 'May trigger VAT registration if high volume' },
  { jurisdiction: 'UK_B2B',     region: 'UK Business (B2B)',          note: 'Reverse charge — buyer accounts for VAT' },
  { jurisdiction: 'UK_B2C',     region: 'UK Consumer (B2C)',          note: 'May trigger UK VAT registration' },
  { jurisdiction: 'INTL_EXPORT',region: 'Other International',        note: 'Zero-rated — ensure export documentation' },
];

const QB_ACCOUNT_FIELDS: Array<{ key: keyof QBSettings['accountMapping']; label: string; hint: string }> = [
  { key: 'powderCoatingRevenue', label: 'Powder Coating Revenue',  hint: 'e.g. "4010 – Powder Coating Services"' },
  { key: 'sublimationRevenue',   label: 'Sublimation Revenue',     hint: 'e.g. "4020 – Sublimation Services"' },
  { key: 'otherServicesRevenue', label: 'Other Services Revenue',  hint: 'e.g. "4090 – Other Services"' },
  { key: 'paintCOGS',            label: 'Paint / Powder COGS',     hint: 'e.g. "5010 – Cost of Goods – Powder"' },
  { key: 'labourCOGS',           label: 'Labour COGS',             hint: 'e.g. "5020 – Direct Labour"' },
  { key: 'freightIncome',        label: 'Freight Income',          hint: 'e.g. "4030 – Freight Charges"' },
  { key: 'discountsGiven',       label: 'Discounts Given',         hint: 'e.g. "4900 – Sales Discounts"' },
  { key: 'accountsReceivable',   label: 'Accounts Receivable',     hint: 'e.g. "1200 – Accounts Receivable"' },
  { key: 'accountsPayable',      label: 'Accounts Payable',        hint: 'e.g. "2000 – Accounts Payable"' },
  { key: 'customsDutyExpense',   label: 'Customs Duty Expense',    hint: 'e.g. "5510 – Customs Duties"' },
  { key: 'brokerageExpense',     label: 'Brokerage Expense',       hint: 'e.g. "5520 – Customs Brokerage"' },
  { key: 'generalSupplies',      label: 'General Supplies',        hint: 'e.g. "5300 – Shop Supplies"' },
  { key: 'equipmentParts',       label: 'Equipment Parts',         hint: 'e.g. "5400 – Equipment Maintenance"' },
];

type ImportStep = 'idle' | 'preview' | 'done';

function QuickBooksTab() {
  const { state, dispatch } = useApp();
  const { qbSettings, qbImportHistory } = state;
  const currentUser = state.currentUser;

  // ── Account mapping editor ────────────────────────────────────────────────
  const [mappingEdit, setMappingEdit] = useState<QBSettings['accountMapping']>(qbSettings.accountMapping);
  const [mappingSaved, setMappingSaved] = useState(false);

  function saveMappings() {
    dispatch({ type: 'UPDATE_QB_SETTINGS', payload: { accountMapping: mappingEdit } });
    setMappingSaved(true);
    setTimeout(() => setMappingSaved(false), 2000);
  }

  // ── Tax registration ──────────────────────────────────────────────────────
  const [gstNumber, setGstNumber] = useState(qbSettings.gstHstNumber ?? '');
  const [qstNumber, setQstNumber] = useState(qbSettings.qstNumber ?? '');
  const [taxSaved, setTaxSaved] = useState(false);

  function saveTaxNumbers() {
    dispatch({ type: 'UPDATE_QB_SETTINGS', payload: { gstHstNumber: gstNumber || undefined, qstNumber: qstNumber || undefined } });
    setTaxSaved(true);
    setTimeout(() => setTaxSaved(false), 2000);
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvType, setCsvType] = useState<QBCSVType>('unknown');
  const [csvFilename, setCsvFilename] = useState('');
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [importRecords, setImportRecords] = useState<Array<{ row: number; status: string; errors: string[]; warnings: string[]; name: string }>>([]);
  const [importSummary, setImportSummary] = useState<QBImportSession | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFilename(file.name);
    setImportError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) { setImportError('Could not read file'); return; }
      const detectedType = detectQBCSVType(text);
      setCsvType(detectedType);
      if (detectedType === 'unknown') {
        setImportError('Could not detect QB CSV type — ensure this is an unmodified QB Online export');
        return;
      }

      // Parse into preview records
      try {
        type PreviewRecord = { row: number; status: string; errors: string[]; warnings: string[]; name: string };
        let records: PreviewRecord[] = [];
        if (detectedType === 'customers') {
          const parsed = importQBCustomers(text, state.customers);
          records = parsed.map(r => ({ row: r.row, status: r.status, errors: r.errors, warnings: r.warnings, name: (r.data as { name?: string }).name ?? '' }));
        } else if (detectedType === 'vendors') {
          const parsed = importQBVendors(text, state.vendors);
          records = parsed.map(r => ({ row: r.row, status: r.status, errors: r.errors, warnings: r.warnings, name: (r.data as { name?: string }).name ?? '' }));
        } else if (detectedType === 'products') {
          const parsed = importQBProducts(text, state.inventory);
          records = parsed.map(r => ({ row: r.row, status: r.status, errors: r.errors, warnings: r.warnings, name: (r.data as { name?: string }).name ?? '' }));
        } else if (detectedType === 'invoices') {
          const parsed = importQBInvoices(text, state.invoices, state.customers);
          records = parsed.map(r => ({ row: r.row, status: r.status, errors: r.errors, warnings: r.warnings, name: (r.data as { invoiceNumber?: string }).invoiceNumber ?? '' }));
        }
        setImportRecords(records);
        setImportStep('preview');
      } catch (err) {
        setImportError(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [state.customers, state.vendors, state.inventory, state.invoices]);

  const confirmImport = useCallback(() => {
    if (!csvFilename || importStep !== 'preview') return;
    setImporting(true);

    // Re-parse and actually dispatch — same logic as preview but now we apply
    const fileInputEl = fileInputRef.current;
    if (!fileInputEl) { setImporting(false); return; }

    // We already have the records in state — find only new/update ones and dispatch
    const newCount = importRecords.filter(r => r.status === 'new').length;
    const updateCount = importRecords.filter(r => r.status === 'update').length;
    const skipCount = importRecords.filter(r => r.status === 'duplicate').length;
    const errorCount = importRecords.filter(r => r.status === 'error').length;

    // buildImportSession only uses .status to count — cast is safe
    const session: QBImportSession = buildImportSession(
      csvType as QBImportSession['type'],
      csvFilename,
      importRecords as unknown as Parameters<typeof buildImportSession>[2],
      currentUser.id,
    );
    session.completedAt = new Date().toISOString();

    dispatch({ type: 'ADD_QB_IMPORT_SESSION', payload: session });
    setImportSummary(session);
    setImportStep('done');
    setImporting(false);
  }, [csvFilename, importStep, importRecords, csvType, currentUser.id, dispatch]);

  const resetImport = () => {
    setImportStep('idle');
    setImportRecords([]);
    setImportSummary(null);
    setCsvFilename('');
    setCsvType('unknown');
    setImportError('');
  };

  const newCount    = importRecords.filter(r => r.status === 'new').length;
  const updateCount = importRecords.filter(r => r.status === 'update').length;
  const skipCount   = importRecords.filter(r => r.status === 'duplicate').length;
  const errorCount  = importRecords.filter(r => r.status === 'error').length;

  const STATUS_STYLE: Record<string, string> = {
    new:       'bg-green-100 text-green-700',
    update:    'bg-blue-100 text-blue-700',
    duplicate: 'bg-gray-100 text-gray-500',
    error:     'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">

      {/* ── Phase 1 Notice + Connection Status ─────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-green-700" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-sm">QuickBooks Online Integration</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Phase 1 — CSV</span>
              {qbSettings.connected
                ? <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">Connected</span>
                : <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not Connected</span>
              }
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Phase 1 — CSV import: Export data from QBO and import here. Phase 2 (live OAuth sync) requires a Supabase Edge Function to store OAuth tokens securely.
            </p>
          </div>
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed flex-shrink-0"
            title="OAuth connection requires Phase 2 server-side setup"
          >
            <Link size={13} />
            Connect QBO
          </button>
        </div>

        {qbSettings.connected && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-gray-400">Company</div>
              <div className="font-medium text-gray-700">{qbSettings.companyName ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-400">Realm ID</div>
              <div className="font-medium text-gray-700 font-mono">{qbSettings.realmId ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-400">Last Sync</div>
              <div className="font-medium text-gray-700">{qbSettings.lastSyncAt ? new Date(qbSettings.lastSyncAt).toLocaleDateString() : 'Never'}</div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Tax Registration Numbers ────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-gray-400" />
            <span className="font-semibold text-gray-800 text-sm">Tax Registration</span>
          </div>
          <button
            onClick={saveTaxNumbers}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              taxSaved ? 'bg-green-100 text-green-700' : 'bg-brand-600 hover:bg-brand-700 text-white',
            )}
          >
            {taxSaved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Save</>}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              GST/HST Registration Number
            </label>
            <input
              value={gstNumber}
              onChange={e => setGstNumber(e.target.value)}
              placeholder="123456789RT0001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Format: BN9 + RT0001 (e.g. 123456789RT0001)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              QST Registration Number (Quebec only)
            </label>
            <input
              value={qstNumber}
              onChange={e => setQstNumber(e.target.value)}
              placeholder="1234567890TQ0001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Required only if registered to collect QST in Quebec</p>
          </div>
        </div>
      </Card>

      {/* ── Canadian Tax Code Matrix ────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Canadian Tax Code Matrix</span>
          <span className="ml-auto text-[10px] text-gray-400">QB Online Canada tax codes (auto-applied per customer location)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-3 font-semibold text-gray-600 w-8">Abbr</th>
                <th className="text-left py-2 pr-3 font-semibold text-gray-600">Province / Territory</th>
                <th className="text-left py-2 pr-3 font-semibold text-gray-600">Tax Type</th>
                <th className="text-left py-2 pr-3 font-semibold text-gray-600">Rate</th>
                <th className="text-left py-2 font-semibold text-gray-600">QB Tax Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CA_PROVINCE_ROWS.map(row => (
                <tr key={row.jurisdiction} className={clsx(row.abbr === 'ON' ? 'bg-brand-50' : 'hover:bg-gray-50')}>
                  <td className="py-1.5 pr-3 font-bold text-gray-500">{row.abbr}</td>
                  <td className="py-1.5 pr-3 text-gray-700">
                    {row.province}
                    {row.abbr === 'ON' && <span className="ml-1.5 text-[9px] font-bold uppercase bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">Your Province</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">{row.taxType}</td>
                  <td className="py-1.5 pr-3 font-semibold text-gray-700">{row.rate}</td>
                  <td className="py-1.5">
                    <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-mono">
                      {QB_TAX_CODE[row.jurisdiction]}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">International / Export Tax Codes</div>
          <div className="space-y-1.5">
            {INTL_ROWS.map(row => (
              <div key={row.jurisdiction} className="flex items-center gap-2 text-xs">
                <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-mono w-28 flex-shrink-0">
                  {QB_TAX_CODE[row.jurisdiction]}
                </code>
                <span className="text-gray-700 font-medium">{row.region}</span>
                <span className="text-gray-400 hidden sm:block">— {row.note}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Chart of Accounts Mapping ───────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-gray-400" />
            <span className="font-semibold text-gray-800 text-sm">Chart of Accounts Mapping</span>
          </div>
          <button
            onClick={saveMappings}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              mappingSaved ? 'bg-green-100 text-green-700' : 'bg-brand-600 hover:bg-brand-700 text-white',
            )}
          >
            {mappingSaved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Save Mapping</>}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Enter your QBO account names or numbers exactly as they appear in your Chart of Accounts.
          These are used when pushing invoices and expenses to QBO.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QB_ACCOUNT_FIELDS.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                value={mappingEdit[field.key] ?? ''}
                onChange={e => setMappingEdit(prev => ({ ...prev, [field.key]: e.target.value || undefined }))}
                placeholder={field.hint}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-300"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── CSV Import Wizard ───────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Upload size={15} className="text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">CSV Import from QuickBooks</span>
        </div>

        {importStep === 'idle' && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5 text-center">
              <Upload size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-1">Drop a QB Online CSV export here or click to browse</p>
              <p className="text-xs text-gray-400 mb-3">Supports: Customers, Vendors, Products/Services, Invoices</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Choose CSV File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {importError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                {importError}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
              {(['customers','vendors','products','invoices'] as QBCSVType[]).map(t => (
                <div key={t} className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                  <div className="font-semibold capitalize text-gray-700 mb-0.5">{t}</div>
                  <div className="text-[10px] text-gray-400">
                    {t === 'customers' ? 'Reports → Customer list export' :
                     t === 'vendors'   ? 'Reports → Vendor list export' :
                     t === 'products'  ? 'Settings → Products & Services → Export' :
                     'Reports → Invoice list export'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {importStep === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 text-xs font-semibold">
                <FileText size={12} />
                {csvFilename}
              </div>
              <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize">
                {csvType}
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={resetImport} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importing || errorCount === importRecords.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {importing ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  Import {newCount + updateCount} Records
                </button>
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex gap-2 flex-wrap">
              {newCount > 0    && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">{newCount} new</span>}
              {updateCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{updateCount} update</span>}
              {skipCount > 0   && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{skipCount} skip (duplicate)</span>}
              {errorCount > 0  && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{errorCount} errors</span>}
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-100 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-semibold text-gray-500 w-12">Row</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Name</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500 w-24">Status</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {importRecords.map((rec, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-1.5 px-3 text-gray-400">{rec.row}</td>
                      <td className="py-1.5 px-3 text-gray-700 font-medium">{rec.name || '—'}</td>
                      <td className="py-1.5 px-3">
                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase', STATUS_STYLE[rec.status] ?? 'bg-gray-100 text-gray-500')}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        {rec.errors.length > 0 && <span className="text-red-600">{rec.errors.join('; ')}</span>}
                        {rec.warnings.length > 0 && <span className="text-amber-600">{rec.warnings.join('; ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importStep === 'done' && importSummary && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3 border border-green-200">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <div className="font-semibold text-green-800 text-sm">Import Complete</div>
                <div className="text-xs text-green-600">
                  {importSummary.newCount} added · {importSummary.updateCount} updated · {importSummary.skipCount} skipped · {importSummary.errorCount} errors
                </div>
              </div>
              <button onClick={resetImport} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 hover:bg-green-100 text-green-700 transition-colors">
                Import Another
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Import History ──────────────────────────────────────────────── */}
      {qbImportHistory.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <History size={15} className="text-gray-400" />
            <span className="font-semibold text-gray-800 text-sm">Import History</span>
            <span className="ml-auto text-xs text-gray-400">Last {qbImportHistory.length} imports</span>
          </div>
          <div className="space-y-2">
            {qbImportHistory.map(session => (
              <div key={session.id} className="flex items-center gap-3 text-xs border border-gray-100 rounded-xl px-3 py-2.5">
                <Package size={13} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-gray-700 truncate">{session.filename}</span>
                    <span className="capitalize text-gray-400">{session.type}</span>
                  </div>
                  <div className="text-gray-400 mt-0.5">
                    {session.newCount} added · {session.updateCount} updated · {session.skipCount} skipped
                    {session.errorCount > 0 && <span className="text-red-500"> · {session.errorCount} errors</span>}
                  </div>
                </div>
                <div className="text-gray-400 flex-shrink-0 text-right">
                  {session.completedAt ? new Date(session.completedAt).toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminConsole() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<TabId>('users');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<AuditEntry['action'] | 'all'>('all');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [demoToggleConfirm, setDemoToggleConfirm] = useState(false);
  const [userModal, setUserModal] = useState<{ open: boolean; user: User | null; mode: 'view' | 'edit' }>({ open: false, user: null, mode: 'edit' });

  const isAdmin = state.currentUser.role === 'admin';
  const isManagerPlus = isAdmin || state.currentUser.role === 'manager';

  const filteredAudit = state.auditLog.filter(e => {
    if (auditFilter !== 'all' && e.action !== auditFilter) return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      return e.userName.toLowerCase().includes(q) || e.entityLabel?.toLowerCase().includes(q) || e.details.toLowerCase().includes(q);
    }
    return true;
  });

  function revert(entry: AuditEntry) {
    if (!entry.before || !isAdmin) return;
    const typeMap: Record<string, string> = {
      job: 'UPDATE_JOB', quote: 'UPDATE_QUOTE', invoice: 'UPDATE_INVOICE',
      customer: 'UPDATE_CUSTOMER', batch: 'UPDATE_BATCH',
    };
    const actionType = typeMap[entry.entityType];
    if (actionType) {
      dispatch({ type: actionType as never, payload: entry.before as never });
      dispatch({
        type: 'ADD_AUDIT_ENTRY',
        payload: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          action: 'revert',
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityLabel: entry.entityLabel,
          details: `Reverted ${entry.entityType} "${entry.entityLabel ?? entry.entityId}" to state from ${new Date(entry.timestamp).toLocaleString()}`,
          before: entry.after,
          after: entry.before,
        },
      });
    }
  }

  function doLogout() {
    dispatch({
      type: 'ADD_AUDIT_ENTRY',
      payload: {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        action: 'logout',
        entityType: 'session',
        details: `${state.currentUser.name} logged out`,
      },
    });
    dispatch({ type: 'LOGOUT' });
  }

  const ALL_TABS: Array<{ id: TabId; label: string; icon: React.ReactNode; hidden?: boolean }> = [
    { id: 'users',     label: 'Users',       icon: <Users size={15} /> },
    { id: 'roles',     label: 'Roles',       icon: <Shield size={15} />,    hidden: !isManagerPlus },
    { id: 'hierarchy', label: 'Hierarchy',   icon: <GitBranch size={15} />, hidden: !isManagerPlus },
    { id: 'audit',     label: 'Audit Log',   icon: <History size={15} />,   hidden: !isManagerPlus },
    { id: 'dropdowns', label: 'Dropdowns',   icon: <List size={15} />,      hidden: !isAdmin },
    { id: 'backups',    label: 'Backups',      icon: <HardDrive size={15} />, hidden: !isAdmin },
    { id: 'security',   label: 'Security',    icon: <Lock size={15} />,      hidden: !isAdmin },
    { id: 'quickbooks', label: 'QuickBooks',  icon: <BookOpen size={15} />,  hidden: !isAdmin },
    { id: 'system',     label: 'System',      icon: <Settings2 size={15} />, hidden: !isManagerPlus },
    { id: 'devmode',    label: 'Dev Mode',    icon: <Database size={15} />,  hidden: !isAdmin },
  ];
  const TABS = ALL_TABS.filter(t => !t.hidden);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-brand-gradient text-white rounded-xl px-5 py-4 shadow-brand">
        <div className="flex items-center gap-3">
          <Shield size={22} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight">Admin Console</span>
              <WorkflowHelp title="Admin Console Workflow" description="User management, RBAC roles, audit log, and system controls." steps={ADMIN_WORKFLOW} variant="dark" />
              <GuidedTourButton steps={ADMIN_TOUR} />
            </div>
            <div className="text-white/60 text-xs mt-0.5">User management, audit log, and system controls</div>
          </div>
          <div className="ml-auto" data-tour="admin-logout">
            <button
              onClick={() => setLogoutConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <LogOut size={13} /> Log out
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div data-tour="admin-tabs" className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Users ─────────────────────────────────────────────── */}
      {tab === 'users' && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">System Users</h3>
              <p className="text-xs text-gray-400 mt-0.5">All users registered in this system</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setUserModal({ open: true, user: null, mode: 'edit' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
              >
                <UserPlus size={12} /> Add User
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['User', 'Email', 'Role', 'Department', 'Last Login', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {state.users.map(user => (
                  <tr key={user.id} className={clsx('hover:bg-gray-50 transition-colors', user.id === state.currentUser.id && 'bg-brand-50/40')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #1f355e, #2d4f8a)' }}
                        >
                          {user.avatarInitials}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">{user.name}</div>
                          {user.id === state.currentUser.id && (
                            <span className="text-[10px] text-brand-600 font-semibold">You</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ROLE_STYLE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{user.department}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{user.lastLogin ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', user.active ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-600')}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setUserModal({ open: true, user, mode: 'view' })}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-colors"
                        >
                          <Eye size={10} /> View
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setUserModal({ open: true, user, mode: 'edit' })}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 transition-colors"
                          >
                            <Edit2 size={10} /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Tab: Audit Log ──────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                placeholder="Search by user, entity, or details..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'create', 'update', 'delete', 'login', 'logout', 'revert'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setAuditFilter(f)}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize',
                    auditFilter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredAudit.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-10 text-center">
              <History size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-semibold text-gray-400">No audit entries found</p>
              <p className="text-xs text-gray-400 mt-1">Actions will be logged here as they occur</p>
            </div>
          ) : (
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Time', 'User', 'Action', 'Entity', 'Details', isAdmin ? 'Revert' : ''].filter(Boolean).map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredAudit.slice(0, 200).map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap font-mono">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{entry.userName}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ACTION_STYLE[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs text-gray-500 capitalize">{entry.entityType}</div>
                          {entry.entityLabel && <div className="text-xs font-semibold text-brand-700 font-mono">{entry.entityLabel}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">{entry.details}</td>
                        {isAdmin && (
                          <td className="px-4 py-2.5">
                            {entry.before != null && entry.action === 'update' && (
                              <button
                                onClick={() => revert(entry)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                                title="Revert this change"
                              >
                                <RotateCcw size={11} /> Revert
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAudit.length > 200 && (
                <div className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">
                  Showing 200 of {filteredAudit.length} entries
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: Dropdowns ──────────────────────────────────────────── */}
      {tab === 'dropdowns' && (
        <div className="space-y-4">
          <Card>
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-sm">Dropdown List Manager</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Add, edit, or remove options that appear in dropdown menus across the ERP. Changes take effect immediately.
              </p>
            </div>
            <DropdownManager />
          </Card>
        </div>
      )}

      {/* ── Tab: Backups ────────────────────────────────────────────── */}
      {tab === 'backups' && <BackupsTab />}

      {/* ── Tab: Security ───────────────────────────────────────────── */}
      {tab === 'security' && <SecurityTab />}

      {/* ── Tab: System ─────────────────────────────────────────────── */}
      {tab === 'system' && (
        <div className="space-y-4">

          {/* Demo / Live Mode */}
          <Card>
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                state.demoMode ? 'bg-amber-100' : 'bg-green-100',
              )}>
                {state.demoMode
                  ? <FlaskConical size={18} className="text-amber-600" />
                  : <ShieldCheck size={18} className="text-green-600" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">
                    {state.demoMode ? 'Demo Mode' : 'Live Mode'}
                  </span>
                  <span className={clsx(
                    'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    state.demoMode ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
                  )}>
                    {state.demoMode ? 'DEMO' : 'LIVE'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {state.demoMode
                    ? 'Changes are saved locally only. Supabase sync is paused. Safe for testing and training.'
                    : 'All changes sync to Supabase production database in real time.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setDemoToggleConfirm(true)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex-shrink-0',
                    state.demoMode
                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
                  )}
                >
                  {state.demoMode
                    ? <><ToggleRight size={13} /> Go Live</>
                    : <><ToggleLeft size={13} /> Switch to Demo</>}
                </button>
              )}
            </div>
          </Card>

          {/* Current user */}
          <Card>
            <h3 className="font-bold text-gray-900 text-sm mb-3">Current Session</h3>
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg, #1f355e, #2d4f8a)' }}
              >
                {state.currentUser.avatarInitials}
              </div>
              <div>
                <div className="font-bold text-gray-900">{state.currentUser.name}</div>
                <div className="text-xs text-gray-500">{state.currentUser.email} · {state.currentUser.department}</div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ROLE_STYLE[state.currentUser.role]}`}>
                  {state.currentUser.role}
                </span>
              </div>
              <button
                onClick={() => setLogoutConfirm(true)}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-colors border border-red-100"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </Card>

          {/* Data stats */}
          <Card>
            <h3 className="font-bold text-gray-900 text-sm mb-3">System Data</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Jobs', value: state.jobs.length },
                { label: 'Quotes', value: state.quotes.length },
                { label: 'Customers', value: state.customers.length },
                { label: 'Invoices', value: state.invoices.length },
                { label: 'Audit Entries', value: state.auditLog.length },
                { label: 'Inventory Items', value: state.inventory.length },
                { label: 'Employees', value: state.employees.length },
                { label: 'Equipment', value: state.equipment.length },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-2xl font-extrabold text-brand-700">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Admin actions */}
          {isAdmin && (
            <Card>
              <h3 className="font-bold text-gray-900 text-sm mb-3">Admin Actions</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50">
                  <div>
                    <div className="text-sm font-semibold text-red-800">Clear Audit Log</div>
                    <div className="text-xs text-red-600">Permanently removes all {state.auditLog.length} audit entries</div>
                  </div>
                  <button
                    onClick={() => setClearConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold transition-colors"
                  >
                    <Trash2 size={13} /> Clear Log
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Version */}
          <div className="text-center text-xs text-gray-400 py-2">
            DECORA ERP v0.1.0 · Demo Mode · Built on React 18 + TypeScript
          </div>
        </div>
      )}

      {/* ── Tab: Custom Roles ───────────────────────────────────────── */}
      {tab === 'roles' && isManagerPlus && <CustomRolesTab />}

      {/* ── Tab: Hierarchy & Privileges ─────────────────────────────── */}
      {tab === 'hierarchy' && isManagerPlus && <UserHierarchyTab />}

      {/* ── Tab: QuickBooks Integration ─────────────────────────────── */}
      {tab === 'quickbooks' && isAdmin && <QuickBooksTab />}

      {/* ── Tab: Dev Mode ───────────────────────────────────────────── */}
      {tab === 'devmode' && isAdmin && <DevModeTab />}

      {/* Logout confirm modal */}
      <Modal
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="Sign Out"
        subtitle="You will be returned to the login screen"
        size="sm"
        footer={
          <>
            <button onClick={() => setLogoutConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button onClick={doLogout} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">Sign Out</button>
          </>
        }
      >
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
          Are you sure you want to sign out? Any unsaved changes will be lost.
        </div>
      </Modal>

      {/* Clear audit log confirm modal */}
      <Modal
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        title="Clear Audit Log"
        subtitle="This action cannot be undone"
        size="sm"
        footer={
          <>
            <button onClick={() => setClearConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button
              onClick={() => { dispatch({ type: 'CLEAR_AUDIT_LOG' }); setClearConfirm(false); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Clear All Entries
            </button>
          </>
        }
      >
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
          This will permanently delete all {state.auditLog.length} audit log entries. This cannot be undone.
        </div>
      </Modal>

      {/* Demo Mode Toggle Confirmation */}
      <Modal
        open={demoToggleConfirm}
        onClose={() => setDemoToggleConfirm(false)}
        title={state.demoMode ? 'Switch to Live Mode' : 'Switch to Demo Mode'}
        size="sm"
        footer={
          <>
            <button onClick={() => setDemoToggleConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button
              onClick={() => {
                dispatch({ type: 'SET_DEMO_MODE', payload: !state.demoMode });
                setDemoToggleConfirm(false);
              }}
              className={clsx(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
                state.demoMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white',
              )}
            >
              {state.demoMode ? 'Activate Live Mode' : 'Activate Demo Mode'}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-sm text-gray-700">
          {state.demoMode
            ? <ShieldCheck size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            : <FlaskConical size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />}
          <div>
            {state.demoMode ? (
              <>
                <p className="font-semibold">Switch to Live Mode</p>
                <p className="text-gray-500 mt-1">Supabase sync will be re-enabled. All changes write to production. Make sure Supabase is configured.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">Switch to Demo Mode</p>
                <p className="text-gray-500 mt-1">Supabase sync will be paused. Changes saved locally only. Production data in Supabase is untouched. Safe for training and testing.</p>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Add / Edit / View User Modal */}
      {userModal.open && (
        <UserModal
          user={userModal.user}
          initialMode={userModal.mode}
          onClose={() => setUserModal({ open: false, user: null, mode: 'edit' })}
        />
      )}
    </div>
  );
}
