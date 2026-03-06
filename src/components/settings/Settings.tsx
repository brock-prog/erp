import React, { useState, useRef } from 'react';
import { Shield, Users, Building2, Bell, Database, Lock, Save, Download, Upload, HardDrive, Cloud, AlertTriangle, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const SETTINGS_TOUR: TourStep[] = [
  { selector: '[data-tour="settings-tabs"]',    title: 'Settings Tabs',      why: 'Company info, user accounts, security policies, notification preferences, and data management.',   what: 'Click each tab to configure that area. Changes are saved when you click the Save button.' },
  { selector: '[data-tour="settings-content"]', title: 'Configuration Area', why: 'Each tab has forms and toggles for that settings category.',                                       what: 'Fill in your company details, adjust defaults, and review security policies here.' },
];

export function Settings() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState('company');
  const [saved, setSaved] = useState(false);

  const [company, setCompany] = useState({
    name: 'CoatPro Job Shop', phone: '555-0100', email: 'info@coatpro.com',
    address: '1200 Industrial Blvd', city: 'Detroit', state: 'MI', zip: '48201',
    defaultTaxRate: 6, paymentTerms: 'Net 30', currency: 'USD',
  });

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data', icon: Database },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <GuidedTourButton steps={SETTINGS_TOUR} />
      </div>
      <div data-tour="settings-tabs" className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 max-w-xl">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-1 justify-center
              ${activeTab === tab.id ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div data-tour="settings-content">
      {activeTab === 'company' && (
        <Card>
          <CardHeader title="Company Settings" subtitle="Basic company information and defaults" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company Name" value={company.name} onChange={e => setCompany(c=>({...c,name:e.target.value}))} />
            <Input label="Phone" value={company.phone} onChange={e => setCompany(c=>({...c,phone:e.target.value}))} />
            <Input label="Email" value={company.email} onChange={e => setCompany(c=>({...c,email:e.target.value}))} />
            <Select label="Default Payment Terms" value={company.paymentTerms} onChange={e => setCompany(c=>({...c,paymentTerms:e.target.value}))}>
              <option>COD</option><option>Net 15</option><option>Net 30</option><option>Net 45</option>
            </Select>
            <Input label="Default Tax Rate (%)" type="number" value={company.defaultTaxRate} onChange={e => setCompany(c=>({...c,defaultTaxRate:Number(e.target.value)}))} />
            <Input label="Street Address" value={company.address} onChange={e => setCompany(c=>({...c,address:e.target.value}))} />
            <Input label="City" value={company.city} onChange={e => setCompany(c=>({...c,city:e.target.value}))} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="State" value={company.state} onChange={e => setCompany(c=>({...c,state:e.target.value}))} />
              <Input label="ZIP" value={company.zip} onChange={e => setCompany(c=>({...c,zip:e.target.value}))} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} icon={<Save size={14} />}>{saved ? 'Saved!' : 'Save Changes'}</Button>
          </div>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100">
            <CardHeader title="User Management" subtitle="Manage staff access and roles" />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['User','Email','Department','Role','Status','Last Login'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {state.users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.avatarInitials}
                      </div>
                      <span className="font-medium text-gray-900 text-xs">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{user.email}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{user.department}</td>
                  <td className="px-4 py-3">
                    <Badge className={{
                      admin: 'bg-red-100 text-red-700',
                      manager: 'bg-purple-100 text-purple-700',
                      operator: 'bg-blue-100 text-blue-700',
                      sales: 'bg-green-100 text-green-700',
                      viewer: 'bg-gray-100 text-gray-600',
                    }[user.role] ?? 'bg-gray-100 text-gray-600'}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{user.lastLogin ?? 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Security Settings" subtitle="Authentication and access controls" />
            <div className="space-y-4">
              {[
                { label: 'Two-Factor Authentication', desc: 'Require 2FA for all admin users', enabled: true },
                { label: 'Session Timeout', desc: 'Auto-logout after 8 hours of inactivity', enabled: true },
                { label: 'IP Allowlist', desc: 'Restrict access to specific IP ranges', enabled: false },
                { label: 'Audit Logging', desc: 'Log all user actions for compliance', enabled: true },
                { label: 'Password Policy', desc: 'Enforce strong passwords (12+ chars, complexity)', enabled: true },
              ].map(setting => (
                <div key={setting.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{setting.label}</div>
                    <div className="text-xs text-gray-500">{setting.desc}</div>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors flex items-center cursor-pointer ${setting.enabled ? 'bg-brand-600' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${setting.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Lock size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-800">
                <div className="font-semibold">SSL/TLS Encryption Active</div>
                <div className="text-xs mt-0.5">All data is transmitted over HTTPS. Certficate valid through 2027.</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <CardHeader title="Notification Preferences" subtitle="Configure alerts and notifications" />
          <div className="space-y-3">
            {[
              { label: 'Rush Job Alerts', desc: 'Notify when a rush job is created or due within 24h' },
              { label: 'QC Failures', desc: 'Alert production manager on failed inspections' },
              { label: 'Low Inventory', desc: 'Alert when items fall below reorder point' },
              { label: 'Overdue Jobs', desc: 'Daily digest of overdue work orders' },
              { label: 'Invoice Overdue', desc: 'Alert when invoices are past due date' },
              { label: 'Equipment Maintenance', desc: 'Remind when maintenance is due within 7 days' },
              { label: 'New Quote Approved', desc: 'Notify sales when customer approves a quote' },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">{n.label}</div>
                  <div className="text-xs text-gray-500">{n.desc}</div>
                </div>
                <div className="w-10 h-5 rounded-full bg-brand-600 flex items-center cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm translate-x-5 mx-0.5" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'data' && (
        <DataManagement state={state} />
      )}
      </div>
    </div>
  );
}

// ─── Data Management Component ────────────────────────────────────────────────

function DataManagement({ state }: { state: ReturnType<typeof useApp>['state'] }) {
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportFullBackup() {
    const { currentUser, sidebarOpen, notifications, ...data } = state as unknown as Record<string, unknown>;
    void currentUser; void sidebarOpen; void notifications;
    const payload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: 'CoatPro ERP',
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coatpro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLastBackup(new Date().toLocaleString());
  }

  function exportCSV(key: string, label: string) {
    const records = (state as unknown as Record<string, unknown>)[key];
    if (!Array.isArray(records) || records.length === 0) return;
    const headers = Object.keys(records[0] as object);
    const rows = records.map((r: Record<string, unknown>) =>
      headers.map(h => {
        const v = r[h];
        if (typeof v === 'object' && v !== null) return JSON.stringify(v).replace(/"/g, '""');
        return String(v ?? '');
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coatpro-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        if (payload.version && payload.data) {
          localStorage.setItem('coatpro_erp_state_v2', JSON.stringify(payload.data));
          setImportStatus('success');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setImportStatus('error');
        }
      } catch {
        setImportStatus('error');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  const CSV_EXPORTS = [
    { key: 'jobs', label: 'jobs', display: 'Jobs / Work Orders' },
    { key: 'customers', label: 'customers', display: 'Customers' },
    { key: 'invoices', label: 'invoices', display: 'Invoices' },
    { key: 'inventory', label: 'inventory', display: 'Inventory' },
    { key: 'quotes', label: 'quotes', display: 'Quotes' },
    { key: 'receipts', label: 'receipts', display: 'Receiving Records' },
    { key: 'shipments', label: 'shipments', display: 'Shipments' },
    { key: 'maintenanceTasks', label: 'maintenance', display: 'Maintenance Tasks' },
    { key: 'employees', label: 'employees', display: 'Employee Records' },
    { key: 'attendanceRecords', label: 'attendance', display: 'Attendance Records' },
    { key: 'trainingRecords', label: 'training', display: 'Training Records' },
    { key: 'spareParts', label: 'spare-parts', display: 'Spare Parts' },
    { key: 'ncrs', label: 'ncrs', display: 'NCR Reports' },
  ];

  return (
    <div className="space-y-4">
      {/* Full Backup */}
      <Card>
        <CardHeader title="Full Data Backup" subtitle="Export all ERP data as a structured JSON file — save to SSD or upload to cloud storage" />
        <div className="flex items-center gap-4 mt-2">
          <Button onClick={exportFullBackup} icon={<Download size={15} />}>
            Download Full Backup (.json)
          </Button>
          <div className="text-xs text-gray-500">
            {lastBackup ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> Last backup: {lastBackup}</span> : 'No backup downloaded this session'}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: <HardDrive size={16} className="text-blue-600" />, title: 'SSD / Local Drive', desc: 'Save the .json backup file to an external SSD or local network drive. Recommended: daily backup scheduled task.' },
            { icon: <Cloud size={16} className="text-purple-600" />, title: 'Cloud Storage', desc: 'Upload backup to Google Drive, Dropbox, OneDrive, or AWS S3. Enable encryption at rest (AES-256) on your cloud storage provider.' },
            { icon: <Shield size={16} className="text-green-600" />, title: 'Backup Security', desc: 'Backup files contain sensitive business data. Password-protect archives. Restrict cloud folder access to authorized personnel only.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
              <div>
                <div className="text-xs font-semibold text-gray-700">{item.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Import / Restore */}
      <Card>
        <CardHeader title="Restore from Backup" subtitle="Import a previously exported .json backup file to restore all data" />
        <div className="flex items-center gap-4 mt-2">
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" id="import-file" />
          <label
            htmlFor="import-file"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer shadow-sm"
          >
            <Upload size={15} />
            Choose Backup File (.json)
          </label>
          {importStatus === 'success' && (
            <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle size={14} /> Restored! Reloading…</span>
          )}
          {importStatus === 'error' && (
            <span className="text-red-600 text-sm flex items-center gap-1"><AlertTriangle size={14} /> Invalid backup file.</span>
          )}
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          Restoring a backup will overwrite all current data. This cannot be undone. Download a current backup first.
        </div>
      </Card>

      {/* CSV Exports */}
      <Card>
        <CardHeader title="CSV Data Exports" subtitle="Export individual data sets for Excel, reporting, or third-party integrations" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {CSV_EXPORTS.map(ex => (
            <button
              key={ex.key}
              onClick={() => exportCSV(ex.key, ex.label)}
              className="flex items-center gap-2 p-2.5 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 transition-colors text-left"
            >
              <Database size={13} className="text-gray-400 flex-shrink-0" />
              {ex.display}
            </button>
          ))}
        </div>
      </Card>

      {/* Backup Schedule Guidance */}
      <Card>
        <CardHeader title="Recommended Backup Schedule" subtitle="Best practices for production deployments" />
        <div className="space-y-2 mt-1">
          {[
            { freq: 'Daily', desc: 'Automated nightly full backup → encrypted SSD + cloud', color: 'text-green-600' },
            { freq: 'Weekly', desc: 'Full backup retained for 4 weeks', color: 'text-blue-600' },
            { freq: 'Monthly', desc: 'Archive backup retained for 12 months', color: 'text-purple-600' },
            { freq: 'Annually', desc: 'Year-end archive retained indefinitely (offline cold storage)', color: 'text-gray-600' },
          ].map(r => (
            <div key={r.freq} className="flex items-start gap-3 text-sm p-2.5 bg-gray-50 rounded-lg">
              <span className={`font-semibold w-20 flex-shrink-0 ${r.color}`}>{r.freq}</span>
              <span className="text-gray-600">{r.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
