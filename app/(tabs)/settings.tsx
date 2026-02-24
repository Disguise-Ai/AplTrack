import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, Alert, Linking, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TrialCountdown } from '@/components/TrialCountdown';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Config } from '@/constants/Config';
import { Colors } from '@/constants/Colors';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile, signOut, updateProfile } = useAuth();
  const { isPremium, isTrial, trialEndsAt, monthlyPackage, purchase, restore, purchasing, beginTrial } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        try {
          await signOut();
          router.replace('/(auth)/welcome');
        } catch (error) {
          console.error('Error signing out:', error);
        }
      }}
    ]);
  };

  const handleEditName = () => {
    setNewName(profile?.full_name || '');
    setShowEditName(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ full_name: newName.trim() });
      setShowEditName(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handlePurchase = async () => {
    if (!monthlyPackage) {
      Alert.alert('Error', 'Subscription not available. Please try again later.');
      return;
    }
    try {
      await purchase(monthlyPackage);
      setShowPaywall(false);
      Alert.alert('Success', 'Welcome to Statly Premium!');
    } catch (error: any) {
      if (error.message !== 'Purchase cancelled') {
        Alert.alert('Error', error.message || 'Purchase failed. Please try again.');
      }
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      Alert.alert('Success', 'Purchases restored successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases.');
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

        {/* Profile Card - Clickable Name */}
        <Card style={styles.profileCard}>
          <TouchableOpacity style={styles.profileContent} onPress={handleEditName} activeOpacity={0.7}>
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
              {profile?.company_name && (
                <Text variant="caption" color="secondary">{profile.company_name}</Text>
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
                <Text variant="caption" color="secondary">Unlock all features for {Config.SUBSCRIPTION_PRICE}</Text>
              </View>
            </View>
            <Button
              title="Start Free Trial"
              onPress={async () => {
                try {
                  await beginTrial();
                  Alert.alert('Trial Started', 'Your 72-hour free trial has begun!');
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Failed to start trial');
                }
              }}
              size="small"
              style={styles.upgradeButton}
            />
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
            <SettingsItem icon="person-outline" label="Edit Profile" onPress={handleEditName} />
            <SettingsItem icon="notifications-outline" label="Notifications" onPress={() => {}} />
            <SettingsItem icon="card-outline" label="Subscription" onPress={() => setShowPaywall(true)} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>SUPPORT</Text>
          <Card style={styles.sectionCard} padding={0}>
            <SettingsItem icon="help-circle-outline" label="Help Center" onPress={() => openLink('https://apltrack.com/help')} external />
            <SettingsItem icon="mail-outline" label="Contact Us" onPress={() => openLink('mailto:support@apltrack.com')} external />
            <SettingsItem icon="chatbubble-outline" label="Send Feedback" onPress={() => openLink('https://apltrack.com/feedback')} external />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary" style={styles.sectionTitle}>LEGAL</Text>
          <Card style={styles.sectionCard} padding={0}>
            <SettingsItem icon="document-text-outline" label="Terms of Service" onPress={() => openLink('https://apltrack.com/terms')} external />
            <SettingsItem icon="shield-outline" label="Privacy Policy" onPress={() => openLink('https://apltrack.com/privacy')} external />
            <SettingsItem icon="refresh-outline" label="Restore Purchases" onPress={handleRestore} />
          </Card>
        </View>

        <Button title="Sign Out" onPress={handleSignOut} variant="outline" style={styles.signOutButton} />
        <Text variant="caption" color="secondary" align="center" style={styles.version}>Statly v1.0.0</Text>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={showEditName} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditName(false)}>
        <SafeAreaView style={[styles.editNameContainer, { backgroundColor: colors.background }]}>
          <View style={styles.editNameHeader}>
            <TouchableOpacity onPress={() => setShowEditName(false)}>
              <Text variant="body" color="secondary">Cancel</Text>
            </TouchableOpacity>
            <Text variant="label" weight="semibold">Edit Name</Text>
            <TouchableOpacity onPress={handleSaveName} disabled={saving}>
              <Text variant="body" style={{ color: saving ? colors.textSecondary : colors.accent }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.editNameContent}>
            <Text variant="caption" color="secondary" style={styles.editNameLabel}>YOUR NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              autoCapitalize="words"
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Paywall Modal */}
      <Modal visible={showPaywall} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPaywall(false)}>
        <SafeAreaView style={[styles.paywallContainer, { backgroundColor: colors.background }]}>
          <View style={styles.paywallHeader}>
            <TouchableOpacity onPress={() => setShowPaywall(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.paywallContent}>
            <View style={[styles.paywallIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="diamond" size={48} color="#FFFFFF" />
            </View>
            <Text variant="title" weight="bold" align="center" style={styles.paywallTitle}>Statly Premium</Text>
            <Text variant="body" color="secondary" align="center" style={styles.paywallSubtitle}>Unlock the full power of app analytics</Text>
            <View style={styles.features}>
              <PaywallFeature icon="sync-outline" title="Real-time Analytics Sync" description="Get live updates from App Store Connect" />
              <PaywallFeature icon="chatbubbles-outline" title="Unlimited AI Chat" description="Marketing and sales advice on demand" />
              <PaywallFeature icon="trophy-outline" title="Leaderboard Access" description="See top MRR apps and AI models" />
              <PaywallFeature icon="notifications-outline" title="Push Notifications" description="Instant alerts for downloads and revenue" />
            </View>
            <View style={styles.priceContainer}>
              <Text variant="title" weight="bold">{Config.SUBSCRIPTION_PRICE}</Text>
              <Text variant="caption" color="secondary">Cancel anytime</Text>
            </View>
            <Button
              title={purchasing ? 'Processing...' : 'Subscribe Now'}
              onPress={handlePurchase}
              loading={purchasing}
              disabled={!monthlyPackage || purchasing}
              size="large"
              style={styles.subscribeButton}
            />
            <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
              <Text variant="label" color="secondary">Restore Purchases</Text>
            </TouchableOpacity>
            <Text variant="caption" color="secondary" align="center" style={styles.disclaimer}>
              Payment will be charged to your Apple ID account. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

function PaywallFeature({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.featureText}>
        <Text variant="label" weight="semibold">{title}</Text>
        <Text variant="caption" color="secondary">{description}</Text>
      </View>
    </View>
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
  upgradeButton: { alignSelf: 'stretch' },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 8, marginLeft: 4 },
  sectionCard: { overflow: 'hidden' },
  settingsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  settingsLabel: { flex: 1, marginLeft: 12 },
  signOutButton: { marginTop: 8 },
  version: { marginTop: 24 },
  // Edit Name Modal
  editNameContainer: { flex: 1 },
  editNameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  editNameContent: { padding: 24 },
  editNameLabel: { marginBottom: 8 },
  nameInput: { fontSize: 17, padding: 16, borderRadius: 12, borderWidth: 1 },
  // Paywall
  paywallContainer: { flex: 1 },
  paywallHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16 },
  paywallContent: { padding: 24, alignItems: 'center' },
  paywallIcon: { width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  paywallTitle: { marginBottom: 8 },
  paywallSubtitle: { marginBottom: 32 },
  features: { width: '100%', marginBottom: 32 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  featureText: { flex: 1 },
  priceContainer: { alignItems: 'center', marginBottom: 24 },
  subscribeButton: { width: '100%', marginBottom: 16 },
  restoreButton: { padding: 12 },
  disclaimer: { marginTop: 16, paddingHorizontal: 16 },
});
