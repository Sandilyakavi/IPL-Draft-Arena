import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createRoom, joinRoom, subscribeToRoom } from '../../services/multiplayerRoomService';
import { ROOM_STATUS } from '../../multiplayer/multiplayerArchitecture';
import { Users, Copy, Check, ArrowRight, X, Loader2, Sparkles } from 'lucide-react';

/**
 * MultiplayerRoomModal
 * =================================================================
 * UI Component for Creating, Joining, and Waiting in 2-Player Rooms.
 * Handles room code display, copy action, room code entry, and waiting state.
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

  // Handle room subscription when waiting for guest
  useEffect(() => {
    if (!roomContract || roomContract.status !== ROOM_STATUS.WAITING) return;

    const unsubscribe = subscribeToRoom(
      roomContract.roomCode,
      (updatedRoom) => {
        if (updatedRoom && updatedRoom.status === ROOM_STATUS.IN_PROGRESS) {
          setRoomContract(updatedRoom);
          if (onRoomReady) onRoomReady(updatedRoom);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [roomContract, onRoomReady]);

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
      const contract = await createRoom(currentUserData);
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
      if (onRoomReady) onRoomReady(contract);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-white">
        
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
            <h3 className="text-lg font-black text-white">Online 2-Player Draft</h3>
            <p className="text-xs text-slate-400 font-medium">Head-to-head multiplayer room setup</p>
          </div>
        </div>

        {/* Authentication Notice */}
        {!isAuthenticated && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs space-y-1">
            <p className="font-bold">Sign In Required</p>
            <p className="text-slate-400">You must be signed in to host or join online 2-player rooms across devices.</p>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* View Mode: Active Waiting Room vs Tab Setup */}
        {roomContract ? (
          /* Waiting Room State */
          <div className="space-y-6 text-center py-2">
            <div className="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Room Passcode</span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black text-amber-400 tracking-widest font-mono">
                  {roomContract.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copied && <p className="text-xs text-emerald-400 font-semibold">Copied to clipboard!</p>}
            </div>

            {roomContract.status === ROOM_STATUS.WAITING ? (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-center gap-3 text-amber-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-bold">Waiting for opponent to join...</span>
                </div>
                <p className="text-xs text-slate-400">Share code <strong className="text-white">{roomContract.roomCode}</strong> with your friend</p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Opponent joined! Room Ready.</span>
              </div>
            )}
          </div>
        ) : (
          /* Tab Selection (Create or Join) */
          <div className="space-y-4">
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => { setActiveTab('create'); setErrorMessage(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeTab === 'create' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => { setActiveTab('join'); setErrorMessage(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeTab === 'join' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Join Room
              </button>
            </div>

            {activeTab === 'create' ? (
              <div className="space-y-4 py-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Host a private 2-player IPL draft room. You will get a 6-character room code to invite your opponent.
                </p>
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Generate Room Code</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoinRoomSubmit} className="space-y-4 py-2">
                <div className="space-y-2">
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
