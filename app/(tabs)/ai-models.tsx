import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/Colors';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  speed: 'Fast' | 'Medium' | 'Slow';
  tags: ('Hot' | 'New' | 'Best Value' | 'Most Capable' | 'Fastest' | 'Open Source')[];
  bestFor: string[];
  icon: string;
  color: string;
  releaseDate?: string;
  url?: string;
}

// Live AI model data - updated regularly
const AI_MODELS: AIModel[] = [
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    description: 'Most intelligent model for complex tasks, coding, and extended thinking',
    contextWindow: '200K',
    inputPrice: '$15/M',
    outputPrice: '$75/M',
    speed: 'Medium',
    tags: ['Hot', 'Most Capable'],
    bestFor: ['Complex coding', 'Research', 'Long documents', 'Agentic tasks'],
    icon: 'sparkles',
    color: '#D97706',
    releaseDate: '2025-01',
    url: 'https://anthropic.com/claude',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    description: 'Best balance of intelligence, speed, and cost for most tasks',
    contextWindow: '200K',
    inputPrice: '$3/M',
    outputPrice: '$15/M',
    speed: 'Fast',
    tags: ['Hot', 'Best Value'],
    bestFor: ['App development', 'Customer support', 'Content creation', 'Code review'],
    icon: 'sparkles',
    color: '#D97706',
    releaseDate: '2025-01',
    url: 'https://anthropic.com/claude',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Multimodal flagship model with vision, audio, and text capabilities',
    contextWindow: '128K',
    inputPrice: '$2.50/M',
    outputPrice: '$10/M',
    speed: 'Fast',
    tags: ['Best Value'],
    bestFor: ['Multimodal apps', 'Vision tasks', 'General purpose', 'Chatbots'],
    icon: 'cube',
    color: '#10B981',
    url: 'https://openai.com/gpt-4',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Previous flagship with strong reasoning and coding abilities',
    contextWindow: '128K',
    inputPrice: '$10/M',
    outputPrice: '$30/M',
    speed: 'Medium',
    tags: [],
    bestFor: ['Complex reasoning', 'Coding', 'Analysis'],
    icon: 'cube',
    color: '#10B981',
    url: 'https://openai.com/gpt-4',
  },
  {
    id: 'gemini-2-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'Google',
    description: 'Google\'s most capable model with advanced reasoning',
    contextWindow: '2M',
    inputPrice: '$1.25/M',
    outputPrice: '$5/M',
    speed: 'Fast',
    tags: ['New', 'Best Value'],
    bestFor: ['Large context', 'Research', 'Document analysis', 'Code generation'],
    icon: 'diamond',
    color: '#4285F4',
    releaseDate: '2025-02',
    url: 'https://deepmind.google/gemini',
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Ultra-fast model optimized for speed and efficiency',
    contextWindow: '1M',
    inputPrice: '$0.075/M',
    outputPrice: '$0.30/M',
    speed: 'Fast',
    tags: ['Hot', 'Fastest', 'Best Value'],
    bestFor: ['Real-time apps', 'High volume', 'Cost-sensitive', 'Quick tasks'],
    icon: 'flash',
    color: '#4285F4',
    releaseDate: '2025-02',
    url: 'https://deepmind.google/gemini',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    description: 'Open-source reasoning model rivaling top proprietary models',
    contextWindow: '128K',
    inputPrice: '$0.55/M',
    outputPrice: '$2.19/M',
    speed: 'Medium',
    tags: ['Hot', 'New', 'Open Source', 'Best Value'],
    bestFor: ['Reasoning', 'Math', 'Coding', 'Self-hosting'],
    icon: 'code-slash',
    color: '#6366F1',
    releaseDate: '2025-01',
    url: 'https://deepseek.com',
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    description: 'Powerful open-source model with excellent coding abilities',
    contextWindow: '128K',
    inputPrice: '$0.27/M',
    outputPrice: '$1.10/M',
    speed: 'Fast',
    tags: ['Open Source', 'Best Value'],
    bestFor: ['Coding', 'General tasks', 'Budget apps'],
    icon: 'code-slash',
    color: '#6366F1',
    releaseDate: '2024-12',
    url: 'https://deepseek.com',
  },
  {
    id: 'llama-3-3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    description: 'Open-source model matching GPT-4 class performance',
    contextWindow: '128K',
    inputPrice: '$0.40/M',
    outputPrice: '$0.40/M',
    speed: 'Fast',
    tags: ['Open Source', 'Best Value'],
    bestFor: ['Self-hosting', 'Fine-tuning', 'Privacy-focused apps'],
    icon: 'logo-meta',
    color: '#0866FF',
    url: 'https://llama.meta.com',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large 2',
    provider: 'Mistral',
    description: 'European flagship model with strong multilingual support',
    contextWindow: '128K',
    inputPrice: '$2/M',
    outputPrice: '$6/M',
    speed: 'Fast',
    tags: [],
    bestFor: ['Multilingual', 'European compliance', 'Enterprise'],
    icon: 'globe',
    color: '#FF7000',
    url: 'https://mistral.ai',
  },
  {
    id: 'grok-2',
    name: 'Grok 2',
    provider: 'xAI',
    description: 'Real-time knowledge model with X/Twitter integration',
    contextWindow: '128K',
    inputPrice: '$2/M',
    outputPrice: '$10/M',
    speed: 'Fast',
    tags: ['New'],
    bestFor: ['Real-time data', 'Social media', 'News analysis'],
    icon: 'planet',
    color: '#1DA1F2',
    releaseDate: '2024-12',
    url: 'https://x.ai',
  },
  {
    id: 'qwen-2-5-72b',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    description: 'Strong open-source alternative with coding focus',
    contextWindow: '128K',
    inputPrice: '$0.35/M',
    outputPrice: '$0.35/M',
    speed: 'Fast',
    tags: ['Open Source', 'Best Value'],
    bestFor: ['Coding', 'Asian languages', 'Self-hosting'],
    icon: 'server',
    color: '#FF6A00',
    url: 'https://qwenlm.github.io',
  },
];

