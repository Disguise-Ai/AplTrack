import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { syncAllDataSources } from '@/lib/api';
import { configureSuperwall, identifySuperwallUser } from '@/lib/superwall';
import { registerForPushNotifications, savePushToken, addNotificationReceivedListener, addNotificationResponseReceivedListener, clearBadgeCount } from '@/lib/notifications';
import { triggerRefresh } from '@/lib/refreshTrigger';

// Ignore RevenueCat configuration warnings (expected during development)
LogBox.ignoreLogs([
  '[RevenueCat]',
  'There is an issue with your configuration',
  'no App Store products registered',
  'offerings-empty',
  'sdk-troubleshooting',
]);

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Configure Superwall on app startup
    configureSuperwall();

    // Trigger background sync on app startup for any authenticated user
    const triggerBackgroundSync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('[App] Triggering background sync on startup');
        // Identify user with Superwall
        identifySuperwallUser(session.user.id);
        // Don't await - let it run in background
        syncAllDataSources(session.user.id).catch(() => {});

        // Register for push notifications
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          console.log('[App] Push token:', pushToken);
          await savePushToken(session.user.id, pushToken);
        }

        // Clear badge count when app opens
        clearBadgeCount();
      }
    };
    triggerBackgroundSync();

    // Set up notification listeners - refresh data when notification received
    const notificationReceivedSub = addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;

      // When we receive a sale or download notification, trigger immediate data refresh
      if (data?.type === 'new_sale' || data?.type === 'new_download' || data?.type === 'new_subscriber' || data?.type === 'renewal') {
        // Trigger refresh so dashboard reloads data from database (webhook already updated it)
        triggerRefresh();
      }
    });

    const notificationResponseSub = addNotificationResponseReceivedListener((response) => {
      console.log('[App] Notification tapped:', response);
      // Handle notification tap - could navigate to specific screen
      const data = response.notification.request.content.data;
      if (data?.type === 'new_sale' || data?.type === 'new_download') {
        // Navigate to dashboard
        router.replace('/(tabs)/dashboard');
      }
    });

    // Handle deep links for auth
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);

      // Check if this is an auth callback
      if (url.includes('auth/callback') || url.includes('access_token') || url.includes('refresh_token')) {
        // Extract tokens from URL fragment or query
        const fragment = url.split('#')[1];
        const query = url.split('?')[1];
        const params = new URLSearchParams(fragment || query || '');

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('Setting session from deep link');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!error) {
            // Navigate to callback screen which will handle the redirect
            router.replace('/auth/callback');
          }
        }
      }
    };

    // Handle initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for URL changes while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => {
      subscription.remove();
      notificationReceivedSub.remove();
      notificationResponseSub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="data-sources" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
