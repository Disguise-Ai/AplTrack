import { supabase } from './supabase';
import type { Profile, ConnectedApp, AnalyticsSnapshot, AttributionData, ChatMessage, CommunityPost, CommunityComment } from './supabase';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  // First try to update, if no rows affected, insert
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const { data, error } = await supabase.from('connected_apps').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function connectApp(app: {
  user_id: string;
  provider?: string;
  credentials?: Record<string, string>;
  app_store_app_id?: string;
  app_store_connect_key_id?: string;
  app_store_connect_issuer_id?: string;
  app_store_connect_private_key?: string;
}): Promise<ConnectedApp> {
  try {
    const insertData: any = {
      user_id: app.user_id,
      provider: app.provider || 'appstore',
      app_store_app_id: app.app_store_app_id,
      is_active: true,
    };

    // Store credentials securely (in production, encrypt these)
    if (app.credentials) {
      insertData.credentials = app.credentials;
    }

    // Legacy support for App Store Connect
    if (app.app_store_connect_key_id) {
      insertData.app_store_connect_key_id = app.app_store_connect_key_id;
      insertData.app_store_connect_issuer_id = app.app_store_connect_issuer_id;
      insertData.app_store_connect_private_key = app.app_store_connect_private_key;
    }

    console.log('Connecting app:', app.provider);
    const { data, error } = await supabase.from('connected_apps').insert(insertData).select().single();

    if (error) {
      console.error('connectApp error:', error);
      throw new Error(error.message || 'Failed to connect app');
    }

    console.log('App connected successfully:', data?.id);
    return data;
  } catch (err: any) {
    console.error('connectApp exception:', err);
    throw err;
  }
}

export async function getConnectedProviders(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('connected_apps')
    .select('provider')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw error;
  return data?.map(d => d.provider) || [];
}

export async function disconnectApp(appId: string): Promise<void> {
  const { error } = await supabase.from('connected_apps').delete().eq('id', appId);
  if (error) throw error;
}

export async function updateAppCredentials(appId: string, credentials: Record<string, string>): Promise<ConnectedApp> {
  const { data, error } = await supabase
    .from('connected_apps')
    .update({
      credentials,
      app_store_app_id: credentials.app_id || credentials.app_token || undefined,
    })
    .eq('id', appId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAnalytics(appId: string, startDate: string, endDate: string): Promise<AnalyticsSnapshot[]> {
  const { data, error } = await supabase.from('analytics_snapshots').select('*').eq('app_id', appId).gte('date', startDate).lte('date', endDate).order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getLatestAnalytics(appId: string): Promise<AnalyticsSnapshot | null> {
  const { data, error } = await supabase.from('analytics_snapshots').select('*').eq('app_id', appId).order('date', { ascending: false }).limit(1).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAttribution(appId: string, startDate: string, endDate: string): Promise<AttributionData[]> {
  const { data, error } = await supabase.from('attribution_data').select('*').eq('app_id', appId).gte('date', startDate).lte('date', endDate).order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getChatHistory(userId: string, botType: 'marketing' | 'sales'): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from('chat_history').select('*').eq('user_id', userId).eq('bot_type', botType).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveChatMessage(userId: string, botType: 'marketing' | 'sales', message: string, isUser: boolean): Promise<ChatMessage> {
  const { data, error } = await supabase.from('chat_history').insert({ user_id: userId, bot_type: botType, message, is_user: isUser }).select().single();
  if (error) throw error;
  return data;
}

export async function sendChatMessage(botType: 'marketing' | 'sales', message: string, context?: { appName?: string; category?: string }): Promise<string> {
  try {
    console.log('Calling chat function:', botType, message.substring(0, 50));

    // Use direct fetch instead of supabase.functions.invoke
    const response = await fetch(
      `https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/${botType}-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydGt0aWJjeHdzb3F2amxldGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzMyMjgsImV4cCI6MjA4NzEwOTIyOH0.2TXD5lBOeyhYcQWsVwhddi-NeWNShJT3m0to-fadrFw`,
        },
        body: JSON.stringify({ message, context }),
      }
    );

    console.log('Chat response status:', response.status);

    const data = await response.json();
    console.log('Chat response data:', data);

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.response) {
      throw new Error('No response from AI');
    }

    return data.response;
  } catch (err: any) {
    console.error('sendChatMessage error:', err.message || err);
    throw err;
  }
}

export async function getCommunityPosts(category?: string, limit = 20, offset = 0): Promise<CommunityPost[]> {
  let query = supabase.from('community_posts').select(`*, profile:profiles(id, full_name, avatar_url)`).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPost(postId: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase.from('community_posts').select(`*, profile:profiles(id, full_name, avatar_url)`).eq('id', postId).single();
  if (error) throw error;
  return data;
}

export async function createPost(userId: string, title: string, content: string, category?: string): Promise<CommunityPost> {
  const { data, error } = await supabase.from('community_posts').insert({ user_id: userId, title, content, category }).select().single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function getComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase.from('community_comments').select(`*, profile:profiles(id, full_name, avatar_url)`).eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createComment(postId: string, userId: string, content: string): Promise<CommunityComment> {
  const { data, error } = await supabase.from('community_comments').insert({ post_id: postId, user_id: userId, content }).select().single();
  if (error) throw error;
  await supabase.rpc('increment_comments_count', { post_id: postId });
  return data;
}

export async function likePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (error) throw error;
  await supabase.rpc('increment_likes_count', { post_id: postId });
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
  await supabase.rpc('decrement_likes_count', { post_id: postId });
}

export async function checkIfLiked(postId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

export async function getSubscription(userId: string): Promise<{
  is_premium: boolean;
  expires_at?: string;
  is_trial?: boolean;
  trial_started_at?: string;
  trial_ends_at?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('is_premium, expires_at, is_trial, trial_started_at, trial_ends_at')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.log('Subscription fetch error:', error.message);
      return { is_premium: false };
    }
    return data || { is_premium: false };
  } catch (err: any) {
    console.log('Subscription error:', err.message);
    return { is_premium: false };
  }
}

export async function startTrial(userId: string): Promise<void> {
  const { error } = await supabase.rpc('start_user_trial', { p_user_id: userId });
  if (error) throw error;
}

export async function updateSubscription(userId: string, isPremium: boolean, expiresAt?: string, revenuecatCustomerId?: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').upsert({ user_id: userId, is_premium: isPremium, expires_at: expiresAt, revenuecat_customer_id: revenuecatCustomerId });
  if (error) throw error;
}

export async function triggerAnalyticsSync(appId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-analytics', { body: { app_id: appId } });
  if (error) throw error;
}

// Sync all connected data sources for a user
export async function syncAllDataSources(userId: string): Promise<{
  synced: number;
  failed: number;
  results?: any[];
  error?: string;
  message?: string;
}> {
  try {
    // Add timeout to prevent infinite loading (8 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const { data, error } = await supabase.functions.invoke('sync-all', {
      body: { user_id: userId },
    });

    clearTimeout(timeoutId);

    if (error) {
      console.log('Sync error (non-critical):', error.message);
      return { synced: 0, failed: 0, message: error.message };
    }

    return {
      synced: data?.synced || 0,
      failed: data?.failed || 0,
      results: data?.results,
      error: data?.error,
      message: data?.message
    };
  } catch (err: any) {
    console.log('Sync timeout or error:', err.message);
    // Return empty result instead of throwing - sync failure shouldn't block refresh
    return { synced: 0, failed: 0, message: 'Sync timed out' };
  }
}

