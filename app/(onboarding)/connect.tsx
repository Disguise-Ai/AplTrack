import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { connectApp } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

interface DataSource {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  dataType: string;
  speed: string;
  fields: { key: string; label: string; placeholder: string; secure?: boolean; multiline?: boolean }[];
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'revenuecat',
    name: 'RevenueCat',
    description: 'Real-time revenue & subscription data',
    icon: '💰',
    color: '#FF6B6B',
    dataType: 'Revenue, MRR, Subscribers',
    speed: 'Real-time',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk_xxxxxxxxxxxx' },
      { key: 'app_id', label: 'App ID', placeholder: 'app1234567890' },
    ],
  },
  {
    id: 'appsflyer',
    name: 'AppsFlyer',
    description: 'Attribution & marketing analytics',
    icon: '📊',
    color: '#12CBC4',
    dataType: 'Installs, Attribution, Ad Spend',
    speed: 'Real-time',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'Your AppsFlyer API token' },
      { key: 'app_id', label: 'App ID', placeholder: 'id123456789' },
    ],
  },
  {
    id: 'adjust',
    name: 'Adjust',
    description: 'Mobile attribution & analytics',
    icon: '🎯',
    color: '#0652DD',
    dataType: 'Installs, Events, Cohorts',
    speed: 'Real-time',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'Your Adjust API token' },
      { key: 'app_token', label: 'App Token', placeholder: 'abc123xyz' },
    ],
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Product & user analytics',
    icon: '📈',
    color: '#7C4DFF',
    dataType: 'Events, Funnels, Retention',
    speed: 'Real-time',
    fields: [
      { key: 'api_secret', label: 'API Secret', placeholder: 'Your Mixpanel API secret', secure: true },
      { key: 'project_id', label: 'Project ID', placeholder: '1234567' },
    ],
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Product intelligence platform',
    icon: '🔬',
    color: '#1E88E5',
    dataType: 'Users, Events, Retention',
    speed: 'Real-time',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your Amplitude API key' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'Your Amplitude secret key', secure: true },
    ],
  },
  {
    id: 'appstore',
    name: 'App Store Connect',
    description: 'Official Apple analytics',
    icon: '🍎',
    color: '#000000',
    dataType: 'Downloads, Sales, Ratings',
    speed: '24-48 hours delay',
    fields: [
      { key: 'key_id', label: 'Key ID', placeholder: 'ABC123DEFG' },
      { key: 'issuer_id', label: 'Issuer ID', placeholder: '12345678-1234-1234-1234-123456789012' },
      { key: 'app_id', label: 'App ID', placeholder: '1234567890' },
      { key: 'private_key', label: 'Private Key (.p8)', placeholder: 'Paste your .p8 key content', multiline: true },
    ],
  },
];

