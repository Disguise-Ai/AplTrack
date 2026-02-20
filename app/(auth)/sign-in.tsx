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

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, loading } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    try { await signIn(email, password); } catch (error: any) { Alert.alert('Sign In Failed', error.message || 'Please check your credentials'); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
          <View style={styles.header}><Text variant="title" weight="bold">Welcome back</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>Sign in to continue tracking your app</Text></View>
          <View style={styles.form}>
            <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} leftIcon="mail-outline" />
            <Input label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={errors.password} leftIcon="lock-closed-outline" />
            <TouchableOpacity style={styles.forgotPassword}><Text variant="label" color="accent">Forgot password?</Text></TouchableOpacity>
          </View>
          <View style={styles.buttons}>
            <Button title="Sign In" onPress={handleSignIn} loading={loading} size="large" style={styles.button} />
            <View style={styles.signUpLink}><Text variant="body" color="secondary">Don't have an account? </Text><TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}><Text variant="body" color="accent" weight="semibold">Sign up</Text></TouchableOpacity></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, keyboardView: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12, marginBottom: 16 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, form: { marginBottom: 24 }, forgotPassword: { alignSelf: 'flex-end' }, buttons: { marginTop: 'auto' }, button: { width: '100%', marginBottom: 16 }, signUpLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' } });