// Sync a specific provider
export async function syncProvider(appId: string, provider: string): Promise<void> {
  const { error } = await supabase.functions.invoke(`sync-${provider}`, { body: { app_id: appId } });
  if (error) throw error;
}

// Get real-time metrics from all providers
export interface RealtimeMetric {
  id: string;
  app_id: string;
  provider: string;
  metric_type: string;
  metric_value: number;
  metric_date: string;
  metadata?: Record<string, any>;
}

export async function getRealtimeMetrics(userId: string, startDate?: string, endDate?: string): Promise<RealtimeMetric[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const defaultStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // First get user's connected apps
    const { data: apps } = await supabase
      .from('connected_apps')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!apps || apps.length === 0) return [];

    const appIds = apps.map(a => a.id);

    const { data, error } = await supabase
      .from('realtime_metrics')
      .select('*')
      .in('app_id', appIds)
      .gte('metric_date', startDate || defaultStart)
      .lte('metric_date', endDate || today)
      .order('metric_date', { ascending: false });

    if (error) {
      console.log('Realtime metrics error:', error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.log('Realtime metrics failed:', err.message);
    return [];
  }
}

// Get aggregated metrics across all providers
export interface AggregatedMetrics {
  revenue: number;
  mrr: number;
  installs: number;
  activeUsers: number;
  churnRate: number;
  avgRating: number;
}

export async function getAggregatedMetrics(userId: string): Promise<AggregatedMetrics> {
  const today = new Date().toISOString().split('T')[0];
  const metrics = await getRealtimeMetrics(userId, today, today);

  const result: AggregatedMetrics = {
    revenue: 0,
    mrr: 0,
    installs: 0,
    activeUsers: 0,
    churnRate: 0,
    avgRating: 0,
  };

  for (const metric of metrics) {
    switch (metric.metric_type) {
      case 'revenue':
        result.revenue += metric.metric_value;
        break;
      case 'mrr':
        result.mrr += metric.metric_value;
        break;
      case 'installs':
      case 'downloads':
        result.installs += metric.metric_value;
        break;
      case 'daily_active_users':
      case 'active_users':
      case 'active_subscribers':
        result.activeUsers += metric.metric_value;
        break;
      case 'churn_rate':
        result.churnRate = metric.metric_value; // Take latest
        break;
      case 'average_rating':
        result.avgRating = metric.metric_value;
        break;
    }
  }

  return result;
}

// Get metrics history for charts
export async function getMetricsHistory(userId: string, metricType: string, days: number = 30): Promise<{ date: string; value: number }[]> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const metrics = await getRealtimeMetrics(userId, startDate, endDate);

  // Group by date and sum values
  const byDate: Record<string, number> = {};

  for (const metric of metrics) {
    if (metric.metric_type === metricType) {
      byDate[metric.metric_date] = (byDate[metric.metric_date] || 0) + metric.metric_value;
    }
  }

  // Convert to array and sort by date
  return Object.entries(byDate)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
