import React from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, Award, UserCheck, Globe, Building2 } from 'lucide-react';
import ProgressBar from '../common/ProgressBar';

/**
 * RuleTracker Component — Displays active draft constraints & live squad limits.
 */
export default function RuleTracker({ rules = {}, currentTurnUser }) {
  const squad = currentTurnUser?.squad || [];
  const squadCount = squad.length;
  const maxSquad = rules.squadSize || 12;

  const overseasCount = squad.filter(p => p.isOverseas).length;
  const maxOverseas = rules.maxOverseas || 4;

  const isOverseasMaxed = overseasCount >= maxOverseas;
  const isSquadMaxed = squadCount >= maxSquad;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" /> Active Draft Rules & Quotas
        </h3>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          Rule Engine Active
        </span>
      </div>

      <div className="space-y-3">
        {/* Squad Size Limit */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" /> Target Squad Size
            </span>
            {isSquadMaxed ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Squad Complete
              </span>
            ) : (
              <span className="font-mono text-cyan-400 font-bold">{squadCount} / {maxSquad}</span>
            )}
          </div>
          <ProgressBar value={squadCount} max={maxSquad} />
        </div>

        {/* Overseas Player Limit */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" /> Overseas Player Limit
            </span>
            {isOverseasMaxed ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Limit Reached (4/4)
              </span>
            ) : (
              <span className="font-mono text-emerald-400 font-bold">{overseasCount} / {maxOverseas} max</span>
            )}
          </div>
          <ProgressBar value={overseasCount} max={maxOverseas} />
        </div>

        {/* Franchise Limit */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Max Players / Franchise
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
            Max {rules.maxPlayersPerTeam || 2} per user
          </span>
        </div>

        {/* Global Player Uniqueness */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Global Uniqueness Rule
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Strict (1 Draft / Player)
          </span>
        </div>
      </div>
    </div>
  );
}
