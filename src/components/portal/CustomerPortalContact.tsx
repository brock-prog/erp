import React, { useState } from 'react';
import {
  MessageCircle, Phone, Mail, MapPin, Clock, Send,
  CheckCircle, ChevronRight, User, Building, AlertCircle,
} from 'lucide-react';
import { useCustomerPortal } from '../../context/CustomerPortalContext';

const SUBJECTS = [
  'Question about my order',
  'Change or modification request',
  'Quote / pricing inquiry',
  'Delivery / shipping question',
  'Quality concern',
  'Invoicing or billing',
  'Technical specifications',
  'New project inquiry',
  'Other',
];

interface FormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export function CustomerPortalContact() {
  const { portalState } = useCustomerPortal();
  const session = portalState.session;

  const [form, setForm] = useState<FormData>({
    name:    session?.contactName ?? '',
    email:   session?.email ?? '',
    phone:   '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim())    errs.name    = 'Required.';
    if (!form.email.trim())   errs.email   = 'Required.';
    if (!form.subject)        errs.subject = 'Please select a subject.';
    if (!form.message.trim()) errs.message = 'Please write a message.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 900));
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-20 h-20 rounded-full bg-[#009877]/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-[#009877]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Message Sent!</h1>
        <p className="text-gray-500 leading-relaxed mb-2">
          Thank you for reaching out. Our team will get back to you within <span className="font-semibold text-gray-700">1 business day</span>.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          For urgent matters, please call us directly at <span className="font-semibold text-gray-600">905-555-1000</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setDone(false)}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Send Another Message
          </button>
          <a href="/portal/dashboard" className="px-5 py-2.5 bg-[#1f355e] text-white rounded-xl text-sm font-semibold hover:bg-[#2a4a80] transition-colors">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-gray-500 text-sm mt-1">
          Have a question, concern, or change request? We're here to help.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Contact cards */}
        <div className="space-y-4">

          {/* Company info */}
          <div className="bg-gradient-to-br from-[#1f355e] to-[#2a4a80] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base">Decora Powder Coatings</h2>
                <p className="text-white/60 text-xs">St. Catharines, Ontario</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: MapPin,  label: '24 Benfield Dr, St. Catharines, ON L2S 3V5' },
                { icon: Phone,   label: '905-555-1000' },
                { icon: Mail,    label: 'info@decoracoatings.com' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-white/80" />
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[#1f355e]" />
              <h3 className="text-sm font-bold text-gray-800">Production Hours</h3>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { day: 'Monday – Thursday', hrs: '6:00 AM – 4:00 PM' },
                { day: 'Friday',            hrs: '6:00 AM – 2:00 PM' },
                { day: 'Saturday – Sunday', hrs: 'Closed' },
              ].map(({ day, hrs }) => (
                <div key={day} className="flex justify-between">
                  <span className="text-gray-500">{day}</span>
                  <span className="font-medium text-gray-700 text-right">{hrs}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              * Office hours: Mon–Fri 8:00 AM – 5:00 PM
            </p>
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Other Ways We Can Help</h3>
            <div className="space-y-2">
              {[
                { label: 'Track my orders',   href: '/portal/orders',         desc: 'Real-time production status' },
                { label: 'Request a quote',   href: '/portal/quote-request',  desc: 'Get pricing within 24 hrs' },
                { label: 'Order samples',     href: '/portal/sample-request', desc: 'Free colour chip samples' },
              ].map(({ label, href, desc }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-[#1f355e] transition-colors">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1f355e] transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-8">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-6">
            <MessageCircle className="w-5 h-5 text-[#1f355e]" /> Send Us a Message
          </h2>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Full name"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                  />
                </div>
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@company.com"
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.email ? 'border-red-300' : 'border-gray-200'}`}
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone (optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="555-555-5555"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject <span className="text-red-500">*</span></label>
                <select
                  value={form.subject}
                  onChange={set('subject')}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all ${errors.subject ? 'border-red-300' : 'border-gray-200'}`}
                >
                  <option value="">Select a topic…</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message <span className="text-red-500">*</span></label>
              <textarea
                rows={6}
                value={form.message}
                onChange={set('message')}
                placeholder="Please describe your question or request in detail. Include job numbers, PO numbers, or order references where applicable."
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all resize-none ${errors.message ? 'border-red-300' : 'border-gray-200'}`}
              />
              {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
            </div>

            {/* Urgent banner */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>Urgent?</strong> Call us directly at <strong>905-555-1000</strong> for same-day assistance.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-[#1f355e] text-white rounded-xl font-semibold text-sm hover:bg-[#2a4a80] transition-colors shadow disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Sending…
                  </>
                ) : (
                  <><Send className="w-4 h-4" /> Send Message</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
