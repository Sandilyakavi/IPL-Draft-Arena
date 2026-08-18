import React, { useState, useCallback, useEffect } from 'react';
import {
  createInitialGame,
  startGame,
  spinTeam,
  selectPendingPlayer,
  confirmPick,
  getCurrentPlayer,
  getDraftProgress,
  isDraftComplete,
  updateSquadOrder,
} from '../game/draftEngine.js';

import { getEligibleTeams } from '../game/wheelEngine.js';
import { getTargetRotation } from '../utils/wheelGeometry.js';
import { saveGameSession, loadGameSession } from '../utils/persistence.js';

import GameSetup from '../components/setup/GameSetup';
import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import ProfileModal from '../components/profile/ProfileModal';
import TeamWheel from '../components/wheel/TeamWheel';
import PlayerSelection from '../components/players/PlayerSelection';
import SquadDisplay from '../components/squad/SquadDisplay';
import RuleTracker from '../components/rules/RuleTracker';
import DraftHistory from '../components/history/DraftHistory';
import DraftComplete from '../components/game/DraftComplete';

import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DraftPage({ onToggleDashboard, showDebug = false }) {
  // Initialize game state from local persistence if available, else default setup state
  const [gameState, setGameState] = useState(() => {
    const saved = loadGameSession();
    return saved || createInitialGame();
  });

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinError, setSpinError] = useState(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [targetTeamId, setTargetTeamId] = useState(null);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [lastPickBanner, setLastPickBanner] = useState(null);

  let authProfile = null;
  let refreshProfile = null;
  try {
    const auth = useAuth();
    authProfile = auth?.profile;
    refreshProfile = auth?.refreshProfile;
  } catch (err) {
    // Graceful fallback when rendered in isolated test environment
  }

  // Persist game state to localStorage whenever it updates
  useEffect(() => {
    if (gameState) {
      saveGameSession(gameState);
    }
  }, [gameState]);

  const activeUser = getCurrentPlayer(gameState);
  const progress = getDraftProgress(gameState);
  const draftFinished = isDraftComplete(gameState);
  const eligibleTeams = getEligibleTeams(gameState);

  // ── Handle Start Draft from Setup ─────────────────────────────
  const handleStartDraft = useCallback((configuredState) => {
    setGameState(configuredState);
    saveGameSession(configuredState);
    setIsSpinning(false);
    setSpinError(null);
    setRotationDegrees(0);
    setTargetTeamId(null);
    setLastPickBanner(null);
  }, []);

  // ── Handle Spin Action ─────────────────────────────────────────
  const handleSpin = useCallback(() => {
    if (isSpinning || draftFinished) return;

    // 1. Calculate wheel engine result (Single Source of Truth)
    const res = spinTeam(gameState);

    if (!res.success) {
      setSpinError(res.message || 'Failed to spin team wheel.');
      setGameState(prev => ({
        ...prev,
        status: 'error',
        error: res.error,
      }));
      return;
    }

    const selectedTeamId = res.resultTeamId;

    // 2. Lock UI & trigger visual rotation animation
    setIsSpinning(true);
    setSpinError(null);
    setTargetTeamId(selectedTeamId);

    // Calculate exact target rotation angle to align pointer with selectedTeamId
    setRotationDegrees(prev => getTargetRotation(selectedTeamId, prev, 5));

    // 3. Update game state ONLY AFTER 2500ms CSS animation finishes
    setTimeout(() => {
      setGameState(res.updatedGameState);
      setIsSpinning(false);
    }, 2500);
  }, [gameState, isSpinning, draftFinished]);

  // ── Handle Select Pending Player ────────────────────────────────
  const handleSelectPending = useCallback((playerId) => {
    if (draftFinished || isSpinning) return;

    const res = selectPendingPlayer(gameState, playerId);
    if (res.success) {
      setGameState(res.updatedGameState);
    }
  }, [gameState, draftFinished, isSpinning]);

  // ── Handle Confirm Pick ─────────────────────────────────────────
  const handleConfirmPick = useCallback((playerId) => {
    if (draftFinished || isSpinning || !playerId) return;

    const currentTurnUser = getCurrentPlayer(gameState);
    const selectedPlayerObj = gameState.currentEligiblePlayers.find(p => p.id === playerId);

    const res = confirmPick(gameState, playerId);
    if (res.success) {
      setGameState(res.updatedGameState);

      // Trigger temporary pick notification banner
      if (selectedPlayerObj && currentTurnUser) {
        setLastPickBanner({
          playerName: selectedPlayerObj.name,
          teamId: selectedPlayerObj.teamId.toUpperCase(),
          userName: currentTurnUser.name,
          userAvatar: currentTurnUser.avatar,
        });

        setTimeout(() => {
          setLastPickBanner(null);
        }, 3000);
      }
    }
  }, [gameState, draftFinished, isSpinning]);

  // ── Reset / New Game ───────────────────────────────────────────
  const handleConfirmReset = useCallback(() => {
    const freshState = createInitialGame();
    setGameState(freshState);
    saveGameSession(freshState);
    setIsSpinning(false);
    setSpinError(null);
    setRotationDegrees(0);
    setTargetTeamId(null);
    setShowRestartModal(false);
    setLastPickBanner(null);
  }, []);

  // ── Handle Squad Order Rearranging ─────────────────────────────
  const handleUpdateSquadOrder = useCallback((playerKey, newOrder) => {
    setGameState(prev => updateSquadOrder(prev, playerKey, newOrder));
  }, []);

  // If in setup status, render pre-game setup flow
  if (!gameState || gameState.status === 'setup') {
    return (
      <GameSetup
        onStartDraft={handleStartDraft}
        initialConfig={gameState?.setup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans pb-12">

      {/* SHELL HEADER */}
      <Header
        pickProgress={{ currentPick: progress.pickNumber, totalPicks: progress.totalPicks }}
        currentTurnUser={activeUser}
        player1Name={gameState.player1?.name || 'Player 1'}
        player2Name={gameState.player2?.name || 'Player 2'}
        onOpenRestartModal={() => setShowRestartModal(true)}
        onOpenProfileModal={() => setShowProfileModal(true)}
        onToggleDebug={onToggleDashboard}
        showDebug={showDebug}
      />

      {/* USER PROFILE MODAL */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={authProfile}
        onProfileUpdated={() => {
          if (refreshProfile) refreshProfile();
        }}
      />

      {/* CONFIRMATION RESTART MODAL */}
      <Modal
        isOpen={showRestartModal}
        title="RESTART DRAFT ARENA?"
        message="Your current draft progress will be lost. Are you sure you want to start a new draft?"
        confirmLabel="NEW DRAFT"
        cancelLabel="CANCEL"
        onConfirm={handleConfirmReset}
        onCancel={() => setShowRestartModal(false)}
      />

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 pt-6 space-y-6">

        {/* PICK CONFIRMATION TOAST BANNER */}
        {lastPickBanner && (
          <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/90 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">Player Drafted Successfully</p>
                <h4 className="font-black text-white text-sm flex items-center gap-1.5">
                  <span>{lastPickBanner.userAvatar}</span>
                  <span>{lastPickBanner.playerName}</span>
                  <span className="text-slate-400 font-normal">({lastPickBanner.teamId})</span> — Drafted by {lastPickBanner.userName}
                </h4>
              </div>
            </div>
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full font-mono text-xs font-bold animate-pulse">
              Next Turn →
            </span>
          </div>
        )}

        {/* DRAFT COMPLETE SCREEN OR ACTIVE GAMEPLAY */}
        {draftFinished ? (
          <DraftComplete
            player1={gameState.player1}
            player2={gameState.player2}
            onPlayAgain={handleConfirmReset}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT COLUMN: Franchise Wheel & Active Rules (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <TeamWheel
                currentTeamId={gameState.currentTeamId}
                targetTeamId={targetTeamId}
                rotationDegrees={rotationDegrees}
                eligibleTeams={eligibleTeams}
                onSpin={handleSpin}
                isSpinning={isSpinning}
                disabled={draftFinished || gameState.status === 'player-selection'}
                respinNotice={gameState.respinNotice}
                errorMessage={spinError || (gameState.status === 'error' ? gameState.message : null)}
              />
              <RuleTracker rules={gameState.rules} currentTurnUser={activeUser} />
            </div>

            {/* CENTER COLUMN: Player Selection Roster & Draft Log (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <PlayerSelection
                currentTeamId={gameState.currentTeamId}
                eligiblePlayers={gameState.currentEligiblePlayers}
                pendingSelectedPlayerId={gameState.pendingSelectedPlayerId}
                onSelectPending={handleSelectPending}
                onConfirmPick={handleConfirmPick}
                isSpinning={isSpinning}
                disabled={draftFinished || gameState.status !== 'player-selection'}
                currentTurnUser={activeUser}
              />
              <DraftHistory pickHistory={gameState.pickHistory} />
            </div>

            {/* RIGHT COLUMN: Squad Panels Tracker (4 cols) */}
            <div className="lg:col-span-4">
              <SquadDisplay
                player1={gameState.player1}
                player2={gameState.player2}
                currentTurn={gameState.currentTurn}
                onUpdateSquadOrder={handleUpdateSquadOrder}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
