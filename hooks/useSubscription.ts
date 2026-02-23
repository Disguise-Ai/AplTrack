import { useEffect, useState, useCallback } from 'react';
import { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { getOfferings, purchasePackage, checkPremiumStatus, restorePurchases } from '@/lib/revenuecat';
import { updateSubscription, getSubscription, startTrial } from '@/lib/api';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

// Free tier limits
const FREE_TIER = {
  maxDataSources: 2,
  canAccessAttribution: false,
  canAccessAIChat: false,
  canAccessCommunity: false,
};

// Premium tier access
const PREMIUM_TIER = {
  maxDataSources: Infinity,
  canAccessAttribution: true,
  canAccessAIChat: true,
  canAccessCommunity: true,
};

interface SubscriptionState {
  isPremium: boolean;
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  error: string | null;
  expiresAt: string | null;
  // Trial info
  isTrial: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  // Feature access
  maxDataSources: number;
  canAccessAttribution: boolean;
  canAccessAIChat: boolean;
  canAccessCommunity: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    isPremium: false,
    packages: [],
    loading: true,
    purchasing: false,
    error: null,
    expiresAt: null,
    isTrial: false,
    trialStartedAt: null,
    trialEndsAt: null,
    ...FREE_TIER,
  });

  const loadSubscriptionData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Check database subscription status first
      let isPremiumFromDB = false;
      let expiresAt: string | null = null;
      let isTrial = false;
      let trialStartedAt: string | null = null;
      let trialEndsAt: string | null = null;

      if (user) {
        try {
          const subscription = await getSubscription(user.id);

          // Check if trial has expired
          const trialExpired = subscription.is_trial &&
            subscription.trial_ends_at &&
            new Date(subscription.trial_ends_at) < new Date();

          isPremiumFromDB = subscription.is_premium && !trialExpired &&
            (!subscription.expires_at || new Date(subscription.expires_at) > new Date());
          expiresAt = subscription.expires_at || null;
          isTrial = subscription.is_trial && !trialExpired || false;
          trialStartedAt = subscription.trial_started_at || null;
          trialEndsAt = subscription.trial_ends_at || null;
        } catch (e) {
          console.log('No subscription found in DB');
        }
      }

      // Also check RevenueCat
      const [isPremiumRC, packages] = await Promise.all([
        checkPremiumStatus(),
        getOfferings(),
      ]);

      // User is premium if either source says so
      const isPremium = isPremiumFromDB || isPremiumRC;
      const tierAccess = isPremium ? PREMIUM_TIER : FREE_TIER;

      setState({
        isPremium,
        packages,
        loading: false,
        purchasing: false,
        error: null,
        expiresAt,
        isTrial,
        trialStartedAt,
        trialEndsAt,
        ...tierAccess,
      });
    } catch (error: any) {
      console.log('Subscription data not available:', error.message);
      setState({
        isPremium: false,
        packages: [],
        loading: false,
        purchasing: false,
        error: null,
        expiresAt: null,
        isTrial: false,
        trialStartedAt: null,
        trialEndsAt: null,
        ...FREE_TIER,
      });
    }
  }, [user]);

  useEffect(() => {
    loadSubscriptionData();
  }, [user, loadSubscriptionData]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('subscription_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadSubscriptionData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, loadSubscriptionData]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    if (!user) throw new Error('Must be logged in to purchase');
    setState((prev) => ({ ...prev, purchasing: true, error: null }));
    try {
      const customerInfo = await purchasePackage(pkg);
      if (!customerInfo) {
        throw new Error('Purchase was not completed');
      }
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
      await updateSubscription(
        user.id,
        isPremium,
        customerInfo.entitlements.active['premium']?.expirationDate ?? undefined,
        customerInfo.originalAppUserId
      );
      const tierAccess = isPremium ? PREMIUM_TIER : FREE_TIER;
      setState((prev) => ({ ...prev, isPremium, purchasing: false, ...tierAccess }));
      return customerInfo;
    } catch (error: any) {
      setState((prev) => ({ ...prev, purchasing: false, error: error.message || 'Purchase failed' }));
      throw error;
    }
  }, [user]);

  const restore = useCallback(async () => {
    if (!user) throw new Error('Must be logged in to restore purchases');
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const customerInfo = await restorePurchases();
      if (!customerInfo) {
        setState((prev) => ({ ...prev, loading: false }));
        return null;
      }
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
      await updateSubscription(
        user.id,
        isPremium,
        customerInfo.entitlements.active['premium']?.expirationDate ?? undefined,
        customerInfo.originalAppUserId
      );
      const tierAccess = isPremium ? PREMIUM_TIER : FREE_TIER;
      setState((prev) => ({ ...prev, isPremium, loading: false, ...tierAccess }));
      return customerInfo;
    } catch (error: any) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to restore purchases' }));
      throw error;
    }
  }, [user]);

  // Helper to check if user can add more data sources
  const canAddDataSource = useCallback((currentCount: number): boolean => {
    return currentCount < state.maxDataSources;
  }, [state.maxDataSources]);

  // Helper to check feature access
  const checkFeatureAccess = useCallback((feature: 'attribution' | 'aiChat' | 'community'): boolean => {
    switch (feature) {
      case 'attribution':
        return state.canAccessAttribution;
      case 'aiChat':
        return state.canAccessAIChat;
      case 'community':
        return state.canAccessCommunity;
      default:
        return false;
    }
  }, [state]);

  const beginTrial = useCallback(async () => {
    if (!user) throw new Error('Must be logged in to start trial');
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await startTrial(user.id);
      await loadSubscriptionData();
    } catch (error: any) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to start trial' }));
      throw error;
    }
  }, [user, loadSubscriptionData]);

  return {
    ...state,
    purchase,
    restore,
    refresh: loadSubscriptionData,
    canAddDataSource,
    checkFeatureAccess,
    beginTrial,
    monthlyPackage: state.packages.find((pkg) =>
      pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY'
    ),
  };
}
