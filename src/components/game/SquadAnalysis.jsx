import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, Database, Award, Shield } from 'lucide-react';

/**
 * SquadAnalysis Component — Factual Strengths, Weaknesses, Score Breakdown, and Data Source metadata.
 */
export default function SquadAnalysis({ evaluation }) {
  const [showExplanation, setShowExplanation] = useState(false);

  if (!evaluation) return null;

  const { strengths = [], weaknesses = [], qualityDetails, balanceDetails } = evaluation;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-cyan-400" /> Factual Squad Analysis
        </h3>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{showExplanation ? 'Hide Scoring Logic' : 'How is this calculated?'}</span>
        </button>
      </div>

      {/* HOW IS THIS SCORE CALCULATED EXPANDABLE PANEL */}
      {showExplanation && (
        <div className="p-4 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-3 text-xs text-slate-300 animate-fadeIn">
          <h4 className="font-black text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Phase 4 Transparent Scoring System
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <span className="font-bold text-white block">PLAYER QUALITY (70 POINTS)</span>
              <p className="text-slate-400 leading-relaxed">
                Aggregates verified T20 performance stats for all 12 squad members (Batting Runs/SR/Avg, Bowling Wickets/Economy/SR, All-Rounder/WK metrics).
              </p>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <span className="font-bold text-white block">SQUAD BALANCE (30 POINTS)</span>
              <p className="text-slate-400 leading-relaxed">
                Evaluates structural balance: Role Balance (10 pts), Bowling Coverage (7 pts), Wicketkeeping (4 pts), Overseas Flexibility (3 pts), Franchise Diversity (3 pts), Completeness (3 pts).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STRENGTHS */}
      {strengths.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified Squad Strengths
          </span>
          <div className="space-y-1.5">
            {strengths.map((s, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 font-medium">
                • {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WEAKNESSES */}
      {weaknesses.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Factual Squad Vulnerabilities
          </span>
          <div className="space-y-1.5">
            {weaknesses.map((w, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 font-medium">
                • {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DATA SOURCE METADATA PANEL */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1 font-semibold">
          <Database className="w-3 h-3 text-cyan-400" /> Source: Official IPL T20 Stats & ESPNcricinfo
        </span>
        <span>Verified: 2026-08-10</span>
      </div>
    </div>
  );
}
