// Superwall configuration - the actual SDK is used via SuperwallProvider and useSuperwall hook
// This file just exports the API keys for use in SuperwallProvider

import { Platform } from 'react-native';

// Superwall API keys
export const SUPERWALL_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_IOS || '',
  android: process.env.EXPO_PUBLIC_SUPERWALL_API_KEY_ANDROID || '',
};

// Check if Superwall is configured
export function isSuperwallConfigured(): boolean {
  const apiKey = Platform.OS === 'ios' ? SUPERWALL_API_KEYS.ios : SUPERWALL_API_KEYS.android;
  return !!apiKey;
}

// Legacy function for compatibility - now a no-op since SuperwallProvider handles config
export function configureSuperwall(): void {
  // Configuration is now handled by SuperwallProvider in _layout.tsx
  console.log('[Superwall] Using SuperwallProvider for configuration');
}
