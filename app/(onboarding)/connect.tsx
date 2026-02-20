import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { connectApp } from '@/lib/api';
import { Colors } from '@/constants/Colors';

export default function ConnectScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [showForm, setShowForm] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [issuerId, setIssuerId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [appId, setAppId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSkip = async () => {
    setLoading(true);
    try { await updateProfile({ onboarding_completed: true }); router.replace('/(tabs)/dashboard'); } catch (error) { console.error('Error completing onboarding:', error); } finally { setLoading(false); }
  };

  const handleConnect = async () => {
    if (!keyId || !issuerId || !privateKey || !appId || !user) return;
    setLoading(true);
    try { await connectApp({ user_id: user.id, app_store_app_id: appId, app_store_connect_key_id: keyId, app_store_connect_issuer_id: issuerId, app_store_connect_private_key: privateKey }); await updateProfile({ onboarding_completed: true }); router.replace('/(tabs)/dashboard'); } catch (error) { console.error('Error connecting app:', error); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.progress}><View style={styles.progressBar}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: '100%' }]} /></View><Text variant="caption" color="secondary">Step 5 of 5</Text></View>
          <View style={styles.header}><Text variant="title" weight="bold">Connect App Store</Text><Text variant="body" color="secondary" style={styles.headerSubtitle}>Connect your App Store Connect account to sync real analytics.</Text></View>
          {!showForm ? (
            <View style={styles.optionsContainer}>
              <Card style={styles.optionCard}><TouchableOpacity style={styles.optionContent} onPress={() => setShowForm(true)}><View style={[styles.iconCircle, { backgroundColor: colors.primary }]}><Ionicons name="link" size={24} color="#FFFFFF" /></View><View style={styles.optionText}><Text variant="label" weight="semibold">Connect Now</Text><Text variant="caption" color="secondary">Enter your App Store Connect API keys</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></TouchableOpacity></Card>
              <Card style={styles.optionCard}><TouchableOpacity style={styles.optionContent} onPress={handleSkip}><View style={[styles.iconCircle, { backgroundColor: colors.border }]}><Ionicons name="time-outline" size={24} color={colors.text} /></View><View style={styles.optionText}><Text variant="label" weight="semibold">Skip for Now</Text><Text variant="caption" color="secondary">Explore with demo data, connect later</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></TouchableOpacity></Card>
              <View style={styles.helpSection}><Text variant="label" weight="semibold" style={styles.helpTitle}>How to get API keys</Text><Text variant="caption" color="secondary">1. Go to App Store Connect {'>'} Users and Access {'>'} Keys</Text><Text variant="caption" color="secondary">2. Click the + button to create a new key</Text><Text variant="caption" color="secondary">3. Give it a name and select "App Manager" role</Text><Text variant="caption" color="secondary">4. Download the private key (only available once!)</Text></View>
            </View>
          ) : (
            <View style={styles.form}>
              <TouchableOpacity style={styles.backButton} onPress={() => setShowForm(false)}><Ionicons name="arrow-back" size={20} color={colors.primary} /><Text variant="label" color="accent" style={{ marginLeft: 8 }}>Back</Text></TouchableOpacity>
              <Input label="Key ID" placeholder="ABC123DEFG" value={keyId} onChangeText={setKeyId} autoCapitalize="characters" />
              <Input label="Issuer ID" placeholder="12345678-1234-1234-1234-123456789012" value={issuerId} onChangeText={setIssuerId} autoCapitalize="none" />
              <Input label="App ID" placeholder="1234567890" value={appId} onChangeText={setAppId} keyboardType="numeric" />
              <Input label="Private Key" placeholder="Paste your .p8 key content" value={privateKey} onChangeText={setPrivateKey} multiline numberOfLines={4} autoCapitalize="none" />
              <Button title="Connect App Store" onPress={handleConnect} loading={loading} disabled={!keyId || !issuerId || !privateKey || !appId} size="large" style={styles.connectButton} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, keyboardView: { flex: 1 }, scrollContent: { flexGrow: 1, padding: 24 }, progress: { alignItems: 'center', marginBottom: 32 }, progressBar: { width: '100%', height: 4, backgroundColor: '#E5E5E5', borderRadius: 2, marginBottom: 8 }, progressFill: { height: '100%', borderRadius: 2 }, header: { marginBottom: 32 }, headerSubtitle: { marginTop: 8 }, optionsContainer: { gap: 16 }, optionCard: { padding: 0 }, optionContent: { flexDirection: 'row', alignItems: 'center', padding: 16 }, iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 }, optionText: { flex: 1 }, helpSection: { marginTop: 24, padding: 16, backgroundColor: '#F9F9F9', borderRadius: 12, gap: 8 }, helpTitle: { marginBottom: 4 }, form: { gap: 4 }, backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, connectButton: { marginTop: 16 } });
