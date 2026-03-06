/**
 * WorkInstructionViewer
 *
 * Full-screen work instruction viewer with:
 * - Create / Edit builder with structured section boxes
 * - Per-step photo upload (base64 data URLs, no server needed)
 * - JSON import & export (single or batch — departments can manage their own)
 * - Language switching: EN | FR | ES | PT | TL
 * - Per-step images & embedded video (YouTube/Vimeo/direct)
 * - Training callout per step
 * - Warning/hazard callouts
 * - Print-friendly layout
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, ChevronDown, ChevronUp, AlertTriangle, PlayCircle,
  Printer, Globe, GraduationCap, Shield, Wrench, Clock,
  CheckCircle, ArrowLeft, Search, Image as ImageIcon, Plus, Trash2,
  Upload, Download, Edit2, X, Camera, Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { clsx } from '../../utils';
import { GuidedTourButton, type TourStep } from '../ui/GuidedTour';
import type { WorkInstruction, WorkInstructionStep, SupportedLanguage, WorkInstructionType } from '../../types';

const WI_TOUR: TourStep[] = [
  { selector: '[data-tour="wi-lang"]', title: 'Language Selector',
    why: 'Work instructions can be viewed in 5 languages — operators see steps in their native language.',
    what: 'Click a language flag to switch. Steps without translations fall back to English.' },
  { selector: '[data-tour="wi-actions"]', title: 'Import / Export / Create',
    why: 'Departments can manage their own instructions via JSON import/export. "New Instruction" opens the builder.',
    what: 'Import JSON from another system. Export All to back up. "New Instruction" opens the step-by-step builder.' },
  { selector: '[data-tour="wi-filters"]', title: 'Search & Filter',
    why: 'With many WIs, filtering by type (operation, safety, maintenance) or department keeps things organized.',
    what: 'Type in search to find by title, equipment, or doc number. Click type/department chips to filter.' },
  { selector: '[data-tour="wi-list"]', title: 'Instruction Cards',
    why: 'Each card shows the WI title, equipment, type, document number, and step count.',
    what: 'Click a card to open the full instruction with step-by-step procedure and images.' },
];

// ─── Language Config ──────────────────────────────────────────────────────────

const LANGUAGES: Array<{ code: SupportedLanguage; label: string; flag: string; nativeName: string }> = [
  { code: 'en', label: 'English',    flag: '🇬🇧', nativeName: 'English'   },
  { code: 'fr', label: 'French',     flag: '🇨🇦', nativeName: 'Français'  },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸', nativeName: 'Español'   },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
  { code: 'tl', label: 'Tagalog',    flag: '🇵🇭', nativeName: 'Tagalog'   },
];

// ─── Draft Types for Builder ──────────────────────────────────────────────────

interface DraftStep {
  id: string;
  description: string;
  warning: string;
  trainingNote: string;
  imageUrl: string;
  videoUrl: string;
  showWarning: boolean;
  showTraining: boolean;
  showVideo: boolean;
}

interface DraftWI {
  title: string;
  type: WorkInstructionType;
  revision: string;
  description: string;
  department: string;
  equipmentName: string;
  estimatedMinutes: string;
  approvedBy: string;
  requiredPPE: string[];
  requiredTools: string[];
  steps: DraftStep[];
  jobStages: string[];
  // ISO 9001:2015 §7.5 document control fields
  documentNumber: string;
  purpose: string;
  scope: string;
  referencedDocuments: string[];
  responsibleRole: string;
  effectiveDate: string;
  issuedBy: string;
}

const EMPTY_DRAFT: DraftWI = {
  title: '', type: 'operation', revision: 'Rev A', description: '',
  department: '', equipmentName: '', estimatedMinutes: '', approvedBy: '',
  requiredPPE: [], requiredTools: [], steps: [], jobStages: [],
  documentNumber: '', purpose: '', scope: '', referencedDocuments: [],
  responsibleRole: '', effectiveDate: '', issuedBy: '',
};

function newDraftStep(): DraftStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: '', warning: '', trainingNote: '', imageUrl: '', videoUrl: '',
    showWarning: false, showTraining: false, showVideo: false,
  };
}

// ─── Conversions ──────────────────────────────────────────────────────────────

function wiToDraft(wi: WorkInstruction): DraftWI {
  return {
    title: wi.title,
    type: wi.type,
    revision: wi.revision,
    description: wi.description,
    department: wi.department ?? '',
    equipmentName: wi.equipmentName ?? '',
    estimatedMinutes: wi.estimatedMinutes?.toString() ?? '',
    approvedBy: wi.approvedBy ?? '',
    requiredPPE: wi.requiredPPE ?? [],
    requiredTools: wi.requiredTools ?? [],
    steps: wi.steps.map(s => ({
      id: s.id,
      description: s.description,
      warning: s.warning ?? '',
      trainingNote: s.trainingNote ?? '',
      imageUrl: s.imageUrl ?? '',
      videoUrl: s.videoUrl ?? '',
      showWarning: !!s.warning,
      showTraining: !!s.trainingNote,
      showVideo: !!s.videoUrl,
    })),
    jobStages: wi.jobStages ?? [],
    documentNumber: wi.documentNumber ?? '',
    purpose: wi.purpose ?? '',
    scope: wi.scope ?? '',
    referencedDocuments: wi.referencedDocuments ?? [],
    responsibleRole: wi.responsibleRole ?? '',
    effectiveDate: wi.effectiveDate ?? '',
    issuedBy: wi.issuedBy ?? '',
  };
}

function draftToWI(draft: DraftWI, existingId?: string): WorkInstruction {
  const now = new Date().toISOString();
  return {
    id: existingId ?? `wi-${Date.now()}`,
    title: draft.title.trim(),
    type: draft.type,
    revision: draft.revision.trim() || 'Rev A',
    description: draft.description.trim(),
    department: draft.department.trim() || undefined,
    equipmentName: draft.equipmentName.trim() || undefined,
    estimatedMinutes: draft.estimatedMinutes ? (parseInt(draft.estimatedMinutes) || undefined) : undefined,
    approvedBy: draft.approvedBy.trim() || undefined,
    requiredPPE: draft.requiredPPE.filter(Boolean),
    requiredTools: draft.requiredTools.filter(Boolean),
    steps: draft.steps.map((s, idx) => ({
      id: s.id,
      stepNumber: idx + 1,
      description: s.description.trim(),
      warning: s.warning.trim() || undefined,
      trainingNote: s.trainingNote.trim() || undefined,
      imageUrl: s.imageUrl || undefined,
      videoUrl: s.videoUrl.trim() || undefined,
    })),
    jobStages: draft.jobStages,
    documentNumber: draft.documentNumber.trim() || undefined,
    purpose: draft.purpose.trim() || undefined,
    scope: draft.scope.trim() || undefined,
    referencedDocuments: draft.referencedDocuments.filter(Boolean).length > 0 ? draft.referencedDocuments.filter(Boolean) : undefined,
    responsibleRole: draft.responsibleRole.trim() || undefined,
    effectiveDate: draft.effectiveDate.trim() || undefined,
    issuedBy: draft.issuedBy.trim() || undefined,
    createdBy: 'Staff',
    createdAt: now,
    updatedAt: now,
  } as WorkInstruction;
}

// ─── Export / Import Helpers ──────────────────────────────────────────────────

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSingle(wi: WorkInstruction) {
  const slug = wi.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50);
  triggerDownload(JSON.stringify(wi, null, 2), `${slug}-${wi.revision}.json`);
}

function exportAll(wis: WorkInstruction[]) {
  const date = new Date().toISOString().split('T')[0];
  triggerDownload(JSON.stringify(wis, null, 2), `work-instructions-${date}.json`);
}

// ─── Video Embed ──────────────────────────────────────────────────────────────

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  return null;
}

function VideoEmbed({ url }: { url: string }) {
  const embedUrl = getEmbedUrl(url);
  if (embedUrl) {
    return (
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full rounded-lg"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="Step video"
        />
      </div>
    );
  }
  return <video src={url} controls className="w-full rounded-lg max-h-64 bg-black" />;
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({ label, icon: Icon, values, onAdd, onRemove, placeholder }: {
  label: string;
  icon: React.ElementType;
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  function add() {
    const v = input.trim();
    if (v) { onAdd(v); setInput(''); }
  }
  return (
    <div>
      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
        <Icon size={12} /> {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
            {v}
            <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500 ml-0.5 leading-none">
              <X size={10} />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="text-xs text-gray-400 italic">None added yet</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button onClick={add} className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors font-medium">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Step Editor Card ─────────────────────────────────────────────────────────

function StepEditorCard({
  step, stepNumber, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  step: DraftStep;
  stepNumber: number;
  onChange: (updates: Partial<DraftStep>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const imgRef = useRef<HTMLInputElement>(null);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange({ imageUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const optionals = [
    { key: 'showWarning',  label: 'Warning',       Icon: AlertTriangle, active: 'bg-amber-50 border-amber-200 text-amber-700' },
    { key: 'showTraining', label: 'Training Note',  Icon: GraduationCap, active: 'bg-green-50 border-green-200 text-green-700' },
    { key: 'showVideo',    label: 'Video URL',      Icon: PlayCircle,    active: 'bg-blue-50 border-blue-200 text-blue-700'    },
  ] as const;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="w-7 h-7 rounded-full bg-[#1f355e] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {stepNumber}
        </div>
        <span className="text-sm font-semibold text-gray-700 flex-1">Step {stepNumber}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} title="Move up"
            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-25 transition-opacity rounded">
            <ChevronUp size={14} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} title="Move down"
            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-25 transition-opacity rounded">
            <ChevronDown size={14} />
          </button>
          <button onClick={onDelete} title="Delete step"
            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded ml-1">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Step body */}
      <div className="p-4 space-y-3">
        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">
            Instruction <span className="text-red-400">*</span>
          </label>
          <textarea
            value={step.description}
            onChange={e => onChange({ description: e.target.value })}
            rows={3}
            placeholder="Describe exactly what the operator should do at this step..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Photo</label>
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
          {step.imageUrl ? (
            <div className="relative inline-block">
              <img
                src={step.imageUrl}
                alt={`Step ${stepNumber}`}
                className="h-40 rounded-lg border border-gray-200 object-cover max-w-sm cursor-zoom-in"
              />
              <button
                onClick={() => onChange({ imageUrl: '' })}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow font-bold"
              >×</button>
            </div>
          ) : (
            <button
              onClick={() => imgRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-[#1f355e]/50 hover:text-[#1f355e] transition-colors"
            >
              <Camera size={13} /> Upload Photo
            </button>
          )}
        </div>

        {/* Optional field toggles */}
        <div className="flex gap-2 flex-wrap">
          {optionals.map(({ key, label, Icon, active }) => (
            <button
              key={key}
              onClick={() => onChange({ [key]: !step[key] })}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                step[key] ? active : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {step.showWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <label className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle size={11} /> Warning / Hazard
            </label>
            <textarea
              value={step.warning}
              onChange={e => onChange({ warning: e.target.value })}
              rows={2}
              placeholder="Describe the hazard, risk, or critical caution..."
              className="w-full text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            />
          </div>
        )}

        {step.showTraining && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(0,152,119,0.05)', border: '1px solid rgba(0,152,119,0.25)' }}>
            <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: '#007a61' }}>
              <GraduationCap size={11} /> Training Note
            </label>
            <textarea
              value={step.trainingNote}
              onChange={e => onChange({ trainingNote: e.target.value })}
              rows={2}
              placeholder="Extra context for new operators learning this step..."
              className="w-full text-sm bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 resize-y"
              style={{ border: '1px solid rgba(0,152,119,0.25)' }}
            />
          </div>
        )}

        {step.showVideo && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Video URL (YouTube / Vimeo)</label>
            <input
              type="url"
              value={step.videoUrl}
              onChange={e => onChange({ videoUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Builder Modal ────────────────────────────────────────────────────────────

function WorkInstructionBuilder({
  initialDraft,
  editingId,
  onSave,
  onCancel,
}: {
  initialDraft?: DraftWI;
  editingId?: string;
  onSave: (wi: WorkInstruction) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DraftWI>(initialDraft ?? EMPTY_DRAFT);
  const isValid = draft.title.trim().length > 0 && draft.steps.some(s => s.description.trim().length > 0);

  function set<K extends keyof DraftWI>(key: K, value: DraftWI[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function updateStep(id: string, updates: Partial<DraftStep>) {
    setDraft(d => ({ ...d, steps: d.steps.map(s => s.id === id ? { ...s, ...updates } : s) }));
  }

  function addStep() {
    setDraft(d => ({ ...d, steps: [...d.steps, newDraftStep()] }));
  }

  function deleteStep(id: string) {
    setDraft(d => ({ ...d, steps: d.steps.filter(s => s.id !== id) }));
  }

  function moveStep(id: string, dir: 'up' | 'down') {
    setDraft(d => {
      const idx = d.steps.findIndex(s => s.id === id);
      if (dir === 'up' && idx === 0) return d;
      if (dir === 'down' && idx === d.steps.length - 1) return d;
      const steps = [...d.steps];
      const t = dir === 'up' ? idx - 1 : idx + 1;
      [steps[idx], steps[t]] = [steps[t], steps[idx]];
      return { ...d, steps };
    });
  }

  const input = (key: keyof DraftWI, placeholder: string, type: string = 'text', label: string = '') => (
    <div>
      {label && <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>}
      <input
        type={type}
        value={draft[key] as string}
        onChange={e => set(key, e.target.value as any)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col overflow-hidden">
      {/* ── Sticky header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-[#1f355e]" />
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {editingId ? 'Edit Work Instruction' : 'New Work Instruction'}
            </h2>
            {!isValid && (
              <p className="text-xs text-gray-400">Add a title and at least one step to save</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draftToWI(draft, editingId))}
            disabled={!isValid}
            className="px-5 py-2 text-sm font-semibold bg-[#1f355e] text-white rounded-lg hover:bg-[#2a4a80] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {editingId ? 'Save Changes' : 'Create Instruction'}
          </button>
        </div>
      </div>

      {/* ── Scrollable form body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

          {/* ─── Box 1: Basic Information ─── */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BookOpen size={14} className="text-[#1f355e]" /> Basic Information
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g. SAT Vertical Line — Powder Application Procedure"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 font-medium"
                />
              </div>

              {/* Row: Type | Revision | Est. Time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
                  <select
                    value={draft.type}
                    onChange={e => set('type', e.target.value as WorkInstructionType)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    {(['operation', 'safety', 'maintenance', 'calibration', 'assembly'] as WorkInstructionType[]).map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                {input('revision', 'Rev A', 'text', 'Revision')}
                {input('estimatedMinutes', '30', 'number', 'Est. Time (min)')}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Description / Purpose</label>
                <textarea
                  value={draft.description}
                  onChange={e => set('description', e.target.value)}
                  rows={2}
                  placeholder="Brief overview of what this instruction covers and when to use it..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y"
                />
              </div>

              {/* Row: Department | Equipment | Approved By */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
                    <Building size={11} /> Department
                  </label>
                  <input
                    type="text"
                    value={draft.department}
                    onChange={e => set('department', e.target.value)}
                    placeholder="e.g. Production, QA"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
                    <Wrench size={11} /> Equipment
                  </label>
                  <input
                    type="text"
                    value={draft.equipmentName}
                    onChange={e => set('equipmentName', e.target.value)}
                    placeholder="e.g. SAT Vertical Line"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1 mb-1">
                    <CheckCircle size={11} /> Approved By
                  </label>
                  <input
                    type="text"
                    value={draft.approvedBy}
                    onChange={e => set('approvedBy', e.target.value)}
                    placeholder="Name or initials"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ─── Box 1b: ISO 9001:2015 QMS Document Control ─── */}
          <section className="bg-white border border-[#1f355e]/20 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-[#1f355e]/5 border-b border-[#1f355e]/15">
              <h3 className="text-sm font-semibold text-[#1f355e] flex items-center gap-2">
                <BookOpen size={14} /> ISO 9001:2015 QMS Document Control
              </h3>
              <p className="text-xs text-[#1f355e]/60 mt-0.5">Clause §7.5 — controlled document information (document number, purpose, scope, references)</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Row: Doc Number | Responsible Role | Effective Date | Issued By */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Document Number</label>
                  <input
                    type="text"
                    value={draft.documentNumber}
                    onChange={e => set('documentNumber', e.target.value)}
                    placeholder="e.g. WI-CM40-001"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Responsible Role</label>
                  <input
                    type="text"
                    value={draft.responsibleRole}
                    onChange={e => set('responsibleRole', e.target.value)}
                    placeholder="e.g. Maintenance Technician"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={draft.effectiveDate}
                    onChange={e => set('effectiveDate', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Issued By</label>
                  <input
                    type="text"
                    value={draft.issuedBy}
                    onChange={e => set('issuedBy', e.target.value)}
                    placeholder="e.g. Sam Chen"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
              {/* Purpose */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Purpose <span className="text-gray-400 font-normal">(objective statement)</span></label>
                <textarea
                  value={draft.purpose}
                  onChange={e => set('purpose', e.target.value)}
                  rows={2}
                  placeholder="e.g. Ensure the CM40 is in a safe, ready-to-operate state before each production shift."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y"
                />
              </div>
              {/* Scope */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Scope <span className="text-gray-400 font-normal">(who it applies to, which equipment/process)</span></label>
                <textarea
                  value={draft.scope}
                  onChange={e => set('scope', e.target.value)}
                  rows={2}
                  placeholder="e.g. All operators and maintenance technicians starting any spray run on the GEMA MagicControl 4.0 system."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y"
                />
              </div>
              {/* Referenced Documents */}
              <TagInput
                label="Referenced Documents"
                icon={BookOpen}
                values={draft.referencedDocuments}
                onAdd={v => set('referencedDocuments', [...draft.referencedDocuments, v])}
                onRemove={i => set('referencedDocuments', draft.referencedDocuments.filter((_, idx) => idx !== i))}
                placeholder="e.g. GEMA Doc 1011 534 EN Rev.01 12/21"
              />
            </div>
          </section>

          {/* ─── Box 2: Safety & Requirements ─── */}
          <section className="bg-white border border-red-100 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100">
              <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <Shield size={14} /> Safety & Equipment Requirements
              </h3>
              <p className="text-xs text-red-500 mt-0.5">These appear prominently before operators begin the task</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-5">
              <TagInput
                label="Required PPE"
                icon={Shield}
                values={draft.requiredPPE}
                onAdd={v => set('requiredPPE', [...draft.requiredPPE, v])}
                onRemove={i => set('requiredPPE', draft.requiredPPE.filter((_, idx) => idx !== i))}
                placeholder="e.g. Safety glasses"
              />
              <TagInput
                label="Required Tools"
                icon={Wrench}
                values={draft.requiredTools}
                onAdd={v => set('requiredTools', [...draft.requiredTools, v])}
                onRemove={i => set('requiredTools', draft.requiredTools.filter((_, idx) => idx !== i))}
                placeholder="e.g. Torque wrench"
              />
            </div>
          </section>

          {/* ─── Box 3: Steps ─── */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CheckCircle size={14} className="text-[#1f355e]" />
                Steps
                {draft.steps.length > 0 && (
                  <span className="text-gray-400 font-normal">({draft.steps.length})</span>
                )}
              </h3>
              <p className="text-xs text-gray-400">Each step can have a photo, warning, training note, or video</p>
            </div>
            <div className="p-5 space-y-3">
              {draft.steps.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No steps yet</p>
                  <p className="text-xs mt-0.5">Add steps to build out the instruction</p>
                </div>
              )}
              {draft.steps.map((step, idx) => (
                <StepEditorCard
                  key={step.id}
                  step={step}
                  stepNumber={idx + 1}
                  onChange={updates => updateStep(step.id, updates)}
                  onDelete={() => deleteStep(step.id)}
                  onMoveUp={() => moveStep(step.id, 'up')}
                  onMoveDown={() => moveStep(step.id, 'down')}
                  isFirst={idx === 0}
                  isLast={idx === draft.steps.length - 1}
                />
              ))}
              <button
                onClick={addStep}
                className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-[#1f355e]/30 text-[#1f355e] rounded-xl text-sm font-medium hover:bg-[#1f355e]/5 hover:border-[#1f355e]/50 transition-colors"
              >
                <Plus size={16} /> Add Step
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// ─── Step Card (viewer) ───────────────────────────────────────────────────────

function StepCard({
  step,
  lang,
}: {
  step: WorkInstructionStep;
  lang: SupportedLanguage;
}) {
  const [open, setOpen] = useState(true);
  const [imgOpen, setImgOpen] = useState(false);

  const t = lang !== 'en' ? step.translations?.[lang] : undefined;
  const description = t?.description ?? step.description;
  const warning = t?.warning ?? step.warning;
  const trainingNote = t?.trainingNote ?? step.trainingNote;
  const isPending = lang !== 'en' && !t && step.description !== '';

  return (
    <div className={clsx(
      'border rounded-xl overflow-hidden transition-all',
      open ? 'border-brand-200 shadow-sm' : 'border-gray-200',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          open ? 'bg-brand-50' : 'bg-white hover:bg-gray-50',
        )}
      >
        <div className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
          open ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600',
        )}>
          {step.stepNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm font-medium', open ? 'text-brand-800' : 'text-gray-700')}>
            {description.slice(0, 80)}{description.length > 80 ? '…' : ''}
          </p>
          {isPending && <span className="text-xs text-amber-500 italic">Translation pending — showing English</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {warning && <AlertTriangle size={15} className="text-amber-500" />}
          {step.videoUrl && <PlayCircle size={15} className="text-brand-500" />}
          {step.imageUrl && <ImageIcon size={15} className="text-gray-400" />}
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 bg-white">
          <p className="text-sm text-gray-700 leading-relaxed">{description}</p>

          {warning && (
            <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 font-medium">{warning}</p>
            </div>
          )}

          {trainingNote && (
            <div
              className="flex gap-2.5 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(0,152,119,0.05)', borderColor: 'rgba(0,152,119,0.2)', border: '1px solid' }}
            >
              <GraduationCap size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#009877' }} />
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: '#007a61' }}>Training Note</p>
                <p className="text-sm" style={{ color: '#005a48' }}>{trainingNote}</p>
              </div>
            </div>
          )}

          {step.imageUrl && (
            <div>
              <img
                src={step.imageUrl}
                alt={`Step ${step.stepNumber} visual`}
                className="rounded-lg border border-gray-200 max-h-64 w-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => setImgOpen(true)}
              />
              {imgOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
                  onClick={() => setImgOpen(false)}
                >
                  <img src={step.imageUrl} alt="Full size" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl" />
                </div>
              )}
            </div>
          )}

          {step.videoUrl && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                <PlayCircle size={13} className="text-brand-500" /> Visual Reference
              </div>
              <VideoEmbed url={step.videoUrl} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Instruction Card (list) ──────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  operation:   'bg-blue-100 text-blue-700',
  safety:      'bg-red-100 text-red-700',
  maintenance: 'bg-orange-100 text-orange-700',
  calibration: 'bg-purple-100 text-purple-700',
  assembly:    'bg-green-100 text-green-700',
};

function InstructionCard({
  wi, lang, onSelect,
}: {
  wi: WorkInstruction;
  lang: SupportedLanguage;
  onSelect: () => void;
}) {
  const t = lang !== 'en' ? wi.translations?.[lang] : undefined;
  const title = t?.title ?? wi.title;
  const hasImages = wi.steps.some(s => s.imageUrl);

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-semibold text-sm text-gray-900 group-hover:text-brand-700 transition-colors leading-snug">{title}</p>
        <Badge className={clsx('flex-shrink-0', TYPE_COLORS[wi.type] ?? 'bg-gray-100 text-gray-600')}>
          {wi.type}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        {wi.department && (
          <span className="flex items-center gap-1 text-[#1f355e] font-medium">
            <Building size={10} />{wi.department}
          </span>
        )}
        {wi.equipmentName && <span className="flex items-center gap-1"><Wrench size={11} />{wi.equipmentName}</span>}
        {wi.estimatedMinutes && <span className="flex items-center gap-1"><Clock size={11} />{wi.estimatedMinutes} min</span>}
        <span className="flex items-center gap-1"><BookOpen size={11} />{wi.steps.length} steps</span>
        {hasImages && <span className="flex items-center gap-1 text-brand-500"><ImageIcon size={11} /> photos</span>}
        {wi.documentNumber && <span className="ml-auto font-mono text-xs text-[#1f355e] font-semibold">{wi.documentNumber}</span>}
        <span className={wi.documentNumber ? 'text-gray-400' : 'ml-auto text-gray-400'}>{wi.revision}</span>
      </div>
      {wi.requiredPPE && wi.requiredPPE.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <Shield size={11} className="text-red-400" />
          <span className="text-xs text-red-600">{wi.requiredPPE.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}

// ─── Instruction Detail (viewer) ──────────────────────────────────────────────

function InstructionDetail({
  wi, lang, onBack, onEdit,
}: {
  wi: WorkInstruction;
  lang: SupportedLanguage;
  onBack: () => void;
  onEdit: () => void;
}) {
  const t = lang !== 'en' ? wi.translations?.[lang] : undefined;
  const title = t?.title ?? wi.title;
  const description = t?.description ?? wi.description;

  return (
    <div className="space-y-4 print:p-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft size={15} /> All Instructions
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSingle(wi)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg transition-colors"
            title="Export this instruction as JSON"
          >
            <Download size={13} /> Export JSON
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-[#1f355e] hover:text-[#2a4a80] px-3 py-1.5 border border-[#1f355e]/30 rounded-lg transition-colors bg-[#1f355e]/5"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg transition-colors"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Header card */}
      <Card>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">{title}</h1>
            {description && <p className="text-sm text-gray-600">{description}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <Badge className={clsx(TYPE_COLORS[wi.type] ?? 'bg-gray-100 text-gray-600')}>{wi.type}</Badge>
            {wi.department && (
              <span className="flex items-center gap-1 text-xs text-[#1f355e] font-medium bg-[#1f355e]/5 px-2 py-1 rounded-full">
                <Building size={10} />{wi.department}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {wi.equipmentName && (
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Equipment</div>
              <div className="font-medium text-gray-800 text-xs">{wi.equipmentName}</div>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-xs text-gray-500 mb-0.5">Revision</div>
            <div className="font-medium text-gray-800 text-xs">{wi.revision}</div>
          </div>
          {wi.estimatedMinutes && (
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Est. Time</div>
              <div className="font-medium text-gray-800 text-xs">{wi.estimatedMinutes} min</div>
            </div>
          )}
          {wi.responsibleRole ? (
            <div className="bg-[#1f355e]/5 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Responsible</div>
              <div className="font-medium text-[#1f355e] text-xs">{wi.responsibleRole}</div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Approved By</div>
              <div className="font-medium text-gray-800 text-xs">{wi.approvedBy ?? '—'}</div>
            </div>
          )}
        </div>

        {(wi.requiredPPE?.length || wi.requiredTools?.length) ? (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {wi.requiredPPE && wi.requiredPPE.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2">
                  <Shield size={13} /> Required PPE
                </div>
                <ul className="space-y-1">
                  {wi.requiredPPE.map(ppe => (
                    <li key={ppe} className="flex items-center gap-1.5 text-xs text-red-800">
                      <CheckCircle size={11} className="text-red-400" />{ppe}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {wi.requiredTools && wi.requiredTools.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                  <Wrench size={13} /> Required Tools
                </div>
                <ul className="space-y-1">
                  {wi.requiredTools.map(tool => (
                    <li key={tool} className="flex items-center gap-1.5 text-xs text-gray-700">
                      <CheckCircle size={11} className="text-gray-400" />{tool}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {/* ── ISO 9001:2015 QMS Document Information ── */}
      {(wi.documentNumber || wi.purpose || wi.scope || wi.referencedDocuments?.length || wi.responsibleRole || wi.issuedBy) && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#1f355e] uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={13} /> ISO 9001:2015 Document Information
            </h3>
            {wi.documentNumber && (
              <span className="font-mono text-xs font-bold text-[#1f355e] bg-[#1f355e]/8 border border-[#1f355e]/20 px-2 py-1 rounded">
                {wi.documentNumber}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">Revision</div>
              <div className="font-medium text-gray-800 text-xs">{wi.revision}</div>
            </div>
            {wi.effectiveDate && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Effective Date</div>
                <div className="font-medium text-gray-800 text-xs">{wi.effectiveDate}</div>
              </div>
            )}
            {wi.responsibleRole && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Responsible Role</div>
                <div className="font-medium text-gray-800 text-xs">{wi.responsibleRole}</div>
              </div>
            )}
            {wi.approvedBy && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Approved By</div>
                <div className="font-medium text-gray-800 text-xs">{wi.approvedBy}{wi.approvedAt ? ` (${wi.approvedAt.slice(0, 10)})` : ''}</div>
              </div>
            )}
            {wi.issuedBy && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Issued By</div>
                <div className="font-medium text-gray-800 text-xs">{wi.issuedBy}</div>
              </div>
            )}
          </div>
          {wi.purpose && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Purpose</div>
              <p className="text-xs text-gray-700 leading-relaxed border-l-2 border-[#1f355e]/30 pl-3">{wi.purpose}</p>
            </div>
          )}
          {wi.scope && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Scope</div>
              <p className="text-xs text-gray-700 leading-relaxed border-l-2 border-gray-300 pl-3">{wi.scope}</p>
            </div>
          )}
          {wi.referencedDocuments && wi.referencedDocuments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Referenced Documents</div>
              <ul className="space-y-0.5">
                {wi.referencedDocuments.map(ref => (
                  <li key={ref} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Steps</span>
          <span className="text-xs text-gray-400">({wi.steps.length} total)</span>
        </div>
        {wi.steps.map(step => (
          <StepCard key={step.id} step={step} lang={lang} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkInstructions() {
  const { state, dispatch } = useApp();
  const [searchParams] = useSearchParams();
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selected, setSelected] = useState<WorkInstruction | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWI, setEditingWI] = useState<WorkInstruction | null>(null);
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  // Deep-link: ?id=wi-cm40-01 pre-selects that WI on mount
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && state.workInstructions.length > 0) {
      const found = state.workInstructions.find(w => w.id === id);
      if (found) setSelected(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workInstructions]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    state.workInstructions.forEach(wi => { if (wi.department) depts.add(wi.department); });
    return Array.from(depts).sort();
  }, [state.workInstructions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.workInstructions.filter(wi => {
      const matchType = typeFilter === 'all' || wi.type === typeFilter;
      const matchDept = deptFilter === 'all' || wi.department === deptFilter;
      const matchSearch = !q ||
        wi.title.toLowerCase().includes(q) ||
        wi.equipmentName?.toLowerCase().includes(q) ||
        wi.description.toLowerCase().includes(q) ||
        wi.department?.toLowerCase().includes(q) ||
        wi.documentNumber?.toLowerCase().includes(q);
      return matchType && matchDept && matchSearch;
    });
  }, [state.workInstructions, search, typeFilter, deptFilter]);

  function handleSave(wi: WorkInstruction) {
    if (editingWI) {
      dispatch({ type: 'UPDATE_WORK_INSTRUCTION', payload: wi });
      setSelected(wi);
    } else {
      dispatch({ type: 'ADD_WORK_INSTRUCTION', payload: wi });
    }
    setShowBuilder(false);
    setEditingWI(null);
  }

  function openEdit(wi: WorkInstruction) {
    setEditingWI(wi);
    setShowBuilder(true);
    setSelected(null);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const items: WorkInstruction[] = Array.isArray(raw) ? raw : [raw];
        if (!items.length || !items[0].title) {
          setImportError('Invalid format. Expected a work instruction or array of work instructions.');
          return;
        }
        items.forEach(item => {
          const newWI = {
            ...item,
            id: `wi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            updatedAt: new Date().toISOString(),
          };
          dispatch({ type: 'ADD_WORK_INSTRUCTION', payload: newWI });
        });
      } catch {
        setImportError('Could not parse file. Make sure it is a valid JSON export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  if (showBuilder) {
    return (
      <WorkInstructionBuilder
        initialDraft={editingWI ? wiToDraft(editingWI) : undefined}
        editingId={editingWI?.id}
        onSave={handleSave}
        onCancel={() => { setShowBuilder(false); setEditingWI(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GuidedTourButton steps={WI_TOUR} />
          <div data-tour="wi-lang" className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Globe size={14} className="text-brand-500" />
            Language:
          </div>
          <div className="flex gap-1 flex-wrap">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  lang === l.code
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
                )}
              >
                {l.flag} {l.nativeName}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div data-tour="wi-actions" className="flex items-center gap-2">
          {/* Import JSON */}
          <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            title="Import work instructions from JSON"
          >
            <Upload size={13} /> Import JSON
          </button>
          {/* Export All */}
          {state.workInstructions.length > 0 && (
            <button
              onClick={() => exportAll(state.workInstructions)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              title="Export all work instructions as JSON"
            >
              <Download size={13} /> Export All
            </button>
          )}
          {/* New Instruction */}
          <button
            onClick={() => { setEditingWI(null); setShowBuilder(true); }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1f355e] text-white rounded-lg text-xs font-semibold hover:bg-[#2a4a80] transition-colors shadow-sm"
          >
            <Plus size={14} /> New Instruction
          </button>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={14} />
          {importError}
          <button onClick={() => setImportError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={13} /></button>
        </div>
      )}

      {lang !== 'en' && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Steps without translations will show English
        </div>
      )}

      {selected ? (
        <InstructionDetail
          wi={selected}
          lang={lang}
          onBack={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      ) : (
        <>
          {/* Filters */}
          <div data-tour="wi-filters" className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-44 max-w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search instructions..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Type filter */}
            <div className="flex gap-1 flex-wrap">
              {['all', 'operation', 'safety', 'maintenance', 'calibration', 'assembly'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                    typeFilter === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Department filter */}
            {departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} instruction{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid */}
          <div data-tour="wi-list" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(wi => (
              <InstructionCard key={wi.id} wi={wi} lang={lang} onSelect={() => setSelected(wi)} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-16 text-gray-400">
                <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">No work instructions found</p>
                <button
                  onClick={() => setShowBuilder(true)}
                  className="mt-3 text-xs text-brand-600 hover:underline"
                >
                  Create your first instruction →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Inline Modal for Job Detail ──────────────────────────────────────────────

export function WorkInstructionModal({
  open,
  onClose,
  filterStage,
  filterServiceType,
}: {
  open: boolean;
  onClose: () => void;
  filterStage?: string;
  filterServiceType?: string;
}) {
  const { state } = useApp();
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const [selected, setSelected] = useState<WorkInstruction | null>(null);

  if (!open) return null;

  const relevant = state.workInstructions.filter(wi => {
    if (filterStage && wi.jobStages?.length) {
      return wi.jobStages.includes(filterStage);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft size={18} />
              </button>
            )}
            <BookOpen size={18} className="text-brand-600" />
            <span className="font-semibold text-gray-900">
              {selected ? selected.title.slice(0, 40) + (selected.title.length > 40 ? '…' : '') : 'Work Instructions'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  title={l.label}
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    lang === l.code ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {l.flag}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="p-5">
          {selected ? (
            <InstructionDetail wi={selected} lang={lang} onBack={() => setSelected(null)} onEdit={() => {}} />
          ) : (
            <div className="space-y-3">
              {relevant.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No instructions for this stage</p>
              )}
              {relevant.map(wi => (
                <InstructionCard key={wi.id} wi={wi} lang={lang} onSelect={() => setSelected(wi)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
