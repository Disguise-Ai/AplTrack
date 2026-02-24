-- Set yesterday's baseline so we can calculate today's new customers
-- You said you had 864 yesterday and 867 today = 3 new customers today

-- First, find your app_id (run this first to get the ID)
SELECT id, provider, created_at FROM connected_apps WHERE provider = 'revenuecat' AND is_active = true;

-- Then run this with your actual app_id (replace 'YOUR_APP_ID_HERE'):
-- INSERT INTO realtime_metrics (app_id, provider, metric_type, metric_value, metric_date)
-- VALUES ('YOUR_APP_ID_HERE', 'revenuecat', 'downloads_cumulative', 864, '2026-02-22');
