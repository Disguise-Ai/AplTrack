import React from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/StatCard';
import { LineChart } from '@/components/charts/LineChart';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Colors } from '@/constants/Colors';

export default function DashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { profile } = useAuth();
  const { analytics, stats, syncing, syncAnalytics, isDemo } = useAnalytics();
  const chartData = analytics.map((a) => a.downloads);
  const chartLabels = analytics.map((a) => { const date = new Date(a.date); return `${date.getMonth() + 1}/${date.getDate()}`; });
  const formatCurrency = (value: number): string => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncAnalytics} tintColor={colors.primary} />}>
        <View style={styles.header}>
          <View><Text variant="caption" color="secondary">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</Text><Text variant="title" weight="bold">{profile?.app_name || 'Dashboard'}</Text></View>
          {isDemo && <View style={[styles.demoBadge, { backgroundColor: colors.warning + '20' }]}><Ionicons name="flask" size={14} color={colors.warning} /><Text variant="caption" style={{ color: colors.warning, marginLeft: 4 }}>Demo</Text></View>}
        </View>
        <View style={styles.statsRow}><StatCard title="Downloads Today" value={stats.downloadsToday} subtitle="vs yesterday" icon="download-outline" /><StatCard title="Revenue Today" value={formatCurrency(stats.revenueToday)} subtitle="vs yesterday" icon="cash-outline" /></View>
        <View style={styles.statsRow}><StatCard title="Weekly Downloads" value={stats.downloadsWeek} change={stats.downloadsChange} icon="trending-up-outline" /><StatCard title="Weekly Revenue" value={formatCurrency(stats.revenueWeek)} change={stats.revenueChange} icon="wallet-outline" /></View>
        <Card style={styles.chartCard}><View style={styles.chartHeader}><Text variant="label" weight="semibold">Downloads (Last 30 Days)</Text><Text variant="caption" color="secondary">{stats.downloadsMonth.toLocaleString()} total</Text></View><LineChart data={chartData} labels={chartLabels} height={200} /></Card>
        <View style={styles.statsRow}><StatCard title="Active Users" value={stats.activeUsers} icon="people-outline" /><StatCard title="Avg Rating" value={stats.averageRating.toFixed(1)} subtitle={`${stats.ratingsCount} reviews`} icon="star-outline" /></View>
        <Card style={styles.overviewCard}><Text variant="label" weight="semibold" style={styles.overviewTitle}>Monthly Overview</Text><View style={styles.overviewRow}><View style={styles.overviewItem}><Text variant="caption" color="secondary">Total Downloads</Text><Text variant="subtitle" weight="bold">{stats.downloadsMonth.toLocaleString()}</Text></View><View style={[styles.overviewDivider, { backgroundColor: colors.border }]} /><View style={styles.overviewItem}><Text variant="caption" color="secondary">Total Revenue</Text><Text variant="subtitle" weight="bold">{formatCurrency(stats.revenueMonth)}</Text></View></View></Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, scrollContent: { padding: 16, paddingBottom: 32 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }, demoBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }, statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 }, chartCard: { marginBottom: 12 }, chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, overviewCard: { marginTop: 4 }, overviewTitle: { marginBottom: 16 }, overviewRow: { flexDirection: 'row', alignItems: 'center' }, overviewItem: { flex: 1, alignItems: 'center' }, overviewDivider: { width: 1, height: 40 } });
