import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, TextInput, TouchableOpacity, Alert, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/api';
import { Colors } from '@/constants/Colors';

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

  // Auto-verify when code is complete
  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      handleVerify();
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
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) {
        shake();
        setCode('');
        throw error;
      }

      if (data.session && data.user) {
        // Check if user has completed onboarding
        try {
          const profile = await getProfile(data.user.id);
          if (profile?.onboarding_completed) {
            router.replace('/(tabs)/dashboard');
          } else {
            router.replace('/(onboarding)/company');
          }
        } catch {
          // No profile yet, go to onboarding
          router.replace('/(onboarding)/company');
        }
      }
    } catch (error: any) {
      Alert.alert(
        'Invalid Code',
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
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
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
        />

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
          title={verifying ? "Verifying..." : "Verify"}
          onPress={handleVerify}
          loading={verifying}
          disabled={code.length !== CODE_LENGTH}
          size="large"
          style={styles.button}
        />
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
});
