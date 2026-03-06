// Superwall configuration and helper functions
import { Platform } from 'react-native';
import Superwall from '@superwall/react-native-superwall';

// Superwall API keys
export const SUPERWALL_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_IOS || 'pk_3WvJjGPcKqXyDQ_EKDSQk',
  android: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_ANDROID || '',
};

let isConfigured = false;

// Get the API key for current platform
export function getSuperwallApiKey(): string {
  return Platform.OS === 'ios' ? SUPERWALL_API_KEYS.ios : SUPERWALL_API_KEYS.android;
}

// Check if Superwall is configured
export function isSuperwallConfigured(): boolean {
  return !!getSuperwallApiKey() && isConfigured;
}

// Configure Superwall SDK
export async function configureSuperwall(): Promise<void> {
  if (isConfigured) return;

  const apiKey = getSuperwallApiKey();
  if (!apiKey) {
    console.log('[Superwall] No API key configured');
    return;
  }

  try {
    // Use the static configure method with object parameter
    await Superwall.configure({ apiKey });
    isConfigured = true;
    console.log('[Superwall] Configured successfully');
  } catch (error) {
    console.log('[Superwall] Configuration error:', error);
  }
}

// Identify user for Superwall
export async function identifySuperwallUser(userId: string): Promise<void> {
  if (!isConfigured) await configureSuperwall();
  if (!isConfigured) return;

  try {
    // Use shared instance for identify
    await Superwall.shared.identify({ userId });
  } catch {
    // Silently handle
  }
}

// Show a paywall for a specific placement
export async function showPaywall(placement: string = 'campaign_trigger'): Promise<boolean> {
  if (!isConfigured) await configureSuperwall();
  if (!isConfigured) return false;

  try {
    // Register the placement - Superwall will show the paywall if configured
    // This returns a promise that resolves when the paywall is dismissed
    await Superwall.shared.register({ placement });
    return true;
  } catch (error) {
    console.log('[Superwall] Paywall error:', error);
    return false;
  }
}

// Reset Superwall user (on logout)
export async function resetSuperwallUser(): Promise<void> {
  if (!isConfigured) return;
  try {
    await Superwall.shared.reset();
  } catch {
    // Silently handle
  }
}
