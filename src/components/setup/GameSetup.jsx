import React, { useState, useMemo } from 'react';
import PlayerIdentityCard from './PlayerIdentityCard';
import FirstTurnSelector from './FirstTurnSelector';
import RulesPreview from './RulesPreview';
import { createInitialGame, startGame, DEFAULT_AVATARS } from '../../game/draftEngine.js';
import { Trophy, Sparkles, ArrowRight, ArrowLeft, Play, ShieldAlert, Dice5, CheckCircle2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import MultiplayerRoomModal from '../multiplayer/MultiplayerRoomModal';
import { Users, Globe } from 'lucide-react';

/**
 * GameSetup Component — Landing Hero Screen & Setup Flow for IPL Draft Arena.
 */
export default function GameSetup({ onStartDraft, initialConfig = null }) {
  const [viewMode, setViewMode] = useState('landing'); // 'landing' | 'setup'
  const [gameMode, setGameMode] = useState('local'); // 'local' | 'multiplayer'
  const [isMultiplayerModalOpen, setIsMultiplayerModalOpen] = useState(false);

  let authUser = null;
  try {
    const auth = useAuth();
    authUser = auth?.user;
  } catch (err) {}

  // Player identity setup state
  const [p1Config, setP1Config] = useState(() => ({
    name: initialConfig?.player1?.name || 'Player 1',
    avatar: initialConfig?.player1?.avatar || '🏏',
    favoriteTeamId: initialConfig?.player1?.favoriteTeamId || null,
  }));

  const [p2Config, setP2Config] = useState(() => ({
    name: initialConfig?.player2?.name || 'Player 2',
    avatar: initialConfig?.player2?.avatar || '⚡',
    favoriteTeamId: initialConfig?.player2?.favoriteTeamId || null,
  }));

  const [firstTurnChoice, setFirstTurnChoice] = useState(() => initialConfig?.firstTurn || 'random');
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedPlayer, setRevealedPlayer] = useState(null);

  // Validation logic
  const p1Trimmed = (p1Config.name || '').trim();
  const p2Trimmed = (p2Config.name || '').trim();

  const p1Error = useMemo(() => {
    if (!p1Trimmed) return 'Player 1 name is required.';
    if (p1Trimmed.length > 20) return 'Name cannot exceed 20 characters.';
    if (p1Trimmed.toLowerCase() === p2Trimmed.toLowerCase()) return 'Player 1 and Player 2 cannot have the exact same name.';
    return null;
  }, [p1Trimmed, p2Trimmed]);

  const p2Error = useMemo(() => {
    if (!p2Trimmed) return 'Player 2 name is required.';
    if (p2Trimmed.length > 20) return 'Name cannot exceed 20 characters.';
    if (p1Trimmed.toLowerCase() === p2Trimmed.toLowerCase()) return 'Player 1 and Player 2 cannot have the exact same name.';
    return null;
  }, [p1Trimmed, p2Trimmed]);

  const isValidSetup = !p1Error && !p2Error && p1Trimmed.length > 0 && p2Trimmed.length > 0;

  // Handle Confirm & Start Draft (Local Single-Player Mode)
  const handleConfirmAndStart = () => {
    if (!isValidSetup || isRevealing) return;

    // Create configured game state
    const setupState = createInitialGame({}, {
      player1: { name: p1Trimmed, avatar: p1Config.avatar, favoriteTeamId: p1Config.favoriteTeamId },
      player2: { name: p2Trimmed, avatar: p2Config.avatar, favoriteTeamId: p2Config.favoriteTeamId },
      firstTurn: firstTurnChoice,
    });

    const activeState = startGame(setupState);
    const chosenPlayerKey = activeState.currentTurn;
    const chosenPlayerName = activeState[chosenPlayerKey]?.name || 'Player';
    const chosenPlayerAvatar = activeState[chosenPlayerKey]?.avatar || '🏏';

    // Trigger first pick reveal animation
    setIsRevealing(true);
    setRevealedPlayer({
      key: chosenPlayerKey,
      name: chosenPlayerName,
      avatar: chosenPlayerAvatar,
    });

    setTimeout(() => {
      setIsRevealing(false);
      onStartDraft(activeState, false);
    }, 1600);
  };

  const handleMultiplayerRoomReady = (roomContract) => {
    setIsMultiplayerModalOpen(false);
    onStartDraft(roomContract, true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-4xl w-full mx-auto space-y-6">

        {/* ── LANDING VIEW ────────────────────────────────────────── */}
        {viewMode === 'landing' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 text-center backdrop-blur-xl animate-fadeIn">
            {/* Title Badge */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <Trophy className="w-4 h-4 text-cyan-400" /> IPL Draft Arena — 2026 Season
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
                BUILD YOUR ULTIMATE SQUAD
              </h1>
              <p className="text-sm sm:text-base text-slate-400 font-medium max-w-xl mx-auto">
                Turn-based local 2-player arena draft. Spin the franchise wheel, draft stars, and construct the winning Playing XI.
              </p>
            </div>

            {/* Players VS Card Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex items-center gap-4 text-left shadow-lg">
                <span className="text-4xl p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">{p1Config.avatar}</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Player 1</span>
                  <h3 className="font-extrabold text-white text-base truncate">{p1Config.name}</h3>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/30 flex items-center gap-4 text-left shadow-lg">
                <span className="text-4xl p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">{p2Config.avatar}</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Player 2</span>
                  <h3 className="font-extrabold text-white text-base truncate">{p2Config.name}</h3>
                </div>
              </div>
            </div>

            {/* Feature Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2 text-xs font-bold text-slate-400">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">24 TOTAL PICKS</div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">12 PLAYERS EACH</div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">10 FRANCHISES</div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">252 DRAFT POOL</div>
            </div>

            {/* Primary Action Buttons: Local Pass & Play vs Online Multiplayer */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setViewMode('setup')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-base rounded-2xl transition-all shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Users className="w-5 h-5" />
                <span>PASS & PLAY (LOCAL)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMultiplayerModalOpen(true)}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base rounded-2xl transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Globe className="w-5 h-5" />
                <span>ONLINE 2-PLAYER</span>
              </button>
            </div>
          </div>
        )}

        {/* Multiplayer Room Modal */}
        <MultiplayerRoomModal
          isOpen={isMultiplayerModalOpen}
          onClose={() => setIsMultiplayerModalOpen(false)}
          onRoomReady={handleMultiplayerRoomReady}
        />

        {/* ── SETUP FORM VIEW ─────────────────────────────────────── */}
        {viewMode === 'setup' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-2.5">
                  <Sparkles className="w-6 h-6 text-cyan-400" /> SET UP YOUR DRAFT
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">Configure player identities and first pick options</p>
              </div>

              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-extrabold rounded-xl border border-slate-800 flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Landing
              </button>
            </div>

            {/* Player Identity Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PlayerIdentityCard
                playerNumber={1}
                config={p1Config}
                onChange={setP1Config}
                errorMessage={p1Error}
                otherPlayerName={p2Trimmed}
              />
              <PlayerIdentityCard
                playerNumber={2}
                config={p2Config}
                onChange={setP2Config}
                errorMessage={p2Error}
                otherPlayerName={p1Trimmed}
              />
            </div>

            {/* First Turn Section */}
            <FirstTurnSelector
              firstTurn={firstTurnChoice}
              onSelectFirstTurn={setFirstTurnChoice}
              p1Name={p1Trimmed || 'Player 1'}
              p2Name={p2Trimmed || 'Player 2'}
              p1Avatar={p1Config.avatar}
              p2Avatar={p2Config.avatar}
            />

            {/* Rules Preview */}
            <RulesPreview />

            {/* Bottom Actions */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-400 text-xs font-extrabold rounded-xl border border-slate-800 flex items-center gap-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> BACK
              </button>

              <button
                type="button"
                disabled={!isValidSetup || isRevealing}
                onClick={handleConfirmAndStart}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-sm rounded-xl transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" /> CONFIRM & START DRAFT
              </button>
            </div>
          </div>
        )}

        {/* ── FIRST TURN REVEAL ANIMATION OVERLAY ─────────────────── */}
        {isRevealing && revealedPlayer && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border-2 border-cyan-400 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl animate-scaleUp">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-4xl mx-auto animate-bounce">
                {revealedPlayer.avatar}
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 inline-block tracking-widest">
                FIRST PICK REVEAL
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase">
                {revealedPlayer.name}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                GETS PICK #1 IN THE DRAFT
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
