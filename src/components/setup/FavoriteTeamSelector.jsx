import React from 'react';
import teams from '../../data/teams.json';
import TeamLogo from '../common/TeamLogo';
import { Shield, Sparkles } from 'lucide-react';

/**
 * FavoriteTeamSelector Component — Cosmetic IPL franchise preference selector.
 * Does NOT alter wheel probability, player eligibility, or draft rules.
 */
export default function FavoriteTeamSelector({ selectedTeamId = null, onSelectTeam }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-cyan-400" /> Favorite Franchise (Optional)
        </label>
        <span className="text-[10px] text-slate-500 italic">Cosmetic preference only</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => onSelectTeam(null)}
          aria-label="No favorite team preference"
          className={`p-2 rounded-xl text-center text-xs font-bold transition-all border ${
            selectedTeamId === null
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/40'
              : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          None
        </button>

        {teams.map(t => {
          const isSelected = selectedTeamId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTeam(t.id)}
              aria-label={`Select ${t.name} as favorite team`}
              title={`${t.name} (Cosmetic preference)`}
              className={`p-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border ${
                isSelected
                  ? 'bg-slate-900 border-cyan-400 ring-2 ring-cyan-400/40 text-white shadow-md shadow-cyan-500/10'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <TeamLogo teamId={t.id} size="xs" />
              <span className="text-[9px] font-black uppercase tracking-wider">{t.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
