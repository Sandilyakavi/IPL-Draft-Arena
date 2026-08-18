import React from 'react';
import { Award, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import ProgressBar from '../common/ProgressBar';

/**
 * SquadScoreCard Component — Displays Quality (70 pts), Balance (30 pts), and Final Score (100 pts).
 */
export default function SquadScoreCard({
  userName = 'Player',
  evaluation,
  userKey = 'player1',
}) {
  if (!evaluation) return null;

  const { finalScore, scoreLabel, qualityScore, balanceScore, qualityDetails, balanceDetails } = evaluation;

  const getLabelColor = (score) => {
    if (score >= 90) return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/20';
    if (score >= 80) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/20';
    if (score >= 70) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20';
    if (score >= 60) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-indigo-500/20';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/20';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3.5 h-3.5 rounded-full ${userKey === 'player1' ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-amber-400 shadow-sm shadow-amber-400'}`} />
          <h3 className="font-extrabold text-white text-base">{userName} Score</h3>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md ${getLabelColor(finalScore)}`}>
          {scoreLabel}
        </span>
      </div>

      {/* Hero Final Score */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-4 text-center space-y-1 shadow-inner relative overflow-hidden">
        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Total Squad Score</span>
        <div className="text-4xl font-black text-white tracking-tight flex items-baseline justify-center gap-1">
          <span className="bg-gradient-to-r from-cyan-300 via-white to-amber-300 bg-clip-text text-transparent">{finalScore}</span>
          <span className="text-sm font-normal text-slate-500">/ 100</span>
        </div>
      </div>

      {/* Component Scores Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Player Quality Score (70 Pts) */}
        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> Player Quality
            </span>
            <span className="font-mono font-extrabold text-cyan-300">{qualityScore} / 70</span>
          </div>
          <ProgressBar value={qualityScore} max={70} />
          <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Avg Rating:</span>
            <span className="font-mono text-white font-bold">{qualityDetails.avgRating} / 100</span>
          </div>
        </div>

        {/* Squad Balance Score (30 Pts) */}
        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Squad Balance
            </span>
            <span className="font-mono font-extrabold text-amber-300">{balanceScore} / 30</span>
          </div>
          <ProgressBar value={balanceScore} max={30} />
          <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Role & Quota:</span>
            <span className="font-mono text-white font-bold">{balanceDetails.totalBalanceScore} pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
