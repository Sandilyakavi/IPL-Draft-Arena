import React from 'react';

/**
 * ProgressBar Component — Displays a visual progress indicator.
 */
export default function ProgressBar({
  value = 0,
  max = 24,
  label = '',
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex justify-between text-[11px] font-semibold text-slate-400">
          <span>{label}</span>
          <span className="font-mono text-cyan-400 font-bold">{value} / {max}</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500 ease-out shadow-sm shadow-cyan-500/50"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
