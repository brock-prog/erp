import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, DollarSign, Clock, CheckCircle,
  AlertTriangle, Package, TrendingUp, Flame,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../ui/StatCard';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  formatCurrency, formatDate, jobStatusConfig, priorityConfig,
  serviceTypeLabel, isOverdue,
} from '../../utils';
import { MONTHLY_REVENUE, THROUGHPUT_DATA, TOP_CUSTOMERS } from '../../data/mockData';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const DASHBOARD_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🏠', label: 'Log In to DECORA ERP',
    description: 'Dashboard is your command centre — a live snapshot of the entire operation.' },
  { type: 'action', icon: '📊', label: 'Review KPI Cards',
    description: 'Active jobs, rush count, overdue jobs, monthly revenue, outstanding AR, and average margin.' },
  { type: 'action', icon: '⚠️', label: 'Check Alerts',
    description: 'Overdue jobs and low-stock items surface at the top of the dashboard as amber warnings.' },
  { type: 'action', icon: '🗂️', label: 'Recent Jobs Table',
    description: 'Scan recently updated jobs, click any row to open the full job detail in Jobs / Work Orders.' },
  { type: 'note', icon: '💡', label: 'Quick Navigation',
    description: 'Use the sidebar to jump to CRM, Pending Jobs, Inventory, Invoicing, or any other module.' },
  { type: 'end', icon: '🚀', label: 'Manage Your Day',
    description: 'Dashboard refreshes live. Monitor KPIs throughout the day to stay on top of production and revenue.' },
];

const DASHBOARD_TOUR: TourStep[] = [
  { selector: '[data-tour="kpi-cards"]', title: 'KPI Cards',
    why: 'These numbers tell you the health of your shop in one glance — jobs, revenue, AR, and margin.',
    what: 'Click any card to jump straight to that module. Red numbers need immediate attention.' },
  { selector: '[data-tour="alert-bar"]', title: 'Alert Bar',
    why: 'Overdue jobs and low stock surface here so you never miss a production or supply issue.',
    what: 'Click "View inventory" to jump to the Inventory module and address low-stock items.' },
  { selector: '[data-tour="revenue-chart"]', title: 'Revenue Trend',
    why: 'Tracking powder coating vs. sublimation revenue shows which service lines are growing.',
    what: 'Hover over data points to see exact monthly figures. Compare your two revenue streams.' },
  { selector: '[data-tour="service-mix"]', title: 'Active Jobs by Service',
    why: 'Shows your current production mix — helps with capacity planning and scheduling.',
    what: 'The pie chart updates live as jobs move through the system.' },
  { selector: '[data-tour="throughput-chart"]', title: 'Weekly Throughput',
    why: 'Measures production output — are you getting faster or is a bottleneck forming?',
    what: 'Jobs completed (left axis) and total parts processed (right axis) over recent weeks.' },
  { selector: '[data-tour="recent-jobs"]', title: 'Recent Jobs',
    why: 'Quick access to the most recently updated jobs — catch status changes and priority shifts.',
    what: 'Click any row to open the full job detail. Overdue jobs show a red warning icon.' },
];

