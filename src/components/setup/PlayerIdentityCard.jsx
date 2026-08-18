import React from 'react';
import AvatarPicker from './AvatarPicker';
import FavoriteTeamSelector from './FavoriteTeamSelector';
import { User, AlertCircle } from 'lucide-react';

/**
 * PlayerIdentityCard Component — Section for configuring Player 1 or Player 2 identity.
 */
export default function PlayerIdentityCard({
  playerNumber = 1,
  config = { name: 'Player 1', avatar: '🏏', favoriteTeamId: null },
  onChange,
  errorMessage = null,
  otherPlayerName = '',
}) {
  const isP1 = playerNumber === 1;
  const accentColor = isP1 ? 'cyan' : 'amber';

  const handleNameChange = (e) => {
    const val = e.target.value.slice(0, 20); // Max 20 chars
    onChange({ ...config, name: val });
  };

  const handleAvatarChange = (avatar) => {
    onChange({ ...config, avatar });
  };

  const handleTeamChange = (favoriteTeamId) => {
    onChange({ ...config, favoriteTeamId });
  };

  return (
    <div className={`bg-slate-900/90 border rounded-2xl p-5 space-y-4 shadow-xl transition-all ${
      isP1 ? 'border-cyan-500/30 ring-1 ring-cyan-500/10' : 'border-amber-500/30 ring-1 ring-amber-500/10'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg ${
            isP1 ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
          }`}>
            {config.avatar || (isP1 ? '🏏' : '⚡')}
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">PLAYER {playerNumber}</h3>
            <p className="text-[11px] text-slate-400 font-medium">Local Arena Competitor</p>
          </div>
        </div>

        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
          isP1 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
        }`}>
          {isP1 ? 'Player 1' : 'Player 2'}
        </span>
      </div>

      {/* Name Input */}
      <div className="space-y-1">
        <label htmlFor={`player-${playerNumber}-name-input`} className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
          Display Name <span className="text-rose-400">*</span>
        </label>
        <div className="relative">
          <input
            id={`player-${playerNumber}-name-input`}
            type="text"
            value={config.name}
            onChange={handleNameChange}
            maxLength={20}
            placeholder={`Player ${playerNumber}`}
            className={`w-full bg-slate-950/90 border rounded-xl px-3.5 py-2.5 text-sm font-bold text-white placeholder-slate-600 focus:outline-none transition-all ${
              errorMessage
                ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/40'
                : 'border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'
            }`}
          />
          <span className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-500">
            {config.name.length}/20
          </span>
        </div>
        {errorMessage && (
          <p className="text-[11px] font-bold text-rose-400 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5" /> {errorMessage}
          </p>
        )}
      </div>

      {/* Avatar Picker */}
      <AvatarPicker
        selectedAvatar={config.avatar}
        onSelectAvatar={handleAvatarChange}
        label={`Player ${playerNumber} Avatar`}
      />

      {/* Favorite Team Selector */}
      <FavoriteTeamSelector
        selectedTeamId={config.favoriteTeamId}
        onSelectTeam={handleTeamChange}
      />
    </div>
  );
}
