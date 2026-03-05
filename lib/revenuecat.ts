import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { Config } from '@/constants/Config';
import Constants from 'expo-constants';

let isConfigured = false;
let isDisabled = false;
let initializationPromise: Promise<void> | null = null;

// Check if RevenueCat is ready to use
export function isRevenueCatReady(): boolean {
  return isConfigured && !isDisabled;
}

// Wait for RevenueCat to be ready
export async function waitForRevenueCat(): Promise<boolean> {
  if (initializationPromise) {
    await initializationPromise;
  }
  return isConfigured && !isDisabled;
}

// Enable RevenueCat for subscription purchases
const REVENUECAT_ENABLED = true;

export async function initializeRevenueCat(userId?: string): Promise<void> {
  if (!REVENUECAT_ENABLED || isConfigured || isDisabled) {
    return;
  }

  // If already initializing, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }

  const doInit = async () => {
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
      // Use ERROR level to suppress verbose warnings about offerings/products
      Purchases.setLogLevel(LOG_LEVEL.ERROR);

      await Purchases.configure({ apiKey, appUserID: userId });
      isConfigured = true;
    } catch (error: any) {
      isDisabled = true;
    }
  };

  initializationPromise = doInit();
  return initializationPromise;
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (!REVENUECAT_ENABLED || isDisabled || !isConfigured) {
    return [];
  }
  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current?.availablePackages?.length) {
      return [];
    }
    return offerings.current.availablePackages;
  } catch (error: any) {
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (!REVENUECAT_ENABLED) {
    throw new Error('In-app purchases are not enabled');
  }

  if (isDisabled) {
    throw new Error('In-app purchases are not available in this environment');
  }

  if (!isConfigured) {
    throw new Error('Payment system is not ready. Please try again.');
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) throw new Error('Purchase cancelled');
    throw error;
  }
}

// Purchase directly using StoreKit product ID (fallback when offerings don't load)
export async function purchaseProduct(productId: string): Promise<CustomerInfo> {
  if (!REVENUECAT_ENABLED) {
    throw new Error('Purchases are temporarily unavailable. Please try again later.');
  }

  if (isDisabled) {
    throw new Error('Purchases are not available on this device. Please use a real device.');
  }

  // Ensure RevenueCat is initialized
  if (!isConfigured) {
    await initializeRevenueCat();
    // Wait a moment for configuration to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!isConfigured) {
    throw new Error('Unable to connect to the App Store. Please check your internet connection and try again.');
  }

  try {
    // Get the StoreProduct - retry once if empty
    let products = await Purchases.getProducts([productId]);

    // If no products found, wait and retry once
    if (products.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      products = await Purchases.getProducts([productId]);
    }

    if (products.length === 0) {
      throw new Error('Unable to load subscription. Please check your internet connection and try again.');
    }

    const { customerInfo } = await Purchases.purchaseStoreProduct(products[0]);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) throw new Error('Purchase cancelled');
    // Provide clearer error messages
    if (error.message?.includes('network') || error.message?.includes('Network')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
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
