import { useEffect, useState, useCallback } from 'react';
import { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { getOfferings, purchasePackage, checkPremiumStatus, restorePurchases } from '@/lib/revenuecat';
import { updateSubscription } from '@/lib/api';
import { useAuth } from './useAuth';

interface SubscriptionState {
  isPremium: boolean;
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  error: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({ isPremium: false, packages: [], loading: true, purchasing: false, error: null });

  const loadSubscriptionData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [isPremium, packages] = await Promise.all([checkPremiumStatus(), getOfferings()]);
      setState({ isPremium, packages, loading: false, purchasing: false, error: null });
    } catch (error: any) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to load subscription data' }));
    }
  }, []);

  useEffect(() => { loadSubscriptionData(); }, [user, loadSubscriptionData]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    if (!user) throw new Error('Must be logged in to purchase');
    setState((prev) => ({ ...prev, purchasing: true, error: null }));
    try {
      const customerInfo = await purchasePackage(pkg);
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
      await updateSubscription(user.id, isPremium, customerInfo.entitlements.active['premium']?.expirationDate ?? undefined, customerInfo.originalAppUserId);
      setState((prev) => ({ ...prev, isPremium, purchasing: false }));
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
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
      await updateSubscription(user.id, isPremium, customerInfo.entitlements.active['premium']?.expirationDate ?? undefined, customerInfo.originalAppUserId);
      setState((prev) => ({ ...prev, isPremium, loading: false }));
      return customerInfo;
    } catch (error: any) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to restore purchases' }));
      throw error;
    }
  }, [user]);

  return { ...state, purchase, restore, refresh: loadSubscriptionData, monthlyPackage: state.packages.find((pkg) => pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY') };
}
