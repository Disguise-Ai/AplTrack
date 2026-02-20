import { useEffect, useState, useCallback } from 'react';
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

export function useAuth() {
  const [state, setState] = useState<AuthState>({ session: null, user: null, profile: null, loading: true, initialized: false });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let profile: Profile | null = null;
      if (session?.user) {
        try { profile = await getProfile(session.user.id); } catch (error) { console.log('Profile not found, will create on onboarding'); }
        try { await initializeRevenueCat(session.user.id); await logInRevenueCat(session.user.id); } catch (error) { console.log('RevenueCat init skipped'); }
      }
      setState({ session, user: session?.user ?? null, profile, loading: false, initialized: true });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      let profile: Profile | null = null;
      if (session?.user) {
        try { profile = await getProfile(session.user.id); } catch (error) { console.log('Profile not found'); }
        try { await initializeRevenueCat(session.user.id); await logInRevenueCat(session.user.id); } catch (error) { console.log('RevenueCat skipped'); }
      }
      setState((prev) => ({ ...prev, session, user: session?.user ?? null, profile, loading: false }));
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
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
    if (!state.user) return;
    try {
      const profile = await getProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));
    } catch (error) { console.error('Error refreshing profile:', error); }
  }, [state.user]);

  const updateUserProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!state.user) throw new Error('No user logged in');
    const profile = await updateProfile(state.user.id, updates);
    setState((prev) => ({ ...prev, profile }));
    return profile;
  }, [state.user]);

  return { ...state, signUp, signIn, signOut, refreshProfile, updateProfile: updateUserProfile, isAuthenticated: !!state.session, needsOnboarding: state.profile && !state.profile.onboarding_completed };
}
