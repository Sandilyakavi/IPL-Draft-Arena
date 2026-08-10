import React from 'react';
import TeamLogo from '../common/TeamLogo';
import PlayerAvatar from '../common/PlayerAvatar';
import { History, Globe, UserCheck } from 'lucide-react';

/**
 * DraftHistory Component — Displays all completed picks in chronological order.
 */
export default function DraftHistory({ pickHistory = [] }) {
  const reversedHistory = [...pickHistory].reverse();

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" /> Draft Pick Log
        </h3>
        <span className="text-xs text-slate-400 font-mono font-bold">{pickHistory.length} / 24 Picks</span>
      </div>

      {pickHistory.length === 0 ? (
        <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-xl text-center text-slate-500 text-xs italic">
          No picks recorded yet. Spin the team wheel and draft your first player!
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {reversedHistory.map((pick, idx) => {
            const isLatest = idx === 0;
            const isP1 = pick.user === 'player1';

            return (
              <div
                key={pick.pickNumber}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  isLatest
                    ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-cyan-400/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-400/30'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 truncate">
                  <span className="font-mono font-black text-slate-500 text-xs w-7 shrink-0">
                    #{String(pick.pickNumber).padStart(2, '0')}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                    isP1 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {pick.userName || pick.user}
                  </span>

                  <TeamLogo teamId={pick.teamId} size="sm" />

                  <span className="font-extrabold text-white text-xs truncate">{pick.player}</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
                  <span className="capitalize font-semibold text-slate-400">{pick.role?.replace('wicketkeeper-', 'WK-')}</span>
                  {pick.isOverseas ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Globe className="w-3 h-3" /> OS
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> IND
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
