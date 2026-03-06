/**
 * Logistics.tsx
 * Logistics & Scheduling module: Schedule Board, Driver Run Sheet,
 * Receiver Briefing, Outbound Queue — cross-department communication
 */

import React, { useState, useMemo } from 'react';
import {
  Truck, Package, Calendar, ClipboardList, ArrowUp, ArrowDown,
  Plus, CheckCircle, Clock, AlertCircle, X, MapPin, User,
  Phone, MessageSquare, ChevronUp, ChevronDown, Layers,
  Navigation, RotateCcw, Edit2, Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { generateId } from '../../utils';
import type { LogisticsStop, DriverRunSheet, LogisticsStopStatus, RunSheetStatus } from '../../types';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';

const LOGISTICS_TOUR: TourStep[] = [
  { selector: '[data-tour="logi-kpis"]',    title: 'Daily KPIs',         why: 'At a glance: how many stops, inbound vs outbound, and jobs ready to ship today.',               what: 'Review every morning. "Jobs Ready Ship" tells you what can go out on the next truck.' },
  { selector: '[data-tour="logi-actions"]',  title: 'Actions',            why: 'Create run sheets for drivers and add pickup/delivery stops to the schedule.',                   what: 'Click "Add Stop" for a new pickup or delivery. "Create Run Sheet" bundles stops into a driver route.' },
  { selector: '[data-tour="logi-tabs"]',     title: 'View Tabs',          why: 'Separates the schedule board, driver run sheets, receiver briefing, and outbound queue.',        what: 'Start with Schedule Board for the day view. Check Outbound Queue for ready-to-ship jobs.' },
];

/* ─── Constants ─────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<LogisticsStopStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  scheduled:  { label: 'Scheduled',  color: 'text-gray-600',   bg: 'bg-gray-100',   icon: <Clock size={13} /> },
  confirmed:  { label: 'Confirmed',  color: 'text-blue-600',   bg: 'bg-blue-100',   icon: <CheckCircle size={13} /> },
  en_route:   { label: 'En Route',   color: 'text-yellow-700', bg: 'bg-yellow-100', icon: <Navigation size={13} /> },
  arrived:    { label: 'Arrived',    color: 'text-purple-600', bg: 'bg-purple-100', icon: <MapPin size={13} /> },
  completed:  { label: 'Completed',  color: 'text-green-600',  bg: 'bg-green-100',  icon: <CheckCircle size={13} /> },
  cancelled:  { label: 'Cancelled',  color: 'text-red-600',    bg: 'bg-red-100',    icon: <X size={13} /> },
  issue:      { label: 'Issue',      color: 'text-orange-600', bg: 'bg-orange-100', icon: <AlertCircle size={13} /> },
};

const RUNSHEET_STATUS_CONFIG: Record<RunSheetStatus, { label: string; color: string }> = {
  draft:       { label: 'Draft',       color: 'text-gray-500' },
  published:   { label: 'Published',   color: 'text-blue-600' },
  in_progress: { label: 'In Progress', color: 'text-yellow-600' },
  complete:    { label: 'Complete',    color: 'text-green-600' },
};

type LogTab = 'board' | 'runsheet' | 'receiver' | 'outbound';

const DAYS_AHEAD = 7;

function getDateRange(offset: number = 0) {
  const dates: string[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i + offset);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function Logistics() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<LogTab>('board');
  const [showStopModal, setShowStopModal] = useState(false);
  const [editingStop, setEditingStop] = useState<LogisticsStop | null>(null);
  const [showRunSheetModal, setShowRunSheetModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayStops = state.logisticsStops.filter(s => s.scheduledDate === todayStr);
  const outboundReady = state.jobs.filter(j => j.status === 'complete' || j.status === 'qc' || j.status === 'shipping');

  const TABS: { id: LogTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'board',     label: 'Schedule Board', icon: <Calendar size={16} /> },
    { id: 'runsheet',  label: 'Driver Run Sheet', icon: <Truck size={16} />, badge: todayStops.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length || undefined },
    { id: 'receiver',  label: 'Receiver Briefing', icon: <Package size={16} />, badge: todayStops.filter(s => s.direction === 'inbound' && s.status !== 'completed').length || undefined },
    { id: 'outbound',  label: 'Outbound Queue', icon: <ArrowUp size={16} />, badge: outboundReady.length || undefined },
  ];

  function handleSaveStop(stop: LogisticsStop) {
    if (editingStop) dispatch({ type: 'UPDATE_LOGISTICS_STOP', payload: stop });
    else dispatch({ type: 'ADD_LOGISTICS_STOP', payload: stop });
    setShowStopModal(false);
    setEditingStop(null);
  }

  function updateStop(stop: LogisticsStop) {
    dispatch({ type: 'UPDATE_LOGISTICS_STOP', payload: stop });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Truck size={22} className="text-brand-500" /> Logistics Scheduler <GuidedTourButton steps={LOGISTICS_TOUR} />
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Schedule board, driver coordination, and inbound/outbound management</p>
          </div>
          <div data-tour="logi-actions" className="flex gap-2">
            {activeTab === 'runsheet' && (
              <Button variant="ghost" icon={<ClipboardList size={16} />} onClick={() => setShowRunSheetModal(true)}>
                Create Run Sheet
              </Button>
            )}
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setEditingStop(null); setShowStopModal(true); }}>
              Add Stop
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div data-tour="logi-kpis" className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Today's Stops",    value: todayStops.length,                                          icon: <Calendar size={18} />,    color: 'text-brand-600',  bg: 'bg-brand-50' },
            { label: 'Outbound Today',   value: todayStops.filter(s => s.direction === 'outbound').length,   icon: <ArrowUp size={18} />,     color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Inbound Today',    value: todayStops.filter(s => s.direction === 'inbound').length,    icon: <ArrowDown size={18} />,   color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Jobs Ready Ship',  value: outboundReady.length,                                        icon: <Layers size={18} />,      color: 'text-green-600',  bg: 'bg-green-50' },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-xl p-3 flex items-center gap-3`}>
              <div className={`${k.color} opacity-80`}>{k.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div data-tour="logi-tabs" className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.icon} {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold ${activeTab === t.id ? 'bg-white text-brand-600' : 'bg-red-500'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'board' && (
          <ScheduleBoard
            stops={state.logisticsStops}
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
            onEditStop={s => { setEditingStop(s); setShowStopModal(true); }}
            onDeleteStop={id => dispatch({ type: 'DELETE_LOGISTICS_STOP', payload: id })}
            onUpdateStop={updateStop}
          />
        )}
        {activeTab === 'runsheet' && (
          <RunSheetTab
            stops={state.logisticsStops}
            runSheets={state.driverRunSheets}
            onUpdateStop={updateStop}
            onUpdateSheet={sheet => dispatch({ type: 'UPDATE_DRIVER_RUN_SHEET', payload: sheet })}
          />
        )}
        {activeTab === 'receiver' && (
          <ReceiverTab
            stops={state.logisticsStops}
            onUpdateStop={updateStop}
          />
        )}
        {activeTab === 'outbound' && (
          <OutboundTab
            jobs={state.jobs}
            customers={state.customers}
            stops={state.logisticsStops}
            onSchedule={(_job: unknown, _customer: unknown) => {
              setEditingStop(null);
              setShowStopModal(true);
            }}
          />
        )}
      </div>

      {showStopModal && (
        <StopModal
          customers={state.customers}
          jobs={state.jobs}
          existing={editingStop}
          currentUser={state.currentUser}
          onSave={handleSaveStop}
          onClose={() => { setShowStopModal(false); setEditingStop(null); }}
        />
      )}

      {showRunSheetModal && (
        <RunSheetCreateModal
          stops={state.logisticsStops}
          currentUser={state.currentUser}
          onSave={(sheet: DriverRunSheet) => {
            dispatch({ type: 'ADD_DRIVER_RUN_SHEET', payload: sheet });
            setShowRunSheetModal(false);
          }}
          onClose={() => setShowRunSheetModal(false)}
        />
      )}
    </div>
  );
}

/* ─── Schedule Board ─────────────────────────────────────────────────────── */

function ScheduleBoard({ stops, weekOffset, onWeekChange, onEditStop, onDeleteStop, onUpdateStop }: {
  stops: LogisticsStop[];
  weekOffset: number;
  onWeekChange: (n: number) => void;
  onEditStop: (s: LogisticsStop) => void;
  onDeleteStop: (id: string) => void;
  onUpdateStop: (s: LogisticsStop) => void;
}) {
  const dates = getDateRange(weekOffset * 7);

  return (
    <div>
      {/* Week nav */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">
          {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : `Week +${weekOffset}`}
        </h2>
        <div className="flex gap-2">
          {weekOffset > 0 && (
            <Button variant="ghost" onClick={() => onWeekChange(weekOffset - 1)} icon={<ChevronUp size={16} />}>Prev Week</Button>
          )}
          <Button variant="ghost" onClick={() => onWeekChange(0)}>Today</Button>
          <Button variant="ghost" onClick={() => onWeekChange(weekOffset + 1)} icon={<ChevronDown size={16} />}>Next Week</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dates.map(date => {
          const dayStops = stops.filter(s => s.scheduledDate === date).sort((a, b) =>
            (a.scheduledTime ?? '23:59').localeCompare(b.scheduledTime ?? '23:59')
          );
          const isToday = date === new Date().toISOString().slice(0, 10);

          return (
            <div key={date} className={`rounded-xl border ${isToday ? 'border-brand-400 bg-brand-50/30' : 'border-gray-200 bg-white'} flex flex-col`} style={{ minHeight: 200 }}>
              <div className={`px-2 py-2 border-b ${isToday ? 'border-brand-200 bg-brand-100/40' : 'border-gray-100 bg-gray-50'} rounded-t-xl`}>
                <p className={`text-xs font-semibold ${isToday ? 'text-brand-700' : 'text-gray-600'}`}>{formatDateLabel(date)}</p>
                <p className="text-xs text-gray-400">{dayStops.length} stop{dayStops.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-1.5 flex flex-col gap-1.5 flex-1">
                {dayStops.map(stop => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    compact
                    onEdit={() => onEditStop(stop)}
                    onDelete={() => onDeleteStop(stop.id)}
                    onStatusChange={status => onUpdateStop({ ...stop, status, updatedAt: new Date().toISOString() })}
                  />
                ))}
                {dayStops.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-gray-300">—</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StopCard({ stop, compact, onEdit, onDelete, onStatusChange }: {
  stop: LogisticsStop;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: LogisticsStopStatus) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const sc = STATUS_CONFIG[stop.status];
  const isOut = stop.direction === 'outbound';

  return (
    <div className={`relative rounded-lg border text-xs ${isOut ? 'border-purple-200 bg-purple-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="p-2">
        <div className="flex items-start gap-1 mb-1">
          {isOut
            ? <ArrowUp size={10} className="text-purple-500 flex-shrink-0 mt-0.5" />
            : <ArrowDown size={10} className="text-blue-500 flex-shrink-0 mt-0.5" />
          }
          <p className="font-semibold text-gray-800 leading-tight line-clamp-2 flex-1">{stop.description}</p>
          {(onEdit || onDelete) && (
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-gray-600">···</button>
              {showMenu && (
                <div className="absolute right-0 top-4 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-36">
                  {onEdit && <button onClick={() => { onEdit(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-gray-50"><Edit2 size={11} /> Edit</button>}
                  {onStatusChange && Object.entries(STATUS_CONFIG).map(([st, cfg]) => (
                    stop.status !== st && (
                      <button key={st} onClick={() => { onStatusChange(st as LogisticsStopStatus); setShowMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-gray-50">
                        {cfg.icon} {cfg.label}
                      </button>
                    )
                  ))}
                  {onDelete && <button onClick={() => { onDelete(); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-red-50 text-red-600"><Trash2 size={11} /> Delete</button>}
                </div>
              )}
            </div>
          )}
        </div>

        {stop.customerName && <p className="text-gray-500 truncate">{stop.customerName}</p>}
        {stop.vendorName && <p className="text-gray-500 truncate">{stop.vendorName}</p>}

        <div className="flex items-center justify-between mt-1.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>
            {sc.icon} {sc.label}
          </span>
          {stop.scheduledTime && <span className="text-gray-400">{stop.scheduledTime}</span>}
        </div>

        {!compact && stop.address && (
          <p className="text-gray-500 mt-1 flex items-start gap-1">
            <MapPin size={10} className="flex-shrink-0 mt-0.5" />
            <span className="truncate">{stop.address}{stop.city ? `, ${stop.city}` : ''}</span>
          </p>
        )}

        {/* Department notes badges */}
        {!compact && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {stop.driverNotes && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-xs">Driver note</span>}
            {stop.receiverNotes && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">Receiver note</span>}
            {stop.dispatchNotes && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">Dispatch note</span>}
            {stop.productionNotes && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">Production note</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Driver Run Sheet Tab ───────────────────────────────────────────────── */

function RunSheetTab({ stops, runSheets, onUpdateStop, onUpdateSheet }: {
  stops: LogisticsStop[];
  runSheets: DriverRunSheet[];
  onUpdateStop: (s: LogisticsStop) => void;
  onUpdateSheet: (r: DriverRunSheet) => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const dateStops = stops
    .filter(s => s.scheduledDate === selectedDate)
    .sort((a, b) => (a.scheduledTime ?? '23:59').localeCompare(b.scheduledTime ?? '23:59'));

  const todaySheets = runSheets.filter(r => r.date === selectedDate);
  const activeSheet = todaySheets[0];

  const completed = dateStops.filter(s => s.status === 'completed').length;
  const pct = dateStops.length > 0 ? Math.round((completed / dateStops.length) * 100) : 0;

  return (
    <div>
      {/* Date selector + progress */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-3 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold text-gray-700">{completed}/{dateStops.length} done ({pct}%)</span>
        </div>
        {activeSheet && (
          <span className={`text-sm font-semibold ${RUNSHEET_STATUS_CONFIG[activeSheet.status].color}`}>
            Run Sheet: {RUNSHEET_STATUS_CONFIG[activeSheet.status].label}
          </span>
        )}
      </div>

      {/* Active Run Sheet info */}
      {activeSheet && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-800">Driver: {activeSheet.driverName}</p>
              {activeSheet.vehicleName && <p className="text-xs text-yellow-600">Vehicle: {activeSheet.vehicleName}</p>}
              {activeSheet.dispatchNotes && <p className="text-xs text-gray-600 mt-1">{activeSheet.dispatchNotes}</p>}
            </div>
            <div className="flex gap-2">
              {activeSheet.status === 'published' && (
                <Button variant="ghost" onClick={() => onUpdateSheet({ ...activeSheet, status: 'in_progress', updatedAt: new Date().toISOString() })}>
                  Start Run
                </Button>
              )}
              {activeSheet.status === 'in_progress' && (
                <Button variant="success" onClick={() => onUpdateSheet({ ...activeSheet, status: 'complete', updatedAt: new Date().toISOString() })}>
                  Complete Run
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {dateStops.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No stops scheduled for {formatDateLabel(selectedDate)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dateStops.map((stop, i) => (
            <RunSheetStopRow
              key={stop.id}
              stop={stop}
              index={i + 1}
              onStatusChange={status => onUpdateStop({
                ...stop,
                status,
                completedAt: status === 'completed' ? new Date().toISOString() : stop.completedAt,
                updatedAt: new Date().toISOString(),
              })}
              onNoteChange={(field, val) => onUpdateStop({ ...stop, [field]: val, updatedAt: new Date().toISOString() })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunSheetStopRow({ stop, index, onStatusChange, onNoteChange }: {
  stop: LogisticsStop;
  index: number;
  onStatusChange: (s: LogisticsStopStatus) => void;
  onNoteChange: (field: string, val: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editNote, setEditNote] = useState<string | null>(null);
  const [noteVal, setNoteVal] = useState('');
  const sc = STATUS_CONFIG[stop.status];
  const isOut = stop.direction === 'outbound';
  const isDone = stop.status === 'completed' || stop.status === 'cancelled';

  return (
    <div className={`bg-white rounded-xl border ${isDone ? 'border-green-200 opacity-70' : 'border-gray-200'} shadow-sm`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Index */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
            isDone ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
          }`}>{index}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isOut
                ? <ArrowUp size={14} className="text-purple-500" />
                : <ArrowDown size={14} className="text-blue-500" />
              }
              <p className="font-semibold text-gray-900">{stop.description}</p>
              {stop.scheduledTime && (
                <span className="text-sm text-gray-400">{stop.scheduledTime}</span>
              )}
            </div>
            {(stop.customerName || stop.vendorName) && (
              <p className="text-sm text-gray-500">{stop.customerName ?? stop.vendorName}</p>
            )}
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {stop.address}{stop.city ? `, ${stop.city}` : ''}
            </p>
            {stop.contactName && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Phone size={10} /> {stop.contactName}{stop.contactPhone ? ` · ${stop.contactPhone}` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${sc.bg} ${sc.color}`}>
              {sc.icon} {sc.label}
            </span>
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 p-1">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Status action buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {stop.status === 'scheduled' && (
            <Button variant="ghost" onClick={() => onStatusChange('confirmed')}>✓ Confirm</Button>
          )}
          {stop.status === 'confirmed' && (
            <Button variant="ghost" onClick={() => onStatusChange('en_route')}>🚛 En Route</Button>
          )}
          {stop.status === 'en_route' && (
            <Button variant="ghost" onClick={() => onStatusChange('arrived')}>📍 Arrived</Button>
          )}
          {stop.status === 'arrived' && (
            <Button variant="success" onClick={() => onStatusChange('completed')}>✓ Complete</Button>
          )}
          {!isDone && stop.status !== 'issue' && (
            <Button variant="ghost" onClick={() => onStatusChange('issue')}>⚠ Report Issue</Button>
          )}
        </div>
      </div>

      {/* Expanded: department notes */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* Pieces/weight */}
          <div className="flex gap-4 text-sm">
            {stop.pieces != null && <span className="text-gray-600"><strong>{stop.pieces}</strong> pieces</span>}
            {stop.weightLbs != null && <span className="text-gray-600"><strong>{stop.weightLbs.toFixed(1)}</strong> lbs</span>}
            {stop.requiresLiftgate && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">🚐 Liftgate Required</span>}
            {stop.jobIds.length > 0 && <span className="text-gray-500 text-xs">{stop.jobIds.length} job{stop.jobIds.length !== 1 ? 's' : ''} linked</span>}
          </div>

          {/* Special instructions */}
          {stop.specialInstructions && (
            <div className="bg-yellow-50 rounded-lg p-2.5 text-sm text-yellow-800">
              <p className="font-medium text-xs mb-1">Special Instructions</p>
              {stop.specialInstructions}
            </div>
          )}

          {/* Department note sections */}
          {([
            { field: 'driverNotes', label: '🚛 Driver Notes', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
            { field: 'receiverNotes', label: '📦 Receiver Notes', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { field: 'dispatchNotes', label: '📡 Dispatch Notes', color: 'bg-purple-50 border-purple-200 text-purple-800' },
            { field: 'productionNotes', label: '⚙ Production Notes', color: 'bg-green-50 border-green-200 text-green-800' },
          ] as const).map(({ field, label, color }) => (
            <div key={field}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-600">{label}</p>
                {editNote !== field
                  ? <button onClick={() => { setEditNote(field); setNoteVal((stop as any)[field] ?? ''); }} className="text-xs text-brand-500 hover:text-brand-700">
                      {(stop as any)[field] ? 'Edit' : '+ Add'}
                    </button>
                  : <div className="flex gap-1">
                      <button onClick={() => { onNoteChange(field, noteVal); setEditNote(null); }} className="text-xs text-green-600 font-semibold">Save</button>
                      <button onClick={() => setEditNote(null)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                }
              </div>
              {editNote === field ? (
                <textarea
                  value={noteVal}
                  onChange={e => setNoteVal(e.target.value)}
                  rows={2}
                  autoFocus
                  className={`w-full border rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none ${color}`}
                />
              ) : (stop as any)[field] ? (
                <p className={`text-sm rounded-lg px-2.5 py-1.5 border ${color}`}>{(stop as any)[field]}</p>
              ) : (
                <p className="text-xs text-gray-300 italic">No note</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Receiver Briefing Tab ──────────────────────────────────────────────── */

function ReceiverTab({ stops, onUpdateStop }: { stops: LogisticsStop[]; onUpdateStop: (s: LogisticsStop) => void }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<'today' | 'week'>('today');

  const dates = view === 'today' ? [todayStr] : getDateRange(0);
  const inboundStops = stops
    .filter(s => s.direction === 'inbound' && dates.includes(s.scheduledDate))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Package size={16} className="text-blue-500" /> Expected Inbound Deliveries
        </h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView('today')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === 'today' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Today</button>
          <button onClick={() => setView('week')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>This Week</button>
        </div>
      </div>

      {inboundStops.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No inbound deliveries expected {view === 'today' ? 'today' : 'this week'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inboundStops.map(stop => {
            const sc = STATUS_CONFIG[stop.status];
            const isDone = stop.status === 'completed';
            return (
              <div key={stop.id} className={`bg-white rounded-xl border ${isDone ? 'border-green-200 bg-green-50/20' : 'border-blue-200'} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ArrowDown size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{stop.description}</p>
                        {stop.vendorName && <p className="text-sm text-gray-500">From: {stop.vendorName}</p>}
                        {stop.scheduledDate !== todayStr && (
                          <p className="text-xs text-blue-600 font-medium">{formatDateLabel(stop.scheduledDate)}</p>
                        )}
                        {stop.scheduledTime && <p className="text-xs text-gray-400">ETA: {stop.scheduledTime}</p>}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${sc.bg} ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex gap-4 text-sm text-gray-600 mt-2 flex-wrap">
                      {stop.pieces != null && <span><strong>{stop.pieces}</strong> pieces</span>}
                      {stop.weightLbs != null && <span><strong>{stop.weightLbs.toFixed(1)}</strong> lbs</span>}
                      {stop.requiresLiftgate && <span className="text-orange-600 font-medium">⚠ Liftgate</span>}
                      {stop.jobIds.length > 0 && <span className="text-brand-600 text-xs">{stop.jobIds.length} job(s)</span>}
                    </div>

                    {stop.specialInstructions && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-2.5 py-1.5 mt-2">{stop.specialInstructions}</p>
                    )}

                    {stop.receiverNotes && (
                      <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-1.5">
                        <strong>Receiver note:</strong> {stop.receiverNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Receiver actions */}
                {!isDone && (
                  <div className="flex gap-2 mt-3">
                    {stop.status === 'scheduled' && (
                      <Button variant="ghost" onClick={() => onUpdateStop({ ...stop, status: 'confirmed', confirmedByReceiverAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>
                        ✓ Acknowledge
                      </Button>
                    )}
                    {(stop.status === 'confirmed' || stop.status === 'en_route' || stop.status === 'arrived') && (
                      <Button variant="success" onClick={() => onUpdateStop({ ...stop, status: 'completed', confirmedByReceiverAt: new Date().toISOString(), completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>
                        ✓ Mark Received
                      </Button>
                    )}
                  </div>
                )}
                {isDone && stop.completedAt && (
                  <p className="text-xs text-green-600 mt-2">✓ Received at {new Date(stop.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Outbound Queue Tab ─────────────────────────────────────────────────── */

function OutboundTab({ jobs, customers, stops, onSchedule }: any) {
  const [search, setSearch] = useState('');

  const readyJobs = jobs
    .filter((j: any) => ['complete', 'qc', 'shipping'].includes(j.status))
    .filter((j: any) => !search || j.jobNumber?.toLowerCase().includes(search.toLowerCase()) || customers.find((c: any) => c.id === j.customerId)?.name?.toLowerCase().includes(search.toLowerCase()));

  const scheduledJobIds = new Set(stops.flatMap((s: LogisticsStop) => s.jobIds));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs or customers…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
        />
        <span className="text-sm text-gray-500">{readyJobs.length} job{readyJobs.length !== 1 ? 's' : ''} ready to ship</span>
      </div>

      {readyJobs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers size={40} className="mx-auto mb-3 opacity-30" />
          <p>No jobs ready to ship</p>
          <p className="text-sm mt-1">Jobs with Completed or QC Passed status will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Job</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Service</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Scheduled</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {readyJobs.map((job: any) => {
                const customer = customers.find((c: any) => c.id === job.customerId);
                const isScheduled = scheduledJobIds.has(job.id);
                return (
                  <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{job.jobNumber ?? job.id.slice(0,8)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{job.serviceType?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle size={10} /> {job.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isScheduled
                        ? <span className="text-xs text-blue-600 font-medium flex items-center gap-1"><Truck size={10} /> Scheduled</span>
                        : <span className="text-xs text-gray-400">Not scheduled</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {!isScheduled && (
                        <Button variant="ghost" onClick={() => onSchedule(job, customer)} className="text-xs py-1">
                          + Schedule Pickup
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Stop Modal ─────────────────────────────────────────────────────────── */

function StopModal({ customers, jobs, existing, currentUser, onSave, onClose }: any) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const readyJobs = jobs.filter((j: any) => ['complete', 'qc', 'shipping', 'coat', 'cure', 'rack', 'pretreat'].includes(j.status));

  const [form, setForm] = useState({
    direction: (existing?.direction ?? 'outbound') as 'outbound' | 'inbound',
    scheduledDate: existing?.scheduledDate ?? todayStr,
    scheduledTime: existing?.scheduledTime ?? '',
    status: (existing?.status ?? 'scheduled') as LogisticsStopStatus,
    customerId: existing?.customerId ?? '',
    vendorName: existing?.vendorName ?? '',
    contactName: existing?.contactName ?? '',
    contactPhone: existing?.contactPhone ?? '',
    address: existing?.address ?? '',
    city: existing?.city ?? '',
    description: existing?.description ?? '',
    pieces: existing?.pieces ?? '',
    weightLbs: existing?.weightLbs ?? '',
    requiresLiftgate: existing?.requiresLiftgate ?? false,
    specialInstructions: existing?.specialInstructions ?? '',
    driverNotes: existing?.driverNotes ?? '',
    receiverNotes: existing?.receiverNotes ?? '',
    dispatchNotes: existing?.dispatchNotes ?? '',
    productionNotes: existing?.productionNotes ?? '',
    selectedJobIds: existing?.jobIds ?? [] as string[],
  });

  const customerName = customers.find((c: any) => c.id === form.customerId)?.name;

  function toggleJob(jobId: string) {
    setForm(f => ({
      ...f,
      selectedJobIds: f.selectedJobIds.includes(jobId)
        ? f.selectedJobIds.filter((id: string) => id !== jobId)
        : [...f.selectedJobIds, jobId],
    }));
  }

  function handleSave() {
    if (!form.description || !form.address) return;
    const stop: LogisticsStop = {
      id: existing?.id ?? generateId(),
      direction: form.direction,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime || undefined,
      status: form.status,
      customerId: form.customerId || undefined,
      customerName: customerName,
      vendorName: form.vendorName || undefined,
      contactName: form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      address: form.address,
      city: form.city || undefined,
      description: form.description,
      pieces: form.pieces !== '' ? Number(form.pieces) : undefined,
      weightLbs: form.weightLbs !== '' ? Number(form.weightLbs) : undefined,
      requiresLiftgate: form.requiresLiftgate,
      specialInstructions: form.specialInstructions || undefined,
      driverNotes: form.driverNotes || undefined,
      receiverNotes: form.receiverNotes || undefined,
      dispatchNotes: form.dispatchNotes || undefined,
      productionNotes: form.productionNotes || undefined,
      jobIds: form.selectedJobIds,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(stop);
  }

  const f = (field: string) => ({ value: (form as any)[field], onChange: (e: any) => setForm(prev => ({ ...prev, [field]: e.target.value })) });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-brand-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">{existing ? 'Edit Stop' : 'Add Logistics Stop'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Direction toggle */}
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Direction</label>
              <div className="flex gap-2">
                {(['outbound', 'inbound'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setForm(f => ({ ...f, direction: d }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      form.direction === d
                        ? d === 'outbound' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {d === 'outbound' ? '↑ Outbound (Delivery/Pickup)' : '↓ Inbound (Receiving)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
              <input type="date" {...f('scheduledDate')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Time</label>
              <input type="time" {...f('scheduledTime')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description / Stop Name *</label>
              <input {...f('description')} placeholder="e.g. Deliver powder coat job to ABC Manufacturing" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {form.direction === 'outbound' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Customer</label>
                <select {...f('customerId')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select customer…</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Vendor / Supplier</label>
                <input {...f('vendorName')} placeholder="Vendor or supplier name" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Name</label>
              <input {...f('contactName')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Phone</label>
              <input {...f('contactPhone')} type="tel" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Address *</label>
              <input {...f('address')} placeholder="Street address" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
              <input {...f('city')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select {...f('status')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Pieces</label>
              <input type="number" min={0} {...f('pieces')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Weight (lbs)</label>
              <input type="number" min={0} step={0.1} {...f('weightLbs')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="liftgate" checked={form.requiresLiftgate} onChange={e => setForm(f => ({ ...f, requiresLiftgate: e.target.checked }))} className="rounded" />
              <label htmlFor="liftgate" className="text-sm font-medium text-gray-700">Liftgate Required</label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Special Instructions</label>
              <textarea rows={2} {...f('specialInstructions')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {/* Department Notes */}
            {[
              { field: 'driverNotes', label: '🚛 Driver Notes' },
              { field: 'receiverNotes', label: '📦 Receiver Notes' },
              { field: 'dispatchNotes', label: '📡 Dispatch Notes' },
              { field: 'productionNotes', label: '⚙ Production Notes' },
            ].map(({ field, label }) => (
              <div key={field} className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
                <textarea rows={1} {...f(field)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            ))}

            {/* Link jobs */}
            {form.direction === 'outbound' && readyJobs.length > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Link Jobs</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                  {readyJobs.slice(0, 20).map((job: any) => {
                    const cust = customers.find((c: any) => c.id === job.customerId);
                    const checked = form.selectedJobIds.includes(job.id);
                    return (
                      <label key={job.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleJob(job.id)} className="rounded" />
                        <span className="font-mono text-xs text-gray-600">{job.jobNumber ?? job.id.slice(0,8)}</span>
                        <span className="text-sm text-gray-700 flex-1">{cust?.name ?? '—'}</span>
                        <span className="text-xs text-gray-400">{job.status}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!form.description || !form.address} className="flex-1">
            {existing ? 'Save Changes' : 'Add Stop'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Run Sheet Create Modal ─────────────────────────────────────────────── */

function RunSheetCreateModal({ stops, currentUser, onSave, onClose }: any) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [driverName, setDriverName] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [status, setStatus] = useState<RunSheetStatus>('draft');
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);

  const dateStops = stops.filter((s: LogisticsStop) => s.scheduledDate === date);

  function toggleStop(id: string) {
    setSelectedStopIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function handleSave() {
    if (!driverName) return;
    const sheet: DriverRunSheet = {
      id: generateId(),
      date,
      driverName,
      vehicleName: vehicleName || undefined,
      stopIds: selectedStopIds,
      status,
      dispatchNotes: dispatchNotes || undefined,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(sheet);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-yellow-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Create Driver Run Sheet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as RunSheetStatus)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {Object.entries(RUNSHEET_STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Driver Name *</label>
              <input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Enter driver name" autoFocus className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle</label>
              <input value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="Truck, van, plate #…" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Dispatch Notes</label>
              <textarea rows={2} value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Notes for the driver…" />
            </div>
          </div>

          {/* Select stops */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Assign Stops ({dateStops.length} available for {formatDateLabel(date)})
            </label>
            {dateStops.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No stops scheduled for this date</p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {dateStops.map((stop: LogisticsStop) => (
                  <label key={stop.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedStopIds.includes(stop.id)} onChange={() => toggleStop(stop.id)} className="rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{stop.description}</p>
                      <p className="text-xs text-gray-500">{stop.scheduledTime ?? 'No time'} · {stop.direction}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!driverName} className="flex-1">Create Run Sheet</Button>
        </div>
      </div>
    </div>
  );
}
