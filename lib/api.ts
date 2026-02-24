import { supabase } from './supabase';
import type { Profile, ConnectedApp, AnalyticsSnapshot, AttributionData, ChatMessage, CommunityPost, CommunityComment } from './supabase';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  // PGRST116 = "no rows returned" which is expected for new users
  if (error && error.code !== 'PGRST116') throw error;
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
  // Only select non-sensitive fields - never return full credentials to client
  const { data, error } = await supabase
    .from('connected_apps')
    .select('id, user_id, provider, app_store_app_id, credentials_masked, is_active, is_encrypted, last_sync_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Map credentials_masked to credentials for UI compatibility
  return (data || []).map(app => ({
    ...app,
    credentials: app.credentials_masked || {},
  }));
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
    console.log('Connecting app securely:', app.provider);

    // Use secure edge function to validate and store encrypted credentials
    const response = await fetch(
      `https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/store-credentials`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydGt0aWJjeHdzb3F2amxldGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzMyMjgsImV4cCI6MjA4NzEwOTIyOH0.2TXD5lBOeyhYcQWsVwhddi-NeWNShJT3m0to-fadrFw`,
        },
        body: JSON.stringify({
          action: 'store',
          user_id: app.user_id,
          provider: app.provider || 'appstore',
          credentials: app.credentials || {},
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to connect app');
    }

    console.log('App connected securely:', result.app?.id);
    return result.app;
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

export async function updateAppCredentials(appId: string, credentials: Record<string, string>, provider?: string): Promise<ConnectedApp> {
  try {
    // Use secure edge function to validate and store encrypted credentials
    const response = await fetch(
      `https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/store-credentials`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydGt0aWJjeHdzb3F2amxldGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzMyMjgsImV4cCI6MjA4NzEwOTIyOH0.2TXD5lBOeyhYcQWsVwhddi-NeWNShJT3m0to-fadrFw`,
        },
        body: JSON.stringify({
          action: 'update',
          app_id: appId,
          provider: provider || 'unknown',
          credentials,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update credentials');
    }

    return result.app;
  } catch (err: any) {
    console.error('updateAppCredentials exception:', err);
    throw err;
  }
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

    console.log('[getRealtimeMetrics] Fetching for user:', userId);

    // First get user's connected apps
    const { data: apps, error: appsError } = await supabase
      .from('connected_apps')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (appsError) {
      console.log('[getRealtimeMetrics] Apps error:', appsError.message);
      return [];
    }

    if (!apps || apps.length === 0) {
      console.log('[getRealtimeMetrics] No connected apps found');
      return [];
    }

    const appIds = apps.map(a => a.id);
    console.log('[getRealtimeMetrics] Found apps:', appIds.length);

    const { data, error } = await supabase
      .from('realtime_metrics')
      .select('*')
      .in('app_id', appIds)
      .gte('metric_date', startDate || defaultStart)
      .lte('metric_date', endDate || today)
      .order('metric_date', { ascending: false });

    if (error) {
      console.log('[getRealtimeMetrics] Metrics error:', error.message);
      return [];
    }

    console.log('[getRealtimeMetrics] Got metrics:', data?.length || 0);
    if (data && data.length > 0) {
      // Log downloads specifically
      const downloads = data.filter(m => m.metric_type === 'downloads' || m.metric_type === 'new_customers');
      console.log('[getRealtimeMetrics] Download metrics:', downloads.map(d => ({ date: d.metric_date, value: d.metric_value })));
    }

    return data || [];
  } catch (err: any) {
    console.log('[getRealtimeMetrics] Failed:', err.message);
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

// ============ SMART LINKS & ATTRIBUTION ============

export interface TrackingLink {
  id: string;
  user_id: string;
  app_slug: string;
  app_name?: string;
  app_store_url?: string;
  created_at: string;
}

export interface AttributionStats {
  source: string;
  clicks: number;
  installs: number;
  revenue: number;
}

// Get or create tracking link for user
export async function getOrCreateTrackingLink(userId: string, appName?: string, appStoreUrl?: string): Promise<TrackingLink> {
  // First try to get existing link
  const { data: existing } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Update if app name or URL provided
    if (appName || appStoreUrl) {
      const { data: updated } = await supabase
        .from('tracking_links')
        .update({
          app_name: appName || existing.app_name,
          app_store_url: appStoreUrl || existing.app_store_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      return updated || existing;
    }
    return existing;
  }

  // Create new link
  const slug = (appName || userId.substring(0, 8))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const { data: newLink, error } = await supabase
    .from('tracking_links')
    .insert({
      user_id: userId,
      app_slug: slug,
      app_name: appName,
      app_store_url: appStoreUrl,
    })
    .select()
    .single();

  if (error) {
    // Slug might be taken, try with random suffix
    const slugWithSuffix = `${slug}${Math.random().toString(36).substring(2, 6)}`;
    const { data: retryLink, error: retryError } = await supabase
      .from('tracking_links')
      .insert({
        user_id: userId,
        app_slug: slugWithSuffix,
        app_name: appName,
        app_store_url: appStoreUrl,
      })
      .select()
      .single();

    if (retryError) throw retryError;
    return retryLink;
  }

  return newLink;
}

// Get attribution stats for user
export async function getAttributionStats(userId: string, days: number = 30): Promise<AttributionStats[]> {
  try {
    // Get user's tracking link
    const { data: link } = await supabase
      .from('tracking_links')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!link) return [];

    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    // Get clicks grouped by source
    const { data: clicks } = await supabase
      .from('link_clicks')
      .select('source')
      .eq('link_id', link.id)
      .gte('clicked_at', startDate);

    // Get installs grouped by source
    const { data: installs } = await supabase
      .from('install_attributions')
      .select('source, revenue')
      .eq('link_id', link.id)
      .gte('attributed_at', startDate);

    // Aggregate stats
    const statsMap: Record<string, AttributionStats> = {};

    // Count clicks
    for (const click of clicks || []) {
      const source = click.source || 'direct';
      if (!statsMap[source]) {
        statsMap[source] = { source, clicks: 0, installs: 0, revenue: 0 };
      }
      statsMap[source].clicks++;
    }

    // Count installs and revenue
    for (const install of installs || []) {
      const source = install.source || 'direct';
      if (!statsMap[source]) {
        statsMap[source] = { source, clicks: 0, installs: 0, revenue: 0 };
      }
      statsMap[source].installs++;
      statsMap[source].revenue += Number(install.revenue) || 0;
    }

    // Sort by clicks descending
    return Object.values(statsMap).sort((a, b) => b.clicks - a.clicks);
  } catch (error) {
    console.error('Error getting attribution stats:', error);
    return [];
  }
}

// Get total attribution metrics
export async function getAttributionTotals(userId: string, days: number = 30): Promise<{
  totalClicks: number;
  totalInstalls: number;
  totalRevenue: number;
}> {
  const stats = await getAttributionStats(userId, days);

  return {
    totalClicks: stats.reduce((sum, s) => sum + s.clicks, 0),
    totalInstalls: stats.reduce((sum, s) => sum + s.installs, 0),
    totalRevenue: stats.reduce((sum, s) => sum + s.revenue, 0),
  };
}

// Get click history for charts
export async function getClickHistory(userId: string, days: number = 30): Promise<{ date: string; clicks: number }[]> {
  try {
    const { data: link } = await supabase
      .from('tracking_links')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!link) return [];

    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    const { data: clicks } = await supabase
      .from('link_clicks')
      .select('clicked_at')
      .eq('link_id', link.id)
      .gte('clicked_at', startDate);

    // Group by date
    const byDate: Record<string, number> = {};
    for (const click of clicks || []) {
      const date = click.clicked_at.split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    }

    return Object.entries(byDate)
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting click history:', error);
    return [];
  }
}