export default function ConnectScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [connectedSources, setConnectedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      await updateProfile({ onboarding_completed: true });
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedSource) return;

    // Check session directly - state.user might be stale after sign in
    let userId = user?.id;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    if (!userId) {
      Alert.alert('Not Logged In', 'Please sign in to connect data sources');
      return;
    }

    // Validate all fields are filled
    const missingFields = selectedSource.fields.filter(f => !formData[f.key]?.trim());
    if (missingFields.length > 0) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    // Dismiss keyboard before making the request
    Keyboard.dismiss();

    setLoading(true);
    try {
      await connectApp({
        user_id: userId,
        provider: selectedSource.id,
        credentials: formData,
        app_store_app_id: formData.app_id || formData.app_token || '',
      });

      setConnectedSources([...connectedSources, selectedSource.id]);
      setSelectedSource(null);
      setFormData({});
      Alert.alert('Connected!', `${selectedSource.name} connected successfully`);
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message || 'Please check your credentials');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  if (selectedSource) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedSource(null); setFormData({}); }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.sourceHeader}>
              <View style={[styles.sourceIconLarge, { backgroundColor: selectedSource.color + '20' }]}>
                <Text style={styles.sourceEmoji}>{selectedSource.icon}</Text>
              </View>
              <Text variant="title" weight="bold">{selectedSource.name}</Text>
              <Text variant="body" color="secondary" align="center" style={styles.sourceDesc}>
                {selectedSource.description}
              </Text>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: colors.accent + '15' }]}>
                  <Text variant="caption" color="accent">{selectedSource.speed}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                  <Text variant="caption" style={{ color: colors.primary }}>{selectedSource.dataType}</Text>
                </View>
              </View>
            </View>

            <View style={styles.form}>
              {selectedSource.fields.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  value={formData[field.key] || ''}
                  onChangeText={(value) => updateField(field.key, value)}
                  secureTextEntry={field.secure}
                  multiline={field.multiline}
                  numberOfLines={field.multiline ? 4 : 1}
                  autoCapitalize="none"
                />
              ))}
            </View>

            <Button
              title={`Connect ${selectedSource.name}`}
              onPress={handleConnect}
              loading={loading}
              size="large"
              style={styles.connectButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: '100%' }]} />
          </View>
          <Text variant="caption" color="secondary">Step 5 of 5</Text>
        </View>

        <View style={styles.header}>
          <Text variant="title" weight="bold">Connect Data Sources</Text>
          <Text variant="body" color="secondary" style={styles.headerSubtitle}>
            Connect your analytics platforms for real-time data. You can add more later.
          </Text>
        </View>

        <View style={styles.sourcesList}>
          {DATA_SOURCES.map((source) => {
            const isConnected = connectedSources.includes(source.id);
            return (
              <Card key={source.id} style={styles.sourceCard}>
                <TouchableOpacity
                  style={styles.sourceContent}
                  onPress={() => !isConnected && setSelectedSource(source)}
                  disabled={isConnected}
                >
                  <View style={[styles.sourceIcon, { backgroundColor: source.color + '20' }]}>
                    <Text style={styles.sourceEmoji}>{source.icon}</Text>
                  </View>
                  <View style={styles.sourceInfo}>
                    <View style={styles.sourceNameRow}>
                      <Text variant="label" weight="semibold">{source.name}</Text>
                      {isConnected && (
                        <View style={[styles.connectedBadge, { backgroundColor: '#4CAF50' }]}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <Text variant="caption" color="secondary">{source.description}</Text>
                    <View style={styles.sourceSpeed}>
                      <Ionicons name="flash" size={12} color={source.speed === 'Real-time' ? '#4CAF50' : '#FF9800'} />
                      <Text variant="caption" color="secondary" style={{ marginLeft: 4 }}>{source.speed}</Text>
                    </View>
                  </View>
                  {!isConnected && <Ionicons name="add-circle-outline" size={24} color={colors.accent} />}
                </TouchableOpacity>
              </Card>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Button
            title={connectedSources.length > 0 ? "Continue to Dashboard" : "Skip for Now"}
            onPress={handleFinish}
            loading={loading}
            size="large"
            variant={connectedSources.length > 0 ? "primary" : "outline"}
          />
          {connectedSources.length === 0 && (
            <Text variant="caption" color="secondary" align="center" style={styles.skipText}>
              You can connect data sources later in Settings
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  progress: { alignItems: 'center', marginBottom: 32 },
  progressBar: { width: '100%', height: 4, backgroundColor: '#27272A', borderRadius: 2, marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 2 },
  header: { marginBottom: 24 },
  headerSubtitle: { marginTop: 8 },
  sourcesList: { gap: 12 },
  sourceCard: { padding: 0 },
  sourceContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  sourceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sourceIconLarge: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  sourceEmoji: { fontSize: 24 },
  sourceInfo: { flex: 1 },
  sourceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceSpeed: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  connectedBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 32, gap: 12 },
  skipText: { marginTop: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12, marginBottom: 16 },
  sourceHeader: { alignItems: 'center', marginBottom: 32 },
  sourceDesc: { marginTop: 8, maxWidth: 280 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  form: { gap: 4 },
  connectButton: { marginTop: 24 },
});
