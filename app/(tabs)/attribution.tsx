import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PieChart } from '@/components/charts/PieChart';
import { LockedFeature } from '@/components/Paywall';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Config } from '@/constants/Config';
import { Colors } from '@/constants/Colors';

const SOCIAL_PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', icon: 'logo-twitter', color: '#1DA1F2', connected: false },
  { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', connected: false },
  { id: 'reddit', name: 'Reddit', icon: 'logo-reddit', color: '#FF4500', connected: false },
  { id: 'tiktok', name: 'TikTok', icon: 'musical-notes', color: '#000000', connected: false },
  { id: 'youtube', name: 'YouTube', icon: 'logo-youtube', color: '#FF0000', connected: false },
];

export default function AttributionScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { attributionBySource, syncing, syncAnalytics, isDemo } = useAnalytics();
  const [connectedSocials, setConnectedSocials] = useState<string[]>([]);
  const totalDownloads = attributionBySource.reduce((sum, a) => sum + a.downloads, 0);

  const getSourceIcon = (source: string): keyof typeof Ionicons.glyphMap => {
    switch (source.toLowerCase()) {
      case 'twitter': return 'logo-twitter';
      case 'instagram': return 'logo-instagram';
      case 'reddit': return 'logo-reddit';
      case 'google': return 'logo-google';
      case 'tiktok': return 'musical-notes';
      case 'youtube': return 'logo-youtube';
      default: return 'link-outline';
    }
  };

  const getSourceColor = (source: string): string =>
    Config.ATTRIBUTION_SOURCES.find((s) => s.name.toLowerCase() === source.toLowerCase())?.color || colors.primary;

  const handleConnectSocial = (platformId: string) => {
    // In production, this would open OAuth flow
    Alert.alert(
      'Connect Account',
      'This will link your social account to track referral traffic and downloads.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: () => {
            setConnectedSocials([...connectedSocials, platformId]);
            Alert.alert('Connected!', 'Your account has been linked. Attribution data will start appearing within 24 hours.');
          }
        },
      ]
    );
  };

  const handleDisconnectSocial = (platformId: string) => {
    setConnectedSocials(connectedSocials.filter(id => id !== platformId));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LockedFeature feature="attribution" featureTitle="Attribution Tracking">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncAnalytics} tintColor={colors.primary} />}
        >
          <View style={styles.header}>
            <Text variant="title" weight="bold">Attribution</Text>
            <Text variant="body" color="secondary">Track where your users come from</Text>
          </View>

          {isDemo && (
            <Card style={[styles.demoCard, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="information-circle" size={20} color={colors.warning} />
              <Text variant="caption" style={{ color: colors.warning, marginLeft: 8, flex: 1 }}>
                Showing demo data. Connect your socials to see real attribution.
              </Text>
            </Card>
          )}

          {/* Connect Socials Section */}
          <Card style={styles.connectCard}>
            <View style={styles.connectHeader}>
              <Ionicons name="share-social" size={24} color={colors.primary} />
              <Text variant="label" weight="semibold" style={styles.connectTitle}>
                Connect Your Socials
              </Text>
            </View>
            <Text variant="caption" color="secondary" style={styles.connectDesc}>
              Link your social accounts to track where clicks and downloads come from
            </Text>
            <View style={styles.socialGrid}>
              {SOCIAL_PLATFORMS.map((platform) => {
                const isConnected = connectedSocials.includes(platform.id);
                return (
                  <TouchableOpacity
                    key={platform.id}
                    style={[
                      styles.socialButton,
                      { backgroundColor: isConnected ? platform.color + '20' : colors.surface },
                      isConnected && { borderColor: platform.color, borderWidth: 2 }
                    ]}
                    onPress={() => isConnected ? handleDisconnectSocial(platform.id) : handleConnectSocial(platform.id)}
                  >
                    <Ionicons
                      name={platform.icon as any}
                      size={24}
                      color={isConnected ? platform.color : colors.textSecondary}
                    />
                    <Text
                      variant="caption"
                      weight={isConnected ? 'semibold' : 'regular'}
                      style={{ color: isConnected ? platform.color : colors.textSecondary, marginTop: 4 }}
                    >
                      {platform.name}
                    </Text>
                    {isConnected && (
                      <View style={[styles.connectedBadge, { backgroundColor: platform.color }]}>
                        <Ionicons name="checkmark" size={10} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Traffic Sources Chart */}
          <Card style={styles.chartCard}>
            <Text variant="label" weight="semibold" style={styles.chartTitle}>
              Traffic Sources (Last 30 Days)
            </Text>
            <PieChart data={attributionBySource} height={250} />
          </Card>

          {/* Source Breakdown */}
          <Text variant="label" weight="semibold" style={styles.sectionTitle}>
            Source Breakdown
          </Text>
          {attributionBySource.map((item, index) => {
            const percentage = totalDownloads > 0 ? ((item.downloads / totalDownloads) * 100).toFixed(1) : '0';
            return (
              <Card key={item.source} style={styles.sourceCard}>
                <View style={styles.sourceContent}>
                  <View style={[styles.sourceIcon, { backgroundColor: getSourceColor(item.source) + '20' }]}>
                    <Ionicons name={getSourceIcon(item.source)} size={24} color={getSourceColor(item.source)} />
                  </View>
                  <View style={styles.sourceInfo}>
                    <Text variant="label" weight="semibold">{item.source}</Text>
                    <Text variant="caption" color="secondary">{item.downloads.toLocaleString()} downloads</Text>
                  </View>
                  <View style={styles.sourceStats}>
                    <Text variant="subtitle" weight="bold">{percentage}%</Text>
                    <View style={[styles.rankBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text variant="caption" color="accent" weight="semibold">#{index + 1}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { backgroundColor: getSourceColor(item.source), width: `${percentage}%` }]} />
                </View>
              </Card>
            );
          })}

          {/* UTM Tracking Info */}
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
              <Text variant="label" weight="semibold" style={styles.infoTitle}>Pro Tip: UTM Tracking</Text>
            </View>
            <Text variant="body" color="secondary">
              Add UTM parameters to your marketing links to track specific campaigns.{'\n\n'}
              Example: ?utm_source=twitter&utm_campaign=launch
            </Text>
          </Card>
        </ScrollView>
      </LockedFeature>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 24 },
  demoCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  connectCard: { marginBottom: 24 },
  connectHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  connectTitle: { marginLeft: 12 },
  connectDesc: { marginBottom: 16 },
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  socialButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  connectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: { marginBottom: 24 },
  chartTitle: { marginBottom: 16 },
  sectionTitle: { marginBottom: 12 },
  sourceCard: { marginBottom: 12 },
  sourceContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sourceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sourceInfo: { flex: 1 },
  sourceStats: { alignItems: 'flex-end' },
  rankBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  infoCard: { marginTop: 12 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoTitle: { marginLeft: 12 },
});
