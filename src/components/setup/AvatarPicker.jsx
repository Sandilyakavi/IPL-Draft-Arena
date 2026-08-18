import React from 'react';
import { DEFAULT_AVATARS } from '../../game/draftEngine.js';

/**
 * AvatarPicker Component — Selects a non-personalized emoji avatar from preset list.
 */
export default function AvatarPicker({ selectedAvatar = '🏏', onSelectAvatar, label = 'Select Avatar' }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      <div className="grid grid-cols-4 gap-2">
        {DEFAULT_AVATARS.map(avatar => {
          const isSelected = selectedAvatar === avatar;
          return (
            <button
              key={avatar}
              type="button"
              onClick={() => onSelectAvatar(avatar)}
              aria-label={`Select avatar ${avatar}`}
              className={`p-2.5 rounded-xl text-xl flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 border-2 border-cyan-400 ring-2 ring-cyan-400/30 scale-105 shadow-md shadow-cyan-500/20 text-white'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {avatar}
            </button>
          );
        })}
      </div>
    </div>
  );
}
