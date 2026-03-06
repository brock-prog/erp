import React, { useState } from 'react';
import {
  CheckCircle, ChevronRight, ChevronLeft, FileText, Package,
  Palette, Calendar, Send, AlertCircle, Info,
} from 'lucide-react';

type Step = 'details' | 'spec' | 'review' | 'done';

const STEPS: { key: Step; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'details', label: 'Project Details', icon: Package },
  { key: 'spec',    label: 'Specification',   icon: Palette },
  { key: 'review',  label: 'Review & Submit', icon: Send },
];

const MATERIALS = ['Aluminum', 'Steel (mild/A36)', 'Steel (galvanized)', 'Steel (stainless)', 'Cast iron', 'Brass', 'Other'];
const FINISH_TYPES = [
  'Smooth Gloss', 'Semi-Gloss', 'Satin', 'Matte / Flat',
  'Wrinkle Texture', 'Hammer Texture', 'Candy / Metallic',
  'Primer only', 'Primer + Topcoat',
];
const UNIT_TYPES = [
  { value: 'pieces', label: 'Pieces' },
  { value: 'lbs',    label: 'Pounds (lbs)' },
  { value: 'ft',     label: 'Linear Feet (ft)' },
];

const COMMON_COLORS = [
  'RAL 9005 Jet Black', 'RAL 9016 Traffic White', 'RAL 7035 Light Grey',
  'RAL 7016 Anthracite Grey', 'RAL 6005 Moss Green', 'RAL 5012 Light Blue',
  'RAL 3002 Carmine Red', 'RAL 1003 Signal Yellow', 'RAL 9006 White Aluminium',
  'Custom RAL / colour chip',
];

interface FormData {
  profileDescription: string;
  material: string;
  quantity: string;
  unitType: 'pieces' | 'lbs' | 'ft';
  finishType: string;
  color: string;
  targetDate: string;
  drawingNotes: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
}

const EMPTY: FormData = {
  profileDescription: '',
  material: '',
  quantity: '',
  unitType: 'pieces',
  finishType: '',
  color: '',
  targetDate: '',
  drawingNotes: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
};

