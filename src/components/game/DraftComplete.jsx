import React from 'react';
import teams from '../../data/teams.json';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import { Trophy, RefreshCcw, Globe, UserCheck, Award, Shield } from 'lucide-react';

function SquadSummaryCard({ user, title, userKey }) {
  const squad = user?.squad || [];
  const overseasCount = squad.filter(p => p.isOverseas).length;
  const indianCount = squad.length - overseasCount;

  // Franchise counts
  const franchiseMap = {};
  teams.forEach(t => { franchiseMap[t.id] = 0; });
  squad.forEach(p => {
    if (franchiseMap[p.teamId] !== undefined) franchiseMap[p.teamId]++;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${userKey === 'player1' ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-amber-400 shadow-sm shadow-amber-400'}`} />
          <h3 className="text-lg font-black text-white">{user?.name || title}</h3>
        </div>
        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-mono text-xs font-bold">
          12 / 12 PLAYERS
        </span>
      </div>

      {/* Stats Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Indian Players</span>
            <span className="font-extrabold text-white">{indianCount} Players</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Overseas Players</span>
            <span className="font-extrabold text-white">{overseasCount} Players</span>
          </div>
        </div>
      </div>

      {/* Franchise Distribution */}
      <div>
        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">Franchise Breakdown</span>
        <div className="flex flex-wrap gap-1.5">
          {teams.map(t => {
            const count = franchiseMap[t.id] || 0;
            if (count === 0) return null;
            return (
              <div
                key={t.id}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-1 text-[11px]"
              >
                <TeamLogo teamId={t} size="sm" />
                <span className="font-mono font-extrabold text-white">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Squad Roster List */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {squad.map((p, idx) => (
          <div
            key={p.id}
            className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-slate-500 text-[10px] font-bold">#{idx + 1}</span>
              <PlayerAvatar player={p} size="sm" />
              <div>
                <span className="font-extrabold text-white block">{p.name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TeamLogo teamId={p.teamId} size="sm" />
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
    </div>
  );
}

/**
 * DraftComplete Screen — Displays full squad results upon completing 24 picks.
 */
export default function DraftComplete({ player1, player2, onPlayAgain }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-scaleUp">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-300 shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 font-mono text-xs font-black uppercase tracking-widest">
            Official 2026 Season Draft
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
            🏆 DRAFT COMPLETE!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1">
            Both Player 1 and Player 2 have successfully assembled their 12-player IPL rosters adhering strictly to all squad and franchise limits.
          </p>
        </div>

        <button
          onClick={onPlayAgain}
          className="py-3 px-8 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-cyan-500/30 active:scale-95 flex items-center gap-2 mx-auto"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>PLAY AGAIN</span>
        </button>
      </div>

      {/* Squad Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SquadSummaryCard user={player1} title="Player 1 Squad" userKey="player1" />
        <SquadSummaryCard user={player2} title="Player 2 Squad" userKey="player2" />
      </div>
    </div>
  );
}
