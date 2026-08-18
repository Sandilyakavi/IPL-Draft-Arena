import React from 'react';
import ProgressBar from './ProgressBar';
import { RotateCcw, Bug, Trophy, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Header Component — Premium sports game application header.
 */
export default function Header({
  pickProgress = { currentPick: 1, totalPicks: 24 },
  currentTurnUser = null,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  onOpenRestartModal,
  onOpenProfileModal,
  onToggleDebug,
  showDebug = false,
}) {
  const currentPick = pickProgress.currentPick || 1;
  const totalPicks = pickProgress.totalPicks || 24;

  let logoutFn = null;
  let userProfile = null;
  try {
    const auth = useAuth();
    logoutFn = auth?.logout;
    userProfile = auth?.profile;
  } catch (err) {
    // Graceful fallback if Header is rendered outside AuthProvider in isolated tests
  }

  return (
    <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">

        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 font-black">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                IPL Draft Arena
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                2026 Season
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {player1Name} vs {player2Name} — Local Draft Arena
            </p>
          </div>
        </div>

        {/* Pick Progress & Turn Indicator */}
        <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800 px-4 py-2 rounded-xl shadow-inner min-w-[240px]">
          <div className="flex-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 mb-1">
              <span>Pick Progress</span>
              <span className="font-mono text-cyan-400 font-extrabold">PICK {String(currentPick).padStart(2, '0')} / {totalPicks}</span>
            </div>
            <ProgressBar value={currentPick} max={totalPicks} />
          </div>

          {currentTurnUser && (
            <div className="border-l border-slate-800 pl-3 text-right">
              <span className="text-[9px] uppercase font-extrabold text-slate-500 block">Current Turn</span>
              <span className="text-xs font-black text-white flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-sm">{currentTurnUser.avatar || (currentTurnUser.id === 'player1' ? '🏏' : '⚡')}</span>
                <span>{currentTurnUser.name}</span>
              </span>
            </div>
          )}
        </div>

        {/* Actions Controls */}
        <div className="flex items-center gap-2">
          {/* Profile Button */}
          {onOpenProfileModal && (
            <button
              onClick={onOpenProfileModal}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-cyan-300 rounded-xl text-xs font-extrabold transition-all border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="View & Edit User Profile"
            >
              <span className="text-sm">{userProfile?.avatar || '🏏'}</span>
              <span className="hidden md:inline font-mono">@{userProfile?.username || 'profile'}</span>
            </button>
          )}

          {/* Restart Button */}
          <button
            onClick={onOpenRestartModal}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-extrabold transition-all border border-slate-700 flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="Restart Draft Game"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </button>

          {/* Debug Dashboard Button */}
          <button
            onClick={onToggleDebug}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 active:scale-95 shadow-sm ${
              showDebug
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Developer Debug Dashboard"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showDebug ? 'Close Debug' : 'Debug'}</span>
          </button>

          {/* Logout Button */}
          {logoutFn && (
            <button
              onClick={logoutFn}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl text-xs font-extrabold transition-all border border-rose-500/30 flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="Sign Out of IPL Draft Arena"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
