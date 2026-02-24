import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { getProfile, updateProfile } from '@/lib/api';
import { initializeRevenueCat, logInRevenueCat, logOutRevenueCat } from '@/lib/revenuecat';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
}

// Helper to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ session: null, user: null, profile: null, loading: true, initialized: false });

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Add timeout for Mac Catalyst which can sometimes hang
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 5000);

        // Handle invalid refresh token error - clear session and start fresh
        if (error) {
          console.log('Auth session error:', error.message);
          if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid')) {
            console.log('Clearing invalid session...');
            await supabase.auth.signOut();
            setState({ session: null, user: null, profile: null, loading: false, initialized: true });
            return;
          }
        }

        let profile: Profile | null = null;
        if (session?.user) {
          try {
            profile = await withTimeout(getProfile(session.user.id), 5000);
          } catch (error) {
            console.log('Profile not found or timeout, will create on onboarding');
          }
          // Don't wait for RevenueCat - do it in background (skip on macOS)
          if (Platform.OS !== 'macos') {
            initializeRevenueCat(session.user.id).then(() => logInRevenueCat(session.user.id)).catch(() => {});
          }
        }
        setState({ session, user: session?.user ?? null, profile, loading: false, initialized: true });
      } catch (error: any) {
        console.log('Auth init error (possibly timeout):', error);
        // Handle refresh token errors
        if (error?.message?.includes('Refresh Token') || error?.message?.includes('Invalid')) {
          console.log('Clearing invalid session due to refresh token error...');
          try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
        }
        // On error/timeout, still mark as initialized so user can proceed
        setState({ session: null, user: null, profile: null, loading: false, initialized: true });
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, clearing session');
        setState({ session: null, user: null, profile: null, loading: false, initialized: true });
        return;
      }

      let profile: Profile | null = null;
      if (session?.user) {
        try { profile = await getProfile(session.user.id); } catch (error) { console.log('Profile not found'); }
        // Don't wait for RevenueCat
        initializeRevenueCat(session.user.id).then(() => logInRevenueCat(session.user.id)).catch(() => {});
      }
      setState((prev) => ({ ...prev, session, user: session?.user ?? null, profile, loading: false, initialized: true }));
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // No redirect - user confirms in browser, then comes back to app
      },
    });
    setState((prev) => ({ ...prev, loading: false }));
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setState((prev) => ({ ...prev, loading: false })); throw error; }
    return data;
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try { await logOutRevenueCat(); } catch (error) { console.error('Error logging out of RevenueCat:', error); }
    const { error } = await supabase.auth.signOut();
    if (error) { setState((prev) => ({ ...prev, loading: false })); throw error; }
    setState({ session: null, user: null, profile: null, loading: false, initialized: true });
  }, []);

  const refreshProfile = useCallback(async () => {
    let userId = state.user?.id;

    if (!userId) {
      // State might not be synced yet, check session directly
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    if (!userId) return;

    try {
      const profile = await getProfile(userId);
      setState((prev) => ({ ...prev, profile }));
    } catch (error) { console.error('Error refreshing profile:', error); }
  }, [state.user]);

  const updateUserProfile = useCallback(async (updates: Partial<Profile>) => {
    // Try state.user first, then check current session directly
    let userId = state.user?.id;

    if (!userId) {
      // State might not be synced yet, check session directly
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    if (!userId) {
      throw new Error('No user logged in');
    }

    const profile = await updateProfile(userId, updates);
    setState((prev) => ({ ...prev, profile }));
    return profile;
  }, [state.user]);

  // User needs onboarding if:
  // 1. They have a session but no profile, OR
  // 2. They have a profile but onboarding is not completed
  const needsOnboarding = !!state.session && (!state.profile || !state.profile.onboarding_completed);

  return { ...state, signUp, signIn, signOut, refreshProfile, updateProfile: updateUserProfile, isAuthenticated: !!state.session, needsOnboarding };
}
