import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Building2, Mail, Phone, ChevronRight, DollarSign, Briefcase, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { formatCurrency, formatDate, generateId, clsx, jobStatusConfig } from '../../utils';
import {
  COUNTRIES, getStateProvinceOptions, getStateProvinceLabel, getZipLabel, formatPostalCode,
} from '../../utils/taxUtils';
import type { Customer, CustomerType, CustomerCurrency } from '../../types';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const CUSTOMERS_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🤝', label: 'New Customer Added',
    description: 'Click "New Customer" — enter company name, type, credit limit, and add contacts.' },
  { type: 'action', icon: '👤', label: 'Manage Contacts',
    description: 'Add multiple contacts per customer. Mark one as Primary — used for emails and combobox search.' },
  { type: 'action', icon: '🎯', label: 'Link to CRM',
    description: 'Create CRM opportunities against the customer to track the sales pipeline.' },
  { type: 'action', icon: '📦', label: 'Track Jobs & Revenue',
    description: 'All jobs, invoices, and revenue are linked to the customer record automatically.' },
  { type: 'decision', icon: '📊', label: 'Tier Assigned?',
    branches: [
      { label: '💎 Platinum / Gold', color: 'purple',
        steps: [{ label: 'High-value, high-frequency customer' }, { label: 'Priority service & dedicated contacts' }]},
      { label: '🥈 Silver / Bronze', color: 'blue',
        steps: [{ label: 'Regular or growing account' }, { label: 'Standard service terms' }]},
    ]},
  { type: 'end', icon: '📈', label: 'Customer Score Tracked',
    description: 'Customer health score (payment, volume, retention) is calculated and shown in the CRM Scores tab.' },
];

const CUSTOMERS_TOUR: TourStep[] = [
  { selector: '[data-tour="customer-search"]', title: 'Search Customers',
    why: 'Quickly find any customer by name, account number, or contact — saves time when the phone rings.',
    what: 'Type any part of the name or account number. Results filter instantly.' },
  { selector: '[data-tour="customer-filters"]', title: 'Filter by Status or Type',
    why: 'Focus on active accounts, prospects, or specific industries when managing your customer base.',
    what: 'Click a filter chip to narrow the list. Click "all" to reset.' },
  { selector: '[data-tour="customer-stats"]', title: 'Customer Stats',
    why: 'At-a-glance totals help you track growth — total customers, active count, AR, and lifetime revenue.',
    what: 'These numbers update live as customers and invoices are added.' },
  { selector: '[data-tour="customer-grid"]', title: 'Customer Cards',
    why: 'Each card shows the customer name, type, primary contact, and revenue — everything you need to assess the account.',
    what: 'Click any card to open the full customer detail with contacts, jobs, and payment history.' },
  { selector: '[data-tour="new-customer-btn"]', title: 'Add New Customer',
    why: 'Every job starts with a customer record — creating it first ensures proper billing and tracking.',
    what: 'Click "New Customer" to open the form. Enter company name, type, payment terms, and contact info.' },
];

