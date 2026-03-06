import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useCustomerPortal } from '../../context/CustomerPortalContext';

export function CustomerPortalLogin() {
  const { portalLogin, portalState } = useCustomerPortal();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Already logged in → go to dashboard
  if (portalState.session) {
    navigate('/portal/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    // Simulate slight async for UX
    await new Promise(r => setTimeout(r, 500));
    const result = portalLogin(email.trim(), password);
    setLoading(false);
    if (result.ok) {
      navigate('/portal/dashboard', { replace: true });
    } else {
      setError(result.error ?? 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1424] via-[#1f355e] to-[#0b1424] flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#009877] flex items-center justify-center shadow">
            <span className="text-white font-black text-sm tracking-tight">D</span>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">DECORA</span>
          <span className="text-white/40 text-sm ml-1">Customer Portal</span>
        </div>
        <a
          href="tel:+19055551000"
          className="text-white/60 hover:text-white text-sm transition-colors"
        >
          Need help? Call us ›
        </a>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Card header */}
            <div className="bg-gradient-to-r from-[#1f355e] to-[#2a4a80] px-8 py-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-xl leading-tight">Secure Client Login</h1>
                  <p className="text-white/60 text-sm">Decora Powder Coatings — Customer Portal</p>
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Track your orders in real time, request quotes, view invoices, and connect with our team — all in one place.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1f355e]/30 focus:border-[#1f355e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Demo hint */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold text-blue-800">Demo Credentials</p>
                <p>mike@ironclad.com / ironclad2024</p>
                <p>tom@apexauto.com / apex2024</p>
                <p>dana@coastalsigns.com / coastal2024</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1f355e] hover:bg-[#2a4a80] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <>
                    Sign In <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Forgot password / contact */}
              <p className="text-center text-xs text-gray-500">
                Forgot your password?{' '}
                <Link to="/portal/contact" className="text-[#1f355e] font-semibold hover:underline">
                  Contact us
                </Link>{' '}
                and we'll reset it for you.
              </p>
            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-white/40 text-xs mt-6">
            Your information is protected with 256-bit encryption.
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-8 py-4 border-t border-white/10 flex items-center justify-between text-white/30 text-xs">
        <span>© 2026 Decora Powder Coatings Inc. All rights reserved.</span>
        <span>24 Benfield Dr, St. Catharines, ON L2S 3V5</span>
      </div>
    </div>
  );
}
