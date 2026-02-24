import React, { useState, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { getConnectedApps, connectApp, disconnectApp, updateAppCredentials, syncAllDataSources } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import type { ConnectedApp } from '@/lib/supabase';

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
      { key: 'api_key', label: 'Secret API Key', placeholder: 'sk_xxxxxxxxxxxx' },
      { key: 'project_id', label: 'Project ID', placeholder: 'projxxxxxxxxx' },
    ],
  },
  {
    id: 'polar',
    name: 'Polar',
    description: 'Open-source monetization platform',
    icon: '❄️',
    color: '#0EA5E9',
    dataType: 'Revenue, Subscriptions, Donations',
    speed: 'Real-time',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'polar_xxxxxxxxxxxx', secure: true },
      { key: 'organization_id', label: 'Organization ID', placeholder: 'org_xxxxxxxxxxxx' },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing & billing',
    icon: '💳',
    color: '#635BFF',
    dataType: 'Revenue, Subscriptions, Payments',
    speed: 'Real-time',
    fields: [
      { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_xxxxxxxxxxxx', secure: true },
    ],
  },
  {
    id: 'superwall',
    name: 'Superwall',
    description: 'Paywall A/B testing & optimization',
    icon: '🧱',
    color: '#6366F1',
    dataType: 'Conversions, Paywalls, A/B Tests',
    speed: 'Real-time',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'pk_xxxxxxxxxxxx' },
      { key: 'app_id', label: 'App ID', placeholder: 'Your Superwall app ID' },
    ],
  },
  {
    id: 'adapty',
    name: 'Adapty',
    description: 'In-app subscriptions & analytics',
    icon: '🔄',
    color: '#FF6B35',
    dataType: 'Revenue, Subscribers, Cohorts',
    speed: 'Real-time',
    fields: [
      { key: 'api_key', label: 'Secret API Key', placeholder: 'Your Adapty secret key', secure: true },
      { key: 'app_id', label: 'App ID', placeholder: 'Your Adapty app ID' },
    ],
  },
  {
    id: 'qonversion',
    name: 'Qonversion',
    description: 'Subscription analytics & automation',
    icon: '📱',
    color: '#00D4AA',
    dataType: 'Revenue, Subscribers, Churn',
    speed: 'Real-time',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your Qonversion API key', secure: true },
      { key: 'project_id', label: 'Project ID', placeholder: 'Your project ID' },
    ],
  },
  {
    id: 'paddle',
    name: 'Paddle',
    description: 'Payments & subscription billing',
    icon: '🏓',
    color: '#FFCC00',
    dataType: 'Revenue, Subscriptions, Taxes',
    speed: 'Real-time',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Your Paddle API key', secure: true },
      { key: 'vendor_id', label: 'Vendor ID', placeholder: 'Your vendor ID' },
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
    description: 'Official app store analytics',
    icon: '🍎',
    color: '#A1A1AA',
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

export default function DataSourcesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [editingApp, setEditingApp] = useState<ConnectedApp | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  useEffect(() => {
    loadConnectedApps();
  }, [user]);

  const loadConnectedApps = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const apps = await getConnectedApps(user.id);
      setConnectedApps(apps);
    } catch (error) {
      console.error('Error loading apps:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedSource) {
      Alert.alert('Error', 'No source selected');
      return;
    }
    if (!user) {
      Alert.alert('Not Logged In', 'Please sign in to connect data sources');
      return;
    }
    const missingFields = selectedSource.fields.filter(f => !formData[f.key]?.trim());
    if (missingFields.length > 0) {
      Alert.alert('Missing Fields', `Please fill in: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    // Trim all credential values to remove accidental whitespace
    const trimmedCredentials: Record<string, string> = {};
    for (const key of Object.keys(formData)) {
      trimmedCredentials[key] = formData[key]?.trim() || '';
    }

    setLoading(true);
    try {
      await connectApp({
        user_id: user.id,
        provider: selectedSource.id,
        credentials: trimmedCredentials,
        app_store_app_id: trimmedCredentials.app_id || trimmedCredentials.project_id || trimmedCredentials.app_token || '',
      });
      await loadConnectedApps();

      // Auto-sync data after connecting
      Alert.alert(
        'Connected!',
        `${selectedSource.name} connected successfully. Syncing your data now...`,
        [{ text: 'OK' }]
      );
      closeModal();

      // Trigger sync in background
      syncAllDataSources(user.id).then(() => {
        Alert.alert('Sync Complete', 'Your data has been synced. Check the Dashboard!');
      }).catch((err) => {
        console.log('Auto-sync error:', err);
      });

    } catch (error: any) {
      console.error('Connection error:', error);
      Alert.alert('Connection Failed', error.message || 'Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingApp || !selectedSource) return;
    const missingFields = selectedSource.fields.filter(f => !formData[f.key]?.trim());
    if (missingFields.length > 0) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    // Trim all credential values
    const trimmedCredentials: Record<string, string> = {};
    for (const key of Object.keys(formData)) {
      trimmedCredentials[key] = formData[key]?.trim() || '';
    }

    setLoading(true);
    try {
      await updateAppCredentials(editingApp.id, trimmedCredentials);
      await loadConnectedApps();
      closeModal();
      Alert.alert('Updated!', `${selectedSource.name} credentials updated successfully`);
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Failed to update credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = (app: ConnectedApp) => {
    const sourceName = DATA_SOURCES.find(s => s.id === app.provider)?.name || app.provider;
    Alert.alert(
      'Remove API Key',
      `Are you sure you want to remove ${sourceName}? You can add it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectApp(app.id);
              await loadConnectedApps();
              Alert.alert('Removed', `${sourceName} has been disconnected`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disconnect');
            }
          },
        },
      ]
    );
  };

  const openAddModal = (source: DataSource) => {
    setSelectedSource(source);
    setEditingApp(null);
    setFormData({});
    setModalMode('add');
  };

  const openEditModal = (app: ConnectedApp) => {
    const source = DATA_SOURCES.find(s => s.id === app.provider);
    if (!source) return;
    setSelectedSource(source);
    setEditingApp(app);
    // Pre-fill with masked values or empty for security
    const initialData: Record<string, string> = {};
    source.fields.forEach(f => {
      initialData[f.key] = ''; // User needs to re-enter credentials
    });
    setFormData(initialData);
    setModalMode('edit');
  };

  const closeModal = () => {
    setSelectedSource(null);
    setEditingApp(null);
    setFormData({});
  };

  const getConnectedProviders = () => connectedApps.map(a => a.provider);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text variant="title" weight="bold">API Keys & Integrations</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {connectedApps.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionTitle}>CONNECTED</Text>
            {connectedApps.map((app) => {
              const source = DATA_SOURCES.find(s => s.id === app.provider);
              return (
                <Card key={app.id} style={styles.sourceCard}>
                  <View style={styles.sourceContent}>
                    <View style={[styles.sourceIcon, { backgroundColor: (source?.color || '#666') + '20' }]}>
                      <Text style={styles.sourceEmoji}>{source?.icon || '📱'}</Text>
                    </View>
                    <View style={styles.sourceInfo}>
                      <Text variant="label" weight="semibold">{source?.name || app.provider}</Text>
                      <View style={styles.connectedStatus}>
                        <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                        <Text variant="caption" color="secondary">Connected</Text>
                        {app.last_sync_at && (
                          <Text variant="caption" color="tertiary" style={{ marginLeft: 8 }}>
                            • Synced {new Date(app.last_sync_at).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      {app.credentials?.project_id && (
                        <Text variant="caption" color="tertiary" style={{ marginTop: 2 }}>
                          Project: {app.credentials.project_id.substring(0, 12)}...
                        </Text>
                      )}
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
                        onPress={() => openEditModal(app)}
                      >
                        <Ionicons name="key-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
                        onPress={() => handleDisconnect(app)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="label" color="secondary" style={styles.sectionTitle}>
            {connectedApps.length > 0 ? 'ADD MORE SOURCES' : 'AVAILABLE SOURCES'}
          </Text>
          {DATA_SOURCES.filter(s => !getConnectedProviders().includes(s.id)).map((source) => (
            <Card key={source.id} style={styles.sourceCard}>
              <TouchableOpacity style={styles.sourceContent} onPress={() => openAddModal(source)}>
                <View style={[styles.sourceIcon, { backgroundColor: source.color + '20' }]}>
                  <Text style={styles.sourceEmoji}>{source.icon}</Text>
                </View>
                <View style={styles.sourceInfo}>
                  <Text variant="label" weight="semibold">{source.name}</Text>
                  <Text variant="caption" color="secondary">{source.description}</Text>
                  <View style={styles.sourceSpeed}>
                    <Ionicons name="flash" size={12} color={source.speed === 'Real-time' ? '#4CAF50' : '#FF9800'} />
                    <Text variant="caption" color="secondary" style={{ marginLeft: 4 }}>{source.speed}</Text>
                  </View>
                </View>
                <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={!!selectedSource} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text variant="label" weight="semibold">
                {modalMode === 'edit' ? 'Update API Key' : 'Add Integration'}
              </Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {selectedSource && (
                <>
                  <View style={styles.sourceHeaderModal}>
                    <View style={[styles.sourceIconLarge, { backgroundColor: selectedSource.color + '20' }]}>
                      <Text style={{ fontSize: 40 }}>{selectedSource.icon}</Text>
                    </View>
                    <Text variant="title" weight="bold">{selectedSource.name}</Text>
                    <Text variant="body" color="secondary" align="center">{selectedSource.description}</Text>
                  </View>

                  {modalMode === 'edit' && (
                    <View style={[styles.infoBox, { backgroundColor: colors.warning + '15' }]}>
                      <Ionicons name="information-circle" size={20} color={colors.warning} />
                      <Text variant="caption" color="secondary" style={{ flex: 1, marginLeft: 8 }}>
                        Enter your new API credentials. For security, existing credentials are not displayed.
                      </Text>
                    </View>
                  )}

                  <View style={styles.form}>
                    {selectedSource.fields.map((field) => (
                      <Input
                        key={field.key}
                        label={field.label}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChangeText={(value) => setFormData({ ...formData, [field.key]: value })}
                        secureTextEntry={field.secure}
                        multiline={field.multiline}
                        numberOfLines={field.multiline ? 4 : 1}
                        autoCapitalize="none"
                      />
                    ))}
                  </View>

                  <Button
                    title={loading ? 'Saving...' : (modalMode === 'edit' ? 'Update Credentials' : `Connect ${selectedSource.name}`)}
                    onPress={modalMode === 'edit' ? handleUpdate : handleConnect}
                    loading={loading}
                    size="large"
                    style={styles.connectButton}
                  />

                  {modalMode === 'edit' && (
                    <Button
                      title="Remove Integration"
                      variant="ghost"
                      onPress={() => {
                        closeModal();
                        if (editingApp) handleDisconnect(editingApp);
                      }}
                      style={styles.removeButton}
                    />
                  )}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingTop: 0 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12, marginLeft: 4 },
  sourceCard: { padding: 0, marginBottom: 12 },
  sourceContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  sourceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sourceIconLarge: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  sourceEmoji: { fontSize: 24 },
  sourceInfo: { flex: 1 },
  sourceSpeed: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  connectedStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionButton: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalContent: { padding: 24 },
  sourceHeaderModal: { alignItems: 'center', marginBottom: 24 },
  infoBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16 },
  form: { gap: 4, marginBottom: 24 },
  connectButton: { marginTop: 16 },
  removeButton: { marginTop: 8 },
});
