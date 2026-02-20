import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Config } from '@/constants/Config';
import Constants from 'expo-constants';

let isConfigured = false;
let isExpoGo = Constants.appOwnership === 'expo';

export async function initializeRevenueCat(userId?: string): Promise<void> {
  if (isConfigured || isExpoGo) {
    if (isExpoGo) console.log('Expo Go app detected. Using RevenueCat in Browser Mode.');
    return;
  }
  const apiKey = Platform.select({ ios: Config.REVENUECAT_API_KEY_IOS, android: Config.REVENUECAT_API_KEY_ANDROID, default: Config.REVENUECAT_API_KEY_IOS });
  try {
    await Purchases.configure({ apiKey, appUserID: userId });
    isConfigured = true;
  } catch (error) {
    console.log('RevenueCat not available (Expo Go mode):', error);
    isExpoGo = true;
  }
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  if (isExpoGo || !isConfigured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  if (isExpoGo || !isConfigured) {
    console.log('Purchases not available in Expo Go');
    return null;
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) throw new Error('Purchase cancelled');
    throw error;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (isExpoGo || !isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.log('Could not get customer info:', error);
    return null;
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (isExpoGo || !isConfigured) return false;
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return false;
    return customerInfo.entitlements.active[Config.PREMIUM_ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    return false;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (isExpoGo || !isConfigured) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.log('Could not restore purchases:', error);
    return null;
  }
}

export async function logInRevenueCat(userId: string): Promise<void> {
  if (isExpoGo || !isConfigured) return;
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.log('Could not log in to RevenueCat:', error);
  }
}

export async function logOutRevenueCat(): Promise<void> {
  if (isExpoGo || !isConfigured) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    console.log('Could not log out of RevenueCat:', error);
  }
}
