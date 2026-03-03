-- Enable required extensions (IF NOT EXISTS prevents errors)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing function if exists to allow recreation
DROP FUNCTION IF EXISTS public.trigger_analytics_sync();

-- Create a function to trigger the sync-all edge function
CREATE OR REPLACE FUNCTION public.trigger_analytics_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the sync-all edge function (set to --no-verify-jwt)
  PERFORM net.http_post(
    url := 'https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/sync-all',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  
  RAISE LOG 'Analytics sync triggered at %', NOW();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_analytics_sync() TO postgres;

-- Remove existing jobs if they exist (to prevent duplicates)
DO $$
BEGIN
  PERFORM cron.unschedule('hourly-analytics-sync');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-eod-sync');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule hourly sync (keeps data fresh throughout the day)
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
