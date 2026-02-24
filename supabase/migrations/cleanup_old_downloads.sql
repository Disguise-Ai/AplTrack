-- Clean up old cumulative download metrics that were incorrectly stored as daily values
-- This removes the 867 cumulative value that was showing as "downloads today"
-- Run this in Supabase SQL Editor

-- Delete old 'downloads' and 'new_customers' metrics (these were cumulative, not daily)
DELETE FROM realtime_metrics
WHERE metric_type IN ('downloads', 'new_customers', 'installs')
AND metric_type != 'downloads_daily'
AND metric_type != 'downloads_cumulative';

-- Show what's left
SELECT metric_type, metric_value, metric_date
FROM realtime_metrics
ORDER BY metric_date DESC, metric_type;
