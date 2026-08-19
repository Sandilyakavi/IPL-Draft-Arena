import React, { useState } from 'react';
import teams from '../../data/teams.json';
import { evaluateSquad } from '../../game/squadAnalyzer.js';
import SquadScoreCard from './SquadScoreCard';
import SquadAnalysis from './SquadAnalysis';
import PlayingXI from './PlayingXI';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import { Trophy, RefreshCcw, Globe, UserCheck, Shield, Users, Award } from 'lucide-react';

function SquadSummaryCard({ user, title, userKey, evaluation }) {
  const squad = user?.squad || [];
  const overseasCount = squad.filter(p => p.isOverseas).length;
  const indianCount = squad.length - overseasCount;

  // Franchise counts
  const franchiseMap = {};
  teams.forEach(t => { franchiseMap[t.id] = 0; });
  squad.forEach(p => {
    if (franchiseMap[p.teamId] !== undefined) franchiseMap[p.teamId]++;
  });

  // Roster display order respecting custom squadOrder
  const playerMap = new Map(squad.map(p => [p.id, p]));
  const squadIds = squad.map(p => p.id);
  const squadIdSet = new Set(squadIds);
  const orderedIds = (Array.isArray(user?.squadOrder) && user.squadOrder.length > 0)
    ? [...user.squadOrder.filter(id => squadIdSet.has(id)), ...squadIds.filter(id => !new Set(user.squadOrder).has(id))]
    : squadIds;
  const displayedSquad = orderedIds.map(id => playerMap.get(id)).filter(Boolean);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3.5 h-3.5 rounded-full ${userKey === 'player1' ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-amber-400 shadow-sm shadow-amber-400'}`} />
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <span>{user?.avatar || (userKey === 'player1' ? '🏏' : '⚡')}</span>
            <span>{user?.name || title}</span>
          </h3>
        </div>
        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-mono text-xs font-bold">
          12 / 12 PLAYERS
        </span>
      </div>

      {/* Roster List */}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
        {displayedSquad.map((p, idx) => (
          <div
            key={p.id}
            className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <span className="font-mono text-slate-500 text-[10px] font-bold w-4">#{idx + 1}</span>
              <PlayerAvatar player={p} size="sm" />
              <div className="truncate">
                <span className="font-extrabold text-white block truncate">{p.name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
 * DraftComplete Screen — Displays full squad results, 100-pt evaluation breakdown, factual analysis, and Best Playing XI.
 * Game data is local-only. Supabase is used only for authentication, not game state.
 */
export default function DraftComplete({ player1, player2, onPlayAgain, season = '2026' }) {
  const [activeTab, setActiveTab] = useState('scores'); // 'scores' | 'xi' | 'roster'

  const eval1 = evaluateSquad(player1?.squad || [], season);
  const eval2 = evaluateSquad(player2?.squad || [], season);

  let winnerNotice = null;
  if (eval1.finalScore > eval2.finalScore) {
    winnerNotice = `${player1?.name || 'Player 1'} has the higher squad score based on this scoring model.`;
  } else if (eval2.finalScore > eval1.finalScore) {
    winnerNotice = `${player2?.name || 'Player 2'} has the higher squad score based on this scoring model.`;
  } else {
    winnerNotice = `Both squads achieved an identical final score of ${eval1.finalScore} / 100.`;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-scaleUp">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-300 shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 font-mono text-xs font-black uppercase tracking-widest">
            Official 2026 Season Draft Results
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
            🏆 DRAFT RESULTS & FINAL EVALUATION
          </h1>
          <p className="text-xs sm:text-sm text-amber-200/90 font-bold max-w-xl mx-auto mt-2 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
            {winnerNotice}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => setActiveTab('scores')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border ${
              activeTab === 'scores'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            📊 Final Scores (100 Pts)
          </button>
          <button
            onClick={() => setActiveTab('xi')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border ${
              activeTab === 'xi'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            🏏 Playing XI Recommendations
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border ${
              activeTab === 'roster'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            📋 Full 12-Player Roster
          </button>
        </div>

        <button
          onClick={onPlayAgain}
          className="py-3 px-8 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-cyan-500/30 active:scale-95 flex items-center gap-2 mx-auto mt-3"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>PLAY AGAIN</span>
        </button>
      </div>

      {/* TAB CONTENT: 1. FINAL SCORES */}
      {activeTab === 'scores' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SquadScoreCard userKey="player1" userName={player1?.name || 'Player 1'} evaluation={eval1} />
            <SquadScoreCard userKey="player2" userName={player2?.name || 'Player 2'} evaluation={eval2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SquadAnalysis evaluation={eval1} />
            <SquadAnalysis evaluation={eval2} />
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. PLAYING XI */}
      {activeTab === 'xi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayingXI squad={player1?.squad || []} userName={player1?.name || 'Player 1'} season={season} />
          <PlayingXI squad={player2?.squad || []} userName={player2?.name || 'Player 2'} season={season} />
        </div>
      )}

      {/* TAB CONTENT: 3. FULL ROSTER */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SquadSummaryCard user={player1} title="Player 1 Squad" userKey="player1" evaluation={eval1} />
          <SquadSummaryCard user={player2} title="Player 2 Squad" userKey="player2" evaluation={eval2} />
        </div>
      )}
    </div>
  );
}
