import Superwall from 'expo-superwall';
import { Platform } from 'react-native';

// Superwall API keys - replace with your actual keys from https://superwall.com/dashboard
const SUPERWALL_IOS_API_KEY = process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_IOS || '';
const SUPERWALL_ANDROID_API_KEY = process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_ANDROID || '';

let isConfigured = false;

export async function configureSuperwall(): Promise<void> {
  if (isConfigured) return;

  const apiKey = Platform.OS === 'ios' ? SUPERWALL_IOS_API_KEY : SUPERWALL_ANDROID_API_KEY;

  if (!apiKey) {
    console.log('[Superwall] No API key configured, skipping initialization');
    return;
  }

  try {
    await Superwall.configure(apiKey);
    isConfigured = true;
    console.log('[Superwall] Configured successfully');
  } catch (error) {
    console.error('[Superwall] Configuration error:', error);
  }
}

export async function showPaywall(placement: string = 'default'): Promise<boolean> {
  if (!isConfigured) {
    console.log('[Superwall] Not configured, cannot show paywall');
    return false;
  }

  try {
    const result = await Superwall.register(placement);
    console.log('[Superwall] Paywall result:', result);
    return result.status === 'purchased' || result.status === 'restored';
  } catch (error) {
    console.error('[Superwall] Error showing paywall:', error);
    return false;
  }
}

export async function identifyUser(userId: string): Promise<void> {
  if (!isConfigured) return;

  try {
    await Superwall.identify(userId);
    console.log('[Superwall] User identified:', userId);
  } catch (error) {
    console.error('[Superwall] Error identifying user:', error);
  }
}

export async function setUserAttributes(attributes: Record<string, any>): Promise<void> {
  if (!isConfigured) return;

  try {
    await Superwall.setUserAttributes(attributes);
    console.log('[Superwall] User attributes set:', attributes);
  } catch (error) {
    console.error('[Superwall] Error setting user attributes:', error);
  }
}

export async function resetUser(): Promise<void> {
  if (!isConfigured) return;

  try {
    await Superwall.reset();
    console.log('[Superwall] User reset');
  } catch (error) {
    console.error('[Superwall] Error resetting user:', error);
  }
}

export { Superwall };
