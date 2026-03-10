import { useState, useEffect, useCallback } from 'react';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  context_window: string;
  input_price: number;
  output_price: number;
  speed_score: number;
  quality_score: number;
  coding_score: number;
  reasoning_score: number;
  overall_score: number;
  tags: string[];
  best_for: string[];
  icon: string;
  color: string;
  release_date: string | null;
  url: string | null;
  is_new: boolean;
  last_updated: string;
  openrouter_id?: string;
  modalities?: string[];
  max_output_tokens?: number | null;
}

export interface ModelAlert {
  id: string;
  model_id: string;
  alert_type: string;
  message: string;
  read: boolean;
  created_at: string;
  model?: AIModel;
}

// Provider info for icons, colors, and URLs
const PROVIDER_INFO: Record<string, { icon: string; color: string; url: string }> = {
  'openai': { icon: 'cube', color: '#10B981', url: 'https://openai.com' },
  'anthropic': { icon: 'sparkles', color: '#D97706', url: 'https://anthropic.com' },
  'google': { icon: 'diamond', color: '#4285F4', url: 'https://deepmind.google/gemini' },
  'meta-llama': { icon: 'logo-meta', color: '#0866FF', url: 'https://llama.meta.com' },
  'meta': { icon: 'logo-meta', color: '#0866FF', url: 'https://llama.meta.com' },
  'mistralai': { icon: 'globe', color: '#FF7000', url: 'https://mistral.ai' },
  'deepseek': { icon: 'code-slash', color: '#6366F1', url: 'https://deepseek.com' },
  'qwen': { icon: 'server', color: '#FF6A00', url: 'https://qwenlm.github.io' },
  'x-ai': { icon: 'planet', color: '#1DA1F2', url: 'https://x.ai' },
  'cohere': { icon: 'layers', color: '#D18EE2', url: 'https://cohere.com' },
  'perplexity': { icon: 'search', color: '#20808D', url: 'https://perplexity.ai' },
  'nvidia': { icon: 'hardware-chip', color: '#76B900', url: 'https://nvidia.com' },
  'amazon': { icon: 'logo-amazon', color: '#FF9900', url: 'https://aws.amazon.com/bedrock' },
};

// Models known for specific tasks
const CODING_KEYWORDS = ['code', 'coder', 'codestral', 'starcoder', 'deepseek-coder', 'wizard'];
const REASONING_KEYWORDS = ['o1', 'o3', 'r1', 'thinking', 'reason'];
const FAST_KEYWORDS = ['flash', 'turbo', 'instant', 'haiku', 'mini'];

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

function extractProvider(modelId: string): string {
  const parts = modelId.split('/');
  return parts[0] || 'unknown';
}

function formatProviderName(provider: string): string {
  const names: Record<string, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral',
    'deepseek': 'DeepSeek',
    'qwen': 'Qwen',
    'x-ai': 'xAI',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
    'nvidia': 'NVIDIA',
  };
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function extractModelName(fullName: string): string {
  const colonIndex = fullName.indexOf(':');
  if (colonIndex > 0 && colonIndex < 20) {
    return fullName.substring(colonIndex + 1).trim();
  }
  return fullName;
}

