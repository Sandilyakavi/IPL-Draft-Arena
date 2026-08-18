import React from 'react';
import { getDraftPool } from '../../utils/dataLoader.js';
import { ShieldCheck, Users, Flame, Globe, Repeat, LayoutList } from 'lucide-react';

/**
 * RulesPreview Component — Concise preview panel displaying active draft game rules
 * and dynamic 2026 draft pool player count.
 */
export default function RulesPreview() {
  const eligiblePoolCount = getDraftPool('2026').length;

  const rulesList = [
    { icon: Users, title: '2 Players', desc: 'Local 2-Player Arena' },
    { icon: Flame, title: '24 Total Picks', desc: '12 Players per squad' },
    { icon: ShieldCheck, title: 'Max 2 / Franchise', desc: 'Max 2 players per IPL team' },
    { icon: Globe, title: 'Max 4 Overseas', desc: 'Max 4 overseas players per squad' },
    { icon: Repeat, title: 'Global Unique Picks', desc: 'Players cannot be duplicated' },
    { icon: LayoutList, title: 'Squad Rearrange', desc: 'Lineup order configurable post-draft' },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-extrabold text-white text-base uppercase tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" /> DRAFT RULES PREVIEW
        </h3>

        <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
          2026 DRAFT POOL: {eligiblePoolCount} ELIGIBLE PLAYERS
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
        {rulesList.map((r, idx) => {
          const Icon = r.icon;
          return (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5 text-left"
            >
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold text-white leading-tight truncate">{r.title}</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">{r.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
