-- Fix Data Sync: Ensure proper constraints and RLS policies for data to sync correctly
-- Run this in Supabase SQL Editor

-- 1. Add unique constraint on analytics_snapshots for upsert to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_snapshots_app_id_date_key'
  ) THEN
    ALTER TABLE analytics_snapshots ADD CONSTRAINT analytics_snapshots_app_id_date_key UNIQUE (app_id, date);
  END IF;
END $$;

-- 2. Create realtime_metrics table if it doesn't exist
CREATE TABLE IF NOT EXISTS realtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES connected_apps(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC DEFAULT 0,
  metric_date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add unique constraint on realtime_metrics for upsert to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'realtime_metrics_app_provider_type_date_key'
  ) THEN
    ALTER TABLE realtime_metrics ADD CONSTRAINT realtime_metrics_app_provider_type_date_key
      UNIQUE (app_id, provider, metric_type, metric_date);
  END IF;
END $$;

-- 4. Enable RLS on realtime_metrics
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for realtime_metrics
DROP POLICY IF EXISTS "Users can view their own metrics" ON realtime_metrics;
CREATE POLICY "Users can view their own metrics" ON realtime_metrics
  FOR SELECT USING (
    app_id IN (SELECT id FROM connected_apps WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role can manage all metrics" ON realtime_metrics;
CREATE POLICY "Service role can manage all metrics" ON realtime_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- 6. RLS policies for analytics_snapshots (ensure service role can insert)
DROP POLICY IF EXISTS "Users can view their app snapshots" ON analytics_snapshots;
CREATE POLICY "Users can view their app snapshots" ON analytics_snapshots
  FOR SELECT USING (
    app_id IN (SELECT id FROM connected_apps WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role can manage all snapshots" ON analytics_snapshots;
CREATE POLICY "Service role can manage all snapshots" ON analytics_snapshots
  FOR ALL USING (true) WITH CHECK (true);

-- 7. RLS policies for connected_apps (ensure users can insert and service can update)
DROP POLICY IF EXISTS "Users can view their own apps" ON connected_apps;
CREATE POLICY "Users can view their own apps" ON connected_apps
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own apps" ON connected_apps;
CREATE POLICY "Users can insert their own apps" ON connected_apps
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own apps" ON connected_apps;
CREATE POLICY "Users can update their own apps" ON connected_apps
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own apps" ON connected_apps;
CREATE POLICY "Users can delete their own apps" ON connected_apps
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all apps" ON connected_apps;
CREATE POLICY "Service role can manage all apps" ON connected_apps
  FOR ALL USING (true) WITH CHECK (true);

-- 8. Add last_sync_at column to connected_apps if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connected_apps' AND column_name = 'last_sync_at'
  ) THEN
    ALTER TABLE connected_apps ADD COLUMN last_sync_at TIMESTAMPTZ;
  END IF;
END $$;

-- 9. Grant permissions to service role
GRANT ALL ON realtime_metrics TO service_role;
GRANT ALL ON analytics_snapshots TO service_role;
GRANT ALL ON connected_apps TO service_role;

-- 10. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_app_date ON realtime_metrics(app_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_app_date ON analytics_snapshots(app_id, date);

SELECT 'Data sync constraints and policies applied successfully!' as result;
