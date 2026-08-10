import React, { useState } from 'react';
import teams from '../../data/teams.json';

/**
 * Gets initials from a full player name.
 * e.g., "Ruturaj Gaikwad" -> "RG", "MS Dhoni" -> "MSD"
 */
function getInitials(name = '') {
  if (!name) return 'IPL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  if (parts.length === 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0][0] + parts[1][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * PlayerAvatar Component — Displays verified player photo if present,
 * or a styled fallback avatar with player initials and franchise brand colors.
 */
export default function PlayerAvatar({
  player,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className = '',
}) {
  const [imageError, setImageError] = useState(false);

  const name = player?.name || '';
  const teamId = player?.teamId || '';
  const teamObj = teams.find(t => t.id === teamId);
  const initials = getInitials(name);

  const primaryColor = teamObj?.primaryColor || '#0284c7';

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  if (player?.image && !imageError) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 border-2 border-slate-700 ${currentSizeClass} ${className}`}>
        <img
          src={player.image}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full shrink-0 border-2 border-slate-700/80 flex items-center justify-center font-black tracking-wider shadow-inner select-none ${currentSizeClass} ${className}`}
      style={{
        background: `radial-gradient(circle at 35% 35%, ${primaryColor}dd 0%, #090d16 100%)`,
        color: '#ffffff',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
