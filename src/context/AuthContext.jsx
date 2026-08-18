import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';
import { fetchProfile } from '../services/profileService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Helper to load user profile
  const refreshProfile = async (targetUserId) => {
    const uId = targetUserId || user?.id;
    if (!uId) return;
    const res = await fetchProfile(uId);
    if (res.success && res.profile) {
      setProfile(res.profile);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session: initialSession }, error } = await supabase.auth.getSession();
          if (mounted) {
            if (error) setAuthError(error.message);
            setSession(initialSession);
            setUser(initialSession?.user || null);
            if (initialSession?.user) {
              fetchProfile(initialSession.user.id).then(r => {
                if (mounted && r.success) setProfile(r.profile);
              });
            }
          }
        } catch (err) {
          if (mounted) setAuthError(err.message);
        }

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession?.user || null);
            if (currentSession?.user) {
              fetchProfile(currentSession.user.id).then(r => {
                if (mounted && r.success) setProfile(r.profile);
              });
            } else {
              setProfile(null);
            }
            setLoading(false);
          }
        });

        if (mounted) setLoading(false);

        return () => {
          subscription?.unsubscribe();
        };
      } else {
        // Unconfigured Supabase environment
        if (mounted) setLoading(false);
      }
    }

    initSession();

    return () => {
      mounted = false;
    };
  }, []);

  // Login with email & password
  const login = async ({ email, password }) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured in .env. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      setUser(data.user);
      setSession(data.session);
      return { success: true, user: data.user };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Sign up with email & password
  const signUp = async ({ email, password }) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured in .env. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true, user: data.user, requiresVerification: !data.session };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Google OAuth Login
  const loginWithGoogle = async () => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase Google OAuth requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        },
      });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Reset Password for email
  const resetPassword = async (email) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured in .env. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : '',
      });
      if (error) {
        setAuthError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Logout
  const logout = async () => {
    setAuthError(null);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('SignOut error:', err.message);
      }
    }
    setUser(null);
    setSession(null);
    setIsDemoMode(false);
  };

  // Enable local demo mode (for local testing when Supabase keys are not set)
  const loginAsDemoUser = () => {
    const mockDemoUser = {
      id: 'demo-user-local',
      email: 'arena-champion@ipldraft.local',
      user_metadata: { full_name: 'Draft Arena Champion' },
    };
    setUser(mockDemoUser);
    setIsDemoMode(true);
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
