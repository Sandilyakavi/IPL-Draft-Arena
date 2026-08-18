import React from 'react';
import { getBestPlayingXI } from '../../game/squadAnalyzer.js';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import { Users, ShieldCheck, Globe, UserCheck, Star } from 'lucide-react';

/**
 * PlayingXI Component — Displays recommended 11 starting XI players and 1 bench player.
 */
export default function PlayingXI({ squad = [], userName = 'Player', season = '2026' }) {
  const { playingXI = [], bench = [], explanation = [] } = getBestPlayingXI(squad, season);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" /> Recommended Playing XI ({userName})
        </h3>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          11 Starting XI
        </span>
      </div>

      {/* Structural Explanation Badges */}
      {explanation.length > 0 && (
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1 text-[11px] text-slate-300">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Composition Strategy</span>
          {explanation.map((e, idx) => (
            <p key={idx} className="text-slate-400">
              • {e}
            </p>
          ))}
        </div>
      )}

      {/* 11 Starting XI Grid */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {playingXI.map((p, idx) => (
          <div
            key={p.id}
            className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <span className="font-mono text-cyan-400 font-extrabold text-[10px] w-5">#{idx + 1}</span>
              <PlayerAvatar player={p} size="sm" />
              <div className="truncate">
                <span className="font-extrabold text-white block truncate">{p.name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <TeamLogo teamId={p.teamId} size="sm" />
              {p.isWicketkeeper && (
                <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                  🧤 WK
                </span>
              )}
              {p.isOverseas ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  🌐 OS
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  🇮🇳 IND
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 1 Bench Reserve Player */}
      {bench.length > 0 && (
        <div className="pt-2 border-t border-slate-800">
          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Squad Bench Reserve</span>
          {bench.map(p => (
            <div key={p.id} className="p-2 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 flex items-center justify-between text-xs opacity-75">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600">BENCH</span>
                <PlayerAvatar player={p} size="sm" />
                <span className="font-bold text-slate-300">{p.name}</span>
              </div>
              <TeamLogo teamId={p.teamId} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
