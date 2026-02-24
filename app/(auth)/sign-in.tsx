import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Send OTP code to email
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false, // Don't create new users on sign-in
        },
      });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('invalid')) {
          throw new Error('No account found with this email. Please sign up first.');
        }
        throw error;
      }

      // Navigate to verify code screen with isSignIn flag
      router.push({
        pathname: '/(auth)/verify-code',
        params: { email: email.trim().toLowerCase(), isSignIn: 'true' }
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text variant="title" weight="bold">Welcome back</Text>
            <Text variant="body" color="secondary" style={styles.headerSubtitle}>
              We'll send a verification code to your email
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              leftIcon="mail-outline"
            />
          </View>

          <View style={styles.buttons}>
            <Button
              title="Send Verification Code"
              onPress={handleSignIn}
              loading={loading}
              size="large"
              style={styles.button}
            />

            <View style={styles.signUpLink}>
              <Text variant="body" color="secondary">Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
                <Text variant="body" color="accent" weight="semibold">Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
    marginBottom: 16
  },
  header: { marginBottom: 32 },
  headerSubtitle: { marginTop: 8 },
  form: { marginBottom: 24 },
  buttons: { marginTop: 'auto' },
  button: { width: '100%', marginBottom: 16 },
  signUpLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
