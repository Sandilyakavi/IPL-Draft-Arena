import React, { useState } from 'react';
import {
  CloudDownload, Trash2, Plus, Clock, Users, Target,
  RefreshCcw, AlertTriangle, X, Calendar
} from 'lucide-react';
import TeamLogo from '../common/TeamLogo';

/**
 * ResumeDraftModal — Shown when authenticated user has an active unfinished cloud draft.
 * Offers RESUME / START NEW DRAFT / DISCARD options.
 */
export default function ResumeDraftModal({ isOpen, draft, onResume, onStartNew, onDiscard, onClose }) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  if (!isOpen || !draft) return null;

  const gs = draft.game_state || {};
  const pickNumber = draft.pick_number ?? gs.pickNumber ?? 0;
  const totalPicks = 24;
  const progress = Math.round((pickNumber / totalPicks) * 100);
  const p1Name = draft.player1_name || 'Player 1';
  const p2Name = draft.player2_name || 'Player 2';
  const p1Avatar = draft.player1_avatar || '🏏';
  const p2Avatar = draft.player2_avatar || '⚡';
  const updatedAt = draft.updated_at ? new Date(draft.updated_at) : null;

  const timeAgo = (date) => {
    if (!date) return 'Unknown time';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await onResume(draft);
    } finally {
      setIsResuming(false);
    }
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    onDiscard(draft);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7, 11, 18, 0.92)', backdropFilter: 'blur(12px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Resume Draft"
    >
      <div className="w-full max-w-md bg-slate-900/95 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/50 overflow-hidden animate-scaleUp">

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-indigo-950/80 border-b border-cyan-500/20 p-6 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
            <CloudDownload className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">RESUME YOUR DRAFT?</h2>
          <p className="text-xs text-slate-400 mt-1">An unfinished draft was found in the cloud.</p>
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Draft Summary */}
        <div className="p-6 space-y-4">
          {/* Players */}
          <div className="flex items-center justify-center gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
            <div className="text-center">
              <div className="text-2xl mb-1">{p1Avatar}</div>
              <div className="text-sm font-black text-white">{p1Name}</div>
            </div>
            <div className="text-slate-600 font-black text-lg">VS</div>
            <div className="text-center">
              <div className="text-2xl mb-1">{p2Avatar}</div>
              <div className="text-sm font-black text-white">{p2Name}</div>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Target className="w-3 h-3 text-cyan-400" />
                Pick Progress
              </span>
              <span className="font-mono font-black text-cyan-400">{pickNumber} / {totalPicks}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Last updated {timeAgo(updatedAt)}</span>
            <span className="ml-auto px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold uppercase text-[10px] tracking-wider">
              {draft.status || 'drafting'}
            </span>
          </div>

          {/* Actions */}
          {!showDiscardConfirm ? (
            <div className="space-y-3 pt-2">
              <button
                id="resume-draft-btn"
                onClick={handleResume}
                disabled={isResuming}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-cyan-500/30 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isResuming ? (
                  <><RefreshCcw className="w-4 h-4 animate-spin" /> Resuming…</>
                ) : (
                  <><CloudDownload className="w-4 h-4" /> Resume Draft</>
                )}
              </button>
              <button
                id="start-new-draft-btn"
                onClick={onStartNew}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4" /> Start New Draft
              </button>
              <button
                onClick={() => setShowDiscardConfirm(true)}
                className="w-full py-2.5 text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Discard Existing Draft
              </button>
            </div>
          ) : (
            /* Discard Confirmation */
            <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl space-y-3">
              <div className="flex items-start gap-2 text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <p className="text-xs leading-relaxed">
                  <strong>DISCARD ACTIVE DRAFT?</strong><br />
                  This will permanently remove your unfinished draft. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  id="confirm-discard-btn"
                  onClick={handleDiscard}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition-all active:scale-95"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
