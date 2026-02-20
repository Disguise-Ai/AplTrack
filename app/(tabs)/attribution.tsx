import React from 'react';
import { View, StyleSheet, useColorScheme, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { PieChart } from '@/components/charts/PieChart';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Config } from '@/constants/Config';
import { Colors } from '@/constants/Colors';

export default function AttributionScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { attributionBySource, syncing, syncAnalytics, isDemo } = useAnalytics();
  const totalDownloads = attributionBySource.reduce((sum, a) => sum + a.downloads, 0);
  const getSourceIcon = (source: string): keyof typeof Ionicons.glyphMap => { switch (source.toLowerCase()) { case 'twitter': return 'logo-twitter'; case 'instagram': return 'logo-instagram'; case 'reddit': return 'logo-reddit'; case 'google': return 'logo-google'; default: return 'link-outline'; } };
  const getSourceColor = (source: string): string => Config.ATTRIBUTION_SOURCES.find((s) => s.name.toLowerCase() === source.toLowerCase())?.color || colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncAnalytics} tintColor={colors.primary} />}>
        <View style={styles.header}><Text variant="title" weight="bold">Attribution</Text><Text variant="body" color="secondary">Track where your users come from</Text></View>
        {isDemo && <Card style={[styles.demoCard, { backgroundColor: colors.warning + '15' }]}><Ionicons name="information-circle" size={20} color={colors.warning} /><Text variant="caption" style={{ color: colors.warning, marginLeft: 8, flex: 1 }}>Showing demo data. Connect your app to see real attribution.</Text></Card>}
        <Card style={styles.chartCard}><Text variant="label" weight="semibold" style={styles.chartTitle}>Traffic Sources (Last 30 Days)</Text><PieChart data={attributionBySource} height={250} /></Card>
        <Text variant="label" weight="semibold" style={styles.sectionTitle}>Source Breakdown</Text>
        {attributionBySource.map((item, index) => {
          const percentage = totalDownloads > 0 ? ((item.downloads / totalDownloads) * 100).toFixed(1) : '0';
          return (
            <Card key={item.source} style={styles.sourceCard}>
              <View style={styles.sourceContent}>
                <View style={[styles.sourceIcon, { backgroundColor: getSourceColor(item.source) + '20' }]}><Ionicons name={getSourceIcon(item.source)} size={24} color={getSourceColor(item.source)} /></View>
                <View style={styles.sourceInfo}><Text variant="label" weight="semibold">{item.source}</Text><Text variant="caption" color="secondary">{item.downloads.toLocaleString()} downloads</Text></View>
                <View style={styles.sourceStats}><Text variant="subtitle" weight="bold">{percentage}%</Text><View style={[styles.rankBadge, { backgroundColor: colors.primary + '15' }]}><Text variant="caption" color="accent" weight="semibold">#{index + 1}</Text></View></View>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: getSourceColor(item.source), width: `${percentage}%` }]} /></View>
            </Card>
          );
        })}
        <Card style={styles.infoCard}><View style={styles.infoHeader}><Ionicons name="bulb-outline" size={24} color={colors.primary} /><Text variant="label" weight="semibold" style={styles.infoTitle}>Pro Tip: UTM Tracking</Text></View><Text variant="body" color="secondary">Add UTM parameters to your marketing links to track specific campaigns. Example: ?utm_source=twitter&utm_campaign=launch</Text></Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, scrollContent: { padding: 16, paddingBottom: 32 }, header: { marginBottom: 24 }, demoCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, chartCard: { marginBottom: 24 }, chartTitle: { marginBottom: 16 }, sectionTitle: { marginBottom: 12 }, sourceCard: { marginBottom: 12 }, sourceContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, sourceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, sourceInfo: { flex: 1 }, sourceStats: { alignItems: 'flex-end' }, rankBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 }, progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3 }, infoCard: { marginTop: 12 }, infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, infoTitle: { marginLeft: 12 } });
