/**
 * CRM.tsx — v2
 * Today/Inbox · Pipeline · Customer Scores · Activities · Forecast · Analytics
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, Users, Activity, BarChart2,
  Plus, ChevronRight, ChevronLeft, Phone, Mail, MapPin,
  CheckCircle, Clock, AlertCircle, DollarSign,
  ArrowRight, Target, Award, Zap, X, Edit2, Trash2,
  Search, Bell, Flame, Calendar, Inbox,
  MessageSquare, Send, Eye, MoreHorizontal,
  Tag, Hash, Percent, Trophy, Star, Crown, Sparkles, Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { WorkflowHelp, type WorkflowStep } from '../ui/WorkflowHelp';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
import { Button } from '../ui/Button';
import { formatCurrency, generateId, formatDate } from '../../utils';
import { exportToCSV, type ExportColumn } from '../../lib/exportUtils';
import type {
  CRMOpportunity, CRMActivity, CustomerScore,
  PipelineStage, ActivityType, ServiceType,
} from '../../types';

const CRM_TOUR: TourStep[] = [
  { selector: '[data-tour="crm-kpi"]', title: 'Sales KPIs',
    why: 'Pipeline value, monthly wins, win rate, and overdue follow-ups at a glance.',
    what: 'Red overdue count means you have follow-ups past their due date — click the Today tab to see them.' },
  { selector: '[data-tour="crm-tabs"]', title: 'CRM Tabs',
    why: 'Each tab focuses on a different aspect of sales management.',
    what: 'Today = daily inbox. Pipeline = deal stages. Scores = customer health. Activities = log history. Forecast + Analytics for reporting.' },
  { selector: '[data-tour="crm-actions"]', title: 'Log Activity & New Opp',
    why: 'Every customer interaction should be logged — calls, emails, visits — to earn gamification points and keep history.',
    what: '"Log Activity" records a touchpoint. "New Opp" creates a new sales opportunity in the pipeline.' },
];

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PIPELINE_STAGES: { id: PipelineStage; label: string; color: string; bg: string; border: string }[] = [
  { id: 'lead',         label: 'Lead',        color: 'text-gray-600',   bg: 'bg-gray-100',    border: 'border-gray-200'   },
  { id: 'prospect',     label: 'Prospect',    color: 'text-blue-600',   bg: 'bg-blue-50',     border: 'border-blue-200'   },
  { id: 'quoted',       label: 'Quoted',      color: 'text-yellow-700', bg: 'bg-yellow-50',   border: 'border-yellow-200' },
  { id: 'negotiating',  label: 'Negotiating', color: 'text-orange-600', bg: 'bg-orange-50',   border: 'border-orange-200' },
  { id: 'won',          label: 'Won',         color: 'text-green-700',  bg: 'bg-green-50',    border: 'border-green-200'  },
  { id: 'lost',         label: 'Lost',        color: 'text-red-600',    bg: 'bg-red-50',      border: 'border-red-200'    },
];

const ACTIVE_STAGES: PipelineStage[] = ['lead', 'prospect', 'quoted', 'negotiating'];

const ACTIVITY_META: Record<ActivityType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  call:             { label: 'Call',             icon: <Phone size={14} />,        color: 'text-blue-600',    bg: 'bg-blue-100'    },
  email:            { label: 'Email',            icon: <Mail size={14} />,         color: 'text-purple-600',  bg: 'bg-purple-100'  },
  visit:            { label: 'Site Visit',       icon: <MapPin size={14} />,       color: 'text-green-600',   bg: 'bg-green-100'   },
  quote_sent:       { label: 'Quote Sent',       icon: <Send size={14} />,         color: 'text-yellow-700',  bg: 'bg-yellow-100'  },
  order_placed:     { label: 'Order Placed',     icon: <CheckCircle size={14} />,  color: 'text-green-700',   bg: 'bg-green-100'   },
  payment_received: { label: 'Payment',          icon: <DollarSign size={14} />,   color: 'text-emerald-600', bg: 'bg-emerald-100' },
  note:             { label: 'Note',             icon: <MessageSquare size={14} />,color: 'text-gray-600',    bg: 'bg-gray-100'    },
  follow_up:        { label: 'Follow-up',        icon: <Clock size={14} />,        color: 'text-orange-600',  bg: 'bg-orange-100'  },
};

const STAGE_PROBABILITY: Record<PipelineStage, number> = {
  lead: 10, prospect: 25, quoted: 50, negotiating: 70, won: 100, lost: 0, inactive: 0,
};

const SERVICE_BADGE: Record<ServiceType, { label: string; color: string }> = {
  powder_coating: { label: 'Powder',      color: 'bg-blue-100 text-blue-700'    },
  sublimation:    { label: 'Sublimation', color: 'bg-purple-100 text-purple-700' },
  both:           { label: 'Both',        color: 'bg-teal-100 text-teal-700'    },
  other:          { label: 'Other',       color: 'bg-gray-100 text-gray-600'    },
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  platinum: { label: 'Platinum', color: 'text-purple-700', bg: 'bg-purple-100', icon: '💎' },
  gold:     { label: 'Gold',     color: 'text-yellow-700', bg: 'bg-yellow-100', icon: '🥇' },
  silver:   { label: 'Silver',   color: 'text-gray-600',   bg: 'bg-gray-100',   icon: '🥈' },
  bronze:   { label: 'Bronze',   color: 'text-orange-700', bg: 'bg-orange-100', icon: '🥉' },
  prospect: { label: 'Prospect', color: 'text-blue-600',   bg: 'bg-blue-50',    icon: '🔵' },
};

/* ─── Scoring Engine ─────────────────────────────────────────────────────── */

