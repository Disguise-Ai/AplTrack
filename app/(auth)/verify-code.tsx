import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, TextInput, TouchableOpacity, Alert, Animated, Keyboard, InputAccessoryView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/api';
import { Colors } from '@/constants/Colors';

const INPUT_ACCESSORY_ID = 'verifyCodeInput';

const CODE_LENGTH = 6;

export default function VerifyCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string; fullName: string }>();
  const email = params.email || '';
  const fullName = params.fullName || '';
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-verify when code is complete (with small delay for paste)
  useEffect(() => {
    if (code.length === CODE_LENGTH && !verifying) {
      // Small delay to allow UI to update before verifying
      const timer = setTimeout(() => {
        console.log('Auto-verifying code...');
        handleVerify();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [code]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH || verifying) return;

    setVerifying(true);
    try {
      console.log('Starting OTP verification for:', email);

      // Try verifying with 'email' type first, then 'signup' as fallback
      let data, error;

      // First try 'email' type (for sign-in)
      const result1 = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      console.log('Email type result:', result1.error ? result1.error.message : 'success');

      if (result1.error) {
        // Try 'signup' type as fallback (for new accounts)
        const result2 = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'signup',
        });
        console.log('Signup type result:', result2.error ? result2.error.message : 'success');
        data = result2.data;
        error = result2.error;
      } else {
        data = result1.data;
        error = result1.error;
      }

      if (error) {
        shake();
        setCode('');
        throw error;
      }

      console.log('OTP verified, session:', !!data?.session, 'user:', !!data?.user);

      if (data?.session && data?.user) {
        // Check if user has profile = existing user goes to dashboard
        // No profile = new user needs onboarding
        try {
          console.log('Checking profile for user:', data.user.id);

          // Add timeout to prevent infinite loading
          const profilePromise = getProfile(data.user.id);
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Profile check timeout')), 5000)
          );

          const profile = await Promise.race([profilePromise, timeoutPromise]);
          console.log('Profile found:', !!profile);

          if (profile) {
            // Profile exists = existing user, go to dashboard
            console.log('Existing user - navigating to dashboard');
            router.replace('/(tabs)/dashboard?refresh=true');
          } else {
            // No profile = new user, needs onboarding
            console.log('New user - navigating to onboarding');
            router.replace('/(onboarding)/company');
          }
        } catch (profileError: any) {
          // Check if it's a "not found" error (new user) vs network error
          const isNotFound = profileError?.message?.includes('not found') ||
                             profileError?.message?.includes('No rows') ||
                             profileError?.code === 'PGRST116';
          console.log('Profile error:', profileError?.message, 'isNotFound:', isNotFound);
          if (isNotFound) {
            // New user - needs onboarding
            router.replace('/(onboarding)/company');
          } else {
            // Network/timeout error - assume existing user, go to dashboard
            router.replace('/(tabs)/dashboard?refresh=true');
          }
        }
      } else {
        // Session created but no user data - try to get session
        console.log('No session/user in response, checking current session');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.replace('/(tabs)/dashboard?refresh=true');
        } else {
          router.replace('/(auth)/sign-in');
        }
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      shake();
      setCode('');
      Alert.alert(
        'Verification Failed',
        error.message || 'The code you entered is incorrect or has expired. Please try again.',
        [{ text: 'OK', onPress: () => inputRef.current?.focus() }]
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      Alert.alert('Code Sent', 'We\'ve sent a new verification code to your email.');
      setResendCooldown(60);
      setCode('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Only allow numbers - handle both typing and paste
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    console.log('Code changed:', cleaned.length, 'digits');
    setCode(cleaned);
  };

  // Render code boxes
  const renderCodeBoxes = () => {
    const boxes = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      const isFilled = i < code.length;
      const isActive = i === code.length;
      boxes.push(
        <View
          key={i}
          style={[
            styles.codeBox,
            {
              backgroundColor: colors.surface,
              borderColor: isActive ? colors.primary : isFilled ? colors.primary + '50' : colors.border,
              borderWidth: isActive ? 2 : 1,
            }
          ]}
        >
          <Text variant="title" weight="bold" style={{ color: colors.text }}>
            {code[i] || ''}
          </Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="shield-checkmark" size={64} color={colors.primary} />
        </View>

        <Text variant="title" weight="bold" align="center" style={styles.title}>
          Enter verification code
        </Text>

        <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
          We sent a 6-digit code to
        </Text>

        <View style={[styles.emailBadge, { backgroundColor: colors.surface }]}>
          <Ionicons name="mail" size={16} color={colors.primary} />
          <Text variant="label" weight="semibold" style={{ color: colors.primary }}>
            {email}
          </Text>
        </View>

        {/* Hidden input for keyboard */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={code}
          onChangeText={handleCodeChange}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
          inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
        />

        {/* Done button for iOS number pad */}
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
            <View style={[styles.accessoryView, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => {
                  Keyboard.dismiss();
                  if (code.length === CODE_LENGTH) {
                    handleVerify();
                  }
                }}
              >
                <Text variant="label" weight="semibold" style={{ color: colors.primary }}>
                  {code.length === CODE_LENGTH ? 'Verify' : 'Done'}
                </Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}

        {/* Code boxes */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <Animated.View
            style={[
              styles.codeContainer,
              { transform: [{ translateX: shakeAnim }] }
            ]}
          >
            {renderCodeBoxes()}
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending || resendCooldown > 0}
        >
          {resending ? (
            <Text variant="label" color="secondary">Sending...</Text>
          ) : resendCooldown > 0 ? (
            <Text variant="label" color="secondary">Resend code in {resendCooldown}s</Text>
          ) : (
            <Text variant="label" color="accent">Didn't receive code? Resend</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <Button
          title={verifying ? "Verifying..." : "Continue"}
          onPress={handleVerify}
          loading={verifying}
          disabled={code.length !== CODE_LENGTH}
          size="large"
          style={styles.button}
        />
        {code.length === CODE_LENGTH && !verifying && (
          <Text variant="caption" color="secondary" align="center" style={{ marginTop: 8 }}>
            Tap Continue or wait for auto-verify
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  subtitle: { marginBottom: 8 },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 32,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendButton: {
    paddingVertical: 12,
  },
  buttons: {
    padding: 24,
  },
  button: { width: '100%' },
  accessoryView: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
