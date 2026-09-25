import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createRoom, joinRoom, subscribeToRoom } from '../../services/multiplayerRoomService';
import { ROOM_STATUS } from '../../multiplayer/multiplayerArchitecture';
import { Users, Copy, Check, ArrowRight, X, Loader2, Sparkles, Clock, Shuffle } from 'lucide-react';
import { DRAFT_CONFIG } from '../../config/draftConfig';

/**
 * MultiplayerRoomModal
 * =================================================================
 * UI Component for Creating, Joining, and Waiting in 2–4 Player Rooms.
 * Supports:
 * - 2, 3, or 4 player capacity selector
 * - Turn timer options (10s, 15s, 20s, 30s)
 * - Snake or Alternating draft mode
 * - Multi-player lobby with connected & ready status indicators
 * - Host manual/automatic start draft trigger
 * =================================================================
 */
export default function MultiplayerRoomModal({ isOpen, onClose, onRoomReady }) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [roomContract, setRoomContract] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Host configuration state
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimer, setTurnTimer] = useState(20);
  const [draftMode, setDraftMode] = useState('snake');

  // Handle room subscription when waiting in lobby
  useEffect(() => {
    if (!roomContract) return;

    const unsubscribe = subscribeToRoom(
      roomContract.roomCode,
      (updatedRoom) => {
        if (!updatedRoom) return;
        setRoomContract(updatedRoom);

        if (updatedRoom.status === ROOM_STATUS.IN_PROGRESS) {
          if (onRoomReady) onRoomReady(updatedRoom);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [roomContract?.roomCode, onRoomReady]);

  if (!isOpen) return null;

  const isAuthenticated = Boolean(user && user.id);

  const currentUserData = {
    id: user?.id,
    username: profile?.username || user?.email?.split('@')[0] || 'Player',
    avatar: profile?.avatar || '🏏',
    favoriteTeamId: profile?.favorite_team || null,
  };

  const handleCreateRoom = async () => {
    if (!isAuthenticated) {
      setErrorMessage('You must be signed in to create an online room');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const contract = await createRoom(currentUserData, '2026', maxPlayers, turnTimer, draftMode);
      setRoomContract(contract);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoomSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setErrorMessage('You must be signed in to join an online room');
      return;
    }
    if (!joinCodeInput.trim()) {
      setErrorMessage('Please enter a 6-character room code');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const contract = await joinRoom(joinCodeInput, currentUserData);
      setRoomContract(contract);
      if (contract.status === ROOM_STATUS.IN_PROGRESS && onRoomReady) {
        onRoomReady(contract);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!roomContract?.roomCode) return;
    navigator.clipboard.writeText(roomContract.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartDraftNow = () => {
    if (!roomContract) return;
    if (onRoomReady) {
      onRoomReady(roomContract);
    }
  };

  const participants = Array.isArray(roomContract?.participants)
    ? roomContract.participants
    : (roomContract ? [roomContract.host, roomContract.guest].filter(Boolean) : []);

  const totalSlots = roomContract?.maxPlayers || maxPlayers;
  const isHost = roomContract && (roomContract.hostId === user?.id || roomContract.host?.userId === user?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-white">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Online Draft Arena</h3>
            <p className="text-xs text-slate-400 font-medium">Realtime multiplayer draft (2–4 players)</p>
          </div>
        </div>

        {/* Authentication Notice */}
        {!isAuthenticated && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs space-y-1">
            <p className="font-bold">Sign In Required</p>
            <p className="text-slate-400">You must be signed in to host or join online rooms across devices.</p>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* View Mode: Active Waiting Lobby vs Tab Setup */}
        {roomContract ? (
          /* Lobby State */
          <div className="space-y-5 text-center py-1">
            {/* Room Passcode Banner */}
            <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Room Code</span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black text-amber-400 tracking-widest font-mono">
                  {roomContract.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                {copied ? <span className="text-emerald-400 font-bold">Copied code to clipboard!</span> : `Share code with friends to join`}
              </p>
            </div>

            {/* Players Status List */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                  Lobby Participants
                </span>
                <span className="font-bold text-amber-400 font-mono text-[11px]">
                  {participants.length} / {totalSlots} Players
                </span>
              </div>

              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                  const participant = participants[slotIdx];
                  if (participant) {
                    return (
                      <div
                        key={participant.playerId || `p-${slotIdx}`}
                        className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{participant.avatar || '🏏'}</span>
                          <div className="truncate">
                            <span className="font-bold text-white block truncate">
                              {participant.displayName || participant.username || `Player ${slotIdx + 1}`}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {slotIdx === 0 ? 'Host' : `Player ${slotIdx + 1}`}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Ready
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`empty-${slotIdx}`}
                      className="p-2.5 bg-slate-950/30 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-500"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 font-mono text-[10px]">#{slotIdx + 1}</span>
                        <span className="italic text-[11px]">Waiting for player...</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-amber-500/50 animate-ping" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Waiting or Ready Banner */}
            {participants.length < totalSlots ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Waiting for {totalSlots - participants.length} more player(s)...</span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>All {totalSlots} players ready! Starting draft...</span>
              </div>
            )}

            {/* Host Start Draft Override */}
            {isHost && participants.length >= 2 && (
              <button
                onClick={handleStartDraftNow}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Start Draft ({participants.length} Players)
              </button>
            )}
          </div>
        ) : (
          /* Tab Selection (Create or Join) */
          <div className="space-y-4">
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => { setActiveTab('create'); setErrorMessage(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  activeTab === 'create' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => { setActiveTab('join'); setErrorMessage(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  activeTab === 'join' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Join Room
              </button>
            </div>

            {activeTab === 'create' ? (
              <div className="space-y-4 py-1">
                {/* 1. Player Count Selector (2, 3, 4) */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" /> Number of Players
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setMaxPlayers(count)}
                        className={`py-2 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                          maxPlayers === count
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {count} Players
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Turn Timer Selector (10s, 15s, 20s, 30s) */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" /> Turn Timer
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[10, 15, 20, 30].map(secs => (
                      <button
                        key={secs}
                        type="button"
                        onClick={() => setTurnTimer(secs)}
                        className={`py-1.5 rounded-xl font-bold text-[11px] border transition-all cursor-pointer ${
                          turnTimer === secs
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {secs}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Draft Mode (Snake vs Alternating) */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-purple-400" /> Draft Turn Order
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDraftMode('snake')}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all text-center cursor-pointer ${
                        draftMode === 'snake'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      Snake Draft 🐍
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftMode('alternating')}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all text-center cursor-pointer ${
                        draftMode === 'alternating'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      Alternating 🔄
                    </button>
                  </div>
                </div>

                {/* Create Room Button */}
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Generate Room Code</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoinRoomSubmit} className="space-y-4 py-2">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Enter 6-Character Room Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. IPL92X"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-center text-lg placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors uppercase tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !joinCodeInput.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Join Match Room</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
