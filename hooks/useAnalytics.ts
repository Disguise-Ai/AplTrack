import { useEffect, useState, useCallback, useMemo } from 'react';
import { getConnectedApps, getAnalytics, getLatestAnalytics, getAttribution, syncAllDataSources, getRealtimeMetrics, type RealtimeMetric } from '@/lib/api';
import type { ConnectedApp, AnalyticsSnapshot, AttributionData } from '@/lib/supabase';
import { useAuth } from './useAuth';

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

    if (!state.selectedApp) {
      // No connected app - check for realtime metrics first, then show mock data
      const loadRealtimeOrMock = async () => {
        try {
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const realtimeMetrics = await getRealtimeMetrics(user.id, startDate, endDate);

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
                case 'new_customers':
                case 'installs':
                case 'downloads':
                  snapshot.downloads += m.metric_value;
                  break;
                case 'revenue':
                case 'mrr':
                  snapshot.revenue += m.metric_value;
                  break;
                case 'active_subscribers':
                case 'active_users':
                case 'daily_active_users':
                  snapshot.active_users = Math.max(snapshot.active_users, m.metric_value);
                  break;
              }
            }
            const analytics = Array.from(metricsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
            setState((prev) => ({ ...prev, analytics, latestSnapshot: analytics[analytics.length - 1] || null, loading: false }));
          } else {
            const mockData = generateMockData();
            setState((prev) => ({ ...prev, analytics: mockData.analytics, latestSnapshot: mockData.latestSnapshot, attribution: mockData.attribution, loading: false }));
          }
        } catch (error) {
          const mockData = generateMockData();
          setState((prev) => ({ ...prev, analytics: mockData.analytics, latestSnapshot: mockData.latestSnapshot, attribution: mockData.attribution, loading: false }));
        }
      };
      loadRealtimeOrMock();
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
              case 'new_customers':
              case 'installs':
              case 'downloads':
                snapshot.downloads += m.metric_value;
                break;
              case 'revenue':
              case 'mrr':
                snapshot.revenue += m.metric_value;
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
      // Sync all connected data sources
      await syncAllDataSources(user.id);

      // Reload data after sync
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (state.selectedApp) {
        const [analytics, latestSnapshot, attribution] = await Promise.all([
          getAnalytics(state.selectedApp.id, startDate, endDate),
          getLatestAnalytics(state.selectedApp.id),
          getAttribution(state.selectedApp.id, startDate, endDate)
        ]);

        // Also get real-time metrics
        const realtimeMetrics = await getRealtimeMetrics(user.id, startDate, endDate);

        // Merge realtime metrics into analytics if we have them
        let mergedAnalytics = analytics;
        if (realtimeMetrics.length > 0 && analytics.length === 0) {
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
              case 'new_customers':
              case 'installs':
              case 'downloads':
                snapshot.downloads += m.metric_value;
                break;
              case 'revenue':
              case 'mrr':
                snapshot.revenue += m.metric_value;
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

        setState((prev) => ({ ...prev, analytics: mergedAnalytics, latestSnapshot: mergedAnalytics[mergedAnalytics.length - 1] || latestSnapshot, attribution, syncing: false }));
      } else {
        setState((prev) => ({ ...prev, syncing: false }));
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      setState((prev) => ({ ...prev, syncing: false, error: error.message || 'Failed to sync analytics' }));
    }
  }, [user, state.selectedApp]);

  const stats = useMemo(() => {
    if (!state.analytics.length) return { downloadsToday: 0, downloadsWeek: 0, downloadsMonth: 0, revenueToday: 0, revenueWeek: 0, revenueMonth: 0, activeUsers: 0, averageRating: 0, ratingsCount: 0, downloadsChange: 0, revenueChange: 0 };
    const today = state.analytics[state.analytics.length - 1];
    const lastWeek = state.analytics.slice(-7);
    const lastMonth = state.analytics;
    const downloadsWeek = lastWeek.reduce((sum, s) => sum + s.downloads, 0);
    const downloadsMonth = lastMonth.reduce((sum, s) => sum + s.downloads, 0);
    const revenueWeek = lastWeek.reduce((sum, s) => sum + s.revenue, 0);
    const revenueMonth = lastMonth.reduce((sum, s) => sum + s.revenue, 0);
    const previousWeek = state.analytics.slice(-14, -7);
    const previousWeekDownloads = previousWeek.reduce((sum, s) => sum + s.downloads, 0);
    const previousWeekRevenue = previousWeek.reduce((sum, s) => sum + s.revenue, 0);
    return { downloadsToday: today?.downloads || 0, downloadsWeek, downloadsMonth, revenueToday: today?.revenue || 0, revenueWeek, revenueMonth, activeUsers: today?.active_users || 0, averageRating: today?.average_rating || 0, ratingsCount: lastMonth.reduce((sum, s) => sum + s.ratings_count, 0), downloadsChange: previousWeekDownloads ? ((downloadsWeek - previousWeekDownloads) / previousWeekDownloads) * 100 : 0, revenueChange: previousWeekRevenue ? ((revenueWeek - previousWeekRevenue) / previousWeekRevenue) * 100 : 0 };
  }, [state.analytics]);

  const attributionBySource = useMemo(() => {
    const sourceMap = new Map<string, number>();
    state.attribution.forEach((attr) => { const current = sourceMap.get(attr.source) || 0; sourceMap.set(attr.source, current + attr.downloads); });
    return Array.from(sourceMap.entries()).map(([source, downloads]) => ({ source, downloads })).sort((a, b) => b.downloads - a.downloads);
  }, [state.attribution]);

  return { ...state, stats, attributionBySource, selectApp, syncAnalytics, isDemo: !state.selectedApp };
}
