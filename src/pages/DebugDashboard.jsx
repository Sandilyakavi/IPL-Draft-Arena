import React, { useState, useMemo } from 'react';
import {
  getOverallSummary,
  getDraftPool,
  getAllPlayers,
  getDefaultRules,
} from '../utils/dataLoader';
import {
  ShieldCheck, Users, Globe, UserCheck, Flag,
  CheckCircle, AlertTriangle, Database, Info,
  Search, Award, AlertCircle, BookOpen,
} from 'lucide-react';

const ROLE_COLORS = {
  batter: 'text-sky-300',
  'wicketkeeper-batter': 'text-purple-300',
  'all-rounder': 'text-cyan-300',
  bowler: 'text-emerald-300',
};

const STATUS_BADGE = {
  '2026-current-squad': { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  '2026-injured-retained-master': { label: 'Injured (Master)', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  unavailable: { label: 'Unavailable', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

function getStatusBadge(status) {
  return STATUS_BADGE[status] || { label: status, cls: 'bg-slate-800 text-slate-400 border-slate-700' };
}

export default function DebugDashboard() {
  const summary = useMemo(() => getOverallSummary('2026'), []);
  const masterPlayers = useMemo(() => getAllPlayers(), []);
  const draftPool = useMemo(() => getDraftPool('2026'), []);
  const defaultRules = useMemo(() => getDefaultRules(), []);

  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('all');

  const basePool = showUnavailable ? masterPlayers : draftPool;

  const filteredPlayers = useMemo(() => {
    return basePool.filter(p => {
      const matchTeam = selectedTeamId === 'all' || p.teamId === selectedTeamId;
      const matchRole = selectedRole === 'all' || p.role === selectedRole;
      const matchSearch = searchQuery === 'all' || searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nationality.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.teamId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTeam && matchRole && matchSearch;
    });
  }, [basePool, selectedTeamId, selectedRole, searchQuery]);

  const { validationResult, metadata } = summary;
  const unavailablePlayers = masterPlayers.filter(p => {
    const s = p.seasonStatus?.['2026'];
    return s === '2026-injured-retained-master' || s === 'unavailable' || s === 'inactive';
  });

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-6 md:p-8 font-sans">

      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-bold rounded-full border border-cyan-500/20 uppercase tracking-widest">
                Phase 1 Verification
              </span>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                IPL {metadata.season} — Excel Master Dataset
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              IPL Draft Arena — Foundation Dashboard
            </h1>
            <p className="text-slate-400 mt-1 text-sm sm:text-base">
              Master player database • Season availability • Data pipeline verified from Excel source of truth.
            </p>
          </div>

          <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-2.5 font-semibold text-sm ${
            validationResult.isValid
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-950/50'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
          }`}>
            {validationResult.isValid
              ? <><CheckCircle className="w-5 h-5" /><span>Validation Passed (0 Errors)</span></>
              : <><AlertTriangle className="w-5 h-5" /><span>{validationResult.errors.length} Errors</span></>
            }
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">

        {/* Validation Errors */}
        {!validationResult.isValid && (
          <div className="bg-rose-950/30 border border-rose-500/40 p-5 rounded-2xl">
            <h3 className="text-rose-400 font-bold flex items-center gap-2 text-lg mb-3">
              <AlertTriangle className="w-5 h-5" /> Validation Errors:
            </h3>
            <ul className="list-disc list-inside text-rose-200 text-sm space-y-1">
              {validationResult.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* Ayush Mhatre Master DB Notice */}
        {unavailablePlayers.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-xl flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-300 font-semibold text-sm mb-1">
                Master DB: {unavailablePlayers.length} player(s) retained but excluded from 2026 draft pool
              </p>
              {unavailablePlayers.map(p => (
                <p key={p.id} className="text-amber-200/70 text-xs">
                  {p.name} ({p.teamId.toUpperCase()}) — status: <span className="font-mono">{p.seasonStatus?.['2026']}</span>
                  {p.notes ? ` — ${p.notes}` : ''}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Franchises', value: summary.totalTeams, sub: '10 official IPL teams', icon: <Flag className="w-4 h-4 text-cyan-400" />, cls: 'text-white' },
            { label: 'Master Players', value: summary.totalMasterPlayers, sub: 'Including unavailable', icon: <BookOpen className="w-4 h-4 text-indigo-400" />, cls: 'text-indigo-300' },
            { label: '2026 Draft Pool', value: summary.totalEligiblePlayers, sub: 'Draft-eligible players', icon: <Users className="w-4 h-4 text-cyan-400" />, cls: 'text-cyan-300' },
            { label: 'Indian Players', value: summary.indianPlayers, sub: 'In 2026 draft pool', icon: <UserCheck className="w-4 h-4 text-amber-400" />, cls: 'text-amber-300' },
            { label: 'Overseas', value: summary.overseasPlayers, sub: 'In 2026 draft pool', icon: <Globe className="w-4 h-4 text-emerald-400" />, cls: 'text-emerald-300' },
            { label: 'Wicketkeepers', value: summary.wicketkeepers, sub: 'In 2026 draft pool', icon: <Award className="w-4 h-4 text-purple-400" />, cls: 'text-purple-300' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider">{kpi.label}</span>
                {kpi.icon}
              </div>
              <div className={`text-3xl font-extrabold ${kpi.cls}`}>{kpi.value}</div>
              <div className="text-[10px] text-slate-500 mt-1">{kpi.sub}</div>
            </div>
          ))}
        </section>

        {/* Dataset & Config */}
        <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl grid md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" /> Dataset Provenance
            </h3>
            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="text-slate-200 font-medium">Season:</span> IPL {metadata.season}</p>
              <p><span className="text-slate-200 font-medium">Source:</span> {metadata.source}</p>
              <p><span className="text-slate-200 font-medium">Last Verified:</span> {metadata.lastVerified}</p>
            </div>
          </div>
          <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" /> Master DB Architecture
            </h3>
            <div className="text-xs text-slate-400 space-y-1">
              <p><span className="text-slate-200 font-medium">Master records:</span> {summary.totalMasterPlayers}</p>
              <p><span className="text-slate-200 font-medium">2026 eligible:</span> {summary.totalEligiblePlayers}</p>
              <p><span className="text-slate-200 font-medium">2026 unavailable:</span> {summary.totalUnavailablePlayers} (retained in DB)</p>
            </div>
          </div>
          <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> Draft Rules (rules.json)
            </h3>
            <div className="text-xs text-slate-400 grid grid-cols-2 gap-x-6 gap-y-1">
              <p><span className="text-slate-200 font-medium">Squad Size:</span> {defaultRules.squadSize}</p>
              <p><span className="text-slate-200 font-medium">Max/Franchise:</span> {defaultRules.maxPlayersPerTeam}</p>
              <p><span className="text-slate-200 font-medium">Max Overseas:</span> {defaultRules.maxOverseas}</p>
              <p><span className="text-slate-200 font-medium">Unique:</span> {defaultRules.uniquePlayers ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </section>

        {/* Franchise Cards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Flag className="w-5 h-5 text-cyan-400" /> 10 Franchise Squad Breakdown
            </h2>
            <span className="text-xs text-slate-400">Master count (eligible / master)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {summary.teamSummaries.map(t => {
              const { stats } = t;
              return (
                <div
                  key={t.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all shadow-md relative overflow-hidden group"
                  style={{ borderTop: `4px solid ${t.primaryColor}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">{t.shortName}</h3>
                      <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{t.name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black"
                      style={{ backgroundColor: `${t.primaryColor}22`, color: t.primaryColor, border: `1px solid ${t.primaryColor}44` }}>
                      {stats.eligibleCount}/{stats.masterCount}
                    </span>
                  </div>

                  {stats.unavailableCount > 0 && (
                    <div className="mb-2 px-2 py-1 bg-rose-950/30 border border-rose-500/20 rounded text-[10px] text-rose-300">
                      {stats.unavailablePlayers.map(u => `${u.name} (unavail)`).join(', ')}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-semibold block">Indian</span>
                      <span className="font-bold text-amber-300">{stats.indianCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-semibold block">Overseas</span>
                      <span className="font-bold text-emerald-400">{stats.overseasCount}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5 text-[11px]">
                    {Object.entries(stats.rolesCount).map(([role, count]) => (
                      <div key={role} className="flex justify-between text-slate-400">
                        <span className="capitalize">{role.replace('wicketkeeper-', 'WK-')}:</span>
                        <span className={`font-semibold ${ROLE_COLORS[role] || 'text-slate-200'}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Player Registry Table */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Player Registry
                <span className="text-sm font-normal text-slate-400 ml-1">({filteredPlayers.length} records)</span>
              </h2>
              <p className="text-xs text-slate-400">Excel master database — role, nationality, season status, source.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search player, team, nationality..."
                  value={searchQuery === 'all' ? '' : searchQuery}
                  onChange={e => setSearchQuery(e.target.value || 'all')}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-52"
                />
              </div>
              <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
                <option value="all">All Teams</option>
                {summary.teamSummaries.map(t => (
                  <option key={t.id} value={t.id}>{t.shortName} — {t.name}</option>
                ))}
              </select>
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
                <option value="all">All Roles</option>
                <option value="batter">Batter</option>
                <option value="wicketkeeper-batter">WK-Batter</option>
                <option value="all-rounder">All-Rounder</option>
                <option value="bowler">Bowler</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={showUnavailable}
                  onChange={e => setShowUnavailable(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 accent-cyan-500"
                />
                Show unavailable (master only)
              </label>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase font-semibold tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Nat.</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Overseas</th>
                  <th className="p-3">WK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {filteredPlayers.length === 0
                  ? <tr><td colSpan="7" className="p-8 text-center text-slate-500">No records match your filters.</td></tr>
                  : filteredPlayers.map(p => {
                      const status2026 = p.seasonStatus?.['2026'] || 'active';
                      const badge = getStatusBadge(status2026);
                      const isUnavail = status2026 === '2026-injured-retained-master';
                      return (
                        <tr key={p.id} className={`hover:bg-slate-800/40 transition-colors ${isUnavail ? 'opacity-50' : ''}`}>
                          <td className="p-3">
                            <div className="font-semibold text-white text-xs">{p.name}</div>
                            <div className="text-slate-500 font-mono text-[10px]">{p.id}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-slate-800 text-slate-300">{p.teamId}</span>
                          </td>
                          <td className={`p-3 capitalize text-xs font-medium ${ROLE_COLORS[p.role] || 'text-slate-300'}`}>{p.role}</td>
                          <td className="p-3 font-bold text-amber-400 text-xs">{p.nationality}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className="p-3">
                            {p.isOverseas
                              ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Overseas</span>
                              : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Indian</span>
                            }
                          </td>
                          <td className="p-3 text-center">
                            {p.isWicketkeeper ? <CheckCircle className="w-4 h-4 text-purple-400 inline" /> : '—'}
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
