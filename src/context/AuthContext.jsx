import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';
import { fetchProfile } from '../services/profileService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);  // true until session is definitively resolved
  const [authError, setAuthError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Helper to load user profile — wrapped in useCallback to be stable reference
  const refreshProfile = useCallback(async (targetUserId) => {
    const uId = targetUserId || user?.id;
    if (!uId) return;
    const res = await fetchProfile(uId);
    if (res.success && res.profile) {
      setProfile(res.profile);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (!isSupabaseConfigured || !supabase) {
        // Supabase not configured — no auth available, clear loading immediately
        if (mounted) setLoading(false);
        return;
      }

      try {
        // 1. Restore existing session on page load / refresh
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setAuthError(error.message);
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          // Fetch profile in background — do NOT block loading on this
          fetchProfile(initialSession.user.id).then(r => {
            if (mounted && r.success) setProfile(r.profile);
          });
        }
      } catch (err) {
        if (mounted) setAuthError(err.message);
      } finally {
        // Always clear loading after session is resolved, regardless of profile fetch
        if (mounted) setLoading(false);
      }

      // 2. Subscribe to auth state changes (login, logout, token refresh, OAuth callback)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          // Ensure profile is cleared immediately on any sign-out variant
          setProfile(null);
          setIsDemoMode(false);
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (currentSession?.user) {
            fetchProfile(currentSession.user.id).then(r => {
              if (mounted && r.success) setProfile(r.profile);
            });
          }
        }

        // Ensure loading is cleared on any auth event
        setLoading(false);
      });

      return () => {
        subscription?.unsubscribe();
      };
    }

    const cleanupPromise = initSession();

    return () => {
      mounted = false;
      // Clean up subscription if the promise resolved a cleanup fn
      cleanupPromise?.then(cleanup => cleanup?.());
    };
  }, []);

  // ── Error message mapping ─────────────────────────────────────────────────
  function mapAuthError(raw) {
    if (!raw) return 'An unexpected error occurred. Please try again.';
    const msg = raw.toLowerCase();

    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password') || msg.includes('wrong password')) {
      return 'Incorrect email or password. Please check your credentials.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Please verify your email address before signing in. Check your inbox.';
    }
    if (msg.includes('user already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (msg.includes('password should be') || msg.includes('weak password') || msg.includes('password is too short')) {
      return 'Password is too weak. Use at least 8 characters including letters and numbers.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('email rate limit exceeded')) {
      return 'Too many attempts. Please wait a few minutes and try again.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('oauth') || msg.includes('provider') || msg.includes('access_denied') || msg.includes('popup closed')) {
      return 'Google sign-in was cancelled or failed. Please try again.';
    }
    if (msg.includes('session_not_found') || msg.includes('session expired') || msg.includes('jwt expired') || msg.includes('refresh token')) {
      return 'Your session has expired. Please sign in again.';
    }
    if (msg.includes('signup disabled') || msg.includes('signups not allowed')) {
      return 'New account registration is currently disabled. Please contact support.';
    }
    // Don't expose raw internal details; use a generic message
    return 'Something went wrong. Please try again.';
  }

  // ── Login with email & password ───────────────────────────────────────────
  const login = async ({ email, password }) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env' };
    }
    if (!email?.trim() || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const friendly = mapAuthError(error.message);
        setAuthError(friendly);
        return { success: false, error: friendly };
      }
      setUser(data.user);
      setSession(data.session);
      return { success: true, user: data.user };
    } catch (err) {
      const friendly = mapAuthError(err.message);
      setAuthError(friendly);
      return { success: false, error: friendly };
    }
  };

  // ── Sign up with email & password ─────────────────────────────────────────
  const signUp = async ({ email, password }) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env' };
    }
    if (!email?.trim()) return { success: false, error: 'Email address is required.' };
    if (!password || password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const friendly = mapAuthError(error.message);
        setAuthError(friendly);
        return { success: false, error: friendly };
      }
      return { success: true, user: data.user, requiresVerification: !data.session };
    } catch (err) {
      const friendly = mapAuthError(err.message);
      setAuthError(friendly);
      return { success: false, error: friendly };
    }
  };

  // ── Google OAuth Login ─────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase Google OAuth requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env' };
    }

    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) {
        const friendly = mapAuthError(error.message);
        setAuthError(friendly);
        return { success: false, error: friendly };
      }
      return { success: true, data };
    } catch (err) {
      const friendly = mapAuthError(err.message);
      setAuthError(friendly);
      return { success: false, error: friendly };
    }
  };

  // ── Reset Password ────────────────────────────────────────────────────────
  const resetPassword = async (email) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env' };
    }
    if (!email?.trim()) return { success: false, error: 'Email address is required.' };

    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}` : '';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) {
        const friendly = mapAuthError(error.message);
        setAuthError(friendly);
        return { success: false, error: friendly };
      }
      return { success: true };
    } catch (err) {
      const friendly = mapAuthError(err.message);
      setAuthError(friendly);
      return { success: false, error: friendly };
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    setAuthError(null);
    // Clear state immediately for instant UI update (prevents stale authenticated UI)
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsDemoMode(false);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        // State is already cleared — signOut failure is non-critical
        console.warn('SignOut error (state already cleared):', err.message);
      }
    }
  };

  // ── Demo Mode (offline local testing) ────────────────────────────────────
  const loginAsDemoUser = () => {
    const mockDemoUser = {
      id: 'demo-user-local',
      email: 'arena-champion@ipldraft.local',
      user_metadata: { full_name: 'Draft Arena Champion' },
    };
    setUser(mockDemoUser);
    setIsDemoMode(true);
    // fetchProfile returns mock data when Supabase unconfigured
    fetchProfile('demo-user-local').then(r => {
      if (r.success) setProfile(r.profile);
    });
    return { success: true, user: mockDemoUser };
  };

  const value = {
    user,
    session,
    profile,
    setProfile,
    refreshProfile,
    loading,
    authError,
    isConfigured: isSupabaseConfigured,
    isDemoMode,
    login,
    signUp,
    loginWithGoogle,
    resetPassword,
    logout,
    loginAsDemoUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
