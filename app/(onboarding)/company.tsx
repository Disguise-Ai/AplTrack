import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

export default function CompanyScreen() {
  const router = useRouter();
  const { updateProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [companyName, setCompanyName] = useState('');
  const [appName, setAppName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!companyName.trim() || !appName.trim()) return;
    setLoading(true);
    try { await updateProfile({ company_name: companyName.trim(), app_name: appName.trim() }); router.push('/(onboarding)/category'); } catch (error) { console.error('Error saving company info:', error); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.progress}><View style={styles.progressBar}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: '20%' }]} /></View><Text variant="caption" color="secondary">Step 1 of 5</Text></View>
          <View style={styles.header}><Text variant="title" weight="bold">Tell us about your app</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>We'll personalize your experience based on your answers.</Text></View>
          <View style={styles.form}><Input label="Company Name" placeholder="Acme Inc." value={companyName} onChangeText={setCompanyName} autoCapitalize="words" leftIcon="business-outline" /><Input label="App Name" placeholder="My Awesome App" value={appName} onChangeText={setAppName} autoCapitalize="words" leftIcon="apps-outline" /></View>
        </ScrollView>
        <View style={styles.buttons}><Button title="Continue" onPress={handleNext} loading={loading} disabled={!companyName.trim() || !appName.trim()} size="large" /></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, keyboardView: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, progress: { alignItems: 'center', marginBottom: 32 }, progressBar: { width: '100%', height: 4, backgroundColor: '#E5E5E5', borderRadius: 2, marginBottom: 8 }, progressFill: { height: '100%', borderRadius: 2 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, form: { flex: 1 }, buttons: { padding: 24, paddingTop: 0 } });
