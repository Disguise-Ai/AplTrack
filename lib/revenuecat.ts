import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { Config } from '@/constants/Config';
import Constants from 'expo-constants';

let isConfigured = false;
let isDisabled = false;

// Disable RevenueCat until products are configured in dashboard
const REVENUECAT_ENABLED = false;

export async function initializeRevenueCat(userId?: string): Promise<void> {
  if (!REVENUECAT_ENABLED || isConfigured || isDisabled) return;

  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    isDisabled = true;
    return;
  }

  const apiKey = Platform.select({ ios: Config.REVENUECAT_API_KEY_IOS, android: Config.REVENUECAT_API_KEY_ANDROID, default: Config.REVENUECAT_API_KEY_IOS });

  if (!apiKey || apiKey === 'your_revenuecat_ios_api_key') {
    isDisabled = true;
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    await Purchases.configure({ apiKey, appUserID: userId });
    isConfigured = true;
  } catch (error) {
    isDisabled = true;
  }
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch (error) {
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) throw new Error('Purchase cancelled');
    throw error;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    return null;
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return false;
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return false;
    return customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    return false;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    return null;
  }
}

export async function logInRevenueCat(userId: string): Promise<void> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return;
  try {
    await Purchases.logIn(userId);
  } catch (error) {}
}

export async function logOutRevenueCat(): Promise<void> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) return;
  try {
    await Purchases.logOut();
  } catch (error) {}
}
