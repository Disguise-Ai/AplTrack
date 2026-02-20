import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '@/constants/Config';

export const supabase = createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  company_name?: string;
  app_name?: string;
  app_category?: string;
  team_size?: string;
  primary_goal?: string;
  push_token?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectedApp {
  id: string;
  user_id: string;
  app_store_app_id: string;
  app_name?: string;
  bundle_id?: string;
  app_store_connect_key_id?: string;
  app_store_connect_issuer_id?: string;
  app_store_connect_private_key?: string;
  created_at: string;
}

export interface AnalyticsSnapshot {
  id: string;
  app_id: string;
  date: string;
  downloads: number;
  revenue: number;
  active_users: number;
  ratings_count: number;
  average_rating?: number;
  created_at: string;
}

export interface AttributionData {
  id: string;
  app_id: string;
  source: string;
  campaign?: string;
  downloads: number;
  date: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  bot_type: 'marketing' | 'sales';
  message: string;
  is_user: boolean;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profile?: Profile;
  liked_by_user?: boolean;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  revenuecat_customer_id?: string;
  is_premium: boolean;
  expires_at?: string;
  created_at: string;
}
