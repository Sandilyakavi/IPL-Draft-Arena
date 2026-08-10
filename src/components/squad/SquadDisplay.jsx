import React from 'react';
import teams from '../../data/teams.json';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import { Users, Globe, UserCheck, Shield } from 'lucide-react';

const ROLE_COLORS = {
  batter: 'text-sky-300',
  'wicketkeeper-batter': 'text-purple-300',
  'all-rounder': 'text-cyan-300',
  bowler: 'text-emerald-300',
};

/**
 * Single Squad Card Component displaying 12 player slots, overseas count, and franchise breakdown.
 */
function SquadCard({ user, isCurrentTurn, userKey }) {
  const squad = user?.squad || [];
  const squadSize = 12;
  const overseasCount = squad.filter(p => p.isOverseas).length;

  // Franchise counts
  const franchiseMap = {};
  teams.forEach(t => { franchiseMap[t.id] = 0; });
  squad.forEach(p => {
    if (franchiseMap[p.teamId] !== undefined) franchiseMap[p.teamId]++;
  });

  return (
    <div
      className={`bg-slate-900/80 border rounded-2xl p-4 shadow-xl transition-all duration-300 ${
        isCurrentTurn
          ? 'border-cyan-500/50 ring-2 ring-cyan-500/20 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-900'
          : 'border-slate-800 opacity-90'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${userKey === 'player1' ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-amber-400 shadow-sm shadow-amber-400'}`} />
          <h4 className="font-extrabold text-white text-sm sm:text-base">{user?.name || 'Player'}</h4>
        </div>

        {isCurrentTurn ? (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse">
            Active Turn
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-950 border border-slate-800">
            Waiting
          </span>
        )}
      </div>

      {/* Progress & Stat Indicators */}
      <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs">
        <div>
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Squad Size</span>
          <span className="font-black text-white text-sm">
            {squad.length} <span className="text-slate-500 font-normal text-xs">/ {squadSize}</span>
          </span>
        </div>
        <div>
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Overseas</span>
          <span className={`font-black text-sm ${overseasCount >= 4 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {overseasCount} <span className="text-slate-500 font-normal text-xs">/ 4 max</span>
          </span>
        </div>
      </div>

      {/* Franchise Distribution Tags */}
      <div className="mb-3">
        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Franchise Quota (Max 2/team)</span>
        <div className="flex flex-wrap gap-1">
          {teams.map(t => {
            const count = franchiseMap[t.id] || 0;
            if (count === 0) return null;
            return (
              <span
                key={t.id}
                className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase border ${
                  count >= 2
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {t.shortName} {count}/2
              </span>
            );
          })}
          {squad.length === 0 && <span className="text-[11px] text-slate-600 italic">No players drafted yet</span>}
        </div>
      </div>

      {/* Drafted Players Slots */}
      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
        {Array.from({ length: squadSize }).map((_, slotIdx) => {
          const player = squad[slotIdx];
          if (player) {
            return (
              <div
                key={player.id}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs transition-all hover:border-slate-700 animate-scaleUp"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-[10px] text-slate-500 w-4 font-bold">#{slotIdx + 1}</span>
                  <PlayerAvatar player={player} size="sm" />
                  <span className="font-extrabold text-white truncate max-w-[100px] sm:max-w-[130px]">{player.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                  <TeamLogo teamId={player.teamId} size="sm" />
                  <span className={`capitalize font-bold ${ROLE_COLORS[player.role] || 'text-slate-400'}`}>
                    {player.role.replace('wicketkeeper-', 'WK-')}
                  </span>
                  {player.isOverseas && <Globe className="w-3 h-3 text-emerald-400" />}
                </div>
              </div>
            );
          }

          return (
            <div
              key={`empty-${slotIdx}`}
              className="p-2 rounded-xl border border-dashed border-slate-800/60 text-[11px] text-slate-600 flex items-center gap-2"
            >
              <span className="font-mono text-[10px] text-slate-700 w-4">#{slotIdx + 1}</span>
              <span className="text-slate-600 italic">Empty Squad Slot</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * SquadDisplay Panel containing both Player 1 and Player 2 squads.
 */
export default function SquadDisplay({ player1, player2, currentTurn }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
        <Users className="w-4 h-4 text-cyan-400" /> User Squad Tracker
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        <SquadCard user={player1} isCurrentTurn={currentTurn === 'player1'} userKey="player1" />
        <SquadCard user={player2} isCurrentTurn={currentTurn === 'player2'} userKey="player2" />
      </div>
    </div>
  );
}
