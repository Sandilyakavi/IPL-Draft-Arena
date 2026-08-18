import React, { useState, useEffect } from 'react';
import teams from '../../data/teams.json';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import {
  Users,
  Globe,
  ArrowUpDown,
  Wand2,
  RotateCcw,
  X,
  Check,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Star,
} from 'lucide-react';
import { autoArrangeSquad } from '../../utils/shuffle.js';
import { getPlayerRating } from '../../game/playerRatingEngine.js';

const ROLE_COLORS = {
  batter: 'text-sky-300',
  'wicketkeeper-batter': 'text-purple-300',
  'all-rounder': 'text-cyan-300',
  bowler: 'text-emerald-300',
};

/**
 * Single Squad Card Component displaying squad slots, overseas count, franchise breakdown,
 * and Rearrange Mode (Drag & Drop, Auto Arrange, Reset Order).
 */
function SquadCard({ user, isCurrentTurn, userKey, onUpdateSquadOrder }) {
  const squad = user?.squad || [];
  const squadSize = 12;
  const overseasCount = squad.filter(p => p.isOverseas).length;

  const [isRearranging, setIsRearranging] = useState(false);
  const [draftOrder, setDraftOrder] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Franchise counts (always computed from real canonical squad)
  const franchiseMap = {};
  teams.forEach(t => { franchiseMap[t.id] = 0; });
  squad.forEach(p => {
    if (franchiseMap[p.teamId] !== undefined) franchiseMap[p.teamId]++;
  });

  // Canonical player map for lookups
  const playerMap = new Map(squad.map(p => [p.id, p]));

  // Active presentation order
  const activeOrder = user?.squadOrder && user.squadOrder.length === squad.length
    ? user.squadOrder
    : squad.map(p => p.id);

  // Sync draftOrder when entering rearrange mode or when squad updates while rearranging
  useEffect(() => {
    if (!isRearranging) {
      setDraftOrder(activeOrder);
    } else {
      // Keep existing draftOrder but append any new player not in draftOrder
      const currentIds = new Set(draftOrder);
      const newIds = squad.map(p => p.id).filter(id => !currentIds.has(id));
      if (newIds.length > 0) {
        setDraftOrder(prev => [...prev, ...newIds]);
      }
    }
  }, [squad, user?.squadOrder, isRearranging]);

  // Derived current displayed players
  const currentOrderIDs = isRearranging ? draftOrder : activeOrder;
  const orderedPlayers = currentOrderIDs.map(id => playerMap.get(id)).filter(Boolean);

  // Handlers
  const handleStartRearrange = () => {
    setDraftOrder([...activeOrder]);
    setIsRearranging(true);
  };

  const handleCancelRearrange = () => {
    setIsRearranging(false);
    setDraftOrder([...activeOrder]);
  };

  const handleSaveRearrange = () => {
    if (onUpdateSquadOrder) {
      onUpdateSquadOrder(userKey, draftOrder);
    }
    setIsRearranging(false);
  };

  const handleResetOrder = () => {
    setDraftOrder(squad.map(p => p.id));
  };

  const handleAutoArrange = () => {
    const currentObjects = draftOrder.map(id => playerMap.get(id)).filter(Boolean);
    const arrangedObjects = autoArrangeSquad(currentObjects);
    setDraftOrder(arrangedObjects.map(p => p.id));
  };

  const handleMove = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draftOrder.length) return;
    const newOrder = [...draftOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    setDraftOrder(newOrder);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newOrder = [...draftOrder];
    const [moved] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    setDraftOrder(newOrder);
    setDraggedIndex(null);
  };

  return (
    <div
      className={`bg-slate-900/80 border rounded-2xl p-4 shadow-xl transition-all duration-300 ${
        isCurrentTurn
          ? 'border-cyan-500/50 ring-2 ring-cyan-500/20 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-900'
          : 'border-slate-800 opacity-90'
      }`}
    >
      {/* Header & Mode Controls */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              userKey === 'player1'
                ? 'bg-cyan-400 shadow-sm shadow-cyan-400'
                : 'bg-amber-400 shadow-sm shadow-amber-400'
            }`}
          />
          <span className="text-base">{user?.avatar || (userKey === 'player1' ? '🏏' : '⚡')}</span>
          <h4 className="font-extrabold text-white text-sm sm:text-base">{user?.name || 'Player'}</h4>
        </div>

        <div className="flex items-center gap-2">
          {squad.length > 1 && !isRearranging && (
            <button
              type="button"
              onClick={handleStartRearrange}
              className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-all shadow-sm"
              title="Rearrange squad presentation order"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
              REARRANGE
            </button>
          )}

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
      </div>

      {/* Rearrange Action Toolbar */}
      {isRearranging && (
        <div className="mb-3 p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-2 text-xs animate-scaleUp">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleAutoArrange}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all"
              title="Intelligently auto-arrange into balanced lineup"
            >
              <Wand2 className="w-3.5 h-3.5" /> AUTO ARRANGE
            </button>
            <button
              type="button"
              onClick={handleResetOrder}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition-all"
              title="Reset order to original draft pick sequence"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" /> RESET ORDER
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCancelRearrange}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 transition-all"
            >
              <X className="w-3.5 h-3.5" /> CANCEL
            </button>
            <button
              type="button"
              onClick={handleSaveRearrange}
              className="px-3 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20"
            >
              <Check className="w-3.5 h-3.5" /> DONE
            </button>
          </div>
        </div>
      )}

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
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {Array.from({ length: squadSize }).map((_, slotIdx) => {
          const player = orderedPlayers[slotIdx];
          if (player) {
            const ratingObj = getPlayerRating(player.id, '2026');
            const ratingDisplay = ratingObj?.rating !== null && ratingObj?.rating !== undefined
              ? `⭐ ${ratingObj.rating}`
              : 'UNRATED';

            return (
              <div
                key={player.id}
                draggable={isRearranging}
                onDragStart={e => isRearranging && handleDragStart(e, slotIdx)}
                onDragOver={e => isRearranging && handleDragOver(e, slotIdx)}
                onDrop={e => isRearranging && handleDrop(e, slotIdx)}
                className={`p-2 rounded-xl bg-slate-950/80 border flex items-center justify-between text-xs transition-all ${
                  isRearranging
                    ? 'border-cyan-500/40 cursor-grab active:cursor-grabbing hover:bg-slate-900/90'
                    : 'border-slate-800/80 hover:border-slate-700'
                } ${draggedIndex === slotIdx ? 'opacity-40 ring-2 ring-cyan-400' : ''}`}
              >
                <div className="flex items-center gap-2 truncate">
                  {isRearranging && (
                    <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0 cursor-grab" />
                  )}
                  <span className="font-mono text-[10px] text-cyan-400/90 w-4 font-bold">#{slotIdx + 1}</span>
                  <PlayerAvatar player={player} size="sm" />
                  <span className="font-extrabold text-white truncate max-w-[90px] sm:max-w-[120px]">{player.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                  <TeamLogo teamId={player.teamId} size="sm" />
                  <span className={`capitalize font-bold ${ROLE_COLORS[player.role] || 'text-slate-400'}`}>
                    {player.role.replace('wicketkeeper-', 'WK-')}
                  </span>
                  {player.isOverseas && <Globe className="w-3 h-3 text-emerald-400" />}

                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                    ratingDisplay === 'UNRATED'
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}>
                    {ratingDisplay}
                  </span>

                  {/* Move up / down controls in Rearrange mode */}
                  {isRearranging && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        type="button"
                        disabled={slotIdx === 0}
                        onClick={() => handleMove(slotIdx, -1)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={slotIdx === orderedPlayers.length - 1}
                        onClick={() => handleMove(slotIdx, 1)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
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
export default function SquadDisplay({ player1, player2, currentTurn, onUpdateSquadOrder }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
        <Users className="w-4 h-4 text-cyan-400" /> User Squad Tracker
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        <SquadCard
          user={player1}
          isCurrentTurn={currentTurn === 'player1'}
          userKey="player1"
          onUpdateSquadOrder={onUpdateSquadOrder}
        />
        <SquadCard
          user={player2}
          isCurrentTurn={currentTurn === 'player2'}
          userKey="player2"
          onUpdateSquadOrder={onUpdateSquadOrder}
        />
      </div>
    </div>
  );
}
