-- Smart Links Attribution System
-- Run this in Supabase SQL Editor

-- 1. Tracking Links - one per user/app
CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_slug TEXT UNIQUE NOT NULL,
  app_name TEXT,
  app_store_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Link Clicks - every click tracked
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES tracking_links(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'direct',
  device_type TEXT,
  country TEXT,
  city TEXT,
  fingerprint TEXT, -- device fingerprint for matching
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Install Attributions - matched installs
CREATE TABLE IF NOT EXISTS install_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES tracking_links(id) ON DELETE CASCADE,
  click_id UUID REFERENCES link_clicks(id),
  source TEXT NOT NULL DEFAULT 'direct',
  device_type TEXT,
  country TEXT,
  revenue DECIMAL(10,2) DEFAULT 0,
  attributed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tracking_links_user ON tracking_links(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_slug ON tracking_links(app_slug);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_time ON link_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_fingerprint ON link_clicks(fingerprint);
CREATE INDEX IF NOT EXISTS idx_install_attributions_link ON install_attributions(link_id);
CREATE INDEX IF NOT EXISTS idx_install_attributions_time ON install_attributions(attributed_at);

-- RLS Policies
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE install_attributions ENABLE ROW LEVEL SECURITY;

-- Users can read their own tracking links
DROP POLICY IF EXISTS "Users can read own tracking links" ON tracking_links;
CREATE POLICY "Users can read own tracking links" ON tracking_links
  FOR SELECT USING (user_id = auth.uid());

-- Users can create their own tracking links
DROP POLICY IF EXISTS "Users can create own tracking links" ON tracking_links;
CREATE POLICY "Users can create own tracking links" ON tracking_links
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own tracking links
DROP POLICY IF EXISTS "Users can update own tracking links" ON tracking_links;
CREATE POLICY "Users can update own tracking links" ON tracking_links
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can insert clicks (from edge function)
DROP POLICY IF EXISTS "Service can insert clicks" ON link_clicks;
CREATE POLICY "Service can insert clicks" ON link_clicks
  FOR INSERT WITH CHECK (true);

-- Users can read clicks for their links
DROP POLICY IF EXISTS "Users can read own clicks" ON link_clicks;
CREATE POLICY "Users can read own clicks" ON link_clicks
  FOR SELECT USING (
    link_id IN (SELECT id FROM tracking_links WHERE user_id = auth.uid())
  );

-- Service role can insert attributions
DROP POLICY IF EXISTS "Service can insert attributions" ON install_attributions;
CREATE POLICY "Service can insert attributions" ON install_attributions
  FOR INSERT WITH CHECK (true);

-- Users can read their attributions
DROP POLICY IF EXISTS "Users can read own attributions" ON install_attributions;
CREATE POLICY "Users can read own attributions" ON install_attributions
  FOR SELECT USING (
    link_id IN (SELECT id FROM tracking_links WHERE user_id = auth.uid())
  );

-- Function to get attribution stats for a user
CREATE OR REPLACE FUNCTION get_attribution_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  source TEXT,
  clicks BIGINT,
  installs BIGINT,
  revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_links AS (
    SELECT id FROM tracking_links WHERE user_id = p_user_id
  ),
  click_stats AS (
    SELECT
      lc.source,
      COUNT(*) as click_count
    FROM link_clicks lc
    WHERE lc.link_id IN (SELECT id FROM user_links)
      AND lc.clicked_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY lc.source
  ),
  install_stats AS (
    SELECT
      ia.source,
      COUNT(*) as install_count,
      COALESCE(SUM(ia.revenue), 0) as total_revenue
    FROM install_attributions ia
    WHERE ia.link_id IN (SELECT id FROM user_links)
      AND ia.attributed_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY ia.source
  )
  SELECT
    COALESCE(cs.source, ist.source) as source,
    COALESCE(cs.click_count, 0) as clicks,
    COALESCE(ist.install_count, 0) as installs,
    COALESCE(ist.total_revenue, 0) as revenue
  FROM click_stats cs
  FULL OUTER JOIN install_stats ist ON cs.source = ist.source
  ORDER BY clicks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create tracking link for user
CREATE OR REPLACE FUNCTION create_tracking_link(
  p_user_id UUID,
  p_app_slug TEXT,
  p_app_name TEXT DEFAULT NULL,
  p_app_store_url TEXT DEFAULT NULL
) RETURNS tracking_links AS $$
DECLARE
  result tracking_links;
BEGIN
  INSERT INTO tracking_links (user_id, app_slug, app_name, app_store_url)
  VALUES (p_user_id, LOWER(REGEXP_REPLACE(p_app_slug, '[^a-zA-Z0-9]', '', 'g')), p_app_name, p_app_store_url)
  ON CONFLICT (app_slug) DO UPDATE SET
    app_name = COALESCE(EXCLUDED.app_name, tracking_links.app_name),
    app_store_url = COALESCE(EXCLUDED.app_store_url, tracking_links.app_store_url),
    updated_at = NOW()
  RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