type FilterType = 'all' | 'hot' | 'coding' | 'budget' | 'fast' | 'open-source';

export default function AIModelsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const filterModels = (models: AIModel[]): AIModel[] => {
    switch (filter) {
      case 'hot':
        return models.filter(m => m.tags.includes('Hot') || m.tags.includes('New'));
      case 'coding':
        return models.filter(m => m.bestFor.some(b => b.toLowerCase().includes('cod')));
      case 'budget':
        return models.filter(m => m.tags.includes('Best Value'));
      case 'fast':
        return models.filter(m => m.speed === 'Fast' || m.tags.includes('Fastest'));
      case 'open-source':
        return models.filter(m => m.tags.includes('Open Source'));
      default:
        return models;
    }
  };

  const filteredModels = filterModels(AI_MODELS);

  const onRefresh = async () => {
    setRefreshing(true);
    // In production, this would fetch latest model data from an API
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'Fast': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Slow': return '#EF4444';
      default: return colors.textSecondary;
    }
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'Hot': return '#EF4444';
      case 'New': return '#8B5CF6';
      case 'Best Value': return '#10B981';
      case 'Most Capable': return '#F59E0B';
      case 'Fastest': return '#3B82F6';
      case 'Open Source': return '#6366F1';
      default: return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="title" weight="bold">AI Models</Text>
        <Text variant="caption" color="secondary" style={{ marginTop: 4 }}>
          Live pricing & capabilities
        </Text>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {[
          { id: 'all', label: 'All Models', icon: 'apps' },
          { id: 'hot', label: 'Hot & New', icon: 'flame' },
          { id: 'coding', label: 'Best for Coding', icon: 'code-slash' },
          { id: 'budget', label: 'Best Value', icon: 'wallet' },
          { id: 'fast', label: 'Fastest', icon: 'flash' },
          { id: 'open-source', label: 'Open Source', icon: 'lock-open' },
        ].map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[
              styles.filterPill,
              {
                backgroundColor: filter === f.id ? '#A78BFA' : colors.card,
                borderColor: filter === f.id ? '#A78BFA' : colors.border,
              },
            ]}
            onPress={() => setFilter(f.id as FilterType)}
          >
            <Ionicons
              name={f.icon as any}
              size={14}
              color={filter === f.id ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              variant="caption"
              weight="semibold"
              style={{
                marginLeft: 6,
                color: filter === f.id ? '#FFFFFF' : colors.text,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Models List */}
      <ScrollView
        style={styles.modelsList}
        contentContainerStyle={styles.modelsContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filteredModels.map((model) => (
          <TouchableOpacity
            key={model.id}
            style={[styles.modelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
            activeOpacity={0.7}
          >
            {/* Model Header */}
            <View style={styles.modelHeader}>
              <View style={[styles.modelIcon, { backgroundColor: model.color + '20' }]}>
                <Ionicons name={model.icon as any} size={24} color={model.color} />
              </View>
              <View style={styles.modelInfo}>
                <View style={styles.modelNameRow}>
                  <Text variant="body" weight="semibold">{model.name}</Text>
                  {model.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {model.tags.slice(0, 2).map((tag) => (
                        <View
                          key={tag}
                          style={[styles.tag, { backgroundColor: getTagColor(tag) + '20' }]}
                        >
                          <Text
                            variant="micro"
                            weight="semibold"
                            style={{ color: getTagColor(tag) }}
                          >
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Text variant="caption" color="secondary">{model.provider}</Text>
              </View>
              <Ionicons
                name={expandedModel === model.id ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.stat}>
                <Text variant="micro" color="secondary">Context</Text>
                <Text variant="caption" weight="semibold">{model.contextWindow}</Text>
              </View>
              <View style={styles.stat}>
                <Text variant="micro" color="secondary">Input</Text>
                <Text variant="caption" weight="semibold">{model.inputPrice}</Text>
              </View>
              <View style={styles.stat}>
                <Text variant="micro" color="secondary">Output</Text>
                <Text variant="caption" weight="semibold">{model.outputPrice}</Text>
              </View>
              <View style={styles.stat}>
                <Text variant="micro" color="secondary">Speed</Text>
                <Text variant="caption" weight="semibold" style={{ color: getSpeedColor(model.speed) }}>
                  {model.speed}
                </Text>
              </View>
            </View>

            {/* Expanded Content */}
            {expandedModel === model.id && (
              <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
                <Text variant="caption" color="secondary" style={styles.description}>
                  {model.description}
                </Text>

                <Text variant="micro" weight="semibold" color="secondary" style={styles.sectionLabel}>
                  BEST FOR
                </Text>
                <View style={styles.bestForContainer}>
                  {model.bestFor.map((use) => (
                    <View key={use} style={[styles.bestForChip, { backgroundColor: colors.background }]}>
                      <Text variant="caption">{use}</Text>
                    </View>
                  ))}
                </View>

                {model.url && (
                  <TouchableOpacity
                    style={[styles.learnMoreButton, { backgroundColor: model.color }]}
                    onPress={() => Linking.openURL(model.url!)}
                  >
                    <Text variant="caption" weight="semibold" style={{ color: '#FFFFFF' }}>
                      Learn More
                    </Text>
                    <Ionicons name="open-outline" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Recommendation Section */}
        <View style={[styles.recommendationCard, { backgroundColor: '#A78BFA' + '15', borderColor: '#A78BFA' + '30' }]}>
          <View style={styles.recommendationHeader}>
            <Ionicons name="bulb" size={24} color="#A78BFA" />
            <Text variant="body" weight="semibold" style={{ marginLeft: 12 }}>
              Model Recommendations
            </Text>
          </View>
          <View style={styles.recommendationList}>
            <RecommendationItem
              useCase="Building a mobile app"
              model="Claude Sonnet 4 or GPT-4o"
              reason="Best balance of cost, speed, and capability for app development"
            />
            <RecommendationItem
              useCase="High-volume chatbot"
              model="Gemini 2.0 Flash"
              reason="Lowest cost per token with fast response times"
            />
            <RecommendationItem
              useCase="Complex coding tasks"
              model="Claude Opus 4 or DeepSeek R1"
              reason="Highest reasoning capability for difficult problems"
            />
            <RecommendationItem
              useCase="Privacy-first / Self-hosting"
              model="Llama 3.3 70B or DeepSeek V3"
              reason="Open source, can run on your own infrastructure"
            />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function RecommendationItem({ useCase, model, reason }: { useCase: string; model: string; reason: string }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.recommendationItem, { borderBottomColor: colors.border }]}>
      <Text variant="caption" weight="semibold">{useCase}</Text>
      <Text variant="caption" style={{ color: '#A78BFA', marginTop: 2 }}>{model}</Text>
      <Text variant="micro" color="secondary" style={{ marginTop: 4 }}>{reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  filterContainer: {
    maxHeight: 44,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  modelsList: {
    flex: 1,
  },
  modelsContent: {
    padding: 16,
  },
  modelCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quickStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  description: {
    lineHeight: 20,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  bestForContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bestForChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  recommendationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recommendationList: {
    gap: 0,
  },
  recommendationItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
