import React, { useState, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, Alert, Linking, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TrialCountdown } from '@/components/TrialCountdown';
import { Paywall } from '@/components/Paywall';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { Config } from '@/constants/Config';
import { Colors } from '@/constants/Colors';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile, signOut, updateProfile, refreshProfile } = useAuth();
  const { isPremium, isTrial, trialEndsAt, subscribe, restore, purchasing, beginTrial, monthlyPackage } = useSubscription();

  // Refresh profile data when screen mounts
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);

  // Update form fields when profile loads
  useEffect(() => {
    if (profile) {
      setNewName(profile.full_name || '');
      setNewCompanyName(profile.company_name || '');
      setNewAppName(profile.app_name || '');
    }
  }, [profile]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [newName, setNewName] = useState(profile?.full_name || '');
  const [newCompanyName, setNewCompanyName] = useState(profile?.company_name || '');
  const [newAppName, setNewAppName] = useState(profile?.app_name || '');
  const [saving, setSaving] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        try {
          console.log('User confirmed sign out');
          await signOut();
          console.log('Sign out completed, navigating to welcome');
          // Use setTimeout to ensure state is cleared before navigation
          setTimeout(() => {
            router.replace('/(auth)/welcome');
          }, 100);
        } catch (error) {
          console.error('Error signing out:', error);
          // Still try to navigate even if there's an error
          router.replace('/(auth)/welcome');
        }
      }}
    ]);
  };

  const handleEditProfile = () => {
    setNewName(profile?.full_name || '');
    setNewCompanyName(profile?.company_name || '');
    setNewAppName(profile?.app_name || '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        full_name: newName.trim(),
        company_name: newCompanyName.trim() || null,
        app_name: newAppName.trim() || null,
      });
      setShowEditProfile(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePurchase = async () => {
    try {
      // Try RevenueCat subscription
      await subscribe();
      setShowPaywall(false);
      Alert.alert('Success', 'Welcome to Statly Premium!');
    } catch (error: any) {
      // Don't show error if user just cancelled
      if (error.message === 'Purchase cancelled') return;

      // If no packages available, offer trial instead
      if (error.message?.includes('No subscription packages')) {
        Alert.alert(
          'Start Free Trial?',
          'In-app purchases are being configured. Would you like to start a free 72-hour trial instead?',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Start Trial',
              onPress: async () => {
                try {
                  await beginTrial();
                  setShowPaywall(false);
                  Alert.alert('Trial Started!', 'Your 72-hour free trial has begun. Enjoy full access to all features!');
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Failed to start trial');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Subscribe failed. Please try again.');
      }
    }
  };

  const handleStartTrial = async () => {
    try {
      setShowPaywall(false);
      await beginTrial();
      Alert.alert('Trial Started!', 'Your 72-hour free trial has begun. Enjoy full access to all features!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start trial.');
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      Alert.alert('Success', 'Subscription restored successfully!');
    } catch (error: any) {
      Alert.alert('Info', 'No active subscription found.');
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="title" weight="bold">Settings</Text>
        </View>

        {/* Profile Card - Clickable to Edit */}
        <Card style={styles.profileCard}>
          <TouchableOpacity style={styles.profileContent} onPress={handleEditProfile} activeOpacity={0.7}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
              <Text variant="title" weight="bold" color="accent">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text variant="label" weight="semibold">{profile?.full_name || 'User'}</Text>
                <Ionicons name="pencil" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
              </View>
              <Text variant="caption" color="secondary">{user?.email}</Text>
              {(profile?.company_name || profile?.app_name) && (
                <Text variant="caption" color="secondary">
                  {[profile?.company_name, profile?.app_name].filter(Boolean).join(' • ')}
                </Text>
              )}
            </View>
            {isPremium && !isTrial && (
              <View style={[styles.premiumBadge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="star" size={14} color={colors.success} />
                <Text variant="caption" style={{ color: colors.success, marginLeft: 4 }}>Premium</Text>
              </View>
            )}
            {isTrial && (
              <View style={[styles.premiumBadge, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="timer" size={14} color={colors.warning} />
                <Text variant="caption" style={{ color: colors.warning, marginLeft: 4 }}>Trial</Text>
              </View>
            )}
          </TouchableOpacity>
        </Card>

        {isTrial && trialEndsAt && (
          <TrialCountdown trialEndsAt={trialEndsAt} onUpgrade={() => setShowPaywall(true)} />
        )}

        {!isPremium && !isTrial && (
          <Card style={styles.subscriptionCard}>
            <View style={styles.subscriptionContent}>
              <View style={[styles.crownIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="diamond" size={28} color={colors.warning} />
              </View>
              <View style={styles.subscriptionInfo}>
                <Text variant="label" weight="semibold">Upgrade to Premium</Text>
                <Text variant="caption" color="secondary">Unlock all features for {Config.SUBSCRIPTION_PRICE}/month</Text>
              </View>
            </View>
            <View style={styles.subscriptionButtons}>
              <Button
                title="Start 72-Hour Trial"
                onPress={async () => {
                  try {
                    await beginTrial();
                    Alert.alert('Trial Started', 'Your 72-hour free trial has begun!');
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to start trial');
                  }
                }}
                size="small"
                style={styles.trialButton}
              />
              <TouchableOpacity
                style={styles.skipTrialButton}
                onPress={() => setShowPaywall(true)}
              >
                <Text variant="caption" color="accent">Skip Trial & Subscribe</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>DATA SOURCES</Text>
          <Card style={styles.sectionCard} padding={0}>
            <SettingsItem icon="key-outline" label="API Keys & Integrations" onPress={() => router.push('/data-sources')} />
            <SettingsItem icon="sync-outline" label="Sync Settings" onPress={() => {}} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>ACCOUNT</Text>
          <Card style={styles.sectionCard} padding={0}>
            <SettingsItem icon="person-outline" label="Edit Profile" onPress={handleEditProfile} />
            <SettingsItem icon="notifications-outline" label="Notifications" onPress={() => {}} />
            <SettingsItem icon="card-outline" label="Subscription" onPress={() => setShowPaywall(true)} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>WIDGETS</Text>
          <Card style={styles.widgetCard}>
            <View style={styles.widgetContent}>
              <View style={[styles.widgetIconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="apps" size={28} color={colors.primary} />
              </View>
              <View style={styles.widgetInfo}>
                <Text variant="label" weight="semibold">Home Screen Widget</Text>
                <Text variant="caption" color="secondary" style={{ marginTop: 4 }}>
                  View your downloads and revenue at a glance
                </Text>
              </View>
            </View>
            <View style={[styles.widgetDivider, { backgroundColor: colors.border }]} />
            <View style={styles.widgetInstructions}>
              <Text variant="caption" color="secondary" weight="semibold" style={{ marginBottom: 8 }}>
                HOW TO ADD WIDGET
              </Text>
              <View style={styles.instructionStep}>
                <Text variant="caption" style={[styles.stepNumber, { backgroundColor: colors.primary }]}>1</Text>
                <Text variant="caption" color="secondary">Long-press on your home screen</Text>
              </View>
              <View style={styles.instructionStep}>
                <Text variant="caption" style={[styles.stepNumber, { backgroundColor: colors.primary }]}>2</Text>
                <Text variant="caption" color="secondary">Tap the + button in the top corner</Text>
              </View>
              <View style={styles.instructionStep}>
                <Text variant="caption" style={[styles.stepNumber, { backgroundColor: colors.primary }]}>3</Text>
                <Text variant="caption" color="secondary">Search for "Statly" and select a widget size</Text>
              </View>
              <View style={styles.instructionStep}>
                <Text variant="caption" style={[styles.stepNumber, { backgroundColor: colors.primary }]}>4</Text>
                <Text variant="caption" color="secondary">Tap "Add Widget" to place it on your screen</Text>
              </View>
            </View>
            <Text variant="caption" color="secondary" style={styles.widgetNote}>
              Widgets show: Today's Downloads, Total Downloads, Today's Revenue, All-Time Revenue
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>SUPPORT</Text>
          <Card style={styles.sectionCard} padding={0}>
            <SettingsItem icon="help-circle-outline" label="Help Center" onPress={() => openLink('https://getstatly.com')} external />
            <SettingsItem icon="mail-outline" label="Contact Us" onPress={() => openLink('mailto:support@dontpanic.digital')} external />
            <SettingsItem icon="chatbubble-outline" label="Send Feedback" onPress={() => openLink('mailto:support@dontpanic.digital?subject=Statly%20Feedback')} external />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>LEGAL</Text>
          <Card style={styles.sectionCard} padding={0}>
            <SettingsItem icon="document-text-outline" label="Terms of Service" onPress={() => openLink('https://getstatly.com/terms.html')} external />
            <SettingsItem icon="shield-outline" label="Privacy Policy" onPress={() => openLink('https://getstatly.com/privacy.html')} external />
            <SettingsItem icon="refresh-outline" label="Restore Purchases" onPress={handleRestore} />
          </Card>
        </View>

        <Button title="Sign Out" onPress={handleSignOut} variant="outline" style={styles.signOutButton} />
        <Text variant="caption" color="secondary" align="center" style={styles.version}>Statly v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditProfile(false)}>
        <SafeAreaView style={[styles.editNameContainer, { backgroundColor: colors.background }]}>
          <View style={styles.editNameHeader}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <Text variant="body" color="secondary">Cancel</Text>
            </TouchableOpacity>
            <Text variant="label" weight="semibold">Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
              <Text variant="body" style={{ color: saving ? colors.textSecondary : colors.accent }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.editNameContent}>
            <Text variant="caption" color="secondary" style={styles.editNameLabel}>YOUR NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />

            <Text variant="caption" color="secondary" style={[styles.editNameLabel, { marginTop: 24 }]}>COMPANY NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={newCompanyName}
              onChangeText={setNewCompanyName}
              placeholder="Enter your company name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />

            <Text variant="caption" color="secondary" style={[styles.editNameLabel, { marginTop: 24 }]}>APP NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={newAppName}
              onChangeText={setNewAppName}
              placeholder="Enter your app name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
            <Text variant="caption" color="secondary" style={{ marginTop: 8 }}>
              This name will appear on your dashboard
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Paywall */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchase={handlePurchase}
        onStartTrial={handleStartTrial}
        onRestore={handleRestore}
        purchasing={purchasing}
        monthlyPrice={Config.SUBSCRIPTION_PRICE}
      />
    </SafeAreaView>
  );
}

function SettingsItem({ icon, label, onPress, external = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; external?: boolean }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return (
    <TouchableOpacity style={[styles.settingsItem, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <Text variant="body" style={styles.settingsLabel}>{label}</Text>
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 24 },
  profileCard: { marginBottom: 16 },
  profileContent: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  subscriptionCard: { marginBottom: 24 },
  subscriptionContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  crownIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  subscriptionInfo: { flex: 1 },
  subscriptionButtons: { gap: 8 },
  trialButton: { alignSelf: 'stretch' },
  skipTrialButton: { alignSelf: 'center', paddingVertical: 8 },
  upgradeButton: { alignSelf: 'stretch' },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 8, marginLeft: 4 },
  sectionCard: { overflow: 'hidden' },
  settingsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  settingsLabel: { flex: 1, marginLeft: 12 },
  signOutButton: { marginTop: 8 },
  version: { marginTop: 24 },
  // Widget Card
  widgetCard: { marginBottom: 0 },
  widgetContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  widgetIconContainer: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  widgetInfo: { flex: 1 },
  widgetDivider: { height: 1, marginBottom: 16 },
  widgetInstructions: { marginBottom: 12 },
  instructionStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepNumber: { width: 20, height: 20, borderRadius: 10, color: '#FFFFFF', fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 20, marginRight: 10, overflow: 'hidden' },
  widgetNote: { marginTop: 8, fontStyle: 'italic' },
  // Edit Name Modal
  editNameContainer: { flex: 1 },
  editNameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  editNameContent: { padding: 24, paddingBottom: 40 },
  editNameLabel: { marginBottom: 8 },
  nameInput: { fontSize: 17, padding: 16, borderRadius: 12, borderWidth: 1 },
});
