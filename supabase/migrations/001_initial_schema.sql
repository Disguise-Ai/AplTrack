-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, full_name TEXT, avatar_url TEXT, company_name TEXT, app_name TEXT, app_category TEXT, team_size TEXT, primary_goal TEXT, push_token TEXT, onboarding_completed BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connected Apps
CREATE TABLE IF NOT EXISTS connected_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, app_store_app_id TEXT NOT NULL, app_name TEXT, bundle_id TEXT, app_store_connect_key_id TEXT, app_store_connect_issuer_id TEXT, app_store_connect_private_key TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Snapshots
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), app_id UUID REFERENCES connected_apps(id) ON DELETE CASCADE NOT NULL, date DATE NOT NULL, downloads INTEGER DEFAULT 0, revenue DECIMAL(10,2) DEFAULT 0, active_users INTEGER DEFAULT 0, ratings_count INTEGER DEFAULT 0, average_rating DECIMAL(2,1), created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(app_id, date)
);

-- Attribution Data
CREATE TABLE IF NOT EXISTS attribution_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), app_id UUID REFERENCES connected_apps(id) ON DELETE CASCADE NOT NULL, source TEXT NOT NULL, campaign TEXT, downloads INTEGER DEFAULT 0, date DATE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat History
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, bot_type TEXT NOT NULL CHECK (bot_type IN ('marketing', 'sales')), message TEXT NOT NULL, is_user BOOLEAN NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community Posts
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT, likes_count INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community Comments
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL, user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post Likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL, user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(post_id, user_id)
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE, revenuecat_customer_id TEXT, is_premium BOOLEAN DEFAULT FALSE, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connected_apps_user_id ON connected_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_app_id ON analytics_snapshots(app_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view their own apps" ON connected_apps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own apps" ON connected_apps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own apps" ON connected_apps FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view analytics for their apps" ON analytics_snapshots FOR SELECT USING (app_id IN (SELECT id FROM connected_apps WHERE user_id = auth.uid()));
CREATE POLICY "Users can view attribution for their apps" ON attribution_data FOR SELECT USING (app_id IN (SELECT id FROM connected_apps WHERE user_id = auth.uid()));
CREATE POLICY "Users can view their own chat history" ON chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages" ON chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view posts" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own posts" ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON community_posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view comments" ON community_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON community_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view likes" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON post_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert their own subscription" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscription" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$ BEGIN INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name'); RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE OR REPLACE FUNCTION increment_likes_count(post_id UUID) RETURNS VOID AS $$ BEGIN UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = post_id; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION decrement_likes_count(post_id UUID) RETURNS VOID AS $$ BEGIN UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = post_id; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION increment_comments_count(post_id UUID) RETURNS VOID AS $$ BEGIN UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = post_id; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
