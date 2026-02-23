-- Add new columns to connected_apps for multi-provider support
ALTER TABLE connected_apps 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'appstore',
ADD COLUMN IF NOT EXISTS credentials JSONB,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Make app_store_app_id nullable for non-appstore providers
ALTER TABLE connected_apps ALTER COLUMN app_store_app_id DROP NOT NULL;

-- Create index on provider
CREATE INDEX IF NOT EXISTS idx_connected_apps_provider ON connected_apps(provider);
CREATE INDEX IF NOT EXISTS idx_connected_apps_is_active ON connected_apps(is_active);

-- Add policy for users to update their own apps
CREATE POLICY IF NOT EXISTS "Users can update their own apps" ON connected_apps FOR UPDATE USING (auth.uid() = user_id);

-- Real-time analytics table (for aggregated data from multiple sources)
CREATE TABLE IF NOT EXISTS realtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES connected_apps(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'revenue', 'installs', 'active_users', 'mrr', 'churn', etc.
  metric_value DECIMAL(15,2) NOT NULL,
  metric_date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, provider, metric_type, metric_date)
);

-- Enable RLS
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;

-- RLS for realtime_metrics
CREATE POLICY "Users can view metrics for their apps" ON realtime_metrics 
FOR SELECT USING (app_id IN (SELECT id FROM connected_apps WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert metrics" ON realtime_metrics 
FOR INSERT WITH CHECK (true);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_app_date ON realtime_metrics(app_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_provider ON realtime_metrics(provider);
