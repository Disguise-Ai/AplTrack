import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { ConnectedApp, AnalyticsSnapshot, AttributionData } from '@/lib/supabase';

// Get today's date in EST timezone
function getTodayEST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Get date N days ago in EST timezone
function getDaysAgoEST(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

interface AnalyticsState {
  apps: ConnectedApp[];
  selectedApp: ConnectedApp | null;
  analytics: AnalyticsSnapshot[];
  latestSnapshot: AnalyticsSnapshot | null;
  attribution: AttributionData[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

export function useAnalytics() {
  const { user } = useAuth();
  const [state, setState] = useState<AnalyticsState>({
    apps: [],
    selectedApp: null,
    analytics: [],
    latestSnapshot: null,
    attribution: [],
    loading: true,
    syncing: false,
    error: null,
  });

  // Live metrics from database - this is the SINGLE SOURCE OF TRUTH
  const [liveMetrics, setLiveMetrics] = useState({
    downloadsToday: 0,
    revenueToday: 0,
    downloadsWeek: 0,
    revenueWeek: 0,
    activeSubscriptions: 0,
    activeTrials: 0,
    mrr: 0,
    newCustomers30d: 0,
    revenue30d: 0,
    activeUsers30d: 0,
  });

  // Load metrics directly from database - simple and reliable
  const loadMetrics = useCallback(async () => {
    if (!user) return;

    const today = getTodayEST();
    const weekStart = getDaysAgoEST(6);
    const twentyEightDaysAgo = getDaysAgoEST(27); // For chart data (matches RevenueCat's 28-day window)


    try {
      // Get user's connected apps
      const { data: apps } = await supabase
        .from('connected_apps')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!apps?.length) {
        setLiveMetrics({
          downloadsToday: 0,
          revenueToday: 0,
          downloadsWeek: 0,
          revenueWeek: 0,
          activeSubscriptions: 0,
          activeTrials: 0,
          mrr: 0,
          newCustomers30d: 0,
          revenue30d: 0,
          activeUsers30d: 0,
        });
        setState(prev => ({ ...prev, apps: [], analytics: [], loading: false }));
        return;
      }

      const appIds = apps.map(a => a.id);

      // Get ALL metrics from last 28 days for chart data + weekly stats (matches RevenueCat)
      const { data: metrics, error } = await supabase
        .from('realtime_metrics')
        .select('metric_type, metric_value, metric_date')
        .in('app_id', appIds)
        .gte('metric_date', twentyEightDaysAgo)
        .order('metric_date', { ascending: false });

      if (error) return;

      // Process metrics - SIMPLE logic
      let downloadsToday = 0;
      let revenueToday = 0;
      let activeSubscriptions = 0;
      let activeTrials = 0;
      let mrr = 0;
      let newCustomers30d = 0;
      let revenue30d = 0;
      let activeUsers30d = 0;

      // Track daily values for weekly sum
      const dailyDownloads: Record<string, number> = {};
      const dailyRevenue: Record<string, number> = {};

      // Track what we've seen for "latest value" metrics
      const seenLatest: Record<string, boolean> = {};

      for (const m of metrics || []) {
        const { metric_type, metric_value, metric_date } = m;

        // DAILY metrics - aggregate by date
        if (metric_type === 'downloads_today') {
          dailyDownloads[metric_date] = Math.max(dailyDownloads[metric_date] || 0, metric_value);
          if (metric_date === today) {
            downloadsToday = Math.max(downloadsToday, metric_value);
          }
        }

        if (metric_type === 'revenue_today') {
          dailyRevenue[metric_date] = Math.max(dailyRevenue[metric_date] || 0, metric_value);
          if (metric_date === today) {
            revenueToday = Math.max(revenueToday, metric_value);
          }
        }

        // REAL-TIME metrics - take most recent value
        if (!seenLatest[metric_type]) {
          seenLatest[metric_type] = true;

          if (metric_type === 'active_subscriptions') activeSubscriptions = metric_value;
          if (metric_type === 'active_trials') activeTrials = metric_value;
          if (metric_type === 'mrr') mrr = metric_value;
          // 28-day rolling totals from RevenueCat (also accept legacy 30d names)
          if (metric_type === 'new_customers_28d' || metric_type === 'new_customers_30d' || metric_type === 'new_customers') newCustomers30d = metric_value;
          if (metric_type === 'revenue_28d' || metric_type === 'revenue_30d' || metric_type === 'revenue') revenue30d = metric_value;
          if (metric_type === 'active_users') activeUsers30d = metric_value;
        }
      }

      // Sum weekly totals (only last 7 days)
      let downloadsWeek = 0;
      let revenueWeek = 0;
      for (let i = 0; i < 7; i++) {
        const dateStr = getDaysAgoEST(i);
        downloadsWeek += dailyDownloads[dateStr] || 0;
        revenueWeek += dailyRevenue[dateStr] || 0;
      }

      const newMetrics = {
        downloadsToday,
        revenueToday,
        downloadsWeek,
        revenueWeek,
        activeSubscriptions,
        activeTrials,
        mrr,
        newCustomers30d,
        revenue30d,
        activeUsers30d,
      };

      // Build analytics array for chart (last 28 days of daily data)
      const analyticsData: AnalyticsSnapshot[] = [];
      for (let i = 27; i >= 0; i--) {
        const dateStr = getDaysAgoEST(i);
        analyticsData.push({
          id: `chart-${dateStr}`,
          app_id: appIds[0],
          date: dateStr,
          downloads: dailyDownloads[dateStr] || 0,
          revenue: dailyRevenue[dateStr] || 0,
          active_users: dailyDownloads[dateStr] || 0,
          ratings_count: 0,
          created_at: dateStr,
        });
      }

      setLiveMetrics(newMetrics);
      setState(prev => ({ ...prev, analytics: analyticsData, loading: false }));

    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err?.message }));
    }
  }, [user]);

  // Sync analytics - calls the edge function then reloads metrics
  const syncAnalytics = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, syncing: true }));

    try {
      await fetch(
        'https://ortktibcxwsoqvjletlj.supabase.co/functions/v1/sync-all',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydGt0aWJjeHdzb3F2amxldGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzMyMjgsImV4cCI6MjA4NzEwOTIyOH0.2TXD5lBOeyhYcQWsVwhddi-NeWNShJT3m0to-fadrFw',
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      );

      await loadMetrics();
    } catch {
      // Sync failed silently
    } finally {
      setState(prev => ({ ...prev, syncing: false }));
    }
  }, [user, loadMetrics]);

  // Stats computed from liveMetrics
  const stats = useMemo(() => {
    return {
      // Daily
      downloadsToday: liveMetrics.downloadsToday,
      revenueToday: liveMetrics.revenueToday,

      // Weekly
      downloadsWeek: liveMetrics.downloadsWeek,
      revenueWeek: liveMetrics.revenueWeek,

      // Real-time
      activeSubscriptions: liveMetrics.activeSubscriptions,
      activeTrials: liveMetrics.activeTrials,
      mrr: liveMetrics.mrr,

      // 30-day
      newCustomers: liveMetrics.newCustomers30d,
      revenue: liveMetrics.revenue30d,
      activeUsers: liveMetrics.activeUsers30d || liveMetrics.newCustomers30d,

      // Aliases for compatibility
      downloadsMonth: liveMetrics.newCustomers30d,
      totalDownloads: liveMetrics.newCustomers30d,
      revenueMonth: liveMetrics.revenue30d,
      totalRevenue: liveMetrics.revenue30d,

      // Placeholders
      averageRating: 0,
      ratingsCount: 0,
      downloadsChange: 0,
      revenueChange: 0,
    };
  }, [liveMetrics]);

  const selectApp = useCallback((app: ConnectedApp) => {
    setState(prev => ({ ...prev, selectedApp: app }));
  }, []);

  const attributionBySource = useMemo(() => {
    const sourceMap = new Map<string, number>();
    state.attribution.forEach(attr => {
      sourceMap.set(attr.source, (sourceMap.get(attr.source) || 0) + attr.downloads);
    });
    return Array.from(sourceMap.entries())
      .map(([source, downloads]) => ({ source, downloads }))
      .sort((a, b) => b.downloads - a.downloads);
  }, [state.attribution]);

  // Load metrics immediately when user is available
  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [user, loadMetrics]);

  return {
    ...state,
    stats,
    attributionBySource,
    selectApp,
    syncAnalytics,
    loadMetrics,
    isDemo: !state.selectedApp,
  };
}
