import React, { useState } from 'react';
import teams from '../../data/teams.json';
import { evaluateSquad } from '../../game/squadAnalyzer.js';
import SquadScoreCard from './SquadScoreCard';
import SquadAnalysis from './SquadAnalysis';
import PlayingXI from './PlayingXI';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamLogo from '../common/TeamLogo';
import { Trophy, RefreshCcw, Globe, UserCheck, Shield, Users, Award, Star, Zap } from 'lucide-react';

function SquadSummaryCard({ user, title, userKey, evaluation }) {
  const squad = user?.squad || [];
  const overseasCount = squad.filter(p => p.isOverseas).length;

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
          <span className="text-xl">{user?.avatar || '🏏'}</span>
          <div>
            <h3 className="text-base font-black text-white">{user?.name || title}</h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Squad Rating: <strong className="text-amber-400">{evaluation?.overallSquadScore || evaluation?.finalScore} / 100</strong>
            </span>
          </div>
        </div>
        <span className="px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-mono text-[11px] font-bold">
          {displayedSquad.length} Players
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
 * DraftComplete Screen — Displays full squad results for 2–4 players.
 * Shows ranked "Squad Rating" (not implying direct cricket match outcome),
 * category breakdowns, Best Playing XI recommendations, and strengths/weaknesses.
 */
export default function DraftComplete({ player1, player2, players, onPlayAgain, season = '2026' }) {
  const [activeTab, setActiveTab] = useState('scores'); // 'scores' | 'xi' | 'roster' | 'analysis'

  const allPlayers = Array.isArray(players) && players.length >= 2
    ? players
    : [player1, player2].filter(Boolean);

  // Evaluate every squad with Squad Score 2.0
  const evaluatedPlayers = allPlayers.map((p, idx) => {
    const squad = p.squad || [];
    const evaluation = evaluateSquad(squad, season);
    return {
      player: p,
      index: idx,
      userKey: p.id || `player${idx + 1}`,
      name: p.name || `Player ${idx + 1}`,
      avatar: p.avatar || '🏏',
      evaluation,
      ratingScore: evaluation.overallSquadScore || evaluation.finalScore,
    };
  });

  // Sort descending by Squad Rating
  const ranked = [...evaluatedPlayers].sort((a, b) => b.ratingScore - a.ratingScore);
  const topSquad = ranked[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-scaleUp">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-300 shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 font-mono text-xs font-black uppercase tracking-widest">
            IPL Draft Arena — Final Evaluation
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
            🏆 FINAL SQUAD RATINGS
          </h1>
          <p className="text-xs sm:text-sm text-amber-200/90 font-bold max-w-xl mx-auto mt-2 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
            Top Evaluated Squad: <strong className="text-white">{topSquad.name}</strong> with a Squad Rating of <strong className="text-amber-300">{topSquad.ratingScore} / 100</strong>.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            onClick={() => setActiveTab('scores')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
              activeTab === 'scores'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            📊 Squad Ratings & Breakdown
          </button>
          <button
            onClick={() => setActiveTab('xi')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
              activeTab === 'xi'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            🏏 Best XI Recommendations
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            📋 Full Rosters
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
              activeTab === 'analysis'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            💡 Strengths & Weaknesses
          </button>
        </div>
      </div>

      {/* Ranked Leaderboard Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Squad Rating Standings
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ranked.map((item, rIdx) => {
            const rankBadges = ['🥇 1st', '🥈 2nd', '🥉 3rd', '4th'];
            return (
              <div
                key={item.userKey}
                className={`p-3 rounded-xl border text-center transition-all ${
                  rIdx === 0
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className={rIdx === 0 ? 'text-amber-400' : 'text-slate-500'}>
                    {rankBadges[rIdx] || `#${rIdx + 1}`}
                  </span>
                  <span className="text-slate-400">{item.avatar}</span>
                </div>
                <h5 className="font-extrabold text-white text-xs truncate">{item.name}</h5>
                <div className="mt-1 text-lg font-black font-mono text-cyan-300">
                  {item.ratingScore}
                  <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TAB 1: SCORES (100 Pts Breakdown) */}
      {activeTab === 'scores' && (
        <div className={`grid grid-cols-1 ${ranked.length >= 3 ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-6`}>
          {ranked.map(item => {
            const categories = item.evaluation.categories || {};
            return (
              <div key={item.userKey} className="space-y-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.avatar}</span>
                      <h4 className="font-black text-white text-base">{item.name}</h4>
                    </div>
                    <span className="text-sm font-black font-mono text-amber-400">
                      {item.ratingScore} <span className="text-[10px] text-slate-500">Squad Rating</span>
                    </span>
                  </div>

                  {/* Category Scores Grid */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Batting</span>
                      <span className="font-extrabold text-sky-300">{categories.batting || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Bowling</span>
                      <span className="font-extrabold text-emerald-300">{categories.bowling || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">All-Round</span>
                      <span className="font-extrabold text-cyan-300">{categories.allRound || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">WK</span>
                      <span className="font-extrabold text-purple-300">{categories.wicketkeeping || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Pace</span>
                      <span className="font-extrabold text-teal-300">{categories.pace || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Spin</span>
                      <span className="font-extrabold text-indigo-300">{categories.spin || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Depth</span>
                      <span className="font-extrabold text-yellow-300">{categories.depth || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Balance</span>
                      <span className="font-extrabold text-amber-300">{categories.balance || '-'}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Synergy</span>
                      <span className="font-extrabold text-emerald-300">{categories.synergy || '-'}</span>
                    </div>
                  </div>
                </div>

                <SquadScoreCard
                  evaluation={item.evaluation}
                  playerName={item.name}
                  avatar={item.avatar}
                  accentColor={item.index % 2 === 0 ? 'cyan' : 'amber'}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: BEST PLAYING XI */}
      {activeTab === 'xi' && (
        <div className={`grid grid-cols-1 ${ranked.length >= 3 ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-6`}>
          {ranked.map(item => (
            <PlayingXI
              key={item.userKey}
              squad={item.player.squad}
              playerName={item.name}
              avatar={item.avatar}
              season={season}
            />
          ))}
        </div>
      )}

      {/* TAB 3: ROSTERS */}
      {activeTab === 'roster' && (
        <div className={`grid grid-cols-1 ${ranked.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
          {ranked.map(item => (
            <SquadSummaryCard
              key={item.userKey}
              user={item.player}
              title={item.name}
              userKey={item.userKey}
              evaluation={item.evaluation}
            />
          ))}
        </div>
      )}

      {/* TAB 4: ANALYSIS (Strengths & Weaknesses) */}
      {activeTab === 'analysis' && (
        <div className={`grid grid-cols-1 ${ranked.length >= 3 ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-6`}>
          {ranked.map(item => (
            <SquadAnalysis
              key={item.userKey}
              evaluation={item.evaluation}
              playerName={item.name}
              avatar={item.avatar}
              accentColor={item.index % 2 === 0 ? 'cyan' : 'amber'}
            />
          ))}
        </div>
      )}

      {/* Play Again Action Footer */}
      <div className="text-center pt-4">
        <button
          onClick={onPlayAgain}
          className="px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5 mx-auto cursor-pointer"
        >
          <RefreshCcw className="w-4 h-4 stroke-[2.5]" />
          <span>START NEW DRAFT</span>
        </button>
      </div>
    </div>
  );
}
