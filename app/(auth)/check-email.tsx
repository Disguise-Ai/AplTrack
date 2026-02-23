import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, useColorScheme, Linking, TouchableOpacity, Alert, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/api';
import { Colors } from '@/constants/Colors';

// Email provider web URLs
const EMAIL_PROVIDERS: Record<string, { name: string; url: string }> = {
  'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
  'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com' },
  'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com/mail' },
  'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com/mail' },
  'live.com': { name: 'Outlook', url: 'https://outlook.live.com/mail' },
  'msn.com': { name: 'Outlook', url: 'https://outlook.live.com/mail' },
  'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
  'ymail.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
  'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
  'me.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
  'mac.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
  'protonmail.com': { name: 'ProtonMail', url: 'https://mail.protonmail.com' },
  'proton.me': { name: 'ProtonMail', url: 'https://mail.protonmail.com' },
  'aol.com': { name: 'AOL Mail', url: 'https://mail.aol.com' },
  'zoho.com': { name: 'Zoho Mail', url: 'https://mail.zoho.com' },
};

const getEmailProvider = (email: string | undefined) => {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return EMAIL_PROVIDERS[domain] || null;
};

export default function CheckEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email || '';
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const emailProvider = getEmailProvider(email);

  // Open the user's email provider in browser
  const openEmailApp = async () => {
    try {
      if (emailProvider) {
        await Linking.openURL(emailProvider.url);
      } else {
        await Linking.openURL('https://mail.google.com');
      }
    } catch (error) {
      Alert.alert(
        'Open Email',
        'Please open your email app manually and look for the confirmation email from AplTrack.',
        [{ text: 'OK' }]
      );
    }
  };

  // Navigate based on profile status
  const navigateBasedOnProfile = async (userId: string) => {
    try {
      const profile = await getProfile(userId);
      if (profile?.onboarding_completed) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(onboarding)/company');
      }
    } catch {
      router.replace('/(onboarding)/company');
    }
  };

  // Check if user is confirmed - tries to sign in with existing credentials
  const checkUserConfirmed = async (): Promise<boolean> => {
    try {
      // First try to refresh the session
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData.session && refreshData.user?.email_confirmed_at) {
        return true;
      }

      // Then try getSession
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user.email_confirmed_at) {
        return true;
      }

      // Also check the user directly via the API
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email_confirmed_at) {
        return true;
      }

      return false;
    } catch (error) {
      console.log('Check confirmed error:', error);
      return false;
    }
  };

  // Poll for confirmation
  const checkForConfirmation = async () => {
    const isConfirmed = await checkUserConfirmed();
    if (isConfirmed) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await navigateBasedOnProfile(user.id);
      }
    }
  };

  // Start polling
  useEffect(() => {
    checkForConfirmation();
    pollingRef.current = setInterval(checkForConfirmation, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email) return;

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      Alert.alert('Email Sent', 'We\'ve sent another confirmation email. Please check your inbox.');
      setResendCooldown(60);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Manual check - "I've Confirmed My Email" button
  const handleManualCheck = async () => {
    setChecking(true);
    try {
      // Try to refresh and get latest session state
      const isConfirmed = await checkUserConfirmed();

      if (isConfirmed) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await navigateBasedOnProfile(user.id);
        } else {
          Alert.alert('Error', 'Could not find your account. Please try signing in.');
        }
      } else {
        Alert.alert(
          'Not Confirmed Yet',
          'We haven\'t detected your email confirmation yet. Please:\n\n1. Check your email inbox\n2. Click the confirmation link\n3. Wait a moment and try again',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Manual check error:', error);
      Alert.alert('Error', 'Failed to check confirmation status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primary + '15', transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Ionicons name="mail-unread" size={64} color={colors.primary} />
        </Animated.View>

        <Text variant="title" weight="bold" align="center" style={styles.title}>
          Verify your email
        </Text>

        <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
          We've sent a confirmation link to
        </Text>

        {email ? (
          <View style={[styles.emailBadge, { backgroundColor: colors.surface }]}>
            <Ionicons name="mail" size={16} color={colors.primary} />
            <Text variant="label" weight="semibold" style={{ color: colors.primary }}>
              {email}
            </Text>
          </View>
        ) : null}

        <Text variant="body" color="secondary" align="center" style={styles.instructions}>
          Click the link in your email to verify your account. Come back here when done!
        </Text>

        <View style={[styles.stepsContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: 'white' }} weight="bold">1</Text>
            </View>
            <Text variant="body">
              Open {emailProvider ? emailProvider.name : 'your email'}
            </Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: 'white' }} weight="bold">2</Text>
            </View>
            <Text variant="body">Click the confirmation link</Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: 'white' }} weight="bold">3</Text>
            </View>
            <Text variant="body">Come back and tap "I've Confirmed"</Text>
          </View>
        </View>

        <View style={styles.tips}>
          <View style={styles.tipRow}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
            <Text variant="caption" color="secondary">Link expires in 24 hours</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="folder-outline" size={18} color={colors.textSecondary} />
            <Text variant="caption" color="secondary">Check spam if not in inbox</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button
          title={emailProvider ? `Open ${emailProvider.name}` : 'Open Email'}
          onPress={openEmailApp}
          size="large"
          style={styles.button}
        />

        <Button
          title={checking ? "Checking..." : "I've Confirmed My Email"}
          variant="secondary"
          onPress={handleManualCheck}
          loading={checking}
          size="large"
          style={styles.button}
        />

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendEmail}
          disabled={resending || resendCooldown > 0}
        >
          {resending ? (
            <Text variant="label" color="secondary">Sending...</Text>
          ) : resendCooldown > 0 ? (
            <Text variant="label" color="secondary">Resend in {resendCooldown}s</Text>
          ) : (
            <Text variant="label" color="accent">Didn't receive email? Resend</Text>
          )}
        </TouchableOpacity>

        <Button
          title="Back to Sign In"
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
          size="large"
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 8 },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  instructions: { maxWidth: 300, marginBottom: 24 },
  stepsContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tips: { flexDirection: 'row', gap: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttons: { padding: 24, gap: 12 },
  button: { width: '100%' },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});
