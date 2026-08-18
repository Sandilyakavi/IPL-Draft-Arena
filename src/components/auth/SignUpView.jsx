import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * SignUpView Component — New account registration view with validation.
 */
export default function SignUpView({ onSwitchView }) {
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await signUp({ email, password });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create account.');
    } else {
      if (res.requiresVerification) {
        setSuccessMsg('Account created successfully! Please check your email to verify your account before logging in.');
      } else {
        setSuccessMsg('Account created successfully! You can now log in.');
      }
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="text-left space-y-1">
        <h2 className="text-xl font-extrabold text-white">Create Account</h2>
        <p className="text-xs text-slate-400">Join IPL Draft Arena to build your squad</p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="coach@ipldraft.com"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1 text-left">
          <label htmlFor="signup-password-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Password (min 6 characters)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="signup-password-input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1 text-left">
          <label htmlFor="signup-confirm-password" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="signup-confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !email || !password || !confirmPassword}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95"
        >
          {isSubmitting ? (
            <span className="animate-pulse">CREATING ACCOUNT...</span>
          ) : (
            <>
              <UserPlus className="w-4 h-4" /> CREATE ACCOUNT
            </>
          )}
        </button>
      </form>

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
    </div>
  );
}
