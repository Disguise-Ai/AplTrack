import { useEffect, useState, useCallback } from 'react';
import { PurchasesPackage } from 'react-native-purchases';
import { getOfferings, purchasePackage, purchaseProduct, checkPremiumStatus, restorePurchases, initializeRevenueCat, logInRevenueCat } from '@/lib/revenuecat';
import { getSubscription, startTrial, updateSubscription } from '@/lib/api';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';
import { Config } from '@/constants/Config';

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
  isTrial: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
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
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      let isPremiumFromDB = false;
      let expiresAt: string | null = null;
      let isTrial = false;
      let trialStartedAt: string | null = null;
      let trialEndsAt: string | null = null;

      // Check database subscription status
      if (user) {
        try {
          const subscription = await getSubscription(user.id);
          const trialExpired = subscription.is_trial &&
            subscription.trial_ends_at &&
            new Date(subscription.trial_ends_at) < new Date();

          isPremiumFromDB = subscription.is_premium && !trialExpired &&
            (!subscription.expires_at || new Date(subscription.expires_at) > new Date());
          expiresAt = subscription.expires_at || null;
          isTrial = !!(subscription.is_trial && !trialExpired);
          trialStartedAt = subscription.trial_started_at || null;
          trialEndsAt = subscription.trial_ends_at || null;
        } catch (e) {
          console.log('No subscription found in DB');
        }
      }

      // Ensure RevenueCat is initialized before fetching offerings
      if (user) {
        try {
          await initializeRevenueCat(user.id);
          await logInRevenueCat(user.id);
        } catch (e) {
          // Silently handle - expected during development
        }
      }

      // Check RevenueCat for subscription status
      let isPremiumRC = false;
      let packages: PurchasesPackage[] = [];
      try {
        [isPremiumRC, packages] = await Promise.all([
          checkPremiumStatus(),
          getOfferings(),
        ]);
      } catch (e) {
        // Silently handle - expected during development
      }

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
    } catch {
      // Silently handle - subscription data not available (expected during development)
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
    if (user) {
      loadSubscriptionData();
    }
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

  // Purchase via RevenueCat (real Apple payment)
  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    if (!user) throw new Error('Must be logged in to purchase');
    setState(prev => ({ ...prev, purchasing: true, error: null }));
    try {
      // This triggers the Apple payment sheet
      const customerInfo = await purchasePackage(pkg);

      const isPremium = customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID] !== undefined;

      // Update database with purchase info
      await updateSubscription(
        user.id,
        isPremium,
        customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID]?.expirationDate ?? undefined,
        customerInfo.originalAppUserId
      );

      const tierAccess = isPremium ? PREMIUM_TIER : FREE_TIER;
      setState(prev => ({ ...prev, isPremium, purchasing: false, ...tierAccess }));
      return customerInfo;
    } catch (error: any) {
      setState(prev => ({ ...prev, purchasing: false, error: error.message || 'Purchase failed' }));
      throw error;
    }
  }, [user]);

  // Subscribe function - uses RevenueCat for real Apple payment
  const subscribe = useCallback(async () => {
    if (!user) throw new Error('Please sign in to subscribe');

    setState(prev => ({ ...prev, purchasing: true, error: null }));

    try {
      // Ensure RevenueCat is initialized
      await initializeRevenueCat(user.id);
      await logInRevenueCat(user.id);

      // Find the monthly package from current state
      let monthlyPkg = state.packages.find(pkg =>
        pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY'
      );

      // If no packages loaded yet, try to fetch them now
      if (!monthlyPkg) {
        const freshPackages = await getOfferings();

        monthlyPkg = freshPackages.find(pkg =>
          pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY'
        );

        // Update state with fresh packages
        if (freshPackages.length > 0) {
          setState(prev => ({ ...prev, packages: freshPackages }));
        }
      }

      let customerInfo;

      if (monthlyPkg) {
        // Use RevenueCat package purchase - this triggers the native payment sheet
        customerInfo = await purchasePackage(monthlyPkg);
      } else {
        // Fallback: purchase directly using product ID
        customerInfo = await purchaseProduct(Config.PREMIUM_MONTHLY_PRODUCT_ID);
      }

      // Purchase successful - update state and database
      const isPremium = customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID] !== undefined;

      await updateSubscription(
        user.id,
        isPremium,
        customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID]?.expirationDate ?? undefined,
        customerInfo.originalAppUserId
      );

      const tierAccess = isPremium ? PREMIUM_TIER : FREE_TIER;
      setState(prev => ({ ...prev, isPremium, purchasing: false, ...tierAccess }));
      return customerInfo;

    } catch (error: any) {
      setState(prev => ({ ...prev, purchasing: false, error: error.message || 'Purchase failed' }));
      throw error;
    }
  }, [user, state.packages]);

  // Restore purchases via RevenueCat
  const restore = useCallback(async () => {
    if (!user) throw new Error('Must be logged in to restore purchases');
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo) {
        const isPremium = customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID] !== undefined;
        if (isPremium) {
          await updateSubscription(
            user.id,
            isPremium,
            customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID]?.expirationDate ?? undefined,
            customerInfo.originalAppUserId
          );
        }
        const tierAccess = isPremium ? PREMIUM_TIER : FREE_TIER;
        setState(prev => ({ ...prev, isPremium, loading: false, ...tierAccess }));
        return customerInfo;
      }
      setState(prev => ({ ...prev, loading: false }));
      return null;
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message || 'Failed to restore purchases' }));
      throw error;
    }
  }, [user]);

  const canAddDataSource = useCallback((currentCount: number): boolean => {
    return currentCount < state.maxDataSources;
  }, [state.maxDataSources]);

  const checkFeatureAccess = useCallback((feature: 'attribution' | 'aiChat' | 'community'): boolean => {
    switch (feature) {
      case 'attribution': return state.canAccessAttribution;
      case 'aiChat': return state.canAccessAIChat;
      case 'community': return state.canAccessCommunity;
      default: return false;
    }
  }, [state]);

  const beginTrial = useCallback(async () => {
    if (!user) throw new Error('Must be logged in to start trial');
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await startTrial(user.id);
      await loadSubscriptionData();
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message || 'Failed to start trial' }));
      throw error;
    }
  }, [user, loadSubscriptionData]);

  return {
    ...state,
    purchase,
    subscribe,
    restore,
    refresh: loadSubscriptionData,
    canAddDataSource,
    checkFeatureAccess,
    beginTrial,
    monthlyPackage: state.packages.find(pkg =>
      pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY'
    ),
  };
}
