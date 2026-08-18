import React, { useState, useEffect, useRef } from 'react';
import AvatarPicker from '../setup/AvatarPicker';
import FavoriteTeamSelector from '../setup/FavoriteTeamSelector';
import TeamLogo from '../common/TeamLogo';
import { updateProfile, checkUsernameAvailable, ALLOWED_AVATARS } from '../../services/profileService';
import { User, Trophy, Award, Target, Flame, X, Edit3, Check, AlertCircle, Save, Loader2 } from 'lucide-react';

/**
 * ProfileModal Component — User profile viewer and editor with live statistics.
 * Phase 7A: Production-hardened profile editing, inline validation, uniqueness checks.
 */
export default function ProfileModal({ isOpen, onClose, profile, onProfileUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('🏏');
  const [favoriteTeam, setFavoriteTeam] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const submitGuardRef = useRef(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setAvatar(profile.avatar || '🏏');
      setFavoriteTeam(profile.favorite_team || null);
    }
    setIsEditing(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUsernameError(null);
  }, [profile, isOpen]);

  if (!isOpen || !profile) return null;

  // Calculate career statistics safely
  const gamesPlayed = Math.max(0, profile.games_played || 0);
  const wins = Math.max(0, profile.wins || 0);
  const losses = Math.max(0, profile.losses || 0);
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';
  const bestScore = Math.min(100, Math.max(0, profile.best_score || 0));
  const avgScore = gamesPlayed > 0 ? Math.min(100, (profile.total_score / gamesPlayed)).toFixed(1) : '0.0';

  // Handle live username change and inline format validation
  const handleUsernameChange = (val) => {
    const raw = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(raw);
    setErrorMsg(null);

    if (raw && raw.length < 3) {
      setUsernameError('Username must be at least 3 characters.');
    } else {
      setUsernameError(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving || submitGuardRef.current) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setUsernameError(null);

    const cleanedName = displayName.trim();
    const cleanedUser = username.trim().toLowerCase();

    if (!cleanedName) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }

    if (!cleanedUser || cleanedUser.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanedUser)) {
      setErrorMsg('Username may only contain letters, numbers, and underscores.');
      return;
    }

    submitGuardRef.current = true;
    setIsSaving(true);
    setIsCheckingUsername(true);

    try {
      // 1. Check username availability if changed
      if (cleanedUser !== (profile.username || '').toLowerCase()) {
        const avail = await checkUsernameAvailable(cleanedUser, profile.id);
        if (!avail.available) {
          setErrorMsg(avail.reason || 'Username is already taken.');
          setIsSaving(false);
          setIsCheckingUsername(false);
          submitGuardRef.current = false;
          return;
        }
      }
      setIsCheckingUsername(false);

      // 2. Perform profile update
      const res = await updateProfile(profile.id, {
        display_name: cleanedName,
        username: cleanedUser,
        avatar,
        favorite_team: favoriteTeam,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update profile.');
      } else {
        setSuccessMsg('Profile updated successfully!');
        if (onProfileUpdated) onProfileUpdated(res.profile);
        setTimeout(() => {
          setIsEditing(false);
          setSuccessMsg(null);
        }, 1200);
      }
    } catch (err) {
      setErrorMsg('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
      setIsCheckingUsername(false);
      submitGuardRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative animate-scaleUp max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition-colors p-1"
          aria-label="Close Profile"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border-2 border-cyan-400 flex items-center justify-center text-3xl shrink-0 shadow-lg shadow-cyan-500/10">
            {avatar}
          </div>

          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white truncate">{profile.display_name}</h2>
              {favoriteTeam && <TeamLogo teamId={favoriteTeam} size="xs" />}
            </div>
            <p className="text-xs font-mono text-cyan-400 font-bold">@{profile.username}</p>
            <span className="text-[10px] text-slate-500 font-medium">IPL Draft Arena Manager</span>
          </div>

          {!isEditing && (
            <button
              type="button"
              id="edit-profile-btn"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold rounded-xl border border-cyan-500/30 flex items-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>

        {/* Feedback Banners */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2" role="status">
            <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── EDIT FORM MODE ────────────────────────────────────────── */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 text-left">
            {/* Display Name */}
            <div className="space-y-1">
              <label htmlFor="edit-display-name" className="text-[11px] font-extrabold uppercase text-slate-400 block">
                Display Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="edit-display-name"
                type="text"
                required
                maxLength={30}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label htmlFor="edit-username" className="text-[11px] font-extrabold uppercase text-slate-400 flex items-center justify-between">
                <span>Username <span className="text-rose-400">*</span></span>
                {usernameError && <span className="text-rose-400 text-[10px] normal-case font-normal">{usernameError}</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500 font-mono text-xs">@</span>
                <input
                  id="edit-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  value={username}
                  onChange={e => handleUsernameChange(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl pl-7 pr-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none ${
                    usernameError ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500">Min 3 characters. Letters, numbers, and underscores only.</p>
            </div>

            {/* Avatar Picker */}
            <AvatarPicker
              selectedAvatar={avatar}
              onSelectAvatar={setAvatar}
              label="Choose Avatar"
            />

            {/* Favorite Franchise Selector */}
            <FavoriteTeamSelector
              selectedTeamId={favoriteTeam}
              onSelectTeam={setFavoriteTeam}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsEditing(false); setErrorMsg(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-profile-btn"
                disabled={isSaving || !displayName.trim() || username.length < 3}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {isCheckingUsername ? 'Checking...' : 'Saving...'}</>
                ) : (
                  <><Save className="w-3.5 h-3.5" /> Save Profile</>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ── STATISTICS DISPLAY MODE ─────────────────────────────── */
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-cyan-400" /> Career Draft Statistics
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Games Played</span>
                <span className="text-xl font-black text-white font-mono">{gamesPlayed}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Wins / Losses</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {wins} <span className="text-slate-600 text-sm font-normal">/ {losses}</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Win Rate</span>
                <span className="text-xl font-black text-cyan-400 font-mono">{winRate}%</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Best Squad Score</span>
                <span className="text-xl font-black text-amber-400 font-mono">{bestScore} <span className="text-slate-600 text-xs">/ 100</span></span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Average Squad Score</span>
                <span className="text-xl font-black text-indigo-300 font-mono">{avgScore} <span className="text-slate-600 text-xs">/ 100</span></span>
              </div>
            </div>

            {gamesPlayed === 0 && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center text-slate-500 text-xs italic">
                No completed draft games recorded yet. Play your first local draft match to populate live career statistics!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
