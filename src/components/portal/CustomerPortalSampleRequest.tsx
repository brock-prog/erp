import React, { useState } from 'react';
import { CheckCircle, Beaker, Plus, X, Send, Truck, Info } from 'lucide-react';

const PRESET_COLORS = [
  'RAL 9005 Jet Black', 'RAL 9016 Traffic White', 'RAL 9006 White Aluminium',
  'RAL 7035 Light Grey', 'RAL 7016 Anthracite Grey', 'RAL 5012 Light Blue',
  'RAL 5015 Sky Blue', 'RAL 6005 Moss Green', 'RAL 3002 Carmine Red',
  'RAL 1003 Signal Yellow', 'RAL 8017 Chocolate Brown', 'RAL 6018 Yellow Green',
];

const FINISH_TYPES = [
  'Smooth Gloss', 'Semi-Gloss', 'Satin', 'Matte / Flat',
  'Wrinkle Texture', 'Hammer Texture', 'Candy / Metallic',
];

interface FormData {
  colors: string[];
  customColor: string;
  finishTypes: string[];
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostal: string;
  notes: string;
}

const EMPTY: FormData = {
  colors: [],
  customColor: '',
  finishTypes: [],
  shippingName: '',
  shippingAddress: '',
  shippingCity: '',
  shippingProvince: '',
  shippingPostal: '',
  notes: '',
};

export function CustomerPortalSampleRequest() {
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [errors, setErrors]   = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);

  const toggleColor = (c: string) =>
    setForm(p => ({
      ...p,
      colors: p.colors.includes(c) ? p.colors.filter(x => x !== c) : [...p.colors, c],
    }));

  const addCustomColor = () => {
    const c = form.customColor.trim();
    if (c && !form.colors.includes(c)) {
      setForm(p => ({ ...p, colors: [...p.colors, c], customColor: '' }));
    }
  };

  const removeColor = (c: string) =>
    setForm(p => ({ ...p, colors: p.colors.filter(x => x !== c) }));

  const toggleFinish = (f: string) =>
    setForm(p => ({
      ...p,
      finishTypes: p.finishTypes.includes(f) ? p.finishTypes.filter(x => x !== f) : [...p.finishTypes, f],
    }));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (form.colors.length === 0) errs.colors = 'Please select at least one colour.';
    if (form.finishTypes.length === 0) errs.finishTypes = 'Please select at least one finish type.';
    if (!form.shippingName.trim())     errs.shippingName = 'Required.';
    if (!form.shippingAddress.trim())  errs.shippingAddress = 'Required.';
    if (!form.shippingCity.trim())     errs.shippingCity = 'Required.';
    if (!form.shippingProvince.trim()) errs.shippingProvince = 'Required.';
    if (!form.shippingPostal.trim())   errs.shippingPostal = 'Required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-20 h-20 rounded-full bg-[#009877]/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-[#009877]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Sample Request Submitted!</h1>
        <p className="text-gray-500 leading-relaxed mb-2">
          We'll prepare your colour and finish samples and ship them to you within <span className="font-semibold text-gray-700">3–5 business days</span>.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          Samples ship free of charge. You'll receive a tracking number by email once dispatched.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => { setForm(EMPTY); setDone(false); }}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Request More Samples
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request Colour Samples</h1>
        <p className="text-gray-500 text-sm mt-1">
          We'll send you physical powder-coated sample chips — free of charge — so you can approve the colour and finish before production.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 leading-relaxed space-y-1">
          <p><strong>Free shipping.</strong> Samples ship via Canada Post / USPS within 3–5 business days.</p>
          <p><strong>Actual panels.</strong> All samples are powder coated on 3" × 4" aluminum substrate — exactly what your finished parts will look like.</p>
          <p><strong>Maximum 8 colours</strong> per request. For larger sample sets, please contact us.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-8 space-y-8">

        {/* Colour selection */}
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Beaker className="w-5 h-5 text-[#1f355e]" /> Select Colours
          </h2>

          {/* Selected chips */}
          {form.colors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {form.colors.map(c => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1f355e] text-white rounded-full text-xs font-medium"
                >
                  {c}
                  <button onClick={() => removeColor(c)} className="hover:opacity-70 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Preset colours */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  if (form.colors.length >= 8 && !form.colors.includes(c)) return;
                  toggleColor(c);
                }}
                disabled={form.colors.length >= 8 && !form.colors.includes(c)}
                className={`px-3 py-2 border rounded-xl text-xs font-medium transition-all text-left ${
                  form.colors.includes(c)
                    ? 'border-[#1f355e] bg-[#1f355e] text-white shadow'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Custom colour input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={form.customColor}
              onChange={e => setForm(p => ({ ...p, customColor: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addCustomColor()}
              placeholder="Add a custom RAL or colour name…"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
              disabled={form.colors.length >= 8}
            />
            <button
              type="button"
              onClick={addCustomColor}
              disabled={!form.customColor.trim() || form.colors.length >= 8}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80] transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {errors.colors && <p className="text-red-500 text-xs mt-1">{errors.colors}</p>}
          <p className="text-gray-400 text-xs mt-2">{form.colors.length} / 8 colours selected</p>
        </div>

        {/* Finish type */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Finish Types</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FINISH_TYPES.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFinish(f)}
                className={`px-3 py-2.5 border rounded-xl text-xs font-medium transition-all text-left ${
                  form.finishTypes.includes(f)
                    ? 'border-[#009877] bg-[#009877] text-white shadow'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {errors.finishTypes && <p className="text-red-500 text-xs mt-1">{errors.finishTypes}</p>}
        </div>

        {/* Shipping address */}
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-[#1f355e]" /> Shipping Address
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Attention / Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.shippingName}
                  onChange={e => setForm(p => ({ ...p, shippingName: e.target.value }))}
                  placeholder="Full name or attention line"
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.shippingName ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Street Address <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.shippingAddress}
                  onChange={e => setForm(p => ({ ...p, shippingAddress: e.target.value }))}
                  placeholder="123 Main Street"
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.shippingAddress ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">City <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.shippingCity}
                  onChange={e => setForm(p => ({ ...p, shippingCity: e.target.value }))}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.shippingCity ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Province / State <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.shippingProvince}
                  onChange={e => setForm(p => ({ ...p, shippingProvince: e.target.value }))}
                  placeholder="ON"
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.shippingProvince ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Postal / ZIP <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.shippingPostal}
                  onChange={e => setForm(p => ({ ...p, shippingPostal: e.target.value }))}
                  placeholder="L2S 3V5"
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.shippingPostal ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Additional Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Any special requirements, substrate preferences, or reference job numbers…"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all resize-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 bg-[#009877] text-white rounded-xl font-semibold text-sm hover:bg-[#007a61] transition-colors shadow disabled:opacity-60"
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
              <><Send className="w-4 h-4" /> Request Samples</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