export function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { jobs, invoices, inventory } = state;

  // KPI calcs
  const activeJobs = jobs.filter(j => !['complete', 'cancelled'].includes(j.status));
  const rushJobs = activeJobs.filter(j => j.priority === 'rush');
  const overdueJobs = activeJobs.filter(j => isOverdue(j.dueDate, j.status));
  const completedThisMonth = jobs.filter(j => j.status === 'complete' && j.completedDate?.startsWith('2026-02'));
  const revenueThisMonth = completedThisMonth.reduce((s, j) => s + j.salePrice, 0);
  const outstandingAR = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + i.balance, 0);
  const lowStockItems = inventory.filter(i => i.quantityOnHand - i.quantityAllocated <= i.reorderPoint);
  const avgMargin = jobs.filter(j => j.margin !== undefined && j.status === 'complete').reduce((s, j, _i, arr) => s + (j.margin ?? 0) / arr.length, 0);

  const recentJobs = [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  const JOB_STATUS_PIE = [
    { name: 'Powder Coat', value: jobs.filter(j => j.serviceType === 'powder_coating' && !['complete', 'cancelled'].includes(j.status)).length, color: '#1f355e' },
    { name: 'Sublimation', value: jobs.filter(j => j.serviceType === 'sublimation' && !['complete', 'cancelled'].includes(j.status)).length, color: '#009877' },
    { name: 'Both', value: jobs.filter(j => j.serviceType === 'both' && !['complete', 'cancelled'].includes(j.status)).length, color: '#26b48e' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-[#1f355e]" />
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <WorkflowHelp title="Dashboard Overview" description="Your command centre — live KPIs, alerts, and quick access to all modules." steps={DASHBOARD_WORKFLOW} />
        <GuidedTourButton steps={DASHBOARD_TOUR} />
      </div>
      {/* Alert bar */}
      {(overdueJobs.length > 0 || lowStockItems.length > 0) && (
        <div data-tour="alert-bar" className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={17} className="text-amber-500 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            {overdueJobs.length > 0 && <span className="font-semibold">{overdueJobs.length} overdue job{overdueJobs.length > 1 ? 's' : ''}</span>}
            {overdueJobs.length > 0 && lowStockItems.length > 0 && ' · '}
            {lowStockItems.length > 0 && <span className="font-semibold">{lowStockItems.length} inventory item{lowStockItems.length > 1 ? 's' : ''} at or below reorder point</span>}
          </div>
          <button onClick={() => navigate('/inventory')} className="ml-auto text-xs text-amber-700 underline">View inventory</button>
        </div>
      )}

      {/* KPI Cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Jobs" value={activeJobs.length} change={12}
          icon={<Briefcase size={18} />} color="indigo"
          onClick={() => navigate('/jobs')}
        />
        <StatCard
          label="Revenue (Feb)" value={formatCurrency(revenueThisMonth)} change={8}
          icon={<DollarSign size={18} />} color="green"
          onClick={() => navigate('/reports')}
        />
        <StatCard
          label="Outstanding AR" value={formatCurrency(outstandingAR)}
          icon={<Clock size={18} />} color="yellow"
          onClick={() => navigate('/invoices')}
        />
        <StatCard
          label="Avg. Margin" value={`${avgMargin.toFixed(1)}%`} change={2}
          icon={<TrendingUp size={18} />} color="purple"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Completed (Feb)" value={completedThisMonth.length}
          icon={<CheckCircle size={18} />} color="blue"
        />
        <StatCard
          label="Rush Orders" value={rushJobs.length}
          icon={<Flame size={18} />} color="red"
          onClick={() => navigate('/jobs')}
        />
        <StatCard
          label="Low Stock Alerts" value={lowStockItems.length}
          icon={<Package size={18} />} color="yellow"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="Overdue Jobs" value={overdueJobs.length}
          icon={<AlertTriangle size={18} />} color="red"
          onClick={() => navigate('/jobs')}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <Card data-tour="revenue-chart" className="lg:col-span-2" padding={false}>
          <div className="p-5 pb-2">
            <CardHeader title="Revenue Trend (Aug – Feb)" subtitle="Powder Coating vs. Sublimation" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MONTHLY_REVENUE} margin={{ left: 10, right: 16, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f355e" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#1f355e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#009877" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#009877" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
              <Area type="monotone" dataKey="powder" name="Powder Coating" stroke="#1f355e" strokeWidth={2.5} fill="url(#pc)" />
              <Area type="monotone" dataKey="sublimation" name="Sublimation" stroke="#009877" strokeWidth={2.5} fill="url(#sub)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Service mix pie */}
        <Card data-tour="service-mix" padding={false}>
          <div className="p-5 pb-0">
            <CardHeader title="Active Jobs by Service" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={JOB_STATUS_PIE} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {JOB_STATUS_PIE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Throughput bar + top customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card data-tour="throughput-chart" className="lg:col-span-2" padding={false}>
          <div className="p-5 pb-2">
            <CardHeader title="Weekly Throughput" subtitle="Jobs completed and parts processed" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={THROUGHPUT_DATA} margin={{ left: 10, right: 16, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="jobs" orientation="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="parts" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="jobs" dataKey="jobs" name="Jobs" fill="#1f355e" radius={[4,4,0,0]} />
              <Bar yAxisId="parts" dataKey="parts" name="Parts" fill="#009877" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Top Customers (All-time)" />
          <div className="space-y-3">
            {TOP_CUSTOMERS.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.jobs} jobs</div>
                </div>
                <span className="text-xs font-bold text-gray-700">{formatCurrency(c.revenue, 0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card data-tour="recent-jobs" padding={false}>
        <div className="p-5 pb-0 flex items-center justify-between">
          <CardHeader title="Recent Jobs" subtitle="Latest work order activity" />
          <button onClick={() => navigate('/jobs')} className="text-xs text-brand-600 hover:underline mb-4">View all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Job #', 'Customer', 'Service', 'Status', 'Priority', 'Due', 'Value', 'Operator'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentJobs.map(job => {
                const sc = jobStatusConfig(job.status);
                const pc = priorityConfig(job.priority);
                const overdue = isOverdue(job.dueDate, job.status);
                return (
                  <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{job.jobNumber}</td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap max-w-[140px] truncate">{job.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{serviceTypeLabel(job.serviceType)}</td>
                    <td className="px-4 py-3">
                      <Badge className={sc.color}>{sc.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold ${pc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />{pc.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs whitespace-nowrap font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                      {overdue ? '⚠ ' : ''}{formatDate(job.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold text-xs">{formatCurrency(job.salePrice)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{job.assignedOperator ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
