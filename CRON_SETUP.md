# Setting Up Automatic Daily Sync

To ensure your analytics data syncs automatically every day (even when the app is closed), follow these steps in the Supabase Dashboard:

## Step 1: Go to SQL Editor

1. Open https://supabase.com/dashboard/project/ortktibcxwsoqvjletlj
2. Click on **SQL Editor** in the left sidebar

## Step 2: Run This SQL

Copy and paste the following SQL and click **Run**:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the sync trigger function
CREATE OR REPLACE FUNCTION public.trigger_analytics_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/sync-all',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  RAISE LOG 'Analytics sync triggered at %', NOW();
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.trigger_analytics_sync() TO postgres;

-- Schedule hourly sync (every hour at minute 0)
SELECT cron.schedule(
  'hourly-analytics-sync',
  '0 * * * *',
  $$SELECT public.trigger_analytics_sync()$$
);

-- Schedule end-of-day sync at 12:05 AM EST (5:05 AM UTC)
SELECT cron.schedule(
  'daily-eod-sync',
  '5 5 * * *',
  $$SELECT public.trigger_analytics_sync()$$
);
```

## Step 3: Verify the Jobs

Run this to see your scheduled jobs:

```sql
SELECT jobid, jobname, schedule, command FROM cron.job;
```

You should see:
- `hourly-analytics-sync` - runs every hour
- `daily-eod-sync` - runs at 12:05 AM EST

## What This Does

- **Hourly Sync**: Keeps data fresh throughout the day
- **End-of-Day Sync**: Captures final daily totals at midnight EST
- Uses RevenueCat Charts API for accurate daily breakdown
- Data is stored in `realtime_metrics` table

## The App Also Syncs:

- Every 2 minutes while the app is open
- On every pull-to-refresh
- When you navigate to the Dashboard
- When you sign in

Your data will always be up to date!