function computeCustomerScore(
  customer: { id: string; name: string; totalRevenue?: number; jobCount?: number; creditLimit?: number; currentBalance?: number },
  jobs: { customerId: string; createdAt: string; status: string }[],
  invoices: { customerId: string; status: string; total: number }[],
): CustomerScore {
  const custJobs     = jobs.filter(j => j.customerId === customer.id);
  const custInvoices = invoices.filter(i => i.customerId === customer.id);
  const revenue      = customer.totalRevenue ?? 0;
  const jobCount     = customer.jobCount ?? custJobs.length;

  const revenueScore   = Math.min(25, Math.round((Math.log10(Math.max(revenue, 1)) / Math.log10(250000)) * 25));
  const frequencyScore = Math.min(20, Math.round((jobCount / 30) * 20));

  const overdueInvoices = custInvoices.filter(i => i.status === 'overdue').length;
  const balanceRatio    = customer.creditLimit && customer.currentBalance != null
    ? Math.min(1, customer.currentBalance / Math.max(customer.creditLimit, 1)) : 0;
  const paymentScore    = Math.max(0, 20 - overdueInvoices * 5 - Math.round(balanceRatio * 10));

  const avgInvoiceValue = custInvoices.length > 0
    ? custInvoices.reduce((s, i) => s + i.total, 0) / custInvoices.length : 0;
  const marginScore     = Math.min(20, Math.round((avgInvoiceValue / 5000) * 20));

  const lastJobDate  = custJobs.length > 0
    ? new Date(Math.max(...custJobs.map(j => new Date(j.createdAt).getTime()))) : null;
  const daysSinceLast = lastJobDate
    ? Math.floor((Date.now() - lastJobDate.getTime()) / 86400000) : 9999;
  const loyaltyScore  = daysSinceLast < 30 ? 15 : daysSinceLast < 90 ? 12 : daysSinceLast < 180 ? 8 : daysSinceLast < 365 ? 4 : 0;

  const totalScore = revenueScore + frequencyScore + paymentScore + marginScore + loyaltyScore;
  const tier: CustomerScore['tier'] =
    totalScore >= 80 ? 'platinum' : totalScore >= 60 ? 'gold' :
    totalScore >= 40 ? 'silver'   : totalScore >= 20 ? 'bronze' : 'prospect';

  const riskFlag: CustomerScore['riskFlag'] =
    overdueInvoices > 0 ? 'overdue_balance' :
    daysSinceLast > 365 ? 'long_inactive' :
    daysSinceLast > 180 && jobCount > 5 ? 'declining_orders' : undefined;

  return {
    customerId: customer.id, customerName: customer.name, totalScore,
    revenueScore, frequencyScore, paymentScore, marginScore, loyaltyScore,
    tier, lastOrderDate: lastJobDate?.toISOString(), riskFlag,
    calculatedAt: new Date().toISOString(),
  };
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function daysFromNow(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function dateLabel(dateStr: string): string {
  const d = daysSince(dateStr);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clsx(...args: (string | false | undefined | null)[]): string {
  return args.filter(Boolean).join(' ');
}

/* ─── Gamification Engine ────────────────────────────────────────────────── */

/** Points awarded per activity type */
const ACTIVITY_POINTS: Record<ActivityType, number> = {
  note:             5,
  follow_up:        8,
  email:            8,
  call:            12,
  visit:           25,
  quote_sent:      30,
  order_placed:    40,
  payment_received: 20,
};

/** Points by current opportunity stage (creation credit) */
const STAGE_POINTS: Partial<Record<PipelineStage, number>> = {
  lead:        10,
  prospect:    20,
  quoted:      35,
  negotiating: 50,
  won:          0,  // handled separately with value bonus
  lost:         5,  // consolation
};

/** Points for winning based on deal value */
function wonDealPoints(value: number): number {
  if (value >= 25_000) return 200;
  if (value >= 10_000) return 100;
  if (value >=  5_000) return  60;
  if (value >=  1_000) return  35;
  return 20;
}

interface UserPoints {
  userId: string;
  userName: string;
  totalPoints: number;
  activityPoints: number;
  opportunityPoints: number;
  wonDeals: number;
  activitiesLogged: number;
  level: number;
  levelLabel: string;
  levelColor: string;
  nextLevelPoints: number;
  progress: number;   // 0–100 towards next level
}

const LEVELS = [
  { min: 0,    label: 'Rookie',   color: '#9ca3af', emoji: '🌱' },
  { min: 80,   label: 'Hunter',   color: '#3b82f6', emoji: '🎯' },
  { min: 250,  label: 'Closer',   color: '#059669', emoji: '🔥' },
  { min: 600,  label: 'Ace',      color: '#f59e0b', emoji: '⚡' },
  { min: 1200, label: 'Legend',   color: '#7c3aed', emoji: '👑' },
];

function getLevel(pts: number) {
  let lv = LEVELS[0];
  for (const l of LEVELS) { if (pts >= l.min) lv = l; else break; }
  const idx   = LEVELS.indexOf(lv);
  const next  = LEVELS[idx + 1];
  const start = lv.min;
  const end   = next?.min ?? start + 1;
  return { ...lv, level: idx + 1, next, progress: Math.round(((pts - start) / (end - start)) * 100), nextMin: end };
}

function computeUserPoints(
  userId: string,
  userName: string,
  activities: CRMActivity[],
  opportunities: CRMOpportunity[],
): UserPoints {
  const userActs = activities.filter(a => a.userId === userId || a.userName === userName);
  const userOpps = opportunities.filter(o => o.assignedToId === userId || o.assignedToName === userName);

  const actPts = userActs.reduce((s, a) => s + (ACTIVITY_POINTS[a.type] ?? 5), 0);

  let oppPts = 0;
  let wonDeals = 0;
  for (const opp of userOpps) {
    if (opp.stage === 'won') {
      oppPts += wonDealPoints(opp.estimatedValue);
      wonDeals++;
    } else {
      oppPts += STAGE_POINTS[opp.stage] ?? 0;
    }
  }

  const total = actPts + oppPts;
  const lv    = getLevel(total);

  return {
    userId, userName,
    totalPoints: total,
    activityPoints: actPts,
    opportunityPoints: oppPts,
    wonDeals,
    activitiesLogged: userActs.length,
    level: lv.level,
    levelLabel: lv.label,
    levelColor: lv.color,
    nextLevelPoints: lv.nextMin,
    progress: lv.progress,
  };
}

/* ─── Leaderboard Tab ────────────────────────────────────────────────────── */

function LeaderboardTab({
  activities, opportunities, currentUserId,
}: {
  activities: CRMActivity[];
  opportunities: CRMOpportunity[];
  currentUserId: string;
}) {
  // Collect unique users from activities + opportunities
  const usersMap = useMemo(() => {
    const m = new Map<string, string>(); // id → name
    activities.forEach(a => { if (a.userId) m.set(a.userId, a.userName); });
    opportunities.forEach(o => { if (o.assignedToId) m.set(o.assignedToId, o.assignedToName); });
    return m;
  }, [activities, opportunities]);

  const rankings = useMemo(() => {
    return Array.from(usersMap.entries())
      .map(([uid, uname]) => computeUserPoints(uid, uname, activities, opportunities))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [usersMap, activities, opportunities]);

  const myStats = rankings.find(r => r.userId === currentUserId) ?? rankings[0];

  const PODIUM_COLORS = ['#f59e0b', '#9ca3af', '#b45309'];
  const PODIUM_ICONS  = [
    <Crown size={18} className="text-yellow-500" />,
    <Trophy size={16} className="text-gray-400" />,
    <Award size={16} className="text-amber-700" />,
  ];
  const RANK_ICONS = ['🥇', '🥈', '🥉'];

  // Activity breakdown for current user
  const myActivities = activities.filter(a => a.userId === currentUserId);
  const myOpps       = opportunities.filter(o => o.assignedToId === currentUserId);

  const activityBreakdown = useMemo(() => {
    const counts: Partial<Record<ActivityType, number>> = {};
    myActivities.forEach(a => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
    return (Object.entries(counts) as [ActivityType, number][])
      .sort((a, b) => b[1] - a[1]);
  }, [myActivities]);

  if (rankings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h3 className="font-bold text-gray-700 text-lg">No data yet</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Log activities and move opportunities through the pipeline to start earning points and appear on the leaderboard!
        </p>
      </div>
    );
  }

  const lv = myStats ? getLevel(myStats.totalPoints) : null;

  return (
    <div className="space-y-5">

      {/* ── My Current Rank Banner ───────────────────────────────────── */}
      {myStats && lv && (
        <div
          className="rounded-2xl p-4 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${lv.color}, ${lv.color}cc)` }}
        >
          {/* Background sparkle decoration */}
          <div className="absolute right-4 top-0 text-6xl opacity-10 leading-none select-none">
            {lv.emoji}
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="text-4xl leading-none">{lv.emoji}</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-70">Your Rank</div>
                <div className="text-2xl font-black tracking-tight">{lv.label}</div>
                <div className="text-sm font-semibold opacity-80">
                  Level {lv.level} · {myStats.totalPoints.toLocaleString()} pts
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs opacity-70">Rank</div>
                <div className="text-3xl font-black">
                  #{(rankings.findIndex(r => r.userId === currentUserId) + 1) || '–'}
                </div>
              </div>
            </div>
            {/* Progress to next level */}
            {lv.next && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs opacity-70 mb-1">
                  <span>Progress to {lv.next.label}</span>
                  <span>{myStats.nextLevelPoints - myStats.totalPoints} pts to go</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/20">
                  <div
                    className="h-2 rounded-full bg-white transition-all duration-500"
                    style={{ width: `${Math.min(100, myStats.progress)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick stats row ───────────────────────────────────────────── */}
      {myStats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Activities', value: myStats.activitiesLogged, icon: <Activity size={14} />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Won Deals',  value: myStats.wonDeals,         icon: <Trophy size={14} />,   color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Opp Points', value: myStats.opportunityPoints, icon: <Target size={14} />,  color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-2.5`}>
              <span className={s.color}>{s.icon}</span>
              <div>
                <div className="text-xs text-gray-400">{s.label}</div>
                <div className={`text-lg font-black ${s.color}`}>{s.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Podium (top 3) ────────────────────────────────────────────── */}
      {rankings.length >= 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" /> Top Performers
          </h3>
          <div className="flex items-end justify-center gap-3">
            {[rankings[1], rankings[0], rankings[2]].map((r, i) => {
              if (!r) return <div key={i} className="flex-1" />;
              const positions = [1, 0, 2]; // display order: 2nd, 1st, 3rd
              const realRank  = positions[i];
              const heights   = [80, 110, 65];
              const lv2       = getLevel(r.totalPoints);
              const isMe      = r.userId === currentUserId;
              return (
                <div key={r.userId} className="flex-1 flex flex-col items-center gap-1">
                  {realRank === 0 && (
                    <div className="text-2xl animate-bounce">{lv2.emoji}</div>
                  )}
                  <div className="text-2xl">{RANK_ICONS[realRank]}</div>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: PODIUM_COLORS[realRank] }}
                  >
                    {r.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold text-gray-800 ${isMe ? 'underline decoration-dotted' : ''}`}>
                      {r.userName.split(' ')[0]}
                      {isMe && ' (you)'}
                    </div>
                    <div className="text-xs font-black" style={{ color: PODIUM_COLORS[realRank] }}>
                      {r.totalPoints.toLocaleString()} pts
                    </div>
                  </div>
                  <div
                    className="w-full rounded-t-lg flex items-center justify-center"
                    style={{ height: heights[i], background: `${PODIUM_COLORS[realRank]}20`, border: `2px solid ${PODIUM_COLORS[realRank]}40` }}
                  >
                    <span className="text-lg font-black" style={{ color: PODIUM_COLORS[realRank] }}>
                      #{realRank + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full Leaderboard ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Star size={14} className="text-yellow-500" /> Full Rankings
          </h3>
        </div>
        <div className="divide-y divide-gray-50">
          {rankings.map((r, idx) => {
            const lv2  = getLevel(r.totalPoints);
            const isMe = r.userId === currentUserId;
            return (
              <div
                key={r.userId}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
              >
                {/* Rank number */}
                <div className="w-6 text-center flex-shrink-0">
                  {idx < 3
                    ? <span className="text-base">{RANK_ICONS[idx]}</span>
                    : <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                  }
                </div>

                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: lv2.color }}
                >
                  {r.userName.charAt(0).toUpperCase()}
                </div>

                {/* Name + level */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
                    {r.userName}
                    {isMe && <span className="text-[10px] text-brand-600 font-bold">(you)</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-base leading-none">{lv2.emoji}</span>
                    <span className="text-[11px] font-semibold" style={{ color: lv2.color }}>{lv2.label}</span>
                    <span className="text-[10px] text-gray-400">· {r.activitiesLogged} activities · {r.wonDeals} wins</span>
                  </div>
                </div>

                {/* Points + bar */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black text-gray-800">{r.totalPoints.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 font-medium">pts</div>
                </div>
                <div className="w-16 ml-1 flex-shrink-0">
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (r.totalPoints / (Math.max(...rankings.map(x => x.totalPoints)) || 1)) * 100)}%`,
                        background: lv2.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Points Cheat Sheet ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-500" /> How to Earn Points
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-y divide-x divide-gray-50">
          {[
            { label: 'Log a Note',          pts: ACTIVITY_POINTS.note,              icon: '📝' },
            { label: 'Send an Email',        pts: ACTIVITY_POINTS.email,             icon: '📧' },
            { label: 'Make a Call',          pts: ACTIVITY_POINTS.call,              icon: '📞' },
            { label: 'Site Visit',           pts: ACTIVITY_POINTS.visit,             icon: '🚗' },
            { label: 'Send a Quote',         pts: ACTIVITY_POINTS.quote_sent,        icon: '📋' },
            { label: 'Place an Order',       pts: ACTIVITY_POINTS.order_placed,      icon: '🎉' },
            { label: 'Create a Lead',        pts: STAGE_POINTS.lead!,               icon: '🌱' },
            { label: 'Close a Deal (small)', pts: 20,                               icon: '🏅' },
            { label: 'Close a Deal ($10k+)', pts: 100,                              icon: '🏆' },
            { label: 'Close a Deal ($25k+)', pts: 200,                              icon: '👑' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5 px-4 py-2.5">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{item.label}</div>
              </div>
              <div className="text-sm font-black text-green-600 flex-shrink-0">+{item.pts}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-brand-50 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Zap size={12} className="text-yellow-500" />
            <strong className="font-bold">Tip:</strong> Consistent daily activity earns the fastest points!
          </div>
        </div>
      </div>

      {/* ── My Activity Breakdown ─────────────────────────────────────── */}
      {myStats && activityBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Your Activity Breakdown</h3>
          </div>
          <div className="p-4 space-y-2">
            {activityBreakdown.map(([type, count]) => {
              const meta  = ACTIVITY_META[type];
              const pts   = ACTIVITY_POINTS[type];
              const total = count * pts;
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                    <span className={meta.color}>{meta.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-medium text-gray-700">{meta.label}</span>
                      <span className="font-bold text-gray-800">{count}× = <span className="text-green-600">+{total} pts</span></span>
                    </div>
                    <div className="h-1 rounded-full bg-gray-100">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${Math.min(100, (count / (activityBreakdown[0][1] || 1)) * 100)}%`,
                          background: meta.color.replace('text-', '').replace('-600', '').replace('-700', ''),
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Workflow Definition ────────────────────────────────────────────────── */

const CRM_WORKFLOW: WorkflowStep[] = [
  { type: 'start', icon: '🎯', label: 'New Lead Identified',
    description: 'A potential customer expresses interest — inbound call, referral, or outreach.' },
  { type: 'action', icon: '➕', label: 'Create Opportunity',
    description: 'Click "New Opp" → select customer, service type, estimated value, and assign to a sales rep.' },
  { type: 'action', icon: '📞', label: 'Log Activities',
    description: 'Record every touchpoint: calls (12 pts), emails (8 pts), visits (25 pts), notes (5 pts).' },
  { type: 'decision', icon: '❓', label: 'Quote Requested?',
    branches: [
      { label: '✓ Yes — Send Quote', color: 'green',
        steps: [
          { label: 'Create quote in Quotes module' },
          { label: 'Log "Quote Sent" activity (+30 pts)' },
          { label: 'Stage advances → Quoted' },
        ]},
      { label: '✗ No — Continue Follow-up', color: 'amber',
        steps: [
          { label: 'Schedule a follow-up activity' },
          { label: 'Move stage to Prospect (+20 pts)' },
        ]},
    ]},
  { type: 'action', icon: '🔄', label: 'Stage Progression',
    description: 'Lead → Prospect → Quoted → Negotiating. Each advance earns stage points on the leaderboard.' },
  { type: 'decision', icon: '🏁', label: 'Deal Closes?',
    branches: [
      { label: '🏆 Won', color: 'green',
        steps: [
          { label: 'Stage → Won (+deal value points)' },
          { label: 'Log "Order Placed" (+40 pts)' },
          { label: 'Job order created in Pending Jobs' },
        ]},
      { label: '✗ Lost', color: 'red',
        steps: [
          { label: 'Stage → Lost (+5 pts for effort)' },
          { label: 'Log lost reason as a note' },
        ]},
    ]},
  { type: 'end', icon: '🎉', label: 'Revenue Realised',
    description: 'Won deal flows to Invoicing. Points tallied on the Leaderboard tab.' },
];

/* ─── Main Component ─────────────────────────────────────────────────────── */

type CRMTab = 'today' | 'pipeline' | 'scores' | 'activities' | 'forecast' | 'analytics' | 'leaderboard';

export function CRM() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<CRMTab>('today');
  const [showOppModal,      setShowOppModal]      = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingOpp,        setEditingOpp]        = useState<CRMOpportunity | null>(null);
  const [prefillCustomer,   setPrefillCustomer]   = useState('');

  const openNewOpp = (customerId = '') => {
    setEditingOpp(null);
    setPrefillCustomer(customerId);
    setShowOppModal(true);
  };

  const customerScores = useMemo(() =>
    state.customers.map(c => computeCustomerScore(c as any, state.jobs as any, state.invoices as any))
      .sort((a, b) => b.totalScore - a.totalScore),
    [state.customers, state.jobs, state.invoices],
  );

  // KPI calculations
  const totalPipelineValue = useMemo(() =>
    state.crmOpportunities.filter(o => ACTIVE_STAGES.includes(o.stage))
      .reduce((s, o) => s + o.estimatedValue * (o.probability / 100), 0),
    [state.crmOpportunities],
  );

  const wonThisMonth = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    return state.crmOpportunities
      .filter(o => o.stage === 'won' && new Date(o.updatedAt) >= start)
      .reduce((s, o) => s + o.estimatedValue, 0);
  }, [state.crmOpportunities]);

  const winRate = useMemo(() => {
    const closed = state.crmOpportunities.filter(o => o.stage === 'won' || o.stage === 'lost');
    return closed.length ? Math.round((closed.filter(o => o.stage === 'won').length / closed.length) * 100) : 0;
  }, [state.crmOpportunities]);

  const overdueFollowUps = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return state.crmActivities.filter(a => a.nextActionDate && a.nextActionDate < today).length;
  }, [state.crmActivities]);

  const TABS: { id: CRMTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'today',      label: 'Today',           icon: <Inbox size={15} />,       badge: overdueFollowUps || undefined },
    { id: 'pipeline',   label: 'Pipeline',        icon: <Target size={15} />       },
    { id: 'scores',     label: 'Scores',          icon: <Award size={15} />        },
    { id: 'activities', label: 'Activities',      icon: <Activity size={15} />     },
    { id: 'forecast',   label: 'Forecast',        icon: <TrendingUp size={15} />   },
    { id: 'analytics',   label: 'Analytics',    icon: <BarChart2 size={15} />   },
    { id: 'leaderboard', label: 'Leaderboard',  icon: <Trophy size={15} />      },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 px-6 pt-4 pb-0 mb-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <TrendingUp size={20} className="text-[#1f355e] flex-shrink-0" /> CRM &amp; Sales
            <WorkflowHelp title="CRM & Sales Workflow" description="How leads move from first contact to closed deal and leaderboard points." steps={CRM_WORKFLOW} />
            <GuidedTourButton steps={CRM_TOUR} />
          </h1>
          <div data-tour="crm-actions" className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowActivityModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Activity size={14} /> Log Activity
            </button>
            <button
              onClick={() => openNewOpp()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f355e] text-white rounded-lg text-sm font-semibold hover:bg-[#2a4a80] transition-colors shadow-sm"
            >
              <Plus size={14} /> New Opp
            </button>
          </div>
        </div>

        {/* KPI Strip — scrollable on narrow viewports */}
        <div data-tour="crm-kpi" className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { label: 'Pipeline',  value: formatCurrency(totalPipelineValue), icon: <Target size={15} />,    color: 'text-[#1f355e]',  bg: 'bg-[#1f355e]/8' },
            { label: 'Won / Mo',  value: formatCurrency(wonThisMonth),       icon: <CheckCircle size={15} />, color: 'text-green-700', bg: 'bg-green-50'    },
            { label: 'Win Rate',  value: `${winRate}%`,                      icon: <Zap size={15} />,        color: 'text-yellow-700', bg: 'bg-yellow-50'  },
            { label: 'Active',    value: String(state.crmOpportunities.filter(o => ACTIVE_STAGES.includes(o.stage)).length), icon: <Hash size={15} />, color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'Overdue',   value: String(overdueFollowUps),           icon: <Bell size={15} />,       color: overdueFollowUps > 0 ? 'text-red-600' : 'text-gray-400', bg: overdueFollowUps > 0 ? 'bg-red-50' : 'bg-gray-50' },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-lg px-3 py-2 flex items-center gap-2 flex-shrink-0`}>
              <span className={k.color}>{k.icon}</span>
              <div>
                <p className="text-xs text-gray-400 leading-none">{k.label}</p>
                <p className={`text-sm font-bold ${k.color} leading-tight`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs — scrollable */}
        <div data-tour="crm-tabs" className="flex gap-0.5 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === t.id
                  ? 'border-[#1f355e] text-[#1f355e]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {t.icon} {t.label}
              {t.badge ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto pt-4">
        {activeTab === 'today' && (
          <TodayTab
            opportunities={state.crmOpportunities}
            activities={state.crmActivities}
            onLogActivity={() => setShowActivityModal(true)}
            onNewOpp={() => openNewOpp()}
            onEditOpp={o => { setEditingOpp(o); setShowOppModal(true); }}
            onMarkDone={(act) => dispatch({
              type: 'UPDATE_CRM_ACTIVITY',
              payload: { ...act, nextActionDate: undefined, nextAction: undefined },
            })}
          />
        )}
        {activeTab === 'pipeline' && (
          <PipelineTab
            opportunities={state.crmOpportunities}
            onEdit={o => { setEditingOpp(o); setShowOppModal(true); }}
            onDelete={id => dispatch({ type: 'DELETE_CRM_OPPORTUNITY', payload: id })}
            onStageChange={(opp, stage) => dispatch({
              type: 'UPDATE_CRM_OPPORTUNITY',
              payload: { ...opp, stage, probability: STAGE_PROBABILITY[stage], updatedAt: new Date().toISOString() },
            })}
            onNewOpp={openNewOpp}
          />
        )}
        {activeTab === 'scores' && (
          <ScoresTab scores={customerScores} />
        )}
        {activeTab === 'activities' && (
          <ActivitiesTab
            activities={state.crmActivities}
            customers={state.customers}
            onMarkDone={(act) => dispatch({
              type: 'UPDATE_CRM_ACTIVITY',
              payload: { ...act, nextActionDate: undefined, nextAction: undefined },
            })}
          />
        )}
        {activeTab === 'forecast' && (
          <ForecastTab opportunities={state.crmOpportunities} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            opportunities={state.crmOpportunities}
            activities={state.crmActivities}
            scores={customerScores}
          />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab
            activities={state.crmActivities}
            opportunities={state.crmOpportunities}
            currentUserId={state.currentUser?.id ?? ''}
          />
        )}
      </div>

      {showOppModal && (
        <OpportunityModal
          customers={state.customers}
          existing={editingOpp}
          prefillCustomerId={prefillCustomer}
          currentUser={state.currentUser}
          onSave={(opp: CRMOpportunity) => {
            if (editingOpp) dispatch({ type: 'UPDATE_CRM_OPPORTUNITY', payload: opp });
            else            dispatch({ type: 'ADD_CRM_OPPORTUNITY',    payload: opp });
            setShowOppModal(false);
          }}
          onClose={() => setShowOppModal(false)}
        />
      )}

      {showActivityModal && (
        <ActivityModal
          customers={state.customers}
          currentUser={state.currentUser}
          onSave={(act: CRMActivity) => {
            dispatch({ type: 'ADD_CRM_ACTIVITY', payload: act });
            setShowActivityModal(false);
          }}
          onClose={() => setShowActivityModal(false)}
        />
      )}
    </div>
  );
}

/* ─── Today / Inbox Tab ──────────────────────────────────────────────────── */

function TodayTab({ opportunities, activities, onLogActivity, onNewOpp, onEditOpp, onMarkDone }: {
  opportunities: CRMOpportunity[];
  activities: CRMActivity[];
  onLogActivity: () => void;
  onNewOpp: () => void;
  onEditOpp: (o: CRMOpportunity) => void;
  onMarkDone: (a: CRMActivity) => void;
}) {
  const today     = new Date().toISOString().slice(0, 10);
  const in7days   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const overdueFollowUps = activities.filter(a => a.nextActionDate && a.nextActionDate < today)
    .sort((a, b) => a.nextActionDate!.localeCompare(b.nextActionDate!));

  const dueToday = activities.filter(a => a.nextActionDate === today);

  const closingSoon = opportunities
    .filter(o => ACTIVE_STAGES.includes(o.stage) && o.expectedCloseDate >= today && o.expectedCloseDate <= in7days)
    .sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate));

  const recentWins = opportunities
    .filter(o => o.stage === 'won' && daysSince(o.updatedAt) <= 14)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const isEmpty = !overdueFollowUps.length && !dueToday.length && !closingSoon.length && !recentWins.length;

  if (isEmpty) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">All caught up!</h2>
        <p className="text-gray-500 mb-6">No overdue follow-ups or urgent items. Great work.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onLogActivity} className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Activity size={15} /> Log Activity
          </button>
          <button onClick={onNewOpp} className="flex items-center gap-2 px-5 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80]">
            <Plus size={15} /> New Opportunity
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Overdue follow-ups */}
      {overdueFollowUps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-sm font-bold text-red-600 uppercase tracking-wide">
              Overdue Follow-ups — {overdueFollowUps.length}
            </h2>
          </div>
          <div className="space-y-2">
            {overdueFollowUps.map(act => (
              <FollowUpCard key={act.id} activity={act} variant="overdue" onMarkDone={() => onMarkDone(act)} />
            ))}
          </div>
        </section>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide">
              Due Today — {dueToday.length}
            </h2>
          </div>
          <div className="space-y-2">
            {dueToday.map(act => (
              <FollowUpCard key={act.id} activity={act} variant="today" onMarkDone={() => onMarkDone(act)} />
            ))}
          </div>
        </section>
      )}

      {/* Closing soon */}
      {closingSoon.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-[#1f355e] rounded-full" />
            <h2 className="text-sm font-bold text-[#1f355e] uppercase tracking-wide">
              Closing This Week — {closingSoon.length}
            </h2>
          </div>
          <div className="space-y-2">
            {closingSoon.map(opp => {
              const d = daysFromNow(opp.expectedCloseDate);
              const stage = PIPELINE_STAGES.find(s => s.id === opp.stage);
              const svc   = SERVICE_BADGE[opp.serviceType];
              return (
                <div key={opp.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900 truncate">{opp.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${svc.color}`}>{svc.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{opp.customerName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(opp.estimatedValue)}</p>
                    <p className={`text-xs font-medium ${d === 0 ? 'text-red-600' : d <= 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {d === 0 ? 'closes today' : `${d}d left`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${stage?.bg} ${stage?.color}`}>{stage?.label}</span>
                  <button onClick={() => onEditOpp(opp)} className="text-gray-400 hover:text-[#1f355e] transition-colors">
                    <Edit2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent wins */}
      {recentWins.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <h2 className="text-sm font-bold text-green-700 uppercase tracking-wide">
              Recent Wins
            </h2>
          </div>
          <div className="space-y-2">
            {recentWins.map(opp => (
              <div key={opp.id} className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{opp.title}</p>
                  <p className="text-xs text-gray-500">{opp.customerName} · {dateLabel(opp.updatedAt)}</p>
                </div>
                <span className="text-sm font-bold text-green-700">{formatCurrency(opp.estimatedValue)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FollowUpCard({ activity, variant, onMarkDone }: {
  activity: CRMActivity;
  variant: 'overdue' | 'today';
  onMarkDone: () => void;
}) {
  const meta = ACTIVITY_META[activity.type];
  const daysAgo = activity.nextActionDate ? Math.floor((Date.now() - new Date(activity.nextActionDate).getTime()) / 86400000) : 0;

  return (
    <div className={clsx(
      'bg-white rounded-xl border px-4 py-3 flex items-start gap-3',
      variant === 'overdue' ? 'border-red-200' : 'border-amber-200',
    )}>
      <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0 ${meta.color}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900">{activity.nextAction || activity.subject}</span>
          {variant === 'overdue' && daysAgo > 0 && (
            <span className="text-xs text-red-600 font-medium">{daysAgo}d overdue</span>
          )}
        </div>
        <p className="text-xs text-gray-500">{activity.customerName} · {meta.label}</p>
        {activity.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{activity.notes}</p>}
      </div>
      <button
        onClick={onMarkDone}
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-600 rounded-lg font-medium transition-colors flex-shrink-0"
      >
        <CheckCircle size={12} /> Done
      </button>
    </div>
  );
}

/* ─── Pipeline Tab ───────────────────────────────────────────────────────── */

function PipelineTab({ opportunities, onEdit, onDelete, onStageChange, onNewOpp }: {
  opportunities: CRMOpportunity[];
  onEdit: (o: CRMOpportunity) => void;
  onDelete: (id: string) => void;
  onStageChange: (o: CRMOpportunity, stage: PipelineStage) => void;
  onNewOpp: (customerId?: string) => void;
}) {
  const [search,      setSearch]      = useState('');
  const [filterSvc,   setFilterSvc]   = useState<ServiceType | 'all'>('all');
  const [view,        setView]        = useState<'active' | 'all'>('active');

  const visibleStages = view === 'active'
    ? PIPELINE_STAGES.filter(s => ACTIVE_STAGES.includes(s.id))
    : PIPELINE_STAGES;

  const filtered = useMemo(() =>
    opportunities.filter(o =>
      (!search || o.title.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase())) &&
      (filterSvc === 'all' || o.serviceType === filterSvc),
    ),
    [opportunities, search, filterSvc],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search opportunities…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 w-56"
          />
        </div>
        <select
          value={filterSvc}
          onChange={e => setFilterSvc(e.target.value as any)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30"
        >
          <option value="all">All Services</option>
          {(Object.keys(SERVICE_BADGE) as ServiceType[]).map(s => (
            <option key={s} value={s}>{SERVICE_BADGE[s].label}</option>
          ))}
        </select>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {(['active','all'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={clsx('px-3 py-2 text-sm font-medium transition-colors', view === v ? 'bg-[#1f355e] text-white' : 'text-gray-600 hover:bg-gray-50')}
            >
              {v === 'active' ? 'Active' : 'All Stages'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} opportunit{filtered.length !== 1 ? 'ies' : 'y'}</span>
        <button
          onClick={() => {
            const cols: ExportColumn<CRMOpportunity>[] = [
              { key: 'customerName', header: 'Company' },
              { key: 'title', header: 'Title' },
              { key: 'stage', header: 'Stage', format: v => PIPELINE_STAGES.find(s => s.id === v)?.label ?? v },
              { key: 'estimatedValue', header: 'Value', format: v => formatCurrency(v) },
              { key: 'probability', header: 'Probability', format: v => `${v}%` },
              { key: 'expectedCloseDate', header: 'Expected Close', format: v => formatDate(v) },
              { key: 'assignedToName', header: 'Owner' },
              { key: 'createdAt', header: 'Created', format: v => formatDate(v) },
            ];
            exportToCSV(filtered, cols, 'pipeline-export');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
          title="Export to CSV"
        >
          <Download size={13} /> Export
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '65vh' }}>
        {visibleStages.map(stage => {
          const stagOpps = filtered.filter(o => o.stage === stage.id);
          const total    = stagOpps.reduce((s, o) => s + o.estimatedValue, 0);
          const weighted = stagOpps.reduce((s, o) => s + o.estimatedValue * (o.probability / 100), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-[260px] flex flex-col">
              {/* Column header */}
              <div className={`${stage.bg} border ${stage.border} rounded-xl px-3 py-2.5 mb-2`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${stage.color}`}>{stage.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.color}`}>
                      {stagOpps.length}
                    </span>
                    <button
                      onClick={() => onNewOpp()}
                      className={`w-5 h-5 rounded-full bg-white/70 hover:bg-white flex items-center justify-center ${stage.color} transition-colors`}
                      title="Add opportunity"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{formatCurrency(total)} · <span className="text-gray-400">{formatCurrency(weighted)} wtd</span></p>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1">
                {stagOpps.length === 0 && (
                  <div className="text-center py-8 text-gray-300 text-xs border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2">
                    <Target size={20} className="opacity-40" />
                    No opportunities
                  </div>
                )}
                {stagOpps.map(opp => (
                  <OppCard
                    key={opp.id}
                    opp={opp}
                    onEdit={() => onEdit(opp)}
                    onDelete={() => onDelete(opp.id)}
                    onStageChange={s => onStageChange(opp, s)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OppCard({ opp, onEdit, onDelete, onStageChange }: {
  opp: CRMOpportunity;
  onEdit: () => void;
  onDelete: () => void;
  onStageChange: (s: PipelineStage) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const d      = daysFromNow(opp.expectedCloseDate);
  const stage  = PIPELINE_STAGES.find(s => s.id === opp.stage)!;
  const svc    = SERVICE_BADGE[opp.serviceType];
  const stageIdx = PIPELINE_STAGES.indexOf(stage);
  const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;
  const nextStage = stageIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIdx + 1] : null;

  const closeDateColor =
    d < 0  ? 'text-red-500' :
    d <= 3 ? 'text-amber-600' :
    d <= 7 ? 'text-yellow-600' : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:shadow-md transition-all group">
      {/* Title + menu */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 flex-1">{opp.title}</p>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1 w-40" onClick={e => e.stopPropagation()}>
              <button onClick={() => { onEdit(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">
                <Edit2 size={12} /> Edit
              </button>
              <div className="border-t border-gray-100 my-1" />
              {PIPELINE_STAGES.filter(s => s.id !== opp.stage && s.id !== 'inactive').map(s => (
                <button key={s.id} onClick={() => { onStageChange(s.id); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 text-gray-600">
                  <ArrowRight size={12} /> → {s.label}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-50 text-red-600">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer + service badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-xs text-gray-500 flex-1 truncate">{opp.customerName}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${svc.color} flex-shrink-0`}>{svc.label}</span>
      </div>

      {/* Value + probability */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-gray-900">{formatCurrency(opp.estimatedValue)}</span>
        <span className="text-xs font-semibold text-[#1f355e]">{opp.probability}%</span>
      </div>

      {/* Probability bar */}
      <div className="h-1 bg-gray-100 rounded-full mb-2 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', opp.stage === 'won' ? 'bg-green-500' : opp.stage === 'lost' ? 'bg-red-400' : 'bg-[#1f355e]')}
          style={{ width: `${opp.probability}%` }}
        />
      </div>

      {/* Footer: close date + quick advance */}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${closeDateColor}`}>
          {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'closes today' : `${d}d`}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {prevStage && (
            <button onClick={() => onStageChange(prevStage.id)} title={`Move to ${prevStage.label}`}
              className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
              <ChevronLeft size={11} />
            </button>
          )}
          {nextStage && (
            <button onClick={() => onStageChange(nextStage.id)} title={`Move to ${nextStage.label}`}
              className="w-5 h-5 flex items-center justify-center rounded bg-[#1f355e]/10 hover:bg-[#1f355e]/20 text-[#1f355e] transition-colors">
              <ChevronRight size={11} />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400">{opp.assignedToName.split(' ')[0]}</span>
      </div>
    </div>
  );
}

/* ─── Customer Scores Tab ────────────────────────────────────────────────── */

function ScoresTab({ scores }: { scores: CustomerScore[] }) {
  const [filterTier, setFilterTier] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'revenue' | 'loyalty'>('score');

  const filtered = (filterTier === 'all' ? scores : scores.filter(s => s.tier === filterTier))
    .slice().sort((a, b) =>
      sortBy === 'score'   ? b.totalScore - a.totalScore :
      sortBy === 'revenue' ? b.revenueScore - a.revenueScore :
                             b.loyaltyScore - a.loyaltyScore,
    );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          <button onClick={() => setFilterTier('all')}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', filterTier === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
            All
          </button>
          {Object.entries(TIER_CONFIG).map(([tier, cfg]) => (
            <button key={tier} onClick={() => setFilterTier(tier)}
              className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border', filterTier === tier ? `${cfg.bg} ${cfg.color} border-transparent` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
          Sort:
          {(['score','revenue','loyalty'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors capitalize', sortBy === s ? 'bg-[#1f355e] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Frequency</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Loyalty</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const tier = TIER_CONFIG[s.tier];
              return (
                <tr key={s.customerId} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{s.customerName}</p>
                    {s.lastOrderDate && (
                      <p className="text-xs text-gray-400">Last order {new Date(s.lastOrderDate).toLocaleDateString()}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tier.bg} ${tier.color}`}>
                      {tier.icon} {tier.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base font-bold text-gray-900">{s.totalScore}</span>
                      <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.totalScore >= 80 ? 'bg-purple-500' : s.totalScore >= 60 ? 'bg-yellow-500' : s.totalScore >= 40 ? 'bg-gray-400' : 'bg-orange-400'}`}
                          style={{ width: `${s.totalScore}%` }} />
                      </div>
                    </div>
                  </td>
                  <ScoreCell value={s.revenueScore}   max={25} />
                  <ScoreCell value={s.frequencyScore} max={20} />
                  <ScoreCell value={s.paymentScore}   max={20} />
                  <ScoreCell value={s.marginScore}    max={20} />
                  <ScoreCell value={s.loyaltyScore}   max={15} />
                  <td className="px-3 py-3 text-center">
                    {s.riskFlag ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                        <AlertCircle size={10} />
                        {s.riskFlag === 'overdue_balance' ? 'Overdue' : s.riskFlag === 'declining_orders' ? 'Declining' : 'Inactive'}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">✓ OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">No customers in this tier</div>
        )}
      </div>
    </div>
  );
}

function ScoreCell({ value, max }: { value: number; max: number }) {
  const pct   = Math.round((value / max) * 100);
  const color = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-400';
  return (
    <td className="px-3 py-3 text-center">
      <span className={`text-sm font-semibold ${color}`}>{value}<span className="text-gray-300 text-xs">/{max}</span></span>
    </td>
  );
}

/* ─── Activities Tab ─────────────────────────────────────────────────────── */

function ActivitiesTab({ activities, customers, onMarkDone }: {
  activities: CRMActivity[];
  customers: any[];
  onMarkDone: (a: CRMActivity) => void;
}) {
  const [filterType,  setFilterType]  = useState<ActivityType | 'all'>('all');
  const [filterCust,  setFilterCust]  = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const filtered = activities
    .filter(a => filterType === 'all' || a.type === filterType)
    .filter(a => !filterCust || a.customerId === filterCust)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const overdue  = filtered.filter(a => a.nextActionDate && a.nextActionDate < today);
  const rest     = filtered.filter(a => !(a.nextActionDate && a.nextActionDate < today));

  // Group rest by date bucket
  const groups: { label: string; items: CRMActivity[] }[] = [];
  const todayStr     = new Date().toDateString();
  const yesterStr    = new Date(Date.now() - 86400000).toDateString();
  const weekAgo      = Date.now() - 7 * 86400000;

  const buckets = { today: [] as CRMActivity[], yesterday: [] as CRMActivity[], thisWeek: [] as CRMActivity[], older: [] as CRMActivity[] };
  for (const a of rest) {
    const ds = new Date(a.createdAt).toDateString();
    if (ds === todayStr)       buckets.today.push(a);
    else if (ds === yesterStr) buckets.yesterday.push(a);
    else if (new Date(a.createdAt).getTime() > weekAgo) buckets.thisWeek.push(a);
    else buckets.older.push(a);
  }
  if (buckets.today.length)    groups.push({ label: 'Today',      items: buckets.today    });
  if (buckets.yesterday.length)groups.push({ label: 'Yesterday',  items: buckets.yesterday});
  if (buckets.thisWeek.length) groups.push({ label: 'This Week',  items: buckets.thisWeek });
  if (buckets.older.length)    groups.push({ label: 'Earlier',    items: buckets.older    });

  return (
    <div className="max-w-3xl">
      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterType('all')}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', filterType === 'all' ? 'bg-[#1f355e] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
            All
          </button>
          {(Object.keys(ACTIVITY_META) as ActivityType[]).map(t => {
            const m = ACTIVITY_META[t];
            return (
              <button key={t} onClick={() => setFilterType(t)}
                className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors', filterType === t ? `${m.bg} ${m.color} border-transparent` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
        <select value={filterCust} onChange={e => setFilterCust(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30">
          <option value="">All Customers</option>
          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => {
            const cols: ExportColumn<CRMActivity>[] = [
              { key: 'createdAt', header: 'Date', format: v => formatDate(v as string) },
              { key: 'type', header: 'Type', format: (v, row) => ACTIVITY_META[row.type]?.label ?? '' },
              { key: 'subject', header: 'Contact / Subject' },
              { key: 'customerName', header: 'Company' },
              { key: 'notes', header: 'Description', format: v => (v as string) ?? '' },
              { key: 'outcome', header: 'Outcome', format: v => (v as string) ?? '' },
            ];
            exportToCSV(filtered, cols, 'activities-export');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors ml-auto"
          title="Export to CSV"
        >
          <Download size={13} /> Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Activity size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No activities logged yet</p>
          <p className="text-sm mt-1">Use "Log Activity" to record calls, emails, visits, and more</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue follow-ups */}
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Overdue Follow-ups — {overdue.length}</p>
              </div>
              <div className="space-y-2">
                {overdue.map(a => <ActivityRow key={a.id} activity={a} onMarkDone={() => onMarkDone(a)} showMarkDone />)}
              </div>
            </div>
          )}

          {/* Date groups */}
          {groups.map(g => (
            <div key={g.label}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{g.label}</p>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-2">
                {g.items.map(a => <ActivityRow key={a.id} activity={a} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity: a, showMarkDone = false, onMarkDone }: { activity: CRMActivity; showMarkDone?: boolean; onMarkDone?: () => void }) {
  const meta = ACTIVITY_META[a.type];
  const outcomeColor =
    a.outcome === 'positive' ? 'bg-green-100 text-green-700' :
    a.outcome === 'negative' ? 'bg-red-100 text-red-700'     : 'bg-gray-100 text-gray-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow">
      <div className={`w-8 h-8 rounded-full ${meta.bg} ${meta.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-gray-900">{a.subject}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.bg} ${meta.color}`}>{meta.label}</span>
          {a.outcome && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${outcomeColor}`}>{a.outcome}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-1">{a.customerName} · {a.userName} · {new Date(a.createdAt).toLocaleDateString()}</p>
        {a.notes && <p className="text-sm text-gray-700">{a.notes}</p>}
        {a.nextAction && (
          <p className="text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
            <Clock size={10} /> Next: {a.nextAction}
            {a.nextActionDate && ` · ${new Date(a.nextActionDate).toLocaleDateString()}`}
          </p>
        )}
      </div>
      {showMarkDone && onMarkDone && (
        <button onClick={onMarkDone}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-600 rounded-lg font-medium transition-colors flex-shrink-0">
          <CheckCircle size={12} /> Done
        </button>
      )}
    </div>
  );
}

/* ─── Forecast Tab ───────────────────────────────────────────────────────── */

function ForecastTab({ opportunities }: { opportunities: CRMOpportunity[] }) {
  const [weighted, setWeighted] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const periods = [30, 60, 90].map(days => {
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const opps   = opportunities.filter(o =>
      ACTIVE_STAGES.includes(o.stage) &&
      o.expectedCloseDate >= today && o.expectedCloseDate <= cutoff,
    );
    return {
      label: `${days} Days`,
      opps,
      raw:      opps.reduce((s, o) => s + o.estimatedValue, 0),
      weighted: opps.reduce((s, o) => s + o.estimatedValue * (o.probability / 100), 0),
    };
  });

  const tableOpps = opportunities
    .filter(o => ACTIVE_STAGES.includes(o.stage) && o.expectedCloseDate >= today)
    .sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate));

  return (
    <div className="space-y-6">
      {/* Period cards */}
      <div className="grid grid-cols-3 gap-4">
        {periods.map(p => (
          <div key={p.label} className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 mb-3">{p.label}</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(weighted ? p.weighted : p.raw)}
            </p>
            <p className="text-xs text-gray-400 mb-3">
              {weighted ? 'weighted' : 'raw'} · {p.opps.length} opportunit{p.opps.length !== 1 ? 'ies' : 'y'}
            </p>
            {/* Mini stage breakdown */}
            <div className="space-y-1">
              {PIPELINE_STAGES.filter(s => ACTIVE_STAGES.includes(s.id)).map(s => {
                const cnt = p.opps.filter(o => o.stage === s.id).length;
                if (!cnt) return null;
                return (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className={`${s.color} w-16 truncate`}>{s.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.bg.replace('bg-', 'bg-').replace('-50', '-400').replace('-100', '-500')}`}
                        style={{ width: `${(cnt / p.opps.length) * 100}%` }} />
                    </div>
                    <span className="text-gray-500 w-4 text-right">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">Upcoming Opportunities</h2>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {([true, false] as const).map(w => (
            <button key={String(w)} onClick={() => setWeighted(w)}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors', weighted === w ? 'bg-[#1f355e] text-white' : 'text-gray-600 hover:bg-gray-50')}>
              {w ? 'Weighted' : 'Raw'}
            </button>
          ))}
        </div>
      </div>

      {/* Forecast table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tableOpps.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No upcoming opportunities in the pipeline</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Close Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Opportunity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {tableOpps.map(opp => {
                const d     = daysFromNow(opp.expectedCloseDate);
                const stage = PIPELINE_STAGES.find(s => s.id === opp.stage)!;
                return (
                  <tr key={opp.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{new Date(opp.expectedCloseDate).toLocaleDateString()}</p>
                      <p className={`text-xs ${d <= 7 ? 'text-amber-600' : 'text-gray-400'}`}>{d}d</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{opp.title}</p>
                      <span className={`text-xs ${SERVICE_BADGE[opp.serviceType].color} px-1.5 py-0.5 rounded-full`}>{SERVICE_BADGE[opp.serviceType].label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{opp.customerName}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.bg} ${stage.color}`}>{stage.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(opp.estimatedValue)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#1f355e]">
                      {formatCurrency(opp.estimatedValue * (opp.probability / 100))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatCurrency(tableOpps.reduce((s, o) => s + o.estimatedValue, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#1f355e]">
                  {formatCurrency(tableOpps.reduce((s, o) => s + o.estimatedValue * (o.probability / 100), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Analytics Tab ──────────────────────────────────────────────────────── */

function AnalyticsTab({ opportunities, activities, scores }: {
  opportunities: CRMOpportunity[];
  activities: CRMActivity[];
  scores: CustomerScore[];
}) {
  // Monthly won/lost value (last 6 months)
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      const wonOpps  = opportunities.filter(o => o.stage === 'won'  && o.updatedAt.startsWith(key));
      const lostOpps = opportunities.filter(o => o.stage === 'lost' && o.updatedAt.startsWith(key));
      months.push({
        month: label,
        won:      wonOpps.reduce((s, o)  => s + o.estimatedValue, 0),
        lost:     lostOpps.reduce((s, o) => s + o.estimatedValue, 0),
        wonCount: wonOpps.length,
      });
    }
    return months;
  }, [opportunities]);

  // Pipeline funnel (with conversion rates)
  const funnelData = useMemo(() => {
    return PIPELINE_STAGES.filter(s => !['inactive'].includes(s.id)).map(s => ({
      stage:  s.label,
      count:  opportunities.filter(o => o.stage === s.id).length,
      value:  opportunities.filter(o => o.stage === s.id).reduce((sum, o) => sum + o.estimatedValue, 0),
      color:  s.color,
      bg:     s.bg,
      border: s.border,
    }));
  }, [opportunities]);

  const maxFunnelCount = Math.max(...funnelData.map(d => d.count), 1);

  // Activity breakdown
  const totalActs  = activities.length;
  const actByType  = (Object.keys(ACTIVITY_META) as ActivityType[]).map(t => ({
    type: t, meta: ACTIVITY_META[t],
    count: activities.filter(a => a.type === t).length,
  })).filter(a => a.count > 0).sort((a, b) => b.count - a.count);

  // Source win/loss
  const sources = ['referral','repeat','cold_call','web','trade_show','other'] as const;

  // Avg deal metrics
  const wonOpps    = opportunities.filter(o => o.stage === 'won');
  const avgDeal    = wonOpps.length ? wonOpps.reduce((s, o) => s + o.estimatedValue, 0) / wonOpps.length : 0;
  const winRate    = (() => {
    const closed = opportunities.filter(o => o.stage === 'won' || o.stage === 'lost');
    return closed.length ? Math.round((closed.filter(o => o.stage === 'won').length / closed.length) * 100) : 0;
  })();
  const avgCycle   = wonOpps.length ? Math.round(wonOpps.reduce((s, o) => {
    return s + Math.floor((new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 86400000);
  }, 0) / wonOpps.length) : 0;

  const CHART_COLORS = { won: '#009877', lost: '#ef4444' };

  return (
    <div className="space-y-6">
      {/* Metric bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Avg Deal Size',   value: formatCurrency(avgDeal), icon: <DollarSign size={18} />, color: 'text-[#1f355e]',  bg: 'bg-[#1f355e]/8' },
          { label: 'Win Rate',        value: `${winRate}%`,           icon: <Percent size={18} />,    color: 'text-green-700',   bg: 'bg-green-50'     },
          { label: 'Avg Sales Cycle', value: avgCycle ? `${avgCycle}d` : '—', icon: <Clock size={18} />, color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className={m.color}>{m.icon}</span>
            <div>
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-[#1f355e]" /> Won vs Lost — Last 6 Months
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'won' ? 'Won' : 'Lost']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Bar dataKey="won"  fill={CHART_COLORS.won}  radius={[4,4,0,0]} name="Won"  />
            <Bar dataKey="lost" fill={CHART_COLORS.lost} radius={[4,4,0,0]} name="Lost" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Target size={16} className="text-[#1f355e]" /> Pipeline Funnel
          </h3>
          <div className="space-y-2">
            {funnelData.map((d, i) => {
              const prev = i > 0 ? funnelData[i - 1].count : null;
              const conv = prev && prev > 0 ? Math.round((d.count / prev) * 100) : null;
              return (
                <div key={d.stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20 text-right truncate">{d.stage}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${d.bg} border ${d.border} flex items-center px-2 rounded-lg transition-all`}
                      style={{ width: `${Math.max((d.count / maxFunnelCount) * 100, 4)}%` }}
                    >
                      <span className={`text-xs font-bold ${d.color}`}>{d.count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-20 text-right">{formatCurrency(d.value)}</span>
                  {conv !== null && (
                    <span className="text-xs text-gray-300 w-10 text-right">{conv}%↓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[#1f355e]" /> Activity Breakdown
          </h3>
          {actByType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No activities logged yet</p>
          ) : (
            <div className="space-y-2.5">
              {actByType.map(a => (
                <div key={a.type} className="flex items-center gap-2">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full ${a.meta.bg} ${a.meta.color} flex-shrink-0`}>{a.meta.icon}</span>
                  <span className="text-sm text-gray-600 flex-1">{a.meta.label}</span>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full ${a.meta.bg.replace('-100','-400')}`}
                      style={{ width: totalActs ? `${(a.count / totalActs) * 100}%` : '0%' }} />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-6 text-right">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Win/Loss by source */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Tag size={16} className="text-[#1f355e]" /> Win / Loss by Lead Source
        </h3>
        <div className="grid grid-cols-6 gap-3">
          {sources.map(src => {
            const srcOpps = opportunities.filter(o => o.source === src);
            const won     = srcOpps.filter(o => o.stage === 'won').length;
            const lost    = srcOpps.filter(o => o.stage === 'lost').length;
            const rate    = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;
            return (
              <div key={src} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 capitalize mb-1">{src.replace('_', ' ')}</p>
                <p className="text-2xl font-bold text-gray-900">{srcOpps.length}</p>
                <p className="text-xs mt-0.5">
                  <span className="text-green-600 font-medium">{won}W</span>
                  <span className="text-gray-400"> / </span>
                  <span className="text-red-500 font-medium">{lost}L</span>
                </p>
                {rate !== null && (
                  <p className={`text-xs font-bold mt-1 ${rate >= 50 ? 'text-green-600' : 'text-red-500'}`}>{rate}%</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer tier distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Users size={16} className="text-[#1f355e]" /> Customer Tier Distribution
        </h3>
        <div className="flex gap-3">
          {Object.entries(TIER_CONFIG).map(([tier, cfg]) => {
            const count = scores.filter(s => s.tier === tier).length;
            const pct   = scores.length ? Math.round((count / scores.length) * 100) : 0;
            return (
              <div key={tier} className={`flex-1 ${cfg.bg} rounded-xl p-3 text-center`}>
                <p className="text-xl">{cfg.icon}</p>
                <p className={`text-lg font-bold ${cfg.color}`}>{count}</p>
                <p className={`text-xs ${cfg.color} font-medium`}>{cfg.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Opportunity Modal ──────────────────────────────────────────────────── */

function OpportunityModal({ customers, existing, prefillCustomerId, currentUser, onSave, onClose }: any) {
  const defaultClose = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    customerId:       existing?.customerId       ?? prefillCustomerId ?? '',
    title:            existing?.title            ?? '',
    stage:            (existing?.stage           ?? 'lead')           as PipelineStage,
    estimatedValue:   existing?.estimatedValue   ?? 0,
    probability:      existing?.probability      ?? 10,
    expectedCloseDate:existing?.expectedCloseDate?.slice(0,10) ?? defaultClose,
    serviceType:      (existing?.serviceType     ?? 'powder_coating') as ServiceType,
    source:           existing?.source           ?? 'repeat',
    notes:            existing?.notes            ?? '',
    lostReason:       existing?.lostReason       ?? '',
  });

  const s   = (v: Partial<typeof form>) => setForm(f => ({ ...f, ...v }));
  const customerName = customers.find((c: any) => c.id === form.customerId)?.name ?? '';

  function handleSave() {
    if (!form.customerId || !form.title) return;
    onSave({
      id:                existing?.id ?? generateId(),
      customerId:        form.customerId,
      customerName,
      title:             form.title,
      stage:             form.stage,
      estimatedValue:    form.estimatedValue,
      probability:       form.probability,
      expectedCloseDate: form.expectedCloseDate,
      serviceType:       form.serviceType,
      source:            form.source,
      notes:             form.notes || undefined,
      lostReason:        form.lostReason || undefined,
      assignedToId:      currentUser.id,
      assignedToName:    currentUser.name,
      createdAt:         existing?.createdAt ?? new Date().toISOString(),
      updatedAt:         new Date().toISOString(),
    } as CRMOpportunity);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#1f355e]/5 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">{existing ? 'Edit Opportunity' : 'New Opportunity'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Customer *</label>
              <select value={form.customerId} onChange={e => s({ customerId: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50">
                <option value="">Select customer…</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Title *</label>
              <input value={form.title} onChange={e => s({ title: e.target.value })}
                placeholder="e.g. Industrial Racking Powder Coat — Q1 2026"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Stage</label>
              <select value={form.stage}
                onChange={e => s({ stage: e.target.value as PipelineStage, probability: STAGE_PROBABILITY[e.target.value as PipelineStage] })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50">
                {PIPELINE_STAGES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Service</label>
              <select value={form.serviceType} onChange={e => s({ serviceType: e.target.value as ServiceType })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50">
                {(Object.keys(SERVICE_BADGE) as ServiceType[]).map(st => (
                  <option key={st} value={st}>{SERVICE_BADGE[st].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Value ($)</label>
              <input type="number" min={0} value={form.estimatedValue} onChange={e => s({ estimatedValue: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Probability (%)</label>
              <input type="number" min={0} max={100} value={form.probability} onChange={e => s({ probability: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Close Date</label>
              <input type="date" value={form.expectedCloseDate} onChange={e => s({ expectedCloseDate: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Source</label>
              <select value={form.source} onChange={e => s({ source: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50">
                {['referral','repeat','cold_call','web','trade_show','other'].map(src => (
                  <option key={src} value={src}>{src.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {form.stage === 'lost' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Lost Reason</label>
                <input value={form.lostReason} onChange={e => s({ lostReason: e.target.value })}
                  placeholder="Why was this opportunity lost?"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => s({ notes: e.target.value })}
                placeholder="Any context, requirements, or reminders…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.customerId || !form.title}
            className="flex-1 px-4 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80] transition-colors shadow-sm disabled:opacity-40">
            {existing ? 'Save Changes' : 'Create Opportunity'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Modal ─────────────────────────────────────────────────────── */

function ActivityModal({ customers, currentUser, onSave, onClose }: any) {
  const [form, setForm] = useState({
    customerId:    '',
    type:          'call' as ActivityType,
    subject:       '',
    notes:         '',
    outcome:       '' as '' | 'positive' | 'neutral' | 'negative',
    nextAction:    '',
    nextActionDate:'',
  });

  const s = (v: any) => setForm(f => ({ ...f, ...v }));
  const customerName = customers.find((c: any) => c.id === form.customerId)?.name ?? '';

  function handleSave() {
    if (!form.customerId || !form.subject) return;
    onSave({
      id:             generateId(),
      customerId:     form.customerId,
      customerName,
      type:           form.type,
      subject:        form.subject,
      notes:          form.notes || undefined,
      outcome:        form.outcome || undefined,
      nextAction:     form.nextAction || undefined,
      nextActionDate: form.nextActionDate || undefined,
      userId:         currentUser.id,
      userName:       currentUser.name,
      createdAt:      new Date().toISOString(),
    } as CRMActivity);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Log Activity</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Activity type as icon buttons */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Activity Type</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ACTIVITY_META) as ActivityType[]).map(t => {
                const m = ACTIVITY_META[t];
                return (
                  <button key={t} onClick={() => s({ type: t })}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                      form.type === t ? `${m.bg} ${m.color} border-transparent shadow-sm` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                    )}>
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Customer *</label>
            <select value={form.customerId} onChange={e => s({ customerId: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50">
              <option value="">Select customer…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Subject *</label>
            <input value={form.subject} onChange={e => s({ subject: e.target.value })}
              placeholder="Brief summary of the interaction…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Outcome</label>
            <div className="flex gap-2">
              {(['positive','neutral','negative'] as const).map(o => (
                <button key={o} onClick={() => s({ outcome: form.outcome === o ? '' : o })}
                  className={clsx(
                    'flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize',
                    form.outcome === o
                      ? o === 'positive' ? 'bg-green-100 text-green-700 border-green-200'
                        : o === 'negative' ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-gray-200 text-gray-700 border-gray-300'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => s({ notes: e.target.value })}
              placeholder="Details, what was discussed…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Next Action</label>
              <input value={form.nextAction} onChange={e => s({ nextAction: e.target.value })}
                placeholder="e.g. Follow up on quote"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">By Date</label>
              <input type="date" value={form.nextActionDate} onChange={e => s({ nextActionDate: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 bg-gray-50" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.customerId || !form.subject}
            className="flex-1 px-4 py-2.5 bg-[#009877] text-white rounded-xl text-sm font-semibold hover:bg-[#007a61] transition-colors shadow-sm disabled:opacity-40">
            Log Activity
          </button>
        </div>
      </div>
    </div>
  );
}
