import React, { useState } from 'react';
import { Cloud, CloudOff, Wifi, WifiOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/**
 * CloudSaveStatus — Non-blocking status indicator for cloud draft sync state.
 * Shows: Saved to Cloud | Saving | Local Backup | Sync Failed | (idle = nothing)
 */
export default function CloudSaveStatus({ status }) {
  if (!status || status === 'idle') return null;

  const config = {
    saving: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'Saving…',
      className: 'text-slate-400 bg-slate-800/80 border-slate-700',
    },
    saved: {
      icon: <Cloud className="w-3 h-3" />,
      label: 'Saved to Cloud',
      className: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
    local: {
      icon: <CloudOff className="w-3 h-3" />,
      label: 'Local Backup Active',
      className: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Cloud save failed — local backup active',
      className: 'text-red-400 bg-red-950/60 border-red-500/30',
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-wide transition-all animate-fadeIn ${c.className}`}
      title={c.label}
      aria-live="polite"
    >
      {c.icon}
      <span className="hidden sm:inline">{c.label}</span>
    </div>
  );
}
