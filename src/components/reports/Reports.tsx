import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card, CardHeader } from '../ui/Card';
import { formatCurrency, serviceTypeLabel } from '../../utils';
import { MONTHLY_REVENUE, THROUGHPUT_DATA, TOP_CUSTOMERS } from '../../data/mockData';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const REPORTS_TOUR: TourStep[] = [
  { selector: '[data-tour="rpt-kpis"]',   title: 'Key Metrics',       why: 'Revenue, job count, margin, and QC pass rate give a quick pulse of business health.',       what: 'Review these KPIs regularly. Margin below 30% or QC pass rate dropping signals a problem.' },
  { selector: '[data-tour="rpt-revenue"]', title: 'Revenue Trend',     why: 'Monthly revenue chart shows seasonality and growth. Compare against budget targets.',        what: 'Hover bars for exact values. Look for months that dip below your break-even line.' },
  { selector: '[data-tour="rpt-mix"]',     title: 'Service Mix',       why: 'Knowing which service types drive revenue helps focus sales and capacity planning.',          what: 'The pie chart breaks down jobs by type. A healthy shop has diversity across services.' },
];

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export function Reports() {
  const { state } = useApp();
  const [period, setPeriod] = useState<'mtd'|'ytd'|'all'>('ytd');

  // Job service mix
  const serviceMix = [
    { name: 'Powder Coating', value: state.jobs.filter(j=>j.serviceType==='powder_coating').length },
    { name: 'Sublimation', value: state.jobs.filter(j=>j.serviceType==='sublimation').length },
    { name: 'Both', value: state.jobs.filter(j=>j.serviceType==='both').length },
  ];

  // Revenue by customer
  const revByCustomer = state.customers.sort((a,b) => b.totalRevenue - a.totalRevenue).slice(0, 5).map(c => ({
    name: c.name.split(' ')[0], // Truncate for chart
    revenue: c.totalRevenue,
    jobs: c.jobCount,
  }));

  // QC stats
  const qcPass = state.qcInspections.filter(i=>i.result==='pass').length;
  const qcFail = state.qcInspections.filter(i=>i.result==='fail').length;
  const qcCond = state.qcInspections.filter(i=>i.result==='conditional').length;
  const qcData = [
    { name: 'Pass', value: qcPass, color: '#10b981' },
    { name: 'Conditional', value: qcCond, color: '#f59e0b' },
    { name: 'Fail', value: qcFail, color: '#ef4444' },
  ];

  // Margin distribution
  const completedJobs = state.jobs.filter(j => j.status==='complete' && j.margin !== undefined);
  const avgMargin = completedJobs.length > 0 ? completedJobs.reduce((s,j) => s+(j.margin??0), 0) / completedJobs.length : 0;

  // Powder usage
  const powders = state.inventory.filter(i => i.category === 'powder');

  // Status distribution
  const statusCounts = [
    'received','pretreat','coat','cure','qc','shipping','complete','on_hold',
  ].map(s => ({
    status: s.replace('_',' '),
    count: state.jobs.filter(j => j.status === s).length,
  }));

  // Accounts receivable aging
  const agingBuckets = [
    { label: '0-30 days', amount: 0 },
    { label: '31-60 days', amount: 0 },
    { label: '61-90 days', amount: 0 },
    { label: '90+ days', amount: 0 },
  ];
  state.invoices.filter(i=>['sent','partial','overdue'].includes(i.status)).forEach(inv => {
    const daysPast = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000));
    if (daysPast <= 30) agingBuckets[0].amount += inv.balance;
    else if (daysPast <= 60) agingBuckets[1].amount += inv.balance;
    else if (daysPast <= 90) agingBuckets[2].amount += inv.balance;
    else agingBuckets[3].amount += inv.balance;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <GuidedTourButton steps={REPORTS_TOUR} />
      </div>

      {/* Summary KPIs */}
      <div data-tour="rpt-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue (YTD)', value: formatCurrency(MONTHLY_REVENUE.slice(0,7).reduce((s,m)=>s+m.total,0), 0), color: 'text-green-700' },
          { label: 'Total Jobs', value: state.jobs.length, color: 'text-brand-700' },
          { label: 'Avg. Margin', value: `${avgMargin.toFixed(1)}%`, color: 'text-purple-700' },
          { label: 'QC Pass Rate', value: `${state.qcInspections.length > 0 ? Math.round((qcPass/state.qcInspections.length)*100) : 0}%`, color: 'text-emerald-700' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </Card>
        ))}
      </div>

      {/* Revenue trend */}
      <Card padding={false} data-tour="rpt-revenue">
        <div className="p-5 pb-2"><CardHeader title="Monthly Revenue — Powder Coating vs. Sublimation" /></div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={MONTHLY_REVENUE} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v:number) => formatCurrency(v)} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="powder" name="Powder Coating" fill="#6366f1" radius={[4,4,0,0]} />
            <Bar dataKey="sublimation" name="Sublimation" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 3-column charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Service mix */}
        <Card padding={false} data-tour="rpt-mix">
          <div className="p-5 pb-0"><CardHeader title="Service Mix" subtitle="All-time job count" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={serviceMix} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {serviceMix.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* QC results */}
        <Card padding={false}>
          <div className="p-5 pb-0"><CardHeader title="QC Results" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={qcData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {qcData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Job status dist */}
        <Card padding={false}>
          <div className="p-5 pb-0"><CardHeader title="Job Status Distribution" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusCounts} layout="vertical" margin={{ left: 60, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} axisLine={false} width={60} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Throughput */}
      <Card padding={false}>
        <div className="p-5 pb-2"><CardHeader title="Weekly Production Throughput" subtitle="Jobs completed and total parts processed" /></div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={THROUGHPUT_DATA} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="jobs" orientation="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="parts" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="jobs" type="monotone" dataKey="jobs" name="Jobs" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line yAxisId="parts" type="monotone" dataKey="parts" name="Parts" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top customers */}
        <Card padding={false}>
          <div className="p-5 pb-2"><CardHeader title="Top Customers by Revenue" /></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revByCustomer} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} axisLine={false} width={80} />
              <Tooltip formatter={(v:number) => formatCurrency(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* AR Aging */}
        <Card>
          <CardHeader title="Accounts Receivable Aging" subtitle="Outstanding invoice balances" />
          <div className="space-y-3">
            {agingBuckets.map((bucket, i) => (
              <div key={bucket.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">{bucket.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full transition-all" style={{
                    width: `${Math.max(2, (bucket.amount / Math.max(...agingBuckets.map(b=>b.amount), 1)) * 100)}%`,
                    backgroundColor: COLORS[i],
                  }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-20 text-right">{formatCurrency(bucket.amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Total Outstanding</span>
            <span className="font-bold text-blue-700">{formatCurrency(agingBuckets.reduce((s,b)=>s+b.amount,0))}</span>
          </div>
        </Card>
      </div>

      {/* Powder inventory summary */}
      <Card>
        <CardHeader title="Powder Inventory Summary" subtitle="Current stock by color" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Color','Code','Finish','Manufacturer','QOH (lbs)','Allocated','Available','Value','Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {powders.map(p => {
                const available = p.quantityOnHand - p.quantityAllocated;
                const isLow = available <= p.reorderPoint;
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: p.colorHex || '#ccc' }} />
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[120px]">{p.name.split('(')[0].trim()}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-500">{p.colorCode}</td>
                    <td className="px-3 py-2 text-xs capitalize text-gray-600">{p.finish}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{p.manufacturer}</td>
                    <td className="px-3 py-2 text-xs font-semibold">{p.quantityOnHand}</td>
                    <td className="px-3 py-2 text-xs text-orange-600">{p.quantityAllocated}</td>
                    <td className="px-3 py-2 text-xs font-bold" style={{ color: isLow ? '#dc2626' : '#059669' }}>{available}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(p.quantityOnHand * p.unitCost)}</td>
                    <td className="px-3 py-2 text-xs">
                      {isLow
                        ? <span className="text-red-600 font-semibold">⚠ Low Stock</span>
                        : <span className="text-green-600">OK</span>}
                    </td>
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
