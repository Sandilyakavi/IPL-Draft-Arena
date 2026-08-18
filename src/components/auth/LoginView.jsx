import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, LogIn, AlertCircle, PlayCircle, Eye, EyeOff } from 'lucide-react';

/**
 * LoginView Component — Email/Password & Google OAuth Login Form.
 * Phase 7A: hardened with password visibility toggle, submission guard, friendly errors.
 */
export default function LoginView({ onSwitchView }) {
  const { login, loginWithGoogle, loginAsDemoUser, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const submitGuard = useRef(false); // prevents double-submissions on fast clicks

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting || submitGuard.current) return;

    submitGuard.current = true;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await login({ email, password });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
      submitGuard.current = false;
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting || submitGuard.current) return;
    submitGuard.current = true;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await loginWithGoogle();
      // Google OAuth redirects away — only handle sync failures here
      if (!res.success) {
        setErrorMsg(res.error || 'Google Sign-In failed. Please try again.');
        setIsSubmitting(false);
      }
      // On success, page will redirect; don't reset submitting state
    } catch (err) {
      setErrorMsg('Google Sign-In failed. Please try again.');
      setIsSubmitting(false);
    } finally {
      submitGuard.current = false;
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="text-left space-y-1">
        <h2 className="text-xl font-extrabold text-white">Welcome Back</h2>
        <p className="text-xs text-slate-400">Sign in to your IPL Draft Arena account</p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2" role="alert" aria-live="polite">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-1 text-left">
          <label htmlFor="login-email-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="login-email-input"
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
          <div className="flex items-center justify-between">
            <label htmlFor="login-password-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Password
            </label>
            <button
              type="button"
              onClick={() => onSwitchView('forgot')}
              className="text-[11px] text-cyan-400 hover:underline font-semibold"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="login-password-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={e => { setPassword(e.target.value); setErrorMsg(null); }}
              placeholder="••••••••"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
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

        {/* Primary Login CTA */}
        <button
          type="submit"
          id="login-submit-btn"
          disabled={isSubmitting || !email.trim() || !password}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95"
        >
          {isSubmitting ? (
            <span className="animate-pulse">SIGNING IN...</span>
          ) : (
            <><LogIn className="w-4 h-4" /> SIGN IN</>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center justify-center my-2">
        <div className="border-t border-slate-800 w-full" />
        <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase font-bold absolute">OR</span>
      </div>

      {/* Google OAuth Button */}
      <button
        type="button"
        id="google-signin-btn"
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
        className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
          <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z" />
          <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
        </svg>
        Sign in with Google
      </button>

      {/* Demo Mode Button (only when Supabase not configured) */}
      {!isConfigured && (
        <div className="pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={loginAsDemoUser}
            className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-4 h-4 text-cyan-400" /> Enter Local Arena (Offline Demo Mode)
          </button>
        </div>
      )}

      {/* Sign Up Link */}
      <div className="text-center pt-2 text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchView('signup')}
          className="text-cyan-400 hover:underline font-bold"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
