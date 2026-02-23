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

export default function SignUpScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!fullName.trim()) newErrors.fullName = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Send OTP code to email
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName.trim() },
        },
      });

      if (error) throw error;

      // Navigate to verify code screen
      router.push({
        pathname: '/(auth)/verify-code',
        params: { email: email.trim().toLowerCase(), fullName: fullName.trim() }
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
            <Text variant="title" weight="bold">Create account</Text>
            <Text variant="body" color="secondary" style={styles.headerSubtitle}>
              We'll send a verification code to your email
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="John Appleseed"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              error={errors.fullName}
              leftIcon="person-outline"
            />
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
              onPress={handleSignUp}
              loading={loading}
              size="large"
              style={styles.button}
            />

            <Text variant="caption" color="secondary" align="center" style={styles.terms}>
              By creating an account, you agree to our{' '}
              <Text variant="caption" color="accent">Terms of Service</Text> and{' '}
              <Text variant="caption" color="accent">Privacy Policy</Text>
            </Text>

            <View style={styles.signInLink}>
              <Text variant="body" color="secondary">Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
                <Text variant="body" color="accent" weight="semibold">Sign in</Text>
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
  terms: { marginBottom: 16 },
  signInLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
