import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

interface AIModel {
  rank: number;
  name: string;
  provider: string;
  score: number;
  change: number; // position change
  isNew: boolean;
  speed: number; // tokens/sec
  accuracy: number;
  reasoning: number;
  coding: number;
  color: string;
}

interface LeaderboardApp {
  rank: number;
  name: string;
  category: string;
  mrr: number;
  change: number;
  icon: string;
}

// AI Model Rankings - BridgeBench style
const AI_MODELS: AIModel[] = [
  { rank: 1, name: 'Claude Opus 4', provider: 'Anthropic', score: 94.2, change: 0, isNew: false, speed: 45, accuracy: 96, reasoning: 95, coding: 92, color: '#A78BFA' },
  { rank: 2, name: 'GPT-5', provider: 'OpenAI', score: 92.8, change: 1, isNew: true, speed: 52, accuracy: 94, reasoning: 93, coding: 91, color: '#10B981' },
  { rank: 3, name: 'Claude Sonnet 4', provider: 'Anthropic', score: 91.5, change: -1, isNew: false, speed: 78, accuracy: 92, reasoning: 91, coding: 90, color: '#A78BFA' },
  { rank: 4, name: 'Gemini 2.0 Ultra', provider: 'Google', score: 89.7, change: 2, isNew: true, speed: 65, accuracy: 91, reasoning: 88, coding: 89, color: '#3B82F6' },
  { rank: 5, name: 'DeepSeek V3', provider: 'DeepSeek', score: 88.4, change: 3, isNew: true, speed: 120, accuracy: 89, reasoning: 87, coding: 91, color: '#EC4899' },
  { rank: 6, name: 'Llama 4', provider: 'Meta', score: 87.1, change: 0, isNew: true, speed: 95, accuracy: 88, reasoning: 86, coding: 87, color: '#8B5CF6' },
  { rank: 7, name: 'Grok 3', provider: 'xAI', score: 85.6, change: 1, isNew: true, speed: 82, accuracy: 86, reasoning: 85, coding: 84, color: '#F59E0B' },
  { rank: 8, name: 'Mistral Large 2', provider: 'Mistral', score: 84.2, change: -2, isNew: false, speed: 88, accuracy: 85, reasoning: 83, coding: 85, color: '#06B6D4' },
  { rank: 9, name: 'Claude Haiku 3.5', provider: 'Anthropic', score: 82.8, change: 0, isNew: false, speed: 145, accuracy: 83, reasoning: 81, coding: 83, color: '#A78BFA' },
  { rank: 10, name: 'Qwen 2.5 Max', provider: 'Alibaba', score: 81.3, change: 2, isNew: true, speed: 110, accuracy: 82, reasoning: 80, coding: 82, color: '#EF4444' },
];

// Top MRR Apps
const TOP_MRR_APPS: LeaderboardApp[] = [
  { rank: 1, name: 'Fitness Pro', category: 'Health & Fitness', mrr: 892000, change: 12.4, icon: '💪' },
  { rank: 2, name: 'MindfulMe', category: 'Health & Fitness', mrr: 654000, change: 8.2, icon: '🧘' },
  { rank: 3, name: 'PhotoMaster', category: 'Photo & Video', mrr: 543000, change: -2.1, icon: '📸' },
  { rank: 4, name: 'TaskFlow', category: 'Productivity', mrr: 421000, change: 15.7, icon: '✅' },
  { rank: 5, name: 'LangLearn', category: 'Education', mrr: 398000, change: 5.3, icon: '🌍' },
  { rank: 6, name: 'BudgetBoss', category: 'Finance', mrr: 356000, change: 9.8, icon: '💰' },
  { rank: 7, name: 'SleepWell', category: 'Health & Fitness', mrr: 312000, change: 4.2, icon: '😴' },
  { rank: 8, name: 'CodeSnippet', category: 'Developer Tools', mrr: 287000, change: 18.9, icon: '💻' },
  { rank: 9, name: 'RecipeBox', category: 'Food & Drink', mrr: 245000, change: 6.1, icon: '🍳' },
  { rank: 10, name: 'JournalAI', category: 'Lifestyle', mrr: 198000, change: 22.3, icon: '📔' },
];

type SortMetric = 'score' | 'speed' | 'accuracy' | 'reasoning' | 'coding';