function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useApp();
  const [form, setForm] = useState({
    name: '', type: 'commercial' as CustomerType, paymentTerms: 'Net 30',
    creditLimit: 10000, street: '', city: '', state: '', zip: '', country: 'CA',
    currency: 'CAD' as CustomerCurrency,
    contactName: '', contactEmail: '', contactPhone: '', notes: '',
  });

  const stateProvinceOptions = getStateProvinceOptions(form.country);
  const stateLabel = getStateProvinceLabel(form.country);
  const zipLabel = getZipLabel(form.country);

  function handleCountryChange(country: string) {
    // Auto-set currency: CA → CAD, US → USD, anything else → CAD
    const currency: CustomerCurrency = country === 'US' ? 'USD' : 'CAD';
    setForm(f => ({ ...f, country, state: '', currency }));
  }

  function setCurrency(currency: CustomerCurrency) {
    setForm(f => ({ ...f, currency }));
  }

  function handleSave() {
    const now = new Date().toISOString().split('T')[0];
    const formattedZip = form.country === 'CA' ? formatPostalCode(form.zip) : form.zip;
    const addr = { street: form.street, city: form.city, state: form.state, zip: formattedZip, country: form.country };
    const customer: Customer = {
      id: generateId(),
      name: form.name,
      type: form.type,
      status: 'active',
      accountNumber: `ACC-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      taxExempt: false,
      creditLimit: form.creditLimit,
      currentBalance: 0,
      paymentTerms: form.paymentTerms,
      currency: form.currency,
      contacts: form.contactName ? [{
        id: generateId(), name: form.contactName, email: form.contactEmail,
        phone: form.contactPhone, isPrimary: true,
      }] : [],
      billingAddress: addr,
      shippingAddress: addr,
      notes: form.notes,
      tags: [],
      totalRevenue: 0, jobCount: 0, avgJobValue: 0,
      createdAt: now, updatedAt: now,
    };
    dispatch({ type: 'ADD_CUSTOMER', payload: customer });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Customer" size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!form.name}>Save Customer</Button></>}>
      <div className="space-y-5">

        {/* Currency / Region Selector — highlighted */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Billing Currency</div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrency('CAD')}
              className={clsx(
                'flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all',
                form.currency === 'CAD'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300',
              )}
            >
              🇨🇦 CAD — Canadian Dollar
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={clsx(
                'flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all',
                form.currency === 'USD'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300',
              )}
            >
              🇺🇸 USD — US Dollar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Company Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="col-span-2"
          />
          <Select label="Customer Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CustomerType }))}>
            <option value="commercial">Commercial</option>
            <option value="industrial">Industrial</option>
            <option value="retail">Retail</option>
            <option value="government">Government</option>
            <option value="wholesale">Wholesale</option>
          </Select>
          <Select label="Payment Terms" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}>
            <option>COD</option><option>Net 15</option><option>Net 30</option>
            <option>Net 45</option><option>Net 60</option>
          </Select>
          <Input
            label="Credit Limit"
            type="number"
            value={form.creditLimit}
            onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))}
          />
        </div>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-xs font-semibold text-gray-600 px-1">Primary Contact</legend>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Input label="Name" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            <Input label="Email" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            <Input label="Phone" type="tel" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
          </div>
        </fieldset>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-xs font-semibold text-gray-600 px-1">Billing / Shipping Address</legend>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {/* Country first — drives province/state options */}
            <Select
              label="Country"
              value={form.country}
              onChange={e => handleCountryChange(e.target.value)}
              className="col-span-2"
            >
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
            <Input
              label="Street Address"
              value={form.street}
              onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
              className="col-span-2"
            />
            <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              {stateProvinceOptions.length > 0 ? (
                <Select
                  label={stateLabel}
                  value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {stateProvinceOptions.map(o => (
                    <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
                  ))}
                </Select>
              ) : (
                <Input label={stateLabel} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
              )}
              <Input
                label={zipLabel}
                value={form.zip}
                onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                placeholder={form.country === 'CA' ? 'A1A 1A1' : form.country === 'US' ? '12345' : ''}
              />
            </div>
          </div>
          {form.country === 'CA' && form.state && (
            <div className="mt-3 text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-2">
              Taxes for this customer will be calculated based on delivery to <strong>{form.state}</strong>.
            </div>
          )}
        </fieldset>

        <Textarea label="Notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
    </Modal>
  );
}

export function Customers() {
  const { state, can } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(params.get('new') === '1');

  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, [params]);

  const filtered = state.customers.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.accountNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.contacts.some(x => x.name.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'all' || c.status === filter || c.type === filter;
    return matchSearch && matchFilter;
  });

  const typeColors: Record<string, string> = {
    industrial: 'bg-orange-100 text-orange-700',
    commercial: 'bg-blue-100 text-blue-700',
    retail: 'bg-purple-100 text-purple-700',
    wholesale: 'bg-teal-100 text-teal-700',
    government: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-5">
      <NewCustomerModal open={showNew} onClose={() => setShowNew(false)} />

      {/* Page header */}
      <div className="flex items-center gap-2">
        <Users size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Customers</h1>
        <WorkflowHelp title="Customers Workflow" description="Managing customer accounts, contacts, tiers, and revenue tracking." steps={CUSTOMERS_WORKFLOW} />
        <GuidedTourButton steps={CUSTOMERS_TOUR} />
      </div>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div data-tour="customer-search" className="relative flex-1 min-w-48 max-w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div data-tour="customer-filters" className="flex gap-1 flex-wrap">
          {['all', 'active', 'inactive', 'prospect', 'industrial', 'commercial', 'wholesale'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                filter === f ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              {f}
            </button>
          ))}
        </div>
        {can(3)
          ? <span data-tour="new-customer-btn"><Button icon={<Plus size={14} />} onClick={() => setShowNew(true)} className="ml-auto">New Customer</Button></span>
          : <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">View Only</span>
        }
      </div>

      {/* Stats row */}
      <div data-tour="customer-stats" className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: state.customers.length, color: 'text-gray-900' },
          { label: 'Active', value: state.customers.filter(c => c.status === 'active').length, color: 'text-green-700' },
          { label: 'Total AR', value: formatCurrency(state.customers.reduce((s, c) => s + c.currentBalance, 0)), color: 'text-blue-700' },
          { label: 'Total Revenue (All-time)', value: formatCurrency(state.customers.reduce((s, c) => s + c.totalRevenue, 0), 0), color: 'text-brand-700' },
        ].map(stat => (
          <Card key={stat.label}>
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* Customer grid */}
      <div data-tour="customer-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(customer => {
          const primary = customer.contacts.find(c => c.isPrimary);
          const country = customer.billingAddress?.country ?? 'CA';
          const currency = customer.currency ?? (country === 'US' ? 'USD' : 'CAD');
          const isUSCustomer = currency === 'USD' || country === 'US';
          return (
            <div
              key={customer.id}
              onClick={() => navigate(`/customers/${customer.id}`)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    isUSCustomer ? 'bg-blue-100' : 'bg-brand-100',
                  )}>
                    <Building2 size={20} className={isUSCustomer ? 'text-blue-600' : 'text-brand-600'} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm group-hover:text-brand-700 transition-colors">{customer.name}</div>
                    <div className="text-xs text-gray-500">{customer.accountNumber}</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-400 transition-colors mt-1" />
              </div>

              <div className="flex gap-1.5 flex-wrap mb-3">
                <Badge className={typeColors[customer.type] ?? 'bg-gray-100 text-gray-600'}>{customer.type}</Badge>
                <Badge className={customer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                  {customer.status}
                </Badge>
                {/* Currency badge — prominently highlighted for US customers */}
                <Badge className={isUSCustomer ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-brand-100 text-brand-700 font-bold'}>
                  {isUSCustomer ? '🇺🇸 USD' : '🇨🇦 CAD'}
                </Badge>
                {customer.taxExempt && <Badge className="bg-yellow-100 text-yellow-700">Tax Exempt</Badge>}
              </div>

              {primary && (
                <div className="space-y-1 mb-3 text-xs text-gray-600">
                  {primary.name && <div className="flex items-center gap-1.5"><span className="font-medium">{primary.name}</span>{primary.title && <span className="text-gray-400">— {primary.title}</span>}</div>}
                  {primary.email && <div className="flex items-center gap-1.5"><Mail size={11} className="text-gray-400" />{primary.email}</div>}
                  {primary.phone && <div className="flex items-center gap-1.5"><Phone size={11} className="text-gray-400" />{primary.phone}</div>}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Briefcase size={12} /><span>{customer.jobCount} jobs</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                  <DollarSign size={12} />{formatCurrency(customer.totalRevenue, 0)}
                </div>
                <div className="text-xs text-gray-500">{customer.paymentTerms}</div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No customers found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}

// ─── Customer Detail Page ──────────────────────────────────────────────────────

export function CustomerDetail() {
  const { state } = useApp();
  const navigate = useNavigate();

  const id = window.location.pathname.split('/').pop();
  const customer = state.customers.find(c => c.id === id);
  const customerJobs = state.jobs.filter(j => j.customerId === id);
  const customerInvoices = state.invoices.filter(i => i.customerId === id);

  if (!customer) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <Building2 size={48} className="mb-4 opacity-30" />
      <p className="font-semibold">Customer not found</p>
      <Button variant="ghost" onClick={() => navigate('/customers')} className="mt-3">Back to Customers</Button>
    </div>
  );

  const country = customer.billingAddress?.country ?? 'CA';
  const currency = customer.currency ?? (country === 'US' ? 'USD' : 'CAD');
  const isUSCustomer = currency === 'USD';
  const addr = customer.billingAddress;
  const stateLabel = country === 'CA' ? 'Province' : country === 'US' ? 'State' : 'Region';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/customers')} className="text-sm text-gray-500 hover:text-brand-600">Customers</button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">{customer.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', isUSCustomer ? 'bg-blue-100' : 'bg-brand-100')}>
                <Building2 size={24} className={isUSCustomer ? 'text-blue-600' : 'text-brand-600'} />
              </div>
              <div>
                <div className="font-bold text-gray-900">{customer.name}</div>
                <div className="text-xs text-gray-500">{customer.accountNumber}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge className="bg-green-100 text-green-700">{customer.status}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{customer.type}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Currency</span>
                <Badge className={isUSCustomer ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-brand-100 text-brand-700 font-bold'}>
                  {isUSCustomer ? '🇺🇸 USD' : '🇨🇦 CAD'}
                </Badge>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Terms</span><span className="font-medium">{customer.paymentTerms}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Credit Limit</span><span className="font-medium">{formatCurrency(customer.creditLimit)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="font-semibold text-blue-700">{formatCurrency(customer.currentBalance)}</span></div>
              {customer.taxExempt && <div className="flex justify-between"><span className="text-gray-500">Tax ID</span><span className="font-medium">{customer.taxId}</span></div>}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Address</div>
            <div className="text-sm text-gray-700 space-y-0.5">
              {addr.street && <div>{addr.street}</div>}
              <div>
                {[addr.city, addr.state].filter(Boolean).join(', ')}
                {addr.zip ? `  ${addr.zip}` : ''}
              </div>
              {addr.country && (
                <div className="text-xs text-gray-400 mt-1">
                  {COUNTRIES.find(c => c.code === addr.country)?.label ?? addr.country}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Contacts</div>
            {customer.contacts.map(c => (
              <div key={c.id} className="mb-3 text-sm">
                <div className="font-medium text-gray-900">{c.name} {c.isPrimary && <Badge className="bg-brand-100 text-brand-700 ml-1">Primary</Badge>}</div>
                {c.title && <div className="text-gray-500 text-xs">{c.title}</div>}
                {c.email && <div className="text-gray-600 text-xs mt-0.5">{c.email}</div>}
                {c.phone && <div className="text-gray-600 text-xs">{c.phone}</div>}
              </div>
            ))}
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><div className="text-xs text-gray-500">Total Revenue</div><div className="text-xl font-bold text-green-700 mt-1">{formatCurrency(customer.totalRevenue, 0)}</div></Card>
            <Card><div className="text-xs text-gray-500">Total Jobs</div><div className="text-xl font-bold text-brand-700 mt-1">{customer.jobCount}</div></Card>
            <Card><div className="text-xs text-gray-500">Avg Job Value</div><div className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(customer.avgJobValue)}</div></Card>
          </div>

          <Card padding={false}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-sm">Jobs</span>
              <Button size="sm" variant="ghost" onClick={() => navigate('/jobs?customer=' + id)}>View all</Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Job #', 'Service', 'Status', 'Due', 'Value'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customerJobs.slice(0, 5).map(job => (
                  <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-brand-700">{job.jobNumber}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{job.serviceType.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5"><Badge className={jobStatusConfig(job.status)?.color ?? ''}>{jobStatusConfig(job.status)?.label}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(job.dueDate)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">{formatCurrency(job.salePrice)}</td>
                  </tr>
                ))}
                {customerJobs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs">No jobs</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card padding={false}>
            <div className="p-4 border-b border-gray-100">
              <span className="font-semibold text-sm">Invoices</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Invoice #', 'Status', 'Issued', 'Due', 'Total', 'Balance'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customerInvoices.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-brand-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2.5"><Badge className={inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>{inv.status}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-blue-700">{formatCurrency(inv.balance)}</td>
                  </tr>
                ))}
                {customerInvoices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">No invoices</td></tr>}
              </tbody>
            </table>
          </Card>

          {customer.notes && (
            <Card>
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Notes</div>
              <p className="text-sm text-gray-700">{customer.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
