import React, { useState } from 'react';
import LoginView from './LoginView';
import SignUpView from './SignUpView';
import ForgotPasswordView from './ForgotPasswordView';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Shield, Info } from 'lucide-react';

/**
 * AuthPage Component — Central Authentication Container for IPL Draft Arena.
 */
export default function AuthPage() {
  const [viewMode, setViewMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const { loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-400 animate-pulse">
            AUTHENTICATING SESSION...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans flex items-center justify-center p-4 sm:p-6 selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-md w-full mx-auto space-y-6">

        {/* Branding Banner */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20 font-black mx-auto">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-1">
              2026 Season
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              IPL Draft Arena
            </h1>
            <p className="text-xs text-slate-400 font-medium">Local 2-Player Strategy & Squad Construction</p>
          </div>
        </div>

        {/* Supabase Environment Notice (if keys not in .env) */}
        {!isConfigured && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-slate-300 text-xs flex items-start gap-2.5 shadow-lg">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-left space-y-1">
              <span className="font-bold text-amber-300 block">Supabase Keys Unconfigured</span>
              <p className="text-[11px] text-slate-400">
                To enable live Supabase Auth & Google OAuth, add your credentials to <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded">.env</code>. You can click <strong>"Enter Local Arena (Offline Demo Mode)"</strong> below to test the game locally right now.
              </p>
            </div>
          </div>
        )}

        {/* Auth Card Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          {viewMode === 'login' && <LoginView onSwitchView={setViewMode} />}
          {viewMode === 'signup' && <SignUpView onSwitchView={setViewMode} />}
          {viewMode === 'forgot' && <ForgotPasswordView onSwitchView={setViewMode} />}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          Protected by Supabase Auth · IPL Draft Arena Phase 6A
        </div>

      </div>
    </div>
  );
}
