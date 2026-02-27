import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getConnectedApps, getAnalytics, getLatestAnalytics, getAttribution, syncAllDataSources, getRealtimeMetrics, type RealtimeMetric } from '@/lib/api';
import type { ConnectedApp, AnalyticsSnapshot, AttributionData } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { updateWidgetData } from '@/lib/widgetData';

// Helper functions for EST timezone (matching backend)
function getESTDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getESTDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getESTDate(date);
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
  const [state, setState] = useState<AnalyticsState>({ apps: [], selectedApp: null, analytics: [], latestSnapshot: null, attribution: [], loading: true, syncing: false, error: null });

  useEffect(() => {
    if (!user) return;
    const loadApps = async () => {
      try {
        const apps = await getConnectedApps(user.id);
        setState((prev) => ({ ...prev, apps, selectedApp: apps[0] || null }));
      } catch (error: any) { console.error('Error loading apps:', error); }
    };
    loadApps();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Always load realtime metrics for all connected apps
    const loadRealtimeMetrics = async () => {
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const realtimeMetrics = await getRealtimeMetrics(user.id, startDate, endDate);

        console.log('[useAnalytics] Got realtime metrics:', realtimeMetrics.length);

        // Log what we got
        if (realtimeMetrics.length > 0) {
          const downloadMetrics = realtimeMetrics.filter(m =>
            m.metric_type === 'downloads' || m.metric_type === 'new_customers'
          );
          console.log('[useAnalytics] Download metrics found:', downloadMetrics.map(d => ({
            type: d.metric_type,
            value: d.metric_value,
            date: d.metric_date,
            app: d.app_id.substring(0, 8)
          })));
        }

        // Create analytics from realtime metrics - aggregate ALL sources
        const metricsByDate = new Map<string, AnalyticsSnapshot>();

        for (const m of realtimeMetrics) {
          if (!metricsByDate.has(m.metric_date)) {
            metricsByDate.set(m.metric_date, {
              id: `realtime-${m.metric_date}`,
              app_id: m.app_id,
              date: m.metric_date,
              downloads: 0,
              revenue: 0,
              active_users: 0,
              ratings_count: 0,
              average_rating: 0,
              created_at: new Date().toISOString(),
            });
          }
          const snapshot = metricsByDate.get(m.metric_date)!;

          // Sum up metrics from all sources
          switch (m.metric_type) {
            case 'downloads_today':
            case 'downloads_daily':
            case 'downloads':
            case 'new_customers':
            case 'new_customers_28d':
            case 'installs':
              // Daily downloads - take max across apps for same day
              snapshot.downloads = Math.max(snapshot.downloads, m.metric_value);
              break;
            case 'revenue_today':
            case 'revenue':
            case 'revenue_28d':
              snapshot.revenue = Math.max(snapshot.revenue, m.metric_value);
              break;
            case 'mrr':
              // MRR is monthly - also add to revenue if no daily revenue
              if (snapshot.revenue === 0) {
                snapshot.revenue = m.metric_value / 30; // Approximate daily from MRR
              }
              break;
            case 'active_subscribers':
            case 'active_users':
            case 'active_users_current':
            case 'daily_active_users':
              snapshot.active_users = Math.max(snapshot.active_users, m.metric_value);
              break;
          }
        }

        const analytics = Array.from(metricsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        const latestDay = analytics[analytics.length - 1];
        const totalDownloads = analytics.reduce((sum, a) => sum + a.downloads, 0);
        console.log('[useAnalytics] Built analytics:', {
          days: analytics.length,
          latestDate: latestDay?.date,
          latestDownloads: latestDay?.downloads,
          totalDownloads,
          latestRevenue: latestDay?.revenue,
          latestActiveUsers: latestDay?.active_users
        });

        // NEVER show mock data - only real data or zeros
        setState((prev) => ({ ...prev, analytics, latestSnapshot: analytics[analytics.length - 1] || null, loading: false }));
      } catch (error) {
        console.error('[useAnalytics] Error loading metrics:', error);
        // On error, show empty data - NEVER fake data
        setState((prev) => ({ ...prev, analytics: [], latestSnapshot: null, loading: false }));
      }
    };

    loadRealtimeMetrics();

    // Skip the old selectedApp logic
    if (!state.selectedApp) {
      return;
    }

    const loadAnalytics = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [analytics, latestSnapshot, attribution, realtimeMetrics] = await Promise.all([
          getAnalytics(state.selectedApp!.id, startDate, endDate),
          getLatestAnalytics(state.selectedApp!.id),
          getAttribution(state.selectedApp!.id, startDate, endDate),
          getRealtimeMetrics(user.id, startDate, endDate)
        ]);

        // Merge realtime metrics into analytics if analytics is empty
        let mergedAnalytics = analytics;
        if (realtimeMetrics.length > 0 && analytics.length === 0) {
          const metricsByDate = new Map<string, AnalyticsSnapshot>();
          for (const m of realtimeMetrics) {
            if (!metricsByDate.has(m.metric_date)) {
              metricsByDate.set(m.metric_date, {
                id: `realtime-${m.metric_date}`,
                app_id: m.app_id,
                date: m.metric_date,
                downloads: 0,
                revenue: 0,
                active_users: 0,
                ratings_count: 0,
                average_rating: 0,
                created_at: new Date().toISOString(),
              });
            }
            const snapshot = metricsByDate.get(m.metric_date)!;
            switch (m.metric_type) {
              case 'downloads_today':
              case 'downloads_daily':
              case 'downloads':
              case 'new_customers':
              case 'new_customers_28d':
              case 'installs':
                // Daily downloads - take max across apps for same day
                snapshot.downloads = Math.max(snapshot.downloads, m.metric_value);
                break;
              case 'revenue_today':
              case 'revenue':
              case 'revenue_28d':
                snapshot.revenue = Math.max(snapshot.revenue, m.metric_value);
                break;
              case 'mrr':
                // MRR is monthly - also add to revenue if no daily revenue
                if (snapshot.revenue === 0) {
                  snapshot.revenue = m.metric_value / 30;
                }
                break;
              case 'active_subscribers':
              case 'active_users':
              case 'active_users_current':
              case 'daily_active_users':
                snapshot.active_users = Math.max(snapshot.active_users, m.metric_value);
                break;
            }
          }
          mergedAnalytics = Array.from(metricsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        }

        setState((prev) => ({ ...prev, analytics: mergedAnalytics, latestSnapshot: mergedAnalytics[mergedAnalytics.length - 1] || latestSnapshot, attribution, loading: false }));
      } catch (error: any) {
        setState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to load analytics' }));
      }
    };
    loadAnalytics();
  }, [user, state.selectedApp]);

  const selectApp = useCallback((app: ConnectedApp) => { setState((prev) => ({ ...prev, selectedApp: app })); }, []);

  const syncAnalytics = useCallback(async () => {
    if (!user) return;
    setState((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      // Just load data from database - don't call external APIs here
      console.log('[syncAnalytics] Loading data for user:', user.id);

      // Refetch live metrics from database
      const { data: apps } = await supabase
        .from('connected_apps')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (apps?.length) {
        const appIds = apps.map(a => a.id);
        const today = getESTDate(); // Use EST timezone

        // Calculate date range for last 7 days (EST)
        const weekStartDate = getESTDaysAgo(6);

        // Get metrics for last 7 days
        const { data: metrics } = await supabase
          .from('realtime_metrics')
          .select('metric_type, metric_value, metric_date')
          .in('app_id', appIds)
          .in('metric_type', [
            // Real-time metrics
            'active_subscriptions',
            'active_trials',
            'mrr',
            // Daily snapshots
            'downloads_today',
            'revenue_today',
            // 28-day totals
            'new_customers_28d',
            'new_customers',
            'revenue_28d',
            'revenue',
            'active_users',
          ])
          .gte('metric_date', weekStartDate)
          .order('metric_date', { ascending: false });

        // Take the most recent value for each metric type
        let activeSubscriptions = 0, activeTrials = 0, mrr = 0;
        let newCustomers28d = 0, revenue28d = 0, activeUsers28d = 0;
        let downloadsToday = 0, revenueToday = 0;
        const seen: Record<string, boolean> = {};

        // Track daily values for weekly sums
        const dailyDownloads: Record<string, number> = {};
        const dailyRevenue: Record<string, number> = {};

        for (const m of metrics || []) {
          // For daily metrics, aggregate by date for weekly totals
          if (m.metric_type === 'downloads_today') {
            dailyDownloads[m.metric_date] = Math.max(dailyDownloads[m.metric_date] || 0, m.metric_value);
            if (m.metric_date === today) {
              downloadsToday = Math.max(downloadsToday, m.metric_value);
            }
          }
          if (m.metric_type === 'revenue_today') {
            dailyRevenue[m.metric_date] = Math.max(dailyRevenue[m.metric_date] || 0, m.metric_value);
            if (m.metric_date === today) {
              revenueToday = Math.max(revenueToday, m.metric_value);
            }
          }

          if (seen[m.metric_type]) continue;
          seen[m.metric_type] = true;

          // Real-time metrics
          if (m.metric_type === 'active_subscriptions') activeSubscriptions = m.metric_value;
          if (m.metric_type === 'active_trials') activeTrials = m.metric_value;
          if (m.metric_type === 'mrr') mrr = m.metric_value;
          // 28-day totals
          if (m.metric_type === 'new_customers_28d' || m.metric_type === 'new_customers') newCustomers28d = m.metric_value;
          if (m.metric_type === 'revenue_28d' || m.metric_type === 'revenue') revenue28d = m.metric_value;
          if (m.metric_type === 'active_users') activeUsers28d = m.metric_value;
        }

        // Calculate weekly totals from daily snapshots
        const downloadsWeek = Object.values(dailyDownloads).reduce((sum, val) => sum + val, 0);
        const revenueWeek = Object.values(dailyRevenue).reduce((sum, val) => sum + val, 0);

        setLiveMetrics({
          activeSubscriptions,
          activeTrials,
          mrr,
          downloadsToday,
          revenueToday,
          downloadsWeek,
          revenueWeek,
          newCustomers28d,
          revenue28d,
          activeUsers28d
        });

        console.log('[syncAnalytics] LIVE metrics:', {
          downloadsToday,
          downloadsWeek,
          revenueToday,
          revenueWeek,
          activeSubscriptions,
          mrr,
          newCustomers28d
        });
      } else {
        // No connected apps - reset all metrics to zero
        setLiveMetrics({
          activeSubscriptions: 0,
          activeTrials: 0,
          mrr: 0,
          downloadsToday: 0,
          revenueToday: 0,
          downloadsWeek: 0,
          revenueWeek: 0,
          newCustomers28d: 0,
          revenue28d: 0,
          activeUsers28d: 0,
        });
        console.log('[syncAnalytics] No connected apps - reset all metrics to zero');
      }

      // Load realtime metrics from database
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const realtimeMetrics = await getRealtimeMetrics(user.id, startDate, endDate);

      console.log('[syncAnalytics] Got metrics:', realtimeMetrics.length);

      if (realtimeMetrics.length > 0) {
        // Create analytics from realtime metrics
        const metricsByDate = new Map<string, AnalyticsSnapshot>();
        for (const m of realtimeMetrics) {
          if (!metricsByDate.has(m.metric_date)) {
            metricsByDate.set(m.metric_date, {
              id: `realtime-${m.metric_date}`,
              app_id: m.app_id,
              date: m.metric_date,
              downloads: 0,
              revenue: 0,
              active_users: 0,
              ratings_count: 0,
              average_rating: 0,
              created_at: new Date().toISOString(),
            });
          }
          const snapshot = metricsByDate.get(m.metric_date)!;
          switch (m.metric_type) {
            case 'downloads_today':
            case 'downloads_daily':
            case 'downloads':
            case 'new_customers':
            case 'new_customers_28d':
            case 'installs':
              // Daily downloads - take max across apps for same day
              snapshot.downloads = Math.max(snapshot.downloads, m.metric_value);
              break;
            case 'revenue_today':
            case 'revenue':
            case 'revenue_28d':
              snapshot.revenue = Math.max(snapshot.revenue, m.metric_value);
              break;
            case 'mrr':
              // MRR is monthly - also add to revenue if no daily revenue
              if (snapshot.revenue === 0) {
                snapshot.revenue = m.metric_value / 30;
              }
              break;
            case 'active_subscribers':
            case 'active_users':
            case 'active_users_current':
            case 'daily_active_users':
              snapshot.active_users = Math.max(snapshot.active_users, m.metric_value);
              break;
          }
        }
        const analytics = Array.from(metricsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        const latestDay = analytics[analytics.length - 1];
        const totalDownloads = analytics.reduce((sum, a) => sum + a.downloads, 0);
        console.log('[syncAnalytics] Built analytics:', {
          days: analytics.length,
          latestDate: latestDay?.date,
          latestDownloads: latestDay?.downloads,
          totalDownloads,
          latestRevenue: latestDay?.revenue
        });

        setState((prev) => ({ ...prev, analytics, latestSnapshot: analytics[analytics.length - 1] || null, syncing: false }));
      } else {
        setState((prev) => ({ ...prev, syncing: false }));
      }
    } catch (error: any) {
      console.error('[syncAnalytics] Error:', error);
      setState((prev) => ({ ...prev, syncing: false, error: error.message || 'Failed to sync analytics' }));
    }
  }, [user]);

  // Store REAL-TIME metrics from RevenueCat
  const [liveMetrics, setLiveMetrics] = useState({
    // REAL-TIME metrics (update instantly)
    activeSubscriptions: 0,   // Current active paid subscriptions
    activeTrials: 0,          // Current active trials
    mrr: 0,                   // Current MRR
    // Daily snapshots
    downloadsToday: 0,        // New customers today (from daily snapshot)
    revenueToday: 0,          // Revenue today (from daily snapshot)
    // Weekly totals (sum of last 7 daily snapshots)
    downloadsWeek: 0,         // New customers this week
    revenueWeek: 0,           // Revenue this week
    // 28-day totals
    newCustomers28d: 0,       // New customers in last 28 days
    revenue28d: 0,            // Revenue in last 28 days
    activeUsers28d: 0,        // Active users in last 28 days
  });

  // Fetch REAL-TIME metrics from database
  useEffect(() => {
    if (!user) return;
    const fetchLiveMetrics = async () => {
      try {
        const { data: apps } = await supabase
          .from('connected_apps')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (!apps?.length) {
          // No connected apps - reset all metrics to zero
          setLiveMetrics({
            activeSubscriptions: 0,
            activeTrials: 0,
            mrr: 0,
            downloadsToday: 0,
            revenueToday: 0,
            downloadsWeek: 0,
            revenueWeek: 0,
            newCustomers28d: 0,
            revenue28d: 0,
            activeUsers28d: 0,
          });
          console.log('[useAnalytics] No connected apps - reset all metrics to zero');
          return;
        }

        const appIds = apps.map(a => a.id);
        const today = getESTDate(); // Use EST timezone

        // Calculate date range for last 7 days (EST)
        const weekStartDate = getESTDaysAgo(6);

        // Get the MOST RECENT metrics (ordered by date desc)
        const { data: metrics } = await supabase
          .from('realtime_metrics')
          .select('metric_type, metric_value, metric_date')
          .in('app_id', appIds)
          .in('metric_type', [
            // Real-time metrics
            'active_subscriptions',
            'active_trials',
            'mrr',
            // Daily snapshots
            'downloads_today',
            'revenue_today',
            // 28-day totals
            'new_customers_28d',
            'new_customers',
            'revenue_28d',
            'revenue',
            'active_users',
          ])
          .gte('metric_date', weekStartDate)
          .order('metric_date', { ascending: false });

        // Take the most recent value for each metric type (for real-time metrics)
        let activeSubscriptions = 0, activeTrials = 0, mrr = 0;
        let newCustomers28d = 0, revenue28d = 0, activeUsers28d = 0;
        let downloadsToday = 0, revenueToday = 0;
        const seen: Record<string, boolean> = {};

        // Track daily values for weekly sums
        const dailyDownloads: Record<string, number> = {};
        const dailyRevenue: Record<string, number> = {};

        for (const m of metrics || []) {
          // For daily metrics, aggregate by date for weekly totals
          if (m.metric_type === 'downloads_today') {
            dailyDownloads[m.metric_date] = Math.max(dailyDownloads[m.metric_date] || 0, m.metric_value);
            // Today's value
            if (m.metric_date === today) {
              downloadsToday = Math.max(downloadsToday, m.metric_value);
            }
          }
          if (m.metric_type === 'revenue_today') {
            dailyRevenue[m.metric_date] = Math.max(dailyRevenue[m.metric_date] || 0, m.metric_value);
            // Today's value
            if (m.metric_date === today) {
              revenueToday = Math.max(revenueToday, m.metric_value);
            }
          }

          // For other metrics, take most recent value
          if (seen[m.metric_type]) continue;
          seen[m.metric_type] = true;

          // Real-time metrics
          if (m.metric_type === 'active_subscriptions') activeSubscriptions = m.metric_value;
          if (m.metric_type === 'active_trials') activeTrials = m.metric_value;
          if (m.metric_type === 'mrr') mrr = m.metric_value;
          // 28-day totals
          if (m.metric_type === 'new_customers_28d' || m.metric_type === 'new_customers') newCustomers28d = m.metric_value;
          if (m.metric_type === 'revenue_28d' || m.metric_type === 'revenue') revenue28d = m.metric_value;
          if (m.metric_type === 'active_users') activeUsers28d = m.metric_value;
        }

        // Calculate weekly totals from daily snapshots
        const downloadsWeek = Object.values(dailyDownloads).reduce((sum, val) => sum + val, 0);
        const revenueWeek = Object.values(dailyRevenue).reduce((sum, val) => sum + val, 0);

        console.log('[useAnalytics] Daily snapshots found:', {
          dates: Object.keys(dailyDownloads),
          dailyDownloads,
          downloadsWeek,
          dailyRevenue,
          revenueWeek
        });

        setLiveMetrics({
          activeSubscriptions,
          activeTrials,
          mrr,
          downloadsToday,
          revenueToday,
          downloadsWeek,
          revenueWeek,
          newCustomers28d,
          revenue28d,
          activeUsers28d
        });

        console.log('[useAnalytics] LIVE metrics:', {
          'Downloads Today': downloadsToday,
          'Downloads Week': downloadsWeek,
          'Revenue Today': revenueToday,
          'Revenue Week': revenueWeek,
          'Active Subscriptions': activeSubscriptions,
          'MRR': mrr,
          'New Customers (28d)': newCustomers28d
        });
      } catch (e) {
        console.error('[useAnalytics] Error fetching live metrics:', e);
      }
    };
    fetchLiveMetrics();
  }, [user, state.apps]);

  const stats = useMemo(() => {
    // REAL-TIME data from RevenueCat
    const {
      activeSubscriptions,
      activeTrials,
      mrr,
      downloadsToday,
      revenueToday,
      downloadsWeek,
      revenueWeek,
      newCustomers28d,
      revenue28d,
      activeUsers28d,
    } = liveMetrics;

    const stats = {
      // REAL-TIME metrics (update instantly)
      activeSubscriptions,                    // Current active paid subscriptions
      activeTrials,                           // Current active trials
      mrr,                                    // Current MRR

      // Daily snapshots
      downloadsToday,                         // New customers today
      revenueToday,                           // Revenue today

      // Weekly totals (sum of last 7 daily snapshots)
      downloadsWeek,                          // New customers this week
      revenueWeek,                            // Revenue this week

      // 28-day totals from RevenueCat
      newCustomers: newCustomers28d,          // New customers (28d)
      revenue: revenue28d,                    // Revenue (28d)
      activeUsers: activeUsers28d || newCustomers28d, // Active users (28d)

      // Monthly/Total (using 28-day values)
      downloadsMonth: newCustomers28d,
      totalDownloads: newCustomers28d,
      revenueMonth: revenue28d,
      totalRevenue: revenue28d,

      // Placeholders
      averageRating: 0,
      ratingsCount: 0,
      downloadsChange: 0,
      revenueChange: 0
    };

    console.log('[useAnalytics] Stats:', {
      'Downloads Today': stats.downloadsToday,
      'Downloads Week': stats.downloadsWeek,
      'Revenue Today': stats.revenueToday,
      'Revenue Week': stats.revenueWeek,
      'Active Subscriptions': stats.activeSubscriptions,
      'MRR': stats.mrr,
      'New Customers (28d)': stats.newCustomers
    });

    return stats;
  }, [liveMetrics]);

  // Update widget data when stats change
  const prevStatsRef = useRef<typeof stats | null>(null);
  useEffect(() => {
    // Only update if stats have actually changed
    const prevStats = prevStatsRef.current;
    if (
      prevStats &&
      prevStats.downloadsToday === stats.downloadsToday &&
      prevStats.totalDownloads === stats.totalDownloads &&
      prevStats.revenueToday === stats.revenueToday &&
      prevStats.totalRevenue === stats.totalRevenue
    ) {
      return;
    }
    prevStatsRef.current = stats;

    // Update widget data for iOS widgets
    if (stats.downloadsToday > 0 || stats.totalDownloads > 0 || stats.revenueToday > 0 || stats.totalRevenue > 0) {
      updateWidgetData({
        downloadsToday: stats.downloadsToday,
        totalDownloads: stats.totalDownloads,
        revenueToday: stats.revenueToday,
        totalRevenue: stats.totalRevenue,
      });
    }
  }, [stats]);

  const attributionBySource = useMemo(() => {
    const sourceMap = new Map<string, number>();
    state.attribution.forEach((attr) => { const current = sourceMap.get(attr.source) || 0; sourceMap.set(attr.source, current + attr.downloads); });
    return Array.from(sourceMap.entries()).map(([source, downloads]) => ({ source, downloads })).sort((a, b) => b.downloads - a.downloads);
  }, [state.attribution]);

  return { ...state, stats, attributionBySource, selectApp, syncAnalytics, isDemo: !state.selectedApp };
}
