import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/StatCard';
import { LineChart } from '@/components/charts/LineChart';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { getConnectedApps, syncAllDataSources } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import type { ConnectedApp } from '@/lib/supabase';

const DATA_SOURCE_INFO: Record<string, { name: string; icon: string; color: string }> = {
  revenuecat: { name: 'RevenueCat', icon: '💰', color: '#FF6B6B' },
  appsflyer: { name: 'AppsFlyer', icon: '📊', color: '#12CBC4' },
  adjust: { name: 'Adjust', icon: '🎯', color: '#0652DD' },
  mixpanel: { name: 'Mixpanel', icon: '📈', color: '#7C4DFF' },
  amplitude: { name: 'Amplitude', icon: '🔬', color: '#1E88E5' },
  appstore: { name: 'App Store', icon: '🍎', color: '#000000' },
};

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const { user, profile, refreshProfile } = useAuth();
  const { analytics, stats, syncing, syncAnalytics, apps, error: syncError } = useAnalytics();
  const { refresh: refreshSubscription } = useSubscription();
  const [connectedSources, setConnectedSources] = useState<ConnectedApp[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasRefreshedOnLogin = useRef(false);

  // Use connected sources from local state OR from useAnalytics apps
  const hasConnectedSources = connectedSources.length > 0 || apps.length > 0;
  const isLive = hasConnectedSources;

  // Build chart data for last 28 days, filling in zeros for missing days
  const chartData: number[] = [];
  const chartLabels: string[] = [];
  const analyticsMap = new Map(analytics.map(a => [a.date, a]));

  for (let i = 27; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = analyticsMap.get(dateStr);

    chartData.push(dayData?.downloads || 0);
    chartLabels.push(`${date.getMonth() + 1}/${date.getDate()}`);
  }

  const formatCurrency = (value: number): string =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    if (user) {
      loadConnectedSources();
    }
  }, [user]);

  // Refresh data when screen comes into focus (e.g., returning from settings or data-sources)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('[Dashboard] Screen focused, refreshing data');
        refreshProfile(); // Refresh profile to get updated app name, company name, etc.
        loadConnectedSources();
        syncAnalytics();
      }
    }, [user])
  );

  // Auto-refresh on sign-in (when coming from verify-code screen)
  useEffect(() => {
    if (user && params.refresh === 'true' && !hasRefreshedOnLogin.current) {
      hasRefreshedOnLogin.current = true;
      console.log('[Dashboard] User signed in, refreshing data...');

      // Refresh subscription status
      refreshSubscription();

      // Sync analytics data
      syncAnalytics().then(() => {
        console.log('[Dashboard] Initial sync complete');
        setLastSyncTime(new Date());
      });

      // Sync from data sources in background
      syncAllDataSources(user.id).then(() => {
        console.log('[Dashboard] Background sync from sources complete');
        syncAnalytics();
        setLastSyncTime(new Date());
      }).catch(() => {});
    }
  }, [user, params.refresh]);

  // Auto-refresh every 2 minutes for real-time data
  useEffect(() => {
    if (!user || !hasConnectedSources) return;

    const refreshData = () => {
      console.log('[Dashboard] Auto-refresh triggered');
      // Don't await - let it run in background
      syncAllDataSources(user.id)
        .then(() => syncAnalytics())
        .then(() => setLastSyncTime(new Date()))
        .catch(() => {});
    };

    // Refresh every 2 minutes (120000ms) for real-time updates
    const interval = setInterval(refreshData, 120000);

    return () => clearInterval(interval);
  }, [user, hasConnectedSources]);

  const loadConnectedSources = async () => {
    if (!user) return;
    try {
      const sources = await getConnectedApps(user.id);
      setConnectedSources(sources);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const handleSync = async () => {
    setRefreshing(true);

    // Force stop refreshing after 3 seconds no matter what
    const forceStopTimeout = setTimeout(() => {
      console.log('[Dashboard] Force stopping refresh');
      setRefreshing(false);
    }, 3000);

    try {
      if (user) {
        // Load existing data from database FIRST (fast)
        await syncAnalytics();
        console.log('[Dashboard] Data loaded');
        setRefreshing(false);
        clearTimeout(forceStopTimeout);

        // Then sync from RevenueCat in background (slow, don't wait)
        syncAllDataSources(user.id).then(() => {
          console.log('[Dashboard] Background sync complete');
          syncAnalytics(); // Reload after sync
          setLastSyncTime(new Date());
        }).catch(() => {});
      }
    } catch (error: any) {
      console.log('[Dashboard] Error:', error.message);
    } finally {
      clearTimeout(forceStopTimeout);
      setRefreshing(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || syncing}
            onRefresh={handleSync}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7}>
            <Text variant="caption" color="secondary">{getGreeting()}</Text>
            <View style={styles.appNameRow}>
              <Text variant="title" weight="bold">{profile?.app_name || 'Dashboard'}</Text>
              <Ionicons name="pencil" size={14} color={colors.textSecondary} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            {isLive ? (
              <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="pulse" size={14} color={colors.success} />
                <Text variant="caption" style={{ color: colors.success, marginLeft: 4 }}>Live</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="flask" size={14} color={colors.warning} />
                <Text variant="caption" style={{ color: colors.warning, marginLeft: 4 }}>Demo</Text>
              </View>
            )}
          </View>
        </View>

        {/* Connected Sources Banner */}
        {!hasConnectedSources ? (
          <Card style={styles.connectBanner}>
            <View style={styles.connectContent}>
              <View style={[styles.connectIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="link" size={24} color={colors.primary} />
              </View>
              <View style={styles.connectText}>
                <Text variant="label" weight="semibold">Connect Your Data</Text>
                <Text variant="caption" color="secondary">
                  Link your analytics sources to see real-time data
                </Text>
              </View>
            </View>
            <Button
              title="Add Data Source"
              onPress={() => router.push('/data-sources')}
              size="small"
              style={styles.connectButton}
            />
          </Card>
        ) : (
          <TouchableOpacity onPress={() => router.push('/data-sources')}>
            <Card style={styles.sourcesBar}>
              <View style={styles.sourcesContent}>
                <View style={styles.sourceIcons}>
                  {connectedSources.slice(0, 3).map((source, index) => (
                    <View
                      key={source.id}
                      style={[
                        styles.sourceIconSmall,
                        {
                          backgroundColor: (DATA_SOURCE_INFO[source.provider]?.color || '#666') + '20',
                          marginLeft: index > 0 ? -8 : 0,
                          zIndex: 3 - index,
                          borderColor: colors.card,
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 14 }}>
                        {DATA_SOURCE_INFO[source.provider]?.icon || '📱'}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.sourcesInfo}>
                  <Text variant="caption" weight="semibold">
                    {connectedSources.length} source{connectedSources.length !== 1 ? 's' : ''} connected
                  </Text>
                  {lastSyncTime && (
                    <Text variant="caption" color="secondary">
                      Last synced {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* Today's Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="Downloads Today"
            value={stats.downloadsToday}
            subtitle="new customers"
            icon="download-outline"
          />
          <StatCard
            title="Revenue Today"
            value={formatCurrency(stats.revenueToday)}
            subtitle="today"
            icon="cash-outline"
          />
        </View>

        {/* Weekly Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="Weekly Downloads"
            value={stats.downloadsWeek}
            subtitle="last 7 days"
            icon="calendar-outline"
          />
          <StatCard
            title="Weekly Revenue"
            value={formatCurrency(stats.revenueWeek)}
            subtitle="last 7 days"
            icon="wallet-outline"
          />
        </View>

        {/* Real-Time Stats (from RevenueCat) */}
        <View style={styles.statsRow}>
          <StatCard
            title="Active Subscriptions"
            value={stats.activeSubscriptions}
            subtitle="current"
            icon="checkmark-circle-outline"
          />
          <StatCard
            title="MRR"
            value={formatCurrency(stats.mrr)}
            subtitle="monthly recurring"
            icon="trending-up-outline"
          />
        </View>

        {/* Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text variant="label" weight="semibold">New Customers (Last 28 Days)</Text>
            <Text variant="caption" color="secondary">{stats.newCustomers.toLocaleString()} total</Text>
          </View>
          <LineChart data={chartData} labels={chartLabels} height={200} />
        </Card>

        {/* 28-Day Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="New Customers"
            value={stats.newCustomers}
            subtitle="last 28 days"
            icon="person-add-outline"
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers}
            subtitle="last 28 days"
            icon="people-outline"
          />
        </View>

        {/* 28-Day Overview */}
        <Card style={styles.overviewCard}>
          <Text variant="label" weight="semibold" style={styles.overviewTitle}>28-Day Overview</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text variant="caption" color="secondary">New Customers</Text>
              <Text variant="subtitle" weight="bold">{stats.newCustomers.toLocaleString()}</Text>
            </View>
            <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />
            <View style={styles.overviewItem}>
              <Text variant="caption" color="secondary">Total Revenue</Text>
              <Text variant="subtitle" weight="bold">{formatCurrency(stats.revenue)}</Text>
            </View>
          </View>
        </Card>

        {/* Data Sources Summary (when connected) */}
        {hasConnectedSources && (
          <Card style={styles.sourceSummaryCard}>
            <View style={styles.sourceSummaryHeader}>
              <Text variant="label" weight="semibold">Data Sources</Text>
              <TouchableOpacity onPress={() => router.push('/data-sources')}>
                <Text variant="caption" color="accent">Manage</Text>
              </TouchableOpacity>
            </View>
            {connectedSources.map((source) => {
              const info = DATA_SOURCE_INFO[source.provider];
              return (
                <View key={source.id} style={styles.sourceRow}>
                  <View style={[styles.sourceIconSmall, { backgroundColor: (info?.color || '#666') + '20' }]}>
                    <Text style={{ fontSize: 14 }}>{info?.icon || '📱'}</Text>
                  </View>
                  <Text variant="body" style={styles.sourceName}>{info?.name || source.provider}</Text>
                  <View style={styles.sourceStatus}>
                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    <Text variant="caption" color="secondary">Active</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  appNameRow: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectBanner: { marginBottom: 16 },
  connectContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  connectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  connectText: { flex: 1 },
  connectButton: { alignSelf: 'stretch' },
  sourcesBar: { marginBottom: 16, padding: 12 },
  sourcesContent: { flexDirection: 'row', alignItems: 'center' },
  sourceIcons: { flexDirection: 'row', marginRight: 12 },
  sourceIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  sourcesInfo: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  chartCard: { marginBottom: 12 },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewCard: { marginTop: 4, marginBottom: 12 },
  overviewTitle: { marginBottom: 16 },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewDivider: { width: 1, height: 40 },
  sourceSummaryCard: { marginTop: 4 },
  sourceSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sourceName: { flex: 1, marginLeft: 12 },
  sourceStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
