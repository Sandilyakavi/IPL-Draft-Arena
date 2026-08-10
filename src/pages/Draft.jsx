import React, { useState, useCallback } from 'react';
import {
  createInitialGame,
  startGame,
  spinTeam,
  selectPendingPlayer,
  confirmPick,
  getCurrentPlayer,
  getDraftProgress,
  isDraftComplete,
} from '../game/draftEngine.js';

import { getEligibleTeams } from '../game/wheelEngine.js';
import { getTargetRotation } from '../utils/wheelGeometry.js';

import Header from '../components/common/Header';
import Modal from '../components/common/Modal';
import TeamWheel from '../components/wheel/TeamWheel';
import PlayerSelection from '../components/players/PlayerSelection';
import SquadDisplay from '../components/squad/SquadDisplay';
import RuleTracker from '../components/rules/RuleTracker';
import DraftHistory from '../components/history/DraftHistory';
import DraftComplete from '../components/game/DraftComplete';

import { CheckCircle2, UserCheck, Sparkles } from 'lucide-react';

export default function DraftPage({ onToggleDashboard, showDebug = false }) {
  const [gameState, setGameState] = useState(() => startGame(createInitialGame()));
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinError, setSpinError] = useState(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [targetTeamId, setTargetTeamId] = useState(null);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [lastPickBanner, setLastPickBanner] = useState(null);

  const activeUser = getCurrentPlayer(gameState);
  const progress = getDraftProgress(gameState);
  const draftFinished = isDraftComplete(gameState);
  const eligibleTeams = getEligibleTeams(gameState);

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
        });

        setTimeout(() => {
          setLastPickBanner(null);
        }, 3000);
      }
    }
  }, [gameState, draftFinished, isSpinning]);

  // ── Reset / New Game ───────────────────────────────────────────
  const handleConfirmReset = useCallback(() => {
    setGameState(startGame(createInitialGame()));
    setIsSpinning(false);
    setSpinError(null);
    setRotationDegrees(0);
    setTargetTeamId(null);
    setShowRestartModal(false);
    setLastPickBanner(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans pb-12">

      {/* SHELL HEADER */}
      <Header
        pickProgress={{ currentPick: progress.pickNumber, totalPicks: progress.totalPicks }}
        currentTurnUser={activeUser}
        onOpenRestartModal={() => setShowRestartModal(true)}
        onToggleDebug={onToggleDashboard}
        showDebug={showDebug}
      />

      {/* CONFIRMATION RESTART MODAL */}
      <Modal
        isOpen={showRestartModal}
        title="RESTART DRAFT ARENA?"
        message="Current draft progress and player selections will be reset. Are you sure you want to start a fresh game?"
        confirmLabel="RESTART GAME"
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
                <h4 className="font-black text-white text-sm">
                  {lastPickBanner.playerName} <span className="text-slate-400 font-normal">({lastPickBanner.teamId})</span> — Drafted by {lastPickBanner.userName}
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
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
