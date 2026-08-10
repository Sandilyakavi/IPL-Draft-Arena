import React, { useState } from 'react';
import teams from '../../data/teams.json';

/**
 * TeamLogo Component — Displays verified team logo image if present,
 * or a clean text/initial fallback badge styled with team brand colors.
 */
export default function TeamLogo({
  teamId,
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
}) {
  const [logoError, setLogoError] = useState(false);

  const teamObj = typeof teamId === 'object' ? teamId : teams.find(t => t.id === teamId);
  const shortName = teamObj?.shortName || teamObj?.id?.toUpperCase() || 'IPL';
  const primaryColor = teamObj?.primaryColor || '#0284c7';

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  if (teamObj?.logo && !logoError) {
    return (
      <div className={`relative rounded-lg overflow-hidden shrink-0 ${currentSizeClass} ${className}`}>
        <img
          src={teamObj.logo}
          alt={teamObj.name}
          onError={() => setLogoError(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg shrink-0 flex items-center justify-center font-black uppercase tracking-wider shadow-md select-none border border-white/10 ${currentSizeClass} ${className}`}
      style={{
        backgroundColor: primaryColor,
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}
      title={teamObj?.name || shortName}
    >
      {shortName}
    </div>
  );
}
