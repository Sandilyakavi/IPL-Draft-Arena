import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

/**
 * SignUpView Component — New account registration view with hardened validation.
 * Phase 7A: password strength hint, confirmation match, ref guard, friendly errors.
 */
export default function SignUpView({ onSwitchView }) {
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const submitGuard = useRef(false);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || submitGuard.current) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Client-side validation first
    if (!email.trim()) { setErrorMsg('Email address is required.'); return; }
    if (password.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setErrorMsg('Passwords do not match. Please re-enter your password.'); return; }

    submitGuard.current = true;
    setIsSubmitting(true);

    try {
      const res = await signUp({ email, password });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to create account. Please try again.');
      } else {
        if (res.requiresVerification) {
          setSuccessMsg('Account created! Check your email inbox to verify your address before signing in.');
        } else {
          setSuccessMsg('Account created successfully! You can now sign in.');
        }
        // Reset form on success
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      setIsSubmitting(false);
      submitGuard.current = false;
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="text-left space-y-1">
        <h2 className="text-xl font-extrabold text-white">Create Account</h2>
        <p className="text-xs text-slate-400">Join IPL Draft Arena to build your squad</p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2" role="alert" aria-live="polite">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2" role="status" aria-live="polite">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {successMsg ? (
        /* After success — show only Sign In link */
        <div className="text-center pt-2 text-xs text-slate-400">
          <button
            type="button"
            onClick={() => onSwitchView('login')}
            className="text-cyan-400 hover:underline font-bold"
          >
            Go to Sign In →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1 text-left">
            <label htmlFor="signup-email-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="signup-email-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg(null); }}
                placeholder="coach@ipldraft.com"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1 text-left">
            <label htmlFor="signup-password-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Password</span>
              {passwordTooShort && <span className="text-rose-400 normal-case font-normal">Min 6 characters</span>}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="signup-password-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={e => { setPassword(e.target.value); setErrorMsg(null); }}
                placeholder="At least 6 characters"
                className={`w-full bg-slate-950/90 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${
                  passwordTooShort ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/30'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1 text-left">
            <label htmlFor="signup-confirm-password" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Confirm Password</span>
              {confirmPassword && !passwordsMatch && <span className="text-rose-400 normal-case font-normal">Passwords don&apos;t match</span>}
              {passwordsMatch && <span className="text-emerald-400 normal-case font-normal">✓ Matches</span>}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="signup-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(null); }}
                placeholder="••••••••"
                className={`w-full bg-slate-950/90 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${
                  confirmPassword && !passwordsMatch
                    ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                    : passwordsMatch
                    ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                    : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/30'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="signup-submit-btn"
            disabled={isSubmitting || !email.trim() || !password || !confirmPassword}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95"
          >
            {isSubmitting ? (
              <span className="animate-pulse">CREATING ACCOUNT...</span>
            ) : (
              <><UserPlus className="w-4 h-4" /> CREATE ACCOUNT</>
            )}
          </button>

          {/* Back to Login Link */}
          <div className="text-center pt-2 text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onSwitchView('login')}
              className="text-cyan-400 hover:underline font-bold"
            >
              Sign In
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