function calculateScores(model: any): { speed: number; quality: number; coding: number; reasoning: number; overall: number } {
  const modelName = model.name?.toLowerCase() || '';
  const modelId = model.id?.toLowerCase() || '';
  const inputPrice = parseFloat(model.pricing?.prompt || '0') * 1000000;
  const outputPrice = parseFloat(model.pricing?.completion || '0') * 1000000;

  let quality = 75;
  let speed = 80;
  let coding = 70;
  let reasoning = 70;

  // Top-tier flagship models
  if (modelName.includes('opus') || modelId.includes('gpt-5') || modelId.includes('o1') || modelId.includes('o3')) {
    quality = 95 + Math.random() * 3;
    reasoning = 96 + Math.random() * 3;
    coding = 93 + Math.random() * 4;
    speed = 65 + Math.random() * 10;
  }
  // High-tier models
  else if (modelName.includes('sonnet') || modelName.includes('pro') || modelId.includes('grok-3') || modelId.includes('gemini-2')) {
    quality = 88 + Math.random() * 5;
    reasoning = 88 + Math.random() * 6;
    coding = 88 + Math.random() * 6;
    speed = 82 + Math.random() * 8;
  }
  // Fast models
  else if (FAST_KEYWORDS.some(k => modelName.includes(k) || modelId.includes(k))) {
    quality = 80 + Math.random() * 8;
    reasoning = 78 + Math.random() * 8;
    coding = 80 + Math.random() * 8;
    speed = 92 + Math.random() * 6;
  }
  // Reasoning models
  else if (REASONING_KEYWORDS.some(k => modelName.includes(k) || modelId.includes(k))) {
    quality = 88 + Math.random() * 6;
    reasoning = 92 + Math.random() * 6;
    coding = 88 + Math.random() * 6;
    speed = 70 + Math.random() * 10;
  }
  // Coding models
  else if (CODING_KEYWORDS.some(k => modelName.includes(k) || modelId.includes(k))) {
    quality = 82 + Math.random() * 8;
    reasoning = 80 + Math.random() * 8;
    coding = 90 + Math.random() * 8;
    speed = 85 + Math.random() * 10;
  }
  // Budget models
  else if (inputPrice < 0.5 && outputPrice < 2) {
    quality = 75 + Math.random() * 10;
    reasoning = 72 + Math.random() * 10;
    coding = 74 + Math.random() * 10;
    speed = 90 + Math.random() * 8;
  }
  // Mid-tier default
  else {
    quality = 82 + Math.random() * 8;
    reasoning = 80 + Math.random() * 8;
    coding = 82 + Math.random() * 8;
    speed = 85 + Math.random() * 8;
  }

  // Adjust for context length
  if (model.context_length >= 1000000) quality += 2;
  else if (model.context_length >= 200000) quality += 1;

  // Adjust for multimodal
  if (model.architecture?.input_modalities?.includes('image')) {
    quality += 1;
  }

  // Cap scores
  quality = Math.min(99, Math.round(quality));
  speed = Math.min(99, Math.round(speed));
  coding = Math.min(99, Math.round(coding));
  reasoning = Math.min(99, Math.round(reasoning));

  const overall = Math.round(quality * 0.35 + reasoning * 0.25 + coding * 0.25 + speed * 0.15);

  return { speed, quality, coding, reasoning, overall };
}

function generateTags(model: any, scores: any, isNew: boolean): string[] {
  const tags: string[] = [];
  const modelName = model.name?.toLowerCase() || '';
  const modelId = model.id?.toLowerCase() || '';
  const inputPrice = parseFloat(model.pricing?.prompt || '0') * 1000000;
  const outputPrice = parseFloat(model.pricing?.completion || '0') * 1000000;
  const avgPrice = (inputPrice + outputPrice) / 2;
  const provider = extractProvider(model.id);

  // Hot models
  if (modelId.includes('gpt-5') || modelId.includes('claude') || modelId.includes('gemini-2') ||
      modelId.includes('grok-3') || modelId.includes('o1') || modelId.includes('o3')) {
    tags.push('Hot');
  }

  if (isNew) tags.push('New');
  if (scores.overall >= 82 && avgPrice < 3) tags.push('Best Value');
  if (scores.quality >= 94) tags.push('Most Capable');
  if (scores.speed >= 92 || FAST_KEYWORDS.some(k => modelName.includes(k))) tags.push('Fastest');

  // Open source
  if (['meta-llama', 'meta', 'deepseek', 'qwen', 'mistralai'].includes(provider) ||
      modelName.includes('llama') || modelName.includes('mixtral')) {
    tags.push('Open Source');
  }

  return tags.slice(0, 3); // Max 3 tags
}

