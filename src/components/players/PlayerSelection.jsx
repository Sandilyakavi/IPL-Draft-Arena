import React from 'react';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import {
  getPlayerRating,
  getBattingRating,
  getBowlingRating,
  getFieldingRating,
  getOverallRating,
  getDetailedDisciplineBreakdown,
} from '../../game/playerRatingEngine.js';
import { calculatePickValue } from '../../game/pickValueEngine.js';
import { UserCheck, Globe, Check, ChevronRight, Star, Zap, Shield, Target } from 'lucide-react';

const ROLE_BADGES = {
  batter: { label: 'Batter', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  'wicketkeeper-batter': { label: 'WK-Batter', cls: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  'all-rounder': { label: 'All-Rounder', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
  bowler: { label: 'Bowler', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
};

/**
 * Player Selection Component — Trading card style grid displaying eligible players,
 * discipline metrics (BAT, BOWL, FIELD, IMPACT), and dynamic Pick Value for the drafting squad.
 */
export default function PlayerSelection({
  currentTeamId,
  eligiblePlayers = [],
  pendingSelectedPlayerId,
  onSelectPending,
  onConfirmPick,
  isSpinning = false,
  disabled = false,
  currentTurnUser = null,
  currentSquad = null,
  rules = {},
  season = '2026',
}) {
  if (!currentTeamId) {
    return (
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[360px] shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl mb-3 shadow-inner">
          🎡
        </div>
        <h3 className="text-lg font-extrabold text-slate-200">Spin the Franchise Wheel</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          Click <span className="text-cyan-400 font-bold">SPIN TEAM WHEEL</span> to randomly select an IPL franchise and unlock its available squad roster.
        </p>
      </div>
    );
  }

  const selectedPlayer = eligiblePlayers.find(p => p.id === pendingSelectedPlayerId);
  const activeSquad = currentSquad || currentTurnUser?.squad || [];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <TeamLogo teamId={currentTeamId} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Franchise Pool
              </span>
              <span className="text-xs font-bold text-white uppercase">{currentTeamId}</span>
            </div>
            <h3 className="text-base font-black text-white mt-0.5">
              Available Players
              <span className="text-xs font-semibold text-slate-400 ml-2">({eligiblePlayers.length})</span>
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Turn</span>
          <span className="text-xs font-black text-cyan-300">{currentTurnUser?.name || 'Active Player'}</span>
        </div>
      </div>

      {/* Trading Card Player Grid */}
      {eligiblePlayers.length === 0 ? (
        <div className="p-6 bg-slate-950/60 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
          No eligible players remaining from this franchise under current draft constraints.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {eligiblePlayers.map(player => {
            const isSelected = player.id === pendingSelectedPlayerId;
            const roleBadge = ROLE_BADGES[player.role] || { label: player.role, cls: 'bg-slate-800 text-slate-300' };

            // Rating Engine 2.0 metrics
            const overallRating = getOverallRating(player, season);
            const batRating = getBattingRating(player, season);
            const bowlRating = getBowlingRating(player, season);
            const fieldRating = getFieldingRating(player, season);
            const detailed = getDetailedDisciplineBreakdown(player, season);
            const impactRating = detailed?.batting?.matchImpact || detailed?.bowling?.matchImpact || overallRating;

            // Pick Value for drafting squad
            const pickVal = calculatePickValue(player, activeSquad, rules, season);
            const isPickValueBoosted = pickVal > overallRating;

            return (
              <div
                key={player.id}
                onClick={() => onSelectPending(player.id)}
                className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-950/90 via-slate-900 to-slate-900 border-cyan-400 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-950/60 -translate-y-0.5'
                    : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/80 hover:-translate-y-0.5 hover:shadow-lg'
                }`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    <PlayerAvatar player={player} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-extrabold text-white text-sm truncate leading-snug">{player.name}</h4>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadge.cls}`}>
                          {roleBadge.label}
                        </span>

                        {/* Overall Rating Badge */}
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-300" /> {overallRating}
                        </span>

                        {player.isOverseas ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> 🌐 {player.nationality}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5" /> 🇮🇳 IND
                          </span>
                        )}

                        {player.isWicketkeeper && (
                          <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded text-[10px] font-bold">
                            🧤 WK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Discipline Breakdown Metrics: BAT, BOWL, FIELD, IMPACT */}
                  <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-center font-mono">
                    <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[8px] uppercase">BAT</span>
                      <span className="font-bold text-sky-300">{batRating || '-'}</span>
                    </div>
                    <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[8px] uppercase">BOWL</span>
                      <span className="font-bold text-emerald-300">{bowlRating || '-'}</span>
                    </div>
                    <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[8px] uppercase">FIELD</span>
                      <span className="font-bold text-purple-300">{fieldRating || '-'}</span>
                    </div>
                    <div className="p-1 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-500 block text-[8px] uppercase">IMPACT</span>
                      <span className="font-bold text-amber-300">{impactRating || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer with Pick Value */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  {/* Dynamic Pick Value Badge */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Pick Value:</span>
                    <span className={`px-2 py-0.5 rounded font-black font-mono text-[11px] ${
                      isPickValueBoosted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                    }`}>
                      {pickVal}
                    </span>
                    {isPickValueBoosted && (
                      <span className="text-[9px] font-bold text-emerald-400">+Need</span>
                    )}
                  </div>

                  <span className={isSelected ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
                    {isSelected ? 'Selected' : 'Click to select'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM PICK ACTION BUTTON */}
      <div className="pt-1">
        <button
          onClick={() => onConfirmPick(pendingSelectedPlayerId)}
          disabled={!pendingSelectedPlayerId || disabled || isSpinning}
          className={`w-full py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
            !pendingSelectedPlayerId || disabled || isSpinning
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 border border-emerald-400/50 hover:shadow-emerald-500/25 active:scale-[0.98] cursor-pointer'
          }`}
        >
          {selectedPlayer ? (
            <>
              <span>CONFIRM PICK: {selectedPlayer.name} ({selectedPlayer.teamId.toUpperCase()})</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </>
          ) : (
            <span>SELECT A PLAYER TO CONFIRM PICK</span>
          )}
        </button>
      </div>
    </div>
  );
}
