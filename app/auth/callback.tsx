import { useEffect, useState } from 'react';
import { View, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/api';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait for Supabase to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to get the session
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
          setStatus('success');
          setMessage('Email verified! Taking you to setup...');

          // Check profile and navigate
          // If profile exists, user is NOT new - go to dashboard
          // Only send to onboarding if profile doesn't exist (new user)
          try {
            const profile = await getProfile(session.user.id);
            setTimeout(() => {
              if (profile) {
                // Profile exists = existing user, go to dashboard
                router.replace('/(tabs)/dashboard');
              } else {
                // No profile = new user, needs onboarding
                router.replace('/(onboarding)/company');
              }
            }, 1500);
          } catch (error: any) {
            // Check if it's a "not found" error (new user) vs network error
            const isNotFound = error?.message?.includes('not found') ||
                               error?.message?.includes('No rows') ||
                               error?.code === 'PGRST116';
            setTimeout(() => {
              if (isNotFound) {
                // New user - needs onboarding
                router.replace('/(onboarding)/company');
              } else {
                // Network/other error - assume existing user, go to dashboard
                // They'll be re-validated by the main auth logic
                router.replace('/(tabs)/dashboard');
              }
            }, 1500);
          }
        } else {
          // No session - maybe they just need to go back to check-email
          setStatus('error');
          setMessage('Please go back to the app and tap "I\'ve Confirmed My Email"');
        }
      } catch (error) {
        console.error('Callback error:', error);
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.iconContainer,
        { backgroundColor: status === 'success' ? colors.success + '15' : status === 'error' ? colors.error + '15' : colors.primary + '15' }
      ]}>
        <Ionicons
          name={status === 'success' ? 'checkmark-circle' : status === 'error' ? 'alert-circle' : 'mail-unread'}
          size={64}
          color={status === 'success' ? colors.success : status === 'error' ? colors.error : colors.primary}
        />
      </View>

      <Text variant="title" weight="bold" align="center" style={styles.title}>
        {status === 'success' ? 'Email Verified!' : status === 'error' ? 'Oops!' : 'Verifying...'}
      </Text>

      <Text variant="body" color="secondary" align="center" style={styles.message}>
        {message}
      </Text>

      {status === 'loading' && (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      )}

      {status === 'error' && (
        <View style={styles.buttons}>
          <Button
            title="Go to Sign In"
            onPress={() => router.replace('/(auth)/sign-in')}
            size="large"
            style={styles.button}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { marginBottom: 8 },
  message: { marginBottom: 24, maxWidth: 300 },
  loader: { marginTop: 16 },
  buttons: { marginTop: 24, width: '100%', maxWidth: 300 },
  button: { width: '100%' },
});