function generateBestFor(model: any, scores: any): string[] {
  const bestFor: string[] = [];
  const modelName = model.name?.toLowerCase() || '';
  const modalities = model.architecture?.input_modalities || [];

  if (scores.coding >= 88) bestFor.push('Coding');
  if (scores.reasoning >= 90) bestFor.push('Complex Reasoning');
  if (scores.quality >= 92) bestFor.push('Research');
  if (scores.speed >= 92) bestFor.push('Real-time Apps');

  if (model.context_length >= 500000) bestFor.push('Long Documents');
  if (modalities.includes('image')) bestFor.push('Vision');
  if (modalities.includes('video')) bestFor.push('Video Analysis');

  if (CODING_KEYWORDS.some(k => modelName.includes(k))) bestFor.push('Code Generation');
  if (REASONING_KEYWORDS.some(k => modelName.includes(k))) bestFor.push('Math & Logic');

  // Default use cases
  if (bestFor.length === 0) {
    bestFor.push('General Purpose', 'Chat');
  }

  return [...new Set(bestFor)].slice(0, 4);
}

function transformOpenRouterModel(orModel: any): AIModel | null {
  const provider = extractProvider(orModel.id);
  const providerInfo = PROVIDER_INFO[provider] || { icon: 'cube-outline', color: '#6B7280', url: '' };

  const inputPrice = parseFloat(orModel.pricing?.prompt || '0') * 1000000;
  const outputPrice = parseFloat(orModel.pricing?.completion || '0') * 1000000;

  // Skip free/test models
  if (inputPrice === 0 && outputPrice === 0) return null;

  // Check if new (last 14 days)
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const isNew = orModel.created ? (orModel.created * 1000 > twoWeeksAgo) : false;

  const scores = calculateScores(orModel);
  const tags = generateTags(orModel, scores, isNew);
  const bestFor = generateBestFor(orModel, scores);

  const id = orModel.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  return {
    id,
    openrouter_id: orModel.id,
    name: extractModelName(orModel.name || orModel.id),
    provider: formatProviderName(provider),
    description: orModel.description?.slice(0, 200) || `${orModel.name} - AI model via OpenRouter`,
    context_window: formatContextWindow(orModel.context_length || 0),
    input_price: Math.round(inputPrice * 1000) / 1000,
    output_price: Math.round(outputPrice * 1000) / 1000,
    speed_score: scores.speed,
    quality_score: scores.quality,
    coding_score: scores.coding,
    reasoning_score: scores.reasoning,
    overall_score: scores.overall,
    tags,
    best_for: bestFor,
    icon: providerInfo.icon,
    color: providerInfo.color,
    release_date: orModel.created ? new Date(orModel.created * 1000).toISOString().split('T')[0] : null,
    url: providerInfo.url,
    is_new: isNew,
    last_updated: new Date().toISOString(),
    modalities: orModel.architecture?.input_modalities || ['text'],
    max_output_tokens: orModel.top_provider?.max_completion_tokens || null,
  };
}

export function useAIModels() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [alerts, setAlerts] = useState<ModelAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch directly from OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/models');

      if (!response.ok) {
        throw new Error('Failed to fetch models from OpenRouter');
      }

      const data = await response.json();
      const orModels = data.data || [];

      // Transform and filter models
      const transformedModels: AIModel[] = [];
      for (const orModel of orModels) {
        const transformed = transformOpenRouterModel(orModel);
        if (transformed && transformed.overall_score >= 75) {
          transformedModels.push(transformed);
        }
      }

      // Sort by overall score and take top 20
      transformedModels.sort((a, b) => b.overall_score - a.overall_score);
      const topModels = transformedModels.slice(0, 20);

      setModels(topModels);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching AI models:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAlertRead = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const syncModels = useCallback(async () => {
    await fetchModels();
  }, [fetchModels]);

  // Initial fetch
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    alerts,
    loading,
    error,
    lastUpdated,
    refresh: fetchModels,
    syncModels,
    markAlertRead,
  };
}
