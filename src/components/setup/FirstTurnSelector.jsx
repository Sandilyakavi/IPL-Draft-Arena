import React from 'react';
import { Dice5, UserCheck, HelpCircle } from 'lucide-react';

/**
 * FirstTurnSelector Component — Selects which player gets pick #1 (Player 1, Random, Player 2).
 */
export default function FirstTurnSelector({
  firstTurn = 'random',
  onSelectFirstTurn,
  p1Name = 'Player 1',
  p2Name = 'Player 2',
  p1Avatar = '🏏',
  p2Avatar = '⚡',
}) {
  const options = [
    { id: 'player1', label: `${p1Avatar} ${p1Name}`, icon: UserCheck, desc: 'Player 1 gets pick #1' },
    { id: 'random', label: '🎲 RANDOM (Default)', icon: Dice5, desc: '50/50 fair coin toss reveal' },
    { id: 'player2', label: `${p2Avatar} ${p2Name}`, icon: UserCheck, desc: 'Player 2 gets pick #1' },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-white text-base uppercase tracking-tight flex items-center gap-2">
            <Dice5 className="w-4 h-4 text-cyan-400" /> WHO PICKS FIRST?
          </h3>
          <p className="text-[11px] text-slate-400">Determines who gets turn #1 (turns alternate normally thereafter)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {options.map(opt => {
          const isSelected = firstTurn === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectFirstTurn(opt.id)}
              aria-label={`Select first turn: ${opt.label}`}
              className={`p-3.5 rounded-xl text-left flex flex-col justify-between transition-all border ${
                isSelected
                  ? 'bg-cyan-500/10 border-cyan-400 ring-2 ring-cyan-400/30 text-white shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-xs text-white truncate">{opt.label}</span>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-700'
                }`}>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
