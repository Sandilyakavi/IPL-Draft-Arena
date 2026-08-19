import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { saveGameSession, loadGameSession, clearGameSession } from '../utils/persistence.js';
import { useAuth } from '../context/AuthContext';

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

import { CheckCircle2, Globe, Users, Copy, Check } from 'lucide-react';
import {
  executeMultiplayerSpin,
  executeMultiplayerPick,
  syncRoomState,
  executeMultiplayerUpdateSquadOrder,
  executeMultiplayerEndDraft,
} from '../services/multiplayerSyncService';
import { subscribeToRoom } from '../services/multiplayerRoomService';
import { isUserTurn, resolveUserRole, ROOM_STATUS } from '../multiplayer/multiplayerArchitecture';

export default function DraftPage({ onToggleDashboard, showDebug = false }) {
  const [isMultiplayerMode, setIsMultiplayerMode] = useState(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const lastAnimatedSpinCount = useRef(0);

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
  const [showEndDraftModal, setShowEndDraftModal] = useState(false);
  const [showOpponentEndedModal, setShowOpponentEndedModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [lastPickBanner, setLastPickBanner] = useState(null);

  let authUser = null;
  let authProfile = null;
  let refreshProfile = null;
  try {
    const auth = useAuth();
    authUser = auth?.user;
    authProfile = auth?.profile;
    refreshProfile = auth?.refreshProfile;
  } catch (err) {
    // Graceful fallback when rendered in isolated test environment
  }

  const currentUserId = authUser?.id || 'demo_user_123';

  // Persist game state to localStorage ONLY when in Single-Player Mode
  useEffect(() => {
    if (gameState && !isMultiplayerMode) {
      saveGameSession(gameState);
    }
  }, [gameState, isMultiplayerMode]);

  // Subscribe to Realtime room updates when in Multiplayer Mode
  useEffect(() => {
    if (!isMultiplayerMode || !multiplayerRoom?.roomCode) return;

    const unsub = subscribeToRoom(
      multiplayerRoom.roomCode,
      (updatedRoomContract) => {
        if (!updatedRoomContract) return;

        // Check if room was abandoned / ended by remote opponent
        if (updatedRoomContract.status === ROOM_STATUS.ABANDONED) {
          setMultiplayerRoom(updatedRoomContract);
          if (updatedRoomContract.abandonedBy && updatedRoomContract.abandonedBy !== currentUserId) {
            setShowOpponentEndedModal(true);
          }
          return;
        }

        if (!updatedRoomContract.gameStateSnapshot) return;

        const incomingSnapshot = updatedRoomContract.gameStateSnapshot;
        const incomingSpinHistory = incomingSnapshot.spinHistory || [];
        const incomingSpinCount = incomingSpinHistory.length;

        // Trigger visual wheel animation on remote client when new spin detected
        if (incomingSpinCount > lastAnimatedSpinCount.current && !isSpinning) {
          lastAnimatedSpinCount.current = incomingSpinCount;
          const latestSpin = incomingSpinHistory[incomingSpinCount - 1];
          const selectedTeamId = latestSpin?.resultTeamId || incomingSnapshot.currentTeamId;

          if (selectedTeamId) {
            setIsSpinning(true);
            setTargetTeamId(selectedTeamId);
            setRotationDegrees(prev => getTargetRotation(selectedTeamId, prev, 5));

            setTimeout(() => {
              setMultiplayerRoom(updatedRoomContract);
              setGameState(incomingSnapshot);
              setIsSpinning(false);
            }, 2500);
            return;
          }
        }

        setMultiplayerRoom(updatedRoomContract);
        setGameState(incomingSnapshot);
      }
    );

    return () => unsub();
  }, [isMultiplayerMode, multiplayerRoom?.roomCode, isSpinning, currentUserId]);

  const activeUser = getCurrentPlayer(gameState);
  const progress = getDraftProgress(gameState);
  const draftFinished = isDraftComplete(gameState);
  const eligibleTeams = getEligibleTeams(gameState);

  const userRole = isMultiplayerMode ? resolveUserRole(multiplayerRoom, currentUserId) : 'player1';
  const isMyTurn = isMultiplayerMode
    ? isUserTurn(multiplayerRoom, currentUserId, gameState?.currentTurn)
    : true;

  // ── Handle Start Draft from Setup ─────────────────────────────
  const handleStartDraft = useCallback((initialStateOrContract, isMultiplayer = false) => {
    if (isMultiplayer) {
      setIsMultiplayerMode(true);
      setMultiplayerRoom(initialStateOrContract);
      const activeState =
        initialStateOrContract.gameStateSnapshot && initialStateOrContract.gameStateSnapshot.status !== 'setup'
          ? initialStateOrContract.gameStateSnapshot
          : startGame(
              createInitialGame(
                {},
                {
                  player1: {
                    name: initialStateOrContract.host?.username || 'Host Player',
                    avatar: initialStateOrContract.host?.avatar || '🏏',
                    favoriteTeamId: initialStateOrContract.host?.favoriteTeamId || null,
                  },
                  player2: {
                    name: initialStateOrContract.guest?.username || 'Guest Player',
                    avatar: initialStateOrContract.guest?.avatar || '⚡',
                    favoriteTeamId: initialStateOrContract.guest?.favoriteTeamId || null,
                  },
                  firstTurn: 'player1',
                  season: initialStateOrContract.season || '2026',
                }
              )
            );
      setGameState(activeState);
    } else {
      setIsMultiplayerMode(false);
      setMultiplayerRoom(null);
      setGameState(initialStateOrContract);
      saveGameSession(initialStateOrContract);
    }
    setIsSpinning(false);
    setSpinError(null);
    setRotationDegrees(0);
    setTargetTeamId(null);
    setLastPickBanner(null);
  }, []);

  // ── Handle Spin Action ─────────────────────────────────────────
  const handleSpin = useCallback(async () => {
    if (isSpinning || draftFinished) return;
    if (isMultiplayerMode && !isMyTurn) return;

    if (isMultiplayerMode) {
      try {
        setIsSpinning(true);
        setSpinError(null);
        const res = await executeMultiplayerSpin(multiplayerRoom.roomCode, currentUserId);
        const updatedState = res.roomContract.gameStateSnapshot;
        const selectedTeamId = res.spunTeamId;
        const newSpinCount = (updatedState.spinHistory || []).length;
        if (newSpinCount > 0) {
          lastAnimatedSpinCount.current = newSpinCount;
        }
        setTargetTeamId(selectedTeamId);
        setRotationDegrees(prev => getTargetRotation(selectedTeamId, prev, 5));

        setTimeout(() => {
          setGameState(updatedState);
          setMultiplayerRoom(res.roomContract);
          setIsSpinning(false);
        }, 2500);
      } catch (err) {
        setSpinError(err.message || 'Multiplayer spin error');
        setIsSpinning(false);
      }
      return;
    }

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
      setGameState(prev => {
        if (!prev) return res.updatedGameState;
        return {
          ...res.updatedGameState,
          player1: {
            ...res.updatedGameState.player1,
            squadOrder: (prev.player1?.squadOrder && prev.player1.squadOrder.length > 0)
              ? prev.player1.squadOrder
              : res.updatedGameState.player1?.squadOrder,
          },
          player2: {
            ...res.updatedGameState.player2,
            squadOrder: (prev.player2?.squadOrder && prev.player2.squadOrder.length > 0)
              ? prev.player2.squadOrder
              : res.updatedGameState.player2?.squadOrder,
          },
        };
      });
      setIsSpinning(false);
    }, 2500);
  }, [gameState, isSpinning, draftFinished, isMultiplayerMode, isMyTurn, multiplayerRoom, currentUserId]);

  // ── Handle Select Pending Player ────────────────────────────────
  const handleSelectPending = useCallback((playerId) => {
    if (draftFinished || isSpinning) return;
    if (isMultiplayerMode && !isMyTurn) return;

    const res = selectPendingPlayer(gameState, playerId);
    if (res.success) {
      setGameState(res.updatedGameState);
    }
  }, [gameState, draftFinished, isSpinning, isMultiplayerMode, isMyTurn]);

  // ── Handle Confirm Pick Action ──────────────────────────────────
  const handleConfirmPick = useCallback(async (playerId) => {
    if (draftFinished || isSpinning) return;
    if (isMultiplayerMode && !isMyTurn) return;

    if (isMultiplayerMode) {
      try {
        const res = await executeMultiplayerPick(
          multiplayerRoom.roomCode,
          currentUserId,
          playerId || gameState.pendingSelectedPlayerId
        );
        setGameState(res.roomContract.gameStateSnapshot);
        setMultiplayerRoom(res.roomContract);
        return;
      } catch (err) {
        setSpinError(err.message || 'Multiplayer pick error');
      }
      return;
    }

    if (!playerId) return;
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

  // ── End Draft Action ───────────────────────────────────────────
  const handleConfirmEndDraft = useCallback(async () => {
    if (isMultiplayerMode && multiplayerRoom?.roomCode) {
      try {
        await executeMultiplayerEndDraft(multiplayerRoom.roomCode, currentUserId);
      } catch (err) {
        console.warn('Multiplayer end draft sync warning:', err.message);
      }
      setIsMultiplayerMode(false);
      setMultiplayerRoom(null);
    } else {
      // Clear local single-player session from storage
      clearGameSession();
    }

    const freshState = createInitialGame();
    setGameState(freshState);
    setIsSpinning(false);
    setSpinError(null);
    setRotationDegrees(0);
    setTargetTeamId(null);
    setShowEndDraftModal(false);
    setLastPickBanner(null);
  }, [isMultiplayerMode, multiplayerRoom?.roomCode, currentUserId]);

  const handleAcknowledgeOpponentEnded = useCallback(() => {
    setIsMultiplayerMode(false);
    setMultiplayerRoom(null);
    const freshState = createInitialGame();
    setGameState(freshState);
    setIsSpinning(false);
    setSpinError(null);
    setRotationDegrees(0);
    setTargetTeamId(null);
    setShowOpponentEndedModal(false);
    setLastPickBanner(null);
  }, []);

  // ── Handle Squad Order Rearranging ─────────────────────────────
  const handleUpdateSquadOrder = useCallback(async (playerKey, newOrder) => {
    setGameState(prev => updateSquadOrder(prev, playerKey, newOrder));

    if (isMultiplayerMode && multiplayerRoom?.roomCode) {
      try {
        const res = await executeMultiplayerUpdateSquadOrder(
          multiplayerRoom.roomCode,
          currentUserId,
          playerKey,
          newOrder
        );
        if (res?.roomContract) {
          setMultiplayerRoom(res.roomContract);
        }
      } catch (err) {
        console.warn('Multiplayer squad order sync warning:', err.message);
      }
    }
  }, [isMultiplayerMode, multiplayerRoom?.roomCode, currentUserId]);

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
        onOpenEndDraftModal={() => setShowEndDraftModal(true)}
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

      {/* CONFIRMATION END DRAFT MODAL */}
      <Modal
        isOpen={showEndDraftModal}
        title="END DRAFT ARENA?"
        message={
          isMultiplayerMode
            ? "Are you sure you want to end this match? This will abandon the multiplayer draft room and return you to Game Setup."
            : "Are you sure you want to end the current draft? Your active session progress will be cleared and you will return to Game Setup."
        }
        confirmLabel="END DRAFT"
        cancelLabel="CANCEL"
        variant="danger"
        onConfirm={handleConfirmEndDraft}
        onCancel={() => setShowEndDraftModal(false)}
      />

      {/* OPPONENT ENDED DRAFT NOTIFICATION MODAL */}
      <Modal
        isOpen={showOpponentEndedModal}
        title="DRAFT ENDED BY OPPONENT"
        message="Your opponent has ended the draft match. The room has been closed."
        confirmLabel="RETURN HOME"
        cancelLabel="CLOSE"
        variant="warning"
        onConfirm={handleAcknowledgeOpponentEnded}
        onCancel={handleAcknowledgeOpponentEnded}
      />

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 pt-6 space-y-6">

        {/* MULTIPLAYER ROOM & TURN BANNER */}
        {isMultiplayerMode && multiplayerRoom && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">Online 2-Player Match</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-white font-mono text-xs font-bold rounded">
                    Room: {multiplayerRoom.roomCode}
                  </span>
                </div>
                <h4 className="font-extrabold text-white text-sm">
                  {multiplayerRoom.host?.username || 'Host'} vs {multiplayerRoom.guest?.username || 'Guest'}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isMyTurn ? (
                <span className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
                  YOUR TURN TO {gameState?.status === 'player-selection' ? 'PICK PLAYER' : 'SPIN WHEEL'}
                </span>
              ) : (
                <span className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 font-extrabold text-xs uppercase tracking-wider rounded-xl">
                  OPPONENT'S TURN (WAITING...)
                </span>
              )}
            </div>
          </div>
        )}

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
                disabled={draftFinished || gameState.status === 'player-selection' || (isMultiplayerMode && !isMyTurn)}
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
                disabled={draftFinished || gameState.status !== 'player-selection' || (isMultiplayerMode && !isMyTurn)}
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
