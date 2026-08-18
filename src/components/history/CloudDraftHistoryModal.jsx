import React, { useState, useEffect } from 'react';
import {
  History, X, Trophy, Calendar, Clock, Target, Users,
  Eye, Trash2, AlertTriangle, ChevronRight, Medal,
  Globe, UserCheck, RefreshCcw
} from 'lucide-react';
import TeamLogo from '../common/TeamLogo';
import { getDraftHistory, discardDraft } from '../../services/draftService.js';

/**
 * HistoryDetailModal — Read-only result view for a single completed draft.
 */
function HistoryDetailModal({ record, onClose }) {
  if (!record) return null;

  const gs = record.game_state || {};
  const pickHistory = gs.pickHistory || [];
  const p1 = gs.player1 || {};
  const p2 = gs.player2 || {};
  const p1Score = record.player1_score;
  const p2Score = record.player2_score;

  let winnerLabel = 'Tie';
  if (record.winner === 'player1') winnerLabel = `${record.player1_name} wins`;
  else if (record.winner === 'player2') winnerLabel = `${record.player2_name} wins`;

  const completedAt = record.completed_at ? new Date(record.completed_at).toLocaleString() : '—';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(7, 11, 18, 0.95)', backdropFilter: 'blur(14px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Draft Result"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900/95 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-500/20 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Draft Result</h2>
              <p className="text-[10px] text-amber-400 font-bold">{winnerLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Score header */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: record.player1_name, avatar: record.player1_avatar, score: p1Score, isWinner: record.winner === 'player1', key: 'player1' },
              { name: record.player2_name, avatar: record.player2_avatar, score: p2Score, isWinner: record.winner === 'player2', key: 'player2' },
            ].map(u => (
              <div
                key={u.key}
                className={`p-4 rounded-2xl border text-center space-y-2 ${u.isWinner
                  ? 'bg-amber-950/40 border-amber-500/40 shadow-lg shadow-amber-950/30'
                  : 'bg-slate-950/60 border-slate-800'}`}
              >
                {u.isWinner && <div className="text-amber-400 text-lg">🏆</div>}
                <div className="text-2xl">{u.avatar}</div>
                <div className="font-black text-white text-sm">{u.name}</div>
                {u.score != null && (
                  <div className={`text-2xl font-black ${u.isWinner ? 'text-amber-400' : 'text-slate-400'}`}>
                    {u.score}<span className="text-xs font-normal text-slate-500">/100</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {completedAt}</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {record.pick_number || pickHistory.length} picks</span>
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Season {record.season}</span>
          </div>

          {/* Pick history */}
          {pickHistory.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-cyan-400" /> Pick Log ({pickHistory.length} picks)
              </h3>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {[...pickHistory].reverse().map((pick, idx) => (
                  <div key={pick.pickNumber || idx} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-500 text-[10px] w-6 shrink-0">#{String(pick.pickNumber || (pickHistory.length - idx)).padStart(2, '0')}</span>
                    <TeamLogo teamId={pick.teamId} size="sm" />
                    <span className="font-bold text-white truncate flex-1">{pick.player}</span>
                    <span className="text-slate-500 capitalize shrink-0">{(pick.role || '').replace('wicketkeeper-', 'WK-')}</span>
                    {pick.isOverseas
                      ? <span className="text-emerald-400 text-[10px] font-bold shrink-0">OS</span>
                      : <span className="text-amber-400 text-[10px] font-bold shrink-0">IND</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-800 p-4">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wide rounded-xl transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * CloudDraftHistoryModal — Shows all completed drafts for the authenticated user.
 */
export default function CloudDraftHistoryModal({ isOpen, ownerId, onClose }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !ownerId) return;
    setIsLoading(true);
    setLoadError(null);

    getDraftHistory(ownerId)
      .then(result => {
        if (result.success) setHistory(result.history || []);
        else setLoadError(result.error || 'Failed to load draft history.');
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, ownerId]);

  const handleDelete = async (draftId) => {
    setIsDeleting(true);
    try {
      await discardDraft(ownerId, draftId);
      setHistory(prev => prev.filter(d => d.id !== draftId));
    } catch (err) {
      /* noop */
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {selectedRecord && (
        <HistoryDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(7, 11, 18, 0.92)', backdropFilter: 'blur(12px)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Draft History"
      >
        <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-900/95 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden animate-scaleUp">
          {/* Header */}
          <div className="border-b border-slate-800 p-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Draft History</h2>
                <p className="text-[10px] text-slate-400">Your completed IPL 2026 drafts</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <RefreshCcw className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading history…</span>
              </div>
            )}

            {!isLoading && loadError && (
              <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl text-center text-red-400 text-sm">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
                {loadError}
              </div>
            )}

            {!isLoading && !loadError && history.length === 0 && (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto text-3xl">🏏</div>
                <p className="text-slate-500 text-sm font-semibold">No completed drafts yet.</p>
                <p className="text-slate-600 text-xs">Finish a 24-pick draft to see it here.</p>
              </div>
            )}

            {!isLoading && history.map(record => {
              const completedAt = record.completed_at
                ? new Date(record.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
              const picks = record.pick_number || (record.game_state?.pickHistory?.length) || 0;
              const isDeletePending = deleteConfirmId === record.id;

              return (
                <div
                  key={record.id}
                  className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-600 rounded-2xl transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {record.winner === 'player1' || record.winner === 'player2'
                        ? <Medal className="w-4 h-4 text-amber-400 shrink-0" />
                        : <Users className="w-4 h-4 text-slate-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">
                          {record.player1_name} <span className="text-slate-500 font-normal">vs</span> {record.player2_name}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{completedAt}</span>
                          <span className="flex items-center gap-1"><Target className="w-3 h-3" />{picks} picks</span>
                          <span className="uppercase tracking-wider">Season {record.season}</span>
                        </p>
                      </div>
                    </div>
                    {record.player1_score != null && record.player2_score != null && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-sm font-black ${record.winner === 'player1' ? 'text-amber-400' : 'text-slate-400'}`}>{record.player1_score}</span>
                        <span className="text-slate-600 text-xs">–</span>
                        <span className={`text-sm font-black ${record.winner === 'player2' ? 'text-amber-400' : 'text-slate-400'}`}>{record.player2_score}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="flex-1 py-2 text-xs font-bold text-cyan-400 hover:text-white bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Result
                    </button>
                    {!isDeletePending ? (
                      <button
                        onClick={() => setDeleteConfirmId(record.id)}
                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                        title="Delete record"
                        aria-label="Delete draft record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 transition-all">Cancel</button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-[10px] font-black text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isDeleting ? '…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-slate-800 p-4">
            <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wide rounded-xl transition-all">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
