import { supabase } from './supabase';
import type { Profile, ConnectedApp, AnalyticsSnapshot, AttributionData, ChatMessage, CommunityPost, CommunityComment } from './supabase';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function getConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const { data, error } = await supabase.from('connected_apps').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function connectApp(app: Omit<ConnectedApp, 'id' | 'created_at'>): Promise<ConnectedApp> {
  const { data, error } = await supabase.from('connected_apps').insert(app).select().single();
  if (error) throw error;
  return data;
}

export async function disconnectApp(appId: string): Promise<void> {
  const { error } = await supabase.from('connected_apps').delete().eq('id', appId);
  if (error) throw error;
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
  const { data, error } = await supabase.functions.invoke(`${botType}-chat`, { body: { message, context } });
  if (error) throw error;
  return data.response;
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

export async function getSubscription(userId: string): Promise<{ is_premium: boolean; expires_at?: string }> {
  const { data, error } = await supabase.from('subscriptions').select('is_premium, expires_at').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || { is_premium: false };
}

export async function updateSubscription(userId: string, isPremium: boolean, expiresAt?: string, revenuecatCustomerId?: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').upsert({ user_id: userId, is_premium: isPremium, expires_at: expiresAt, revenuecat_customer_id: revenuecatCustomerId });
  if (error) throw error;
}

export async function triggerAnalyticsSync(appId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-analytics', { body: { app_id: appId } });
  if (error) throw error;
}
