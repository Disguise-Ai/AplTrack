import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, loading } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string; confirmPassword?: string }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!fullName) newErrors.fullName = 'Name is required';
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    try {
      const result = await signUp(email, password, fullName);
      if (result.user && !result.session) {
        Alert.alert('Check Your Email', 'We sent you a confirmation link. Please check your email to complete sign up.');
      }
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Please try again');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
          <View style={styles.header}><Text variant="title" weight="bold">Create account</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>Start tracking your app analytics today</Text></View>
          <View style={styles.form}>
            <Input label="Full Name" placeholder="John Appleseed" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" error={errors.fullName} leftIcon="person-outline" />
            <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} leftIcon="mail-outline" />
            <Input label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" error={errors.password} leftIcon="lock-closed-outline" />
            <Input label="Confirm Password" placeholder="Re-enter your password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="password-new" error={errors.confirmPassword} leftIcon="lock-closed-outline" />
          </View>
          <View style={styles.buttons}>
            <Button title="Create Account" onPress={handleSignUp} loading={loading} size="large" style={styles.button} />
            <Text variant="caption" color="secondary" align="center" style={styles.terms}>By creating an account, you agree to our <Text variant="caption" color="accent">Terms of Service</Text> and <Text variant="caption" color="accent">Privacy Policy</Text></Text>
            <View style={styles.signInLink}><Text variant="body" color="secondary">Already have an account? </Text><TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}><Text variant="body" color="accent" weight="semibold">Sign in</Text></TouchableOpacity></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, keyboardView: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12, marginBottom: 16 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, form: { marginBottom: 24 }, buttons: { marginTop: 'auto' }, button: { width: '100%', marginBottom: 16 }, terms: { marginBottom: 16 }, signInLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' } });
