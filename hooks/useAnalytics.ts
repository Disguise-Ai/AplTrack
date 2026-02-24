import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getConnectedApps, getAnalytics, getLatestAnalytics, getAttribution, syncAllDataSources, getRealtimeMetrics, type RealtimeMetric } from '@/lib/api';
import type { ConnectedApp, AnalyticsSnapshot, AttributionData } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { updateWidgetData } from '@/lib/widgetData';

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

function generateMockData(): { analytics: AnalyticsSnapshot[]; attribution: AttributionData[]; latestSnapshot: AnalyticsSnapshot } {
  const today = new Date();
  const analytics: AnalyticsSnapshot[] = [];
  const attribution: AttributionData[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const baseDownloads = 50 + Math.floor(Math.random() * 100);
    const weekendBoost = [0, 6].includes(date.getDay()) ? 1.3 : 1;
    analytics.push({ id: `mock-${i}`, app_id: 'demo', date: dateStr, downloads: Math.floor(baseDownloads * weekendBoost), revenue: parseFloat((baseDownloads * 0.5 * Math.random()).toFixed(2)), active_users: Math.floor(baseDownloads * 3 + Math.random() * 200), ratings_count: Math.floor(Math.random() * 10), average_rating: 4.2 + Math.random() * 0.6, created_at: new Date().toISOString() });
    ['Twitter', 'Instagram', 'Reddit', 'Google', 'Direct'].forEach((source) => {
      attribution.push({ id: `attr-${i}-${source}`, app_id: 'demo', source, campaign: undefined, downloads: Math.floor(baseDownloads * weekendBoost * (0.1 + Math.random() * 0.3)), date: dateStr, created_at: new Date().toISOString() });
    });
  }
  return { analytics, attribution, latestSnapshot: analytics[analytics.length - 1] };
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

        if (realtimeMetrics.length > 0) {
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
              case 'downloads_daily':
              case 'downloads':
              case 'new_customers':
              case 'installs':
                // Daily downloads - take max across apps for same day
                snapshot.downloads = Math.max(snapshot.downloads, m.metric_value);
                break;
              case 'revenue':
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

          setState((prev) => ({ ...prev, analytics, latestSnapshot: analytics[analytics.length - 1] || null, loading: false }));
        } else if (state.apps.length === 0) {
          // No connected apps and no metrics - show mock data
          console.log('[useAnalytics] No metrics, showing mock data');
          const mockData = generateMockData();
          setState((prev) => ({ ...prev, analytics: mockData.analytics, latestSnapshot: mockData.latestSnapshot, attribution: mockData.attribution, loading: false }));
        } else {
          // Has connected apps but no metrics yet - show zeros
          console.log('[useAnalytics] Has apps but no metrics yet');
          setState((prev) => ({ ...prev, analytics: [], latestSnapshot: null, loading: false }));
        }
      } catch (error) {
        console.error('[useAnalytics] Error loading metrics:', error);
        const mockData = generateMockData();
        setState((prev) => ({ ...prev, analytics: mockData.analytics, latestSnapshot: mockData.latestSnapshot, attribution: mockData.attribution, loading: false }));
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
              case 'downloads_daily':
              case 'downloads':
              case 'new_customers':
              case 'installs':
                // Daily downloads - take max across apps for same day
                snapshot.downloads = Math.max(snapshot.downloads, m.metric_value);
                break;
              case 'revenue':
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
            case 'downloads_daily':
            case 'downloads':
            case 'new_customers':
            case 'installs':
              // Daily downloads - take max across apps for same day
              snapshot.downloads = Math.max(snapshot.downloads, m.metric_value);
              break;
            case 'revenue':
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

  const stats = useMemo(() => {
    if (!state.analytics.length) return { downloadsToday: 0, downloadsWeek: 0, downloadsMonth: 0, totalDownloads: 0, revenueToday: 0, revenueWeek: 0, revenueMonth: 0, totalRevenue: 0, activeUsers: 0, averageRating: 0, ratingsCount: 0, downloadsChange: 0, revenueChange: 0 };
    const today = state.analytics[state.analytics.length - 1];
    const lastWeek = state.analytics.slice(-7);
    const lastMonth = state.analytics;
    const downloadsWeek = lastWeek.reduce((sum, s) => sum + s.downloads, 0);
    const downloadsMonth = lastMonth.reduce((sum, s) => sum + s.downloads, 0);
    const totalDownloads = state.analytics.reduce((sum, s) => sum + s.downloads, 0);
    const revenueWeek = lastWeek.reduce((sum, s) => sum + s.revenue, 0);
    const revenueMonth = lastMonth.reduce((sum, s) => sum + s.revenue, 0);
    const totalRevenue = state.analytics.reduce((sum, s) => sum + s.revenue, 0);
    const previousWeek = state.analytics.slice(-14, -7);
    const previousWeekDownloads = previousWeek.reduce((sum, s) => sum + s.downloads, 0);
    const previousWeekRevenue = previousWeek.reduce((sum, s) => sum + s.revenue, 0);
    const stats = {
      downloadsToday: today?.downloads || 0,
      downloadsWeek,
      downloadsMonth,
      totalDownloads,
      revenueToday: today?.revenue || 0,
      revenueWeek,
      revenueMonth,
      totalRevenue,
      activeUsers: today?.active_users || 0,
      averageRating: today?.average_rating || 0,
      ratingsCount: lastMonth.reduce((sum, s) => sum + s.ratings_count, 0),
      downloadsChange: previousWeekDownloads ? ((downloadsWeek - previousWeekDownloads) / previousWeekDownloads) * 100 : 0,
      revenueChange: previousWeekRevenue ? ((revenueWeek - previousWeekRevenue) / previousWeekRevenue) * 100 : 0
    };
    console.log('[useAnalytics] Stats computed:', {
      downloadsToday: stats.downloadsToday,
      downloadsWeek: stats.downloadsWeek,
      downloadsMonth: stats.downloadsMonth,
      totalDownloads: stats.totalDownloads,
      revenueToday: stats.revenueToday,
      totalRevenue: stats.totalRevenue
    });
    return stats;
  }, [state.analytics]);

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
