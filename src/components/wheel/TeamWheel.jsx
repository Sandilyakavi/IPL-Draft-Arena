import React, { useMemo } from 'react';
import teams from '../../data/teams.json';
import { WHEEL_TEAMS, TEAM_ANGLE } from '../../utils/wheelGeometry';
import TeamLogo from '../common/TeamLogo';
import { RefreshCw, RotateCcw, AlertTriangle, Disc, Sparkles } from 'lucide-react';

/**
 * TeamWheel Component — Visual wheel rendering & rotation animation.
 * Enforces 100% visual synchronization between pointer and selected team.
 */
export default function TeamWheel({
  currentTeamId,
  targetTeamId,
  rotationDegrees = 0,
  eligibleTeams = [],
  onSpin,
  isSpinning = false,
  disabled = false,
  respinNotice = null,
  errorMessage = null,
}) {
  // Map WHEEL_TEAMS explicitly to team objects to ensure identical order
  const wheelTeamObjects = useMemo(() => {
    return WHEEL_TEAMS.map(id => teams.find(t => t.id === id)).filter(Boolean);
  }, []);

  const currentTeamObj = useMemo(() => {
    return teams.find(t => t.id === currentTeamId) || null;
  }, [currentTeamId]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col items-center relative overflow-hidden">
      <div className="w-full flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Disc className={`w-4 h-4 ${isSpinning ? 'text-cyan-400 animate-spin' : 'text-cyan-400'}`} /> Franchise Wheel
        </h3>
        <span className="text-[10px] px-2.5 py-1 bg-slate-950 text-slate-400 rounded-full font-mono border border-slate-800 font-bold">
          {eligibleTeams.length} / 10 Franchises Available
        </span>
      </div>

      {/* Respin Notice Banner */}
      {respinNotice && (
        <div className="w-full mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2 animate-fadeIn">
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-amber-400" />
          <span>{respinNotice}</span>
        </div>
      )}

      {/* Error Notice Banner */}
      {errorMessage && (
        <div className="w-full mb-3 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Wheel Graphic Container */}
      <div className="relative w-72 h-72 my-2 flex items-center justify-center">

        {/* Top Pointer Indicator (Fixed at 12 o'clock / 270deg) */}
        <div className="absolute -top-4 z-30 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-amber-400 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]" />
        </div>

        {/* Rotating SVG Wheel */}
        <div
          className={`w-full h-full rounded-full border-4 border-slate-800 shadow-2xl relative overflow-hidden transition-shadow duration-500 ${
            isSpinning ? 'shadow-[0_0_35px_rgba(6,182,212,0.35)]' : ''
          }`}
          style={{
            transform: `rotate(${rotationDegrees}deg)`,
            transition: isSpinning
              ? 'transform 2500ms cubic-bezier(0.15, 0.85, 0.35, 1.0)'
              : 'none',
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {wheelTeamObjects.map((t, idx) => {
              const startAngle = idx * TEAM_ANGLE;
              const endAngle = (idx + 1) * TEAM_ANGLE;
              const isEligible = eligibleTeams.some(et => et.id === t.id);

              const radStart = (Math.PI * startAngle) / 180;
              const radEnd = (Math.PI * endAngle) / 180;

              const x1 = 100 + 100 * Math.cos(radStart);
              const y1 = 100 + 100 * Math.sin(radStart);
              const x2 = 100 + 100 * Math.cos(radEnd);
              const y2 = 100 + 100 * Math.sin(radEnd);

              const pathData = `M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`;
              const midAngle = startAngle + TEAM_ANGLE / 2;
              const textRad = (Math.PI * midAngle) / 180;
              const textX = 100 + 66 * Math.cos(textRad);
              const textY = 100 + 66 * Math.sin(textRad);

              return (
                <g key={t.id}>
                  <path
                    d={pathData}
                    fill={t.primaryColor}
                    opacity={isEligible ? 0.95 : 0.25}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                  >
                    {t.shortName}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="24" fill="#0f172a" stroke="#334155" strokeWidth="3" />
          </svg>
        </div>

        {/* Center Logo / Status Display */}
        <div className="absolute z-20 w-16 h-16 rounded-full bg-slate-950 border-2 border-slate-700 flex flex-col items-center justify-center shadow-inner pointer-events-none">
          {isSpinning ? (
            <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
          ) : currentTeamObj ? (
            <TeamLogo teamId={currentTeamObj} size="md" />
          ) : (
            <span className="text-xl">🎡</span>
          )}
        </div>
      </div>

      {/* Result Showcase Banner (Only visible AFTER spinning completes) */}
      {!isSpinning && currentTeamObj && (
        <div
          className="w-full mt-3 p-3 rounded-xl border flex items-center justify-between transition-all animate-scaleUp shadow-lg"
          style={{
            backgroundColor: `${currentTeamObj.primaryColor}18`,
            borderColor: `${currentTeamObj.primaryColor}60`,
          }}
        >
          <div className="flex items-center gap-3">
            <TeamLogo teamId={currentTeamObj} size="md" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Franchise Selected
              </p>
              <h4 className="font-extrabold text-white text-sm">{currentTeamObj.name}</h4>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold">
            Select Player →
          </span>
        </div>
      )}

      {/* SPIN BUTTON */}
      <button
        onClick={onSpin}
        disabled={disabled || isSpinning}
        className={`w-full mt-4 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
          disabled || isSpinning
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-cyan-500 hover:from-cyan-400 hover:to-indigo-500 text-white border border-cyan-400/30 hover:shadow-cyan-500/25 active:scale-[0.98]'
        }`}
      >
        {isSpinning ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Spinning Wheel...</span>
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            <span>SPIN TEAM WHEEL</span>
          </>
        )}
      </button>
    </div>
  );
}
