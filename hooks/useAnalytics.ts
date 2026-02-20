import { useEffect, useState, useCallback, useMemo } from 'react';
import { getConnectedApps, getAnalytics, getLatestAnalytics, getAttribution, triggerAnalyticsSync } from '@/lib/api';
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
    if (!state.selectedApp) {
      const mockData = generateMockData();
      setState((prev) => ({ ...prev, analytics: mockData.analytics, latestSnapshot: mockData.latestSnapshot, attribution: mockData.attribution, loading: false }));
      return;
    }
    const loadAnalytics = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [analytics, latestSnapshot, attribution] = await Promise.all([getAnalytics(state.selectedApp!.id, startDate, endDate), getLatestAnalytics(state.selectedApp!.id), getAttribution(state.selectedApp!.id, startDate, endDate)]);
        setState((prev) => ({ ...prev, analytics, latestSnapshot, attribution, loading: false }));
      } catch (error: any) {
        setState((prev) => ({ ...prev, loading: false, error: error.message || 'Failed to load analytics' }));
      }
    };
    loadAnalytics();
  }, [state.selectedApp]);

  const selectApp = useCallback((app: ConnectedApp) => { setState((prev) => ({ ...prev, selectedApp: app })); }, []);

  const syncAnalytics = useCallback(async () => {
    if (!state.selectedApp) return;
    setState((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      await triggerAnalyticsSync(state.selectedApp.id);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [analytics, latestSnapshot, attribution] = await Promise.all([getAnalytics(state.selectedApp.id, startDate, endDate), getLatestAnalytics(state.selectedApp.id), getAttribution(state.selectedApp.id, startDate, endDate)]);
      setState((prev) => ({ ...prev, analytics, latestSnapshot, attribution, syncing: false }));
    } catch (error: any) {
      setState((prev) => ({ ...prev, syncing: false, error: error.message || 'Failed to sync analytics' }));
    }
  }, [state.selectedApp]);

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