function StepIndicator({ current, steps }: { current: Step; steps: typeof STEPS }) {
  const currentIdx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map(({ key, label, icon: Icon }, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={key}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                done   ? 'bg-[#009877] border-[#009877] shadow'
                : active ? 'bg-white border-[#1f355e] shadow-md ring-4 ring-[#1f355e]/10'
                : 'bg-white border-gray-200'
              }`}>
                {done
                  ? <CheckCircle className="w-5 h-5 text-white" />
                  : <Icon className={`w-4 h-4 ${active ? 'text-[#1f355e]' : 'text-gray-300'}`} />
                }
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${
                active ? 'text-[#1f355e]' : done ? 'text-[#009877]' : 'text-gray-400'
              }`}>{label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-12 sm:w-20 mt-[-18px] transition-all ${done ? 'bg-[#009877]' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function CustomerPortalQuoteRequest() {
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const validateStep = (): boolean => {
    const errs: typeof errors = {};
    if (step === 'details') {
      if (!form.profileDescription.trim()) errs.profileDescription = 'Please describe your parts/profile.';
      if (!form.material) errs.material = 'Please select a material.';
      if (!form.quantity.trim() || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0)
        errs.quantity = 'Please enter a valid quantity.';
    }
    if (step === 'spec') {
      if (!form.finishType) errs.finishType = 'Please select a finish type.';
      if (!form.color.trim()) errs.color = 'Please specify a colour.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step === 'details') setStep('spec');
    else if (step === 'spec') setStep('review');
  };
  const back = () => {
    if (step === 'spec') setStep('details');
    else if (step === 'review') setStep('spec');
  };

  const submit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-20 h-20 rounded-full bg-[#009877]/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-[#009877]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Quote Request Submitted!</h1>
        <p className="text-gray-500 leading-relaxed mb-2">
          We've received your request and our team will review it shortly.
          You can expect a quote within <span className="font-semibold text-gray-700">1–2 business days</span>.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          A confirmation will be sent to your email. If you have urgent requirements, feel free to call us directly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => { setForm(EMPTY); setStep('details'); }}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Submit Another Request
          </button>
          <a
            href="/portal/dashboard"
            className="px-5 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80] transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Request a Quote</h1>
        <p className="text-gray-500 text-sm mt-1">Fill out the form below and our team will prepare a detailed quote for your powder coating project.</p>
      </div>

      <StepIndicator current={step} steps={STEPS} />

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-8">

        {/* ── Step 1: Project Details ──────────────────────────────────── */}
        {step === 'details' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#1f355e]" /> Project Details
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Describe your parts / profile <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={form.profileDescription}
                onChange={set('profileDescription')}
                placeholder="e.g. Aluminum extrusion 3x1.5 box section, 20 ft lengths. Holes pre-drilled. Delivered on pallets."
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all resize-none ${errors.profileDescription ? 'border-red-300' : 'border-gray-200'}`}
              />
              {errors.profileDescription && <p className="text-red-500 text-xs mt-1">{errors.profileDescription}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Material <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.material}
                  onChange={set('material')}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.material ? 'border-red-300' : 'border-gray-200'}`}
                >
                  <option value="">Select material…</option>
                  {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {errors.material && <p className="text-red-500 text-xs mt-1">{errors.material}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={set('quantity')}
                    placeholder="e.g. 500"
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.quantity ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  <select
                    value={form.unitType}
                    onChange={set('unitType')}
                    className="px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
                  >
                    {UNIT_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Completion Date</label>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={set('targetDate')}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Additional Notes / Drawing Reference</label>
                <input
                  type="text"
                  value={form.drawingNotes}
                  onChange={set('drawingNotes')}
                  placeholder="e.g. Drawing ref APX-0042, no masking required"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Specification ────────────────────────────────────── */}
        {step === 'spec' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#1f355e]" /> Finish & Colour Specification
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Finish Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FINISH_TYPES.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, finishType: f }))}
                    className={`px-3 py-2.5 border rounded-xl text-xs font-medium transition-all text-left ${
                      form.finishType === f
                        ? 'border-[#1f355e] bg-[#1f355e] text-white shadow'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {errors.finishType && <p className="text-red-500 text-xs mt-1">{errors.finishType}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Colour <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {COMMON_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                    className={`px-3 py-2 border rounded-xl text-xs font-medium transition-all text-left ${
                      form.color === c
                        ? 'border-[#1f355e] bg-[#1f355e]/5 text-[#1f355e]'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.color}
                onChange={set('color')}
                placeholder="Or type a custom colour / RAL code…"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.color ? 'border-red-300' : 'border-gray-200'}`}
              />
              {errors.color && <p className="text-red-500 text-xs mt-1">{errors.color}</p>}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Not sure about your colour? We carry a full RAL colour library and can provide sample chips before production.
                You can also request samples from our{' '}
                <a href="/portal/sample-request" className="font-semibold underline">Sample Request</a> page.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ───────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1f355e]" /> Review Your Request
            </h2>

            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              {[
                { label: 'Description',   value: form.profileDescription },
                { label: 'Material',      value: form.material },
                { label: 'Quantity',      value: `${form.quantity} ${form.unitType}` },
                { label: 'Finish',        value: form.finishType },
                { label: 'Colour',        value: form.color },
                { label: 'Target Date',   value: form.targetDate || 'Not specified' },
                { label: 'Notes',         value: form.drawingNotes || 'None' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">{label}</span>
                  <span className="text-gray-800 text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Once submitted, our team will review your request and follow up within <strong>1–2 business days</strong>.
                For urgent requests, please call <strong>905-555-1000</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className={`flex mt-8 pt-6 border-t border-gray-100 ${step === 'details' ? 'justify-end' : 'justify-between'}`}>
          {step !== 'details' && (
            <button
              onClick={back}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step !== 'review' ? (
            <button
              onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80] transition-colors shadow"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#009877] text-white rounded-xl text-sm font-semibold hover:bg-[#007a61] transition-colors shadow disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                <><Send className="w-4 h-4" /> Submit Quote Request</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
