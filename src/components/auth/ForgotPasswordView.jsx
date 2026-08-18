import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, ArrowLeft, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * ForgotPasswordView Component — Password reset request view.
 */
export default function ForgotPasswordView({ onSwitchView }) {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await resetPassword(email);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to send reset email.');
    } else {
      setSuccessMsg('Password reset instructions sent! Please check your email inbox.');
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="text-left space-y-1">
        <h2 className="text-xl font-extrabold text-white">Reset Password</h2>
        <p className="text-xs text-slate-400">Enter your email address to receive password reset instructions</p>
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
          <label htmlFor="forgot-email-input" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Registered Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              id="forgot-email-input"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="coach@ipldraft.com"
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95"
        >
          {isSubmitting ? (
            <span className="animate-pulse">SENDING RESET LINK...</span>
          ) : (
            <>
              <KeyRound className="w-4 h-4" /> SEND RESET LINK
            </>
          )}
        </button>
      </form>

      {/* Back to Login Link */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => onSwitchView('login')}
          className="text-xs text-slate-400 hover:text-cyan-400 font-extrabold flex items-center justify-center gap-1.5 mx-auto transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
      </div>
    </div>
  );
}