export default function LeaderboardScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [activeTab, setActiveTab] = useState<'ai' | 'mrr'>('ai');
  const [sortMetric, setSortMetric] = useState<SortMetric>('score');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const sortedModels = [...AI_MODELS].sort((a, b) => b[sortMetric] - a[sortMetric]);

  const formatMRR = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: '#FFD700', text: '#000' };
    if (rank === 2) return { bg: '#C0C0C0', text: '#000' };
    if (rank === 3) return { bg: '#CD7F32', text: '#FFF' };
    return { bg: colors.card, text: colors.textSecondary };
  };

  const renderAILeaderboard = () => (
    <View>
      {/* Sort Controls */}
      <View style={styles.sortContainer}>
        <Text variant="caption" color="secondary">Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
          {(['score', 'speed', 'accuracy', 'reasoning', 'coding'] as SortMetric[]).map((metric) => (
            <TouchableOpacity
              key={metric}
              style={[
                styles.sortChip,
                {
                  backgroundColor: sortMetric === metric ? colors.accent : colors.card,
                  borderColor: sortMetric === metric ? colors.accent : colors.border,
                },
              ]}
              onPress={() => setSortMetric(metric)}
            >
              <Text
                variant="caption"
                weight={sortMetric === metric ? 'semibold' : 'regular'}
                style={{ color: sortMetric === metric ? '#FFF' : colors.textSecondary }}
              >
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Benchmark Info */}
      <View style={[styles.benchmarkInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
        <Text variant="caption" color="secondary" style={{ marginLeft: 8, flex: 1 }}>
          Scores normalized to 0-100 scale based on comprehensive evaluations
        </Text>
      </View>

      {/* Model Cards */}
      {sortedModels.map((model, index) => {
        const displayRank = index + 1;
        const badge = getRankBadge(displayRank);
        const scoreWidth = (model[sortMetric] / 100) * 100;

        return (
          <View
            key={model.name}
            style={[styles.modelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {/* Rank Badge */}
            <View style={[styles.rankBadge, { backgroundColor: badge.bg }]}>
              <Text variant="caption" weight="bold" style={{ color: badge.text }}>
                {displayRank}
              </Text>
            </View>

            {/* Model Info */}
            <View style={styles.modelInfo}>
              <View style={styles.modelHeader}>
                <View style={styles.modelName}>
                  <Text variant="label" weight="semibold">{model.name}</Text>
                  {model.isNew && (
                    <View style={[styles.newBadge, { backgroundColor: colors.success }]}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text variant="title" weight="bold" style={{ color: model.color }}>
                  {model[sortMetric].toFixed(1)}
                </Text>
              </View>

              <Text variant="caption" color="secondary" style={{ marginBottom: 8 }}>
                {model.provider}
              </Text>

              {/* Score Bar */}
              <View style={[styles.scoreBarContainer, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.scoreBar,
                    { width: `${scoreWidth}%`, backgroundColor: model.color },
                  ]}
                />
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text variant="caption" color="secondary">Speed</Text>
                  <Text variant="caption" weight="semibold">{model.speed} t/s</Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="caption" color="secondary">Accuracy</Text>
                  <Text variant="caption" weight="semibold">{model.accuracy}%</Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="caption" color="secondary">Reasoning</Text>
                  <Text variant="caption" weight="semibold">{model.reasoning}%</Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="caption" color="secondary">Coding</Text>
                  <Text variant="caption" weight="semibold">{model.coding}%</Text>
                </View>
              </View>
            </View>

            {/* Change Indicator */}
            {model.change !== 0 && (
              <View style={styles.changeIndicator}>
                <Ionicons
                  name={model.change > 0 ? 'caret-up' : 'caret-down'}
                  size={12}
                  color={model.change > 0 ? colors.success : colors.error}
                />
                <Text
                  variant="caption"
                  style={{ color: model.change > 0 ? colors.success : colors.error, fontSize: 10 }}
                >
                  {Math.abs(model.change)}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderMRRLeaderboard = () => (
    <View style={styles.mrrList}>
      {TOP_MRR_APPS.map((app) => {
        const badge = getRankBadge(app.rank);
        return (
          <View
            key={app.rank}
            style={[styles.mrrCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.rankBadge, { backgroundColor: badge.bg }]}>
              <Text variant="caption" weight="bold" style={{ color: badge.text }}>
                {app.rank}
              </Text>
            </View>
            <View style={styles.appIcon}>
              <Text style={{ fontSize: 28 }}>{app.icon}</Text>
            </View>
            <View style={styles.appInfo}>
              <Text variant="label" weight="semibold">{app.name}</Text>
              <Text variant="caption" color="secondary">{app.category}</Text>
            </View>
            <View style={styles.mrrInfo}>
              <Text variant="label" weight="bold" style={{ color: colors.accent }}>
                {formatMRR(app.mrr)}
              </Text>
              <View style={styles.mrrChange}>
                <Ionicons
                  name={app.change >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={app.change >= 0 ? colors.success : colors.error}
                />
                <Text
                  variant="caption"
                  style={{ color: app.change >= 0 ? colors.success : colors.error, marginLeft: 2 }}
                >
                  {app.change >= 0 ? '+' : ''}{app.change.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text variant="title" weight="bold">Leaderboard</Text>
          <Text variant="caption" color="secondary">Real-time rankings & benchmarks</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ai' && { backgroundColor: colors.accent }]}
          onPress={() => setActiveTab('ai')}
        >
          <Ionicons
            name="hardware-chip"
            size={18}
            color={activeTab === 'ai' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            variant="label"
            weight="semibold"
            style={{ marginLeft: 8, color: activeTab === 'ai' ? '#FFFFFF' : colors.textSecondary }}
          >
            AI Models
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mrr' && { backgroundColor: colors.accent }]}
          onPress={() => setActiveTab('mrr')}
        >
          <Ionicons
            name="trophy"
            size={18}
            color={activeTab === 'mrr' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            variant="label"
            weight="semibold"
            style={{ marginLeft: 8, color: activeTab === 'mrr' ? '#FFFFFF' : colors.textSecondary }}
          >
            Top MRR
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'ai' ? renderAILeaderboard() : renderMRRLeaderboard()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 16,
    paddingBottom: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortScroll: {
    marginLeft: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  benchmarkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modelInfo: {
    flex: 1,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  modelName: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  scoreBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  scoreBar: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  mrrList: {
    gap: 10,
  },
  mrrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appInfo: {
    flex: 1,
  },
  mrrInfo: {
    alignItems: 'flex-end',
  },
  mrrChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
});
