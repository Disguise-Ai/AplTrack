import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, RefreshControl, TouchableOpacity, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { LockedFeature } from '@/components/Paywall';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateTrackingLink, getAttributionStats, AttributionStats } from '@/lib/api';
import { Colors } from '@/constants/Colors';

const SOURCE_ICONS: Record<string, { icon: string; color: string }> = {
  'Twitter': { icon: 'logo-twitter', color: '#1DA1F2' },
  'Reddit': { icon: 'logo-reddit', color: '#FF4500' },
  'Instagram': { icon: 'logo-instagram', color: '#E4405F' },
  'TikTok': { icon: 'musical-notes', color: '#ff0050' },
  'Facebook': { icon: 'logo-facebook', color: '#1877F2' },
  'YouTube': { icon: 'logo-youtube', color: '#FF0000' },
  'LinkedIn': { icon: 'logo-linkedin', color: '#0A66C2' },
  'Google': { icon: 'logo-google', color: '#4285F4' },
  'direct': { icon: 'link-outline', color: '#34C759' },
};

export default function AttributionScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [smartLink, setSmartLink] = useState<string>('');
  const [stats, setStats] = useState<AttributionStats[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get or create tracking link
      const link = await getOrCreateTrackingLink(
        user.id,
        profile?.app_name || undefined,
        undefined // app store URL
      );
      setSmartLink(`apltrack.link/${link.app_slug}`);

      // Get attribution stats
      const attributionStats = await getAttributionStats(user.id, 30);
      setStats(attributionStats);
    } catch (error) {
      console.error('Error loading attribution data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.app_name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCopyLink = async () => {
    // Use the actual tracking URL for now (until custom domain is set up)
    const trackingUrl = `https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/track-click/${smartLink.replace('apltrack.link/', '')}`;

    try {
      await Share.share({
        message: trackingUrl,
        url: trackingUrl,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // User cancelled share
    }
  };

  const totalClicks = stats.reduce((sum, s) => sum + s.clicks, 0);
  const totalInstalls = stats.reduce((sum, s) => sum + s.installs, 0);
  const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);

  const getSourceInfo = (source: string) => {
    return SOURCE_ICONS[source] || { icon: 'globe-outline', color: colors.primary };
  };

  const hasData = stats.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LockedFeature feature="attribution" featureTitle="Attribution Tracking">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.header}>
            <Text variant="title" weight="bold">Attribution</Text>
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, { backgroundColor: '#34C759' }]} />
              <Text variant="caption" style={{ color: '#34C759' }}>Live</Text>
            </View>
          </View>

          {/* Smart Link Card */}
          <Card style={styles.linkCard}>
            <View style={styles.linkHeader}>
              <View style={[styles.linkIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="link" size={24} color={colors.primary} />
              </View>
              <View style={styles.linkInfo}>
                <Text variant="label" weight="semibold">Your Smart Link</Text>
                <Text variant="caption" color="secondary">One link for all platforms - auto-tracks source</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.linkBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleCopyLink}
              activeOpacity={0.7}
            >
              <Text variant="body" weight="semibold" style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                {smartLink || 'Loading...'}
              </Text>
              <View style={[styles.copyButton, { backgroundColor: copied ? '#34C759' : '#8B5CF6' }]}>
                <Ionicons name={copied ? "checkmark" : "share-outline"} size={16} color="white" />
                <Text variant="caption" weight="semibold" style={{ color: 'white', marginLeft: 4 }}>
                  {copied ? 'Copied!' : 'Share'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.hintBox, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text variant="caption" style={{ color: colors.primary, marginLeft: 8, flex: 1 }}>
                No setup needed! Just paste this link anywhere and we track the source automatically.
              </Text>
            </View>
          </Card>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text variant="caption" color="secondary">Total Clicks</Text>
              <Text variant="title" weight="bold">{totalClicks}</Text>
              {totalClicks > 0 && (
                <Text variant="caption" style={{ color: '#34C759' }}>Live</Text>
              )}
            </Card>
            <Card style={styles.statCard}>
              <Text variant="caption" color="secondary">Installs</Text>
              <Text variant="title" weight="bold">{totalInstalls}</Text>
              {totalInstalls > 0 && (
                <Text variant="caption" style={{ color: '#34C759' }}>Tracked</Text>
              )}
            </Card>
            <Card style={styles.statCard}>
              <Text variant="caption" color="secondary">Revenue</Text>
              <Text variant="title" weight="bold">${totalRevenue.toFixed(0)}</Text>
              {totalRevenue > 0 && (
                <Text variant="caption" style={{ color: '#34C759' }}>Attributed</Text>
              )}
            </Card>
          </View>

          {/* Source Breakdown */}
          <View style={styles.sectionHeader}>
            <Text variant="label" weight="semibold">Traffic Sources</Text>
            <Text variant="caption" color="secondary">Last 30 days</Text>
          </View>

          {/* Show all traffic sources - 0 until data comes in */}
          {(() => {
            const defaultSources = [
              { source: 'Twitter', clicks: 0, installs: 0, revenue: 0 },
              { source: 'Instagram', clicks: 0, installs: 0, revenue: 0 },
              { source: 'TikTok', clicks: 0, installs: 0, revenue: 0 },
              { source: 'Reddit', clicks: 0, installs: 0, revenue: 0 },
              { source: 'Facebook', clicks: 0, installs: 0, revenue: 0 },
              { source: 'YouTube', clicks: 0, installs: 0, revenue: 0 },
              { source: 'LinkedIn', clicks: 0, installs: 0, revenue: 0 },
              { source: 'Google', clicks: 0, installs: 0, revenue: 0 },
              { source: 'direct', clicks: 0, installs: 0, revenue: 0 },
            ];

            // Merge real data with defaults
            const merged = defaultSources.map(def => {
              const real = stats.find(s => s.source.toLowerCase() === def.source.toLowerCase());
              return real || def;
            });

            // Add any sources from real data not in defaults
            stats.forEach(s => {
              if (!merged.find(m => m.source.toLowerCase() === s.source.toLowerCase())) {
                merged.push(s);
              }
            });

            // Sort by clicks descending
            return merged.sort((a, b) => b.clicks - a.clicks);
          })().map((item, index) => {
            const convRate = item.clicks > 0 ? ((item.installs / item.clicks) * 100).toFixed(1) : '0';
            const sourceInfo = getSourceInfo(item.source);

            return (
              <Card key={item.source} style={styles.sourceCard}>
                <View style={styles.sourceRow}>
                  <View style={[styles.sourceIcon, { backgroundColor: sourceInfo.color + '20' }]}>
                    <Ionicons name={sourceInfo.icon as any} size={24} color={sourceInfo.color} />
                  </View>
                  <View style={styles.sourceInfo}>
                    <View style={styles.sourceNameRow}>
                      <Text variant="label" weight="semibold">{item.source}</Text>
                      {index === 0 && hasData && item.clicks > 0 && (
                        <View style={[styles.topBadge, { backgroundColor: '#FFD700' + '30' }]}>
                          <Ionicons name="trophy" size={10} color="#FFD700" />
                          <Text variant="caption" style={{ color: '#FFD700', marginLeft: 2 }}>Top</Text>
                        </View>
                      )}
                    </View>
                    <Text variant="caption" color="secondary">{convRate}% conversion</Text>
                  </View>
                  <View style={styles.sourceStats}>
                    <Text variant="body" weight="bold">{item.clicks}</Text>
                    <Text variant="caption" color="secondary">clicks</Text>
                  </View>
                  <View style={styles.sourceStats}>
                    <Text variant="body" weight="bold">{item.installs}</Text>
                    <Text variant="caption" color="secondary">installs</Text>
                  </View>
                </View>

                {/* Progress bar */}
                {totalClicks > 0 && (
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: sourceInfo.color, width: `${(item.clicks / totalClicks) * 100}%` }
                      ]}
                    />
                  </View>
                )}
              </Card>
            );
          })}

          {/* How it works */}
          <Card style={[styles.infoCard, { backgroundColor: colors.primary + '10' }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
              <Text variant="label" weight="semibold" style={{ marginLeft: 8, color: colors.primary }}>
                How It Works
              </Text>
            </View>
            <View style={styles.infoSteps}>
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text variant="caption" style={{ color: 'white' }}>1</Text>
                </View>
                <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                  Share your smart link above
                </Text>
              </View>
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text variant="caption" style={{ color: 'white' }}>2</Text>
                </View>
                <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                  Paste it anywhere - Twitter, Reddit, Instagram, etc.
                </Text>
              </View>
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text variant="caption" style={{ color: 'white' }}>3</Text>
                </View>
                <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                  Watch real-time data flow in automatically
                </Text>
              </View>
            </View>
          </Card>

          <Text variant="caption" color="secondary" align="center" style={styles.footer}>
            Data updates in real-time • No 24-48 hour delay
          </Text>
        </ScrollView>
      </LockedFeature>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759' + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  linkCard: { marginBottom: 20 },
  linkHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  linkIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkInfo: { flex: 1 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  sourceCard: { marginBottom: 12 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sourceInfo: { flex: 1 },
  sourceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceStats: {
    alignItems: 'center',
    marginLeft: 12,
    minWidth: 50,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 2
  },
  infoCard: { marginTop: 12, marginBottom: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoSteps: { gap: 10 },
  infoStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  footer: { marginTop: 8 },
});
