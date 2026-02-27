import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get date in EST timezone (handles EDT/EST automatically)
function getESTDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Get yesterday's date in EST timezone
function getESTYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getESTDate(yesterday);
}

// Get date N days ago in EST timezone
function getESTDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getESTDate(date);
}

async function syncRevenueCat(supabase: any, app: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const credentials = app.credentials || {};
  const apiKey = (credentials.api_key || "").trim();
  let projectId = (credentials.project_id || credentials.app_id || "").trim();
  // Use EST timezone for date calculations
  const today = getESTDate();
  console.log(`[RC] Using EST date: ${today}`);

  if (!apiKey) {
    return { success: false, error: "No API key" };
  }

  // Get project ID if not provided
  if (!projectId) {
    const resp = await fetch("https://api.revenuecat.com/v2/projects", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!resp.ok) return { success: false, error: "Invalid API key" };
    const data = await resp.json();
    if (!data.items?.length) return { success: false, error: "No projects" };
    projectId = data.items[0].id;
  }

  // Get overview metrics from RevenueCat
  const overviewResp = await fetch(
    `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
    { headers: { "Authorization": `Bearer ${apiKey}` } }
  );

  if (!overviewResp.ok) {
    return { success: false, error: "Failed to fetch metrics" };
  }

  const overviewData = await overviewResp.json();

  // LOG THE FULL API RESPONSE to see exactly what RevenueCat returns
  console.log(`[RC] FULL API RESPONSE:`, JSON.stringify(overviewData, null, 2));

  const metrics = overviewData.metrics || [];

  // Log each metric individually
  console.log(`[RC] Number of metrics returned: ${metrics.length}`);
  for (const m of metrics) {
    console.log(`[RC] Metric: id="${m.id}", name="${m.name}", value=${m.value}, description="${m.description}"`);
  }

  // Parse RevenueCat metrics - using exact field names from API
  let newCustomers = 0, revenue = 0, activeUsers = 0, mrr = 0, activeSubs = 0, activeTrials = 0;

  for (const m of metrics) {
    const id = (m.id || "").toLowerCase();
    const val = m.value || 0;
    if (id === "new_customers") newCustomers = val;
    if (id === "revenue") revenue = val;
    if (id === "active_users" || id === "active_customers") activeUsers = val;
    if (id === "mrr") mrr = val;
    if (id === "active_subscriptions") activeSubs = val;
    if (id === "active_trials") activeTrials = val;
  }

  console.log(`[RC] REAL-TIME VALUES: active_subscriptions=${activeSubs}, active_trials=${activeTrials}, mrr=${mrr}`);
  console.log(`[RC] 28-DAY VALUES: new_customers=${newCustomers}, revenue=${revenue}, active_users=${activeUsers}`);

  const metricsToInsert = [];

  // Get yesterday's date in EST timezone
  const yesterdayStr = getESTYesterday();
  console.log(`[RC] Yesterday (EST): ${yesterdayStr}`);

  // ALWAYS calculate downloads_today from yesterday's final value
  // Look across ALL apps for this user (in case app was reconnected with new ID)
  let customerBaseline = 0;
  let foundYesterdayData = false;

  // Find yesterday's new_customers count - search ALL RevenueCat metrics from yesterday
  const customerMetricTypes = ["new_customers_28d", "downloads_cumulative", "active_users", "active_users_current"];
  for (const metricType of customerMetricTypes) {
    // Search ALL revenuecat metrics from yesterday (regardless of app_id)
    // This handles cases where user reconnected with a new app ID
    const { data } = await supabase
      .from("realtime_metrics")
      .select("metric_value")
      .eq("provider", "revenuecat")
      .eq("metric_type", metricType)
      .eq("metric_date", yesterdayStr)
      .order("metric_value", { ascending: false })
      .limit(1)
      .single();

    if (data?.metric_value !== undefined && data.metric_value !== null) {
      customerBaseline = data.metric_value;
      foundYesterdayData = true;
      console.log(`[RC] Yesterday's customers from ${metricType}: ${customerBaseline}`);
      break;
    }
  }

  // If no yesterday data, this is first sync ever - use current value as baseline
  if (!foundYesterdayData) {
    // First time setup - show at least 1 download if there are any customers
    customerBaseline = newCustomers > 0 ? newCustomers - 1 : 0;
    console.log(`[RC] First time setup - baseline: ${customerBaseline}`);
  }

  // Calculate downloads today = current - yesterday's end value
  const downloadsToday = Math.max(0, newCustomers - customerBaseline);
  console.log(`[RC] Downloads today: ${downloadsToday} (${newCustomers} current - ${customerBaseline} baseline)`);

  // Same for revenue - search across all apps
  let revenueBaseline = 0;
  let foundYesterdayRevenue = false;

  const revenueMetricTypes = ["revenue_28d", "revenue", "revenue_total"];
  for (const metricType of revenueMetricTypes) {
    // Search ALL revenuecat metrics from yesterday
    const { data } = await supabase
      .from("realtime_metrics")
      .select("metric_value")
      .eq("provider", "revenuecat")
      .eq("metric_type", metricType)
      .eq("metric_date", yesterdayStr)
      .order("metric_value", { ascending: false })
      .limit(1)
      .single();

    if (data?.metric_value !== undefined && data.metric_value !== null) {
      revenueBaseline = data.metric_value;
      foundYesterdayRevenue = true;
      console.log(`[RC] Yesterday's revenue from ${metricType}: ${revenueBaseline}`);
      break;
    }
  }

  if (!foundYesterdayRevenue && revenue > 0) {
    revenueBaseline = revenue; // No change if first time
  }

  const revenueToday = Math.max(0, revenue - revenueBaseline);
  console.log(`[RC] Revenue today: $${revenueToday} ($${revenue} current - $${revenueBaseline} baseline)`);

  // Delete old metrics for today to avoid duplicates
  await supabase.from("realtime_metrics")
    .delete()
    .eq("app_id", app.id)
    .eq("metric_date", today);

  // Store all metrics for today - EXACT from RevenueCat
  metricsToInsert.push(
    // REAL-TIME METRICS (current state, not rolling totals)
    { app_id: app.id, provider: "revenuecat", metric_type: "active_subscriptions", metric_value: activeSubs, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "active_trials", metric_value: activeTrials, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "mrr", metric_value: mrr, metric_date: today },
    // 28-day rolling totals
    { app_id: app.id, provider: "revenuecat", metric_type: "new_customers_28d", metric_value: newCustomers, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "revenue_28d", metric_value: revenue, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "active_users", metric_value: activeUsers || newCustomers, metric_date: today },
    // Legacy metrics for compatibility
    { app_id: app.id, provider: "revenuecat", metric_type: "downloads_today", metric_value: downloadsToday, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "revenue_today", metric_value: revenueToday, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "downloads_cumulative", metric_value: newCustomers, metric_date: today },
  );

  console.log(`[RC] TODAY's FINAL stats: downloads_today=${downloadsToday}, revenue_today=$${revenueToday}, total_customers=${newCustomers}`);

  // Fetch REAL daily breakdown from RevenueCat Charts API for last 7 days
  const startDate = getESTDaysAgo(6);
  console.log(`[RC] Fetching charts from ${startDate} to ${today} (EST)`);
  let chartsApiStatus = "not_called";
  let chartsApiResponse = "";

  try {
    // Get daily new_customers breakdown using Charts API
    // Use 'customers_new' chart with realtime=false (required for non-realtime projects)
    const chartResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/charts/customers_new?start_date=${startDate}&end_date=${today}&realtime=false`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    chartsApiStatus = `${chartResp.status}`;
    const chartText = await chartResp.text();
    chartsApiResponse = chartText.substring(0, 2000);
    console.log(`[RC] Charts API status: ${chartResp.status}`);
    console.log(`[RC] Charts API raw response: ${chartText}`);

    if (chartResp.ok) {
      const chartData = JSON.parse(chartText);
      console.log(`[RC] Charts API response keys:`, Object.keys(chartData));

      // RevenueCat returns values as [[timestamp, value], [timestamp, value], ...]
      const values = chartData.values || [];
      console.log(`[RC] Found ${values.length} data points`);

      if (Array.isArray(values) && values.length > 0) {
        console.log(`[RC] First data point:`, JSON.stringify(values[0]));

        for (const point of values) {
          // Handle [[timestamp, value], ...] format
          if (Array.isArray(point) && point.length >= 2) {
            const timestamp = point[0]; // Unix timestamp in seconds
            const pointValue = point[1];

            // Convert Unix timestamp to date string
            const pointDate = new Date(timestamp * 1000).toISOString().split('T')[0];

            console.log(`[RC] Parsed: timestamp=${timestamp} -> date=${pointDate}, value=${pointValue}`);

            // Only use Charts API for HISTORICAL days (not today)
            // Today's value should come from our real-time calculation
            if (pointDate !== today) {
              metricsToInsert.push({
                app_id: app.id,
                provider: "revenuecat",
                metric_type: "downloads_today",
                metric_value: pointValue,
                metric_date: pointDate,
              });
              console.log(`[RC] Historical daily data: ${pointDate} = ${pointValue} downloads`);
            } else {
              console.log(`[RC] Skipping Charts API value for today (${pointValue}), using real-time calculation (${downloadsToday}) instead`);
            }
          }
        }
      }
    } else {
      console.log(`[RC] Charts API not available (${chartResp.status}), using calculated values`);
    }

    // Also try to get daily revenue breakdown
    const revenueChartResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/charts/revenue?start_date=${startDate}&end_date=${today}&resolution=day`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    if (revenueChartResp.ok) {
      const revenueChartData = await revenueChartResp.json();
      const revenueValues = revenueChartData.values || revenueChartData.data || [];
      if (Array.isArray(revenueValues)) {
        for (const point of revenueValues) {
          const pointDate = point.date || point.x || point.timestamp;
          const pointValue = point.value || point.y || 0;

          if (pointDate && pointDate !== today) {
            metricsToInsert.push({
              app_id: app.id,
              provider: "revenuecat",
              metric_type: "revenue_today",
              metric_value: pointValue,
              metric_date: pointDate,
            });
            console.log(`[RC] Historical daily revenue: ${pointDate} = $${pointValue}`);
          }
        }
      }
    }
  } catch (chartError) {
    console.log(`[RC] Charts API error:`, chartError);
  }

  // Remove duplicates before upserting (keep the last value for each key)
  const metricsMap = new Map<string, any>();
  for (const m of metricsToInsert) {
    const key = `${m.app_id}|${m.provider}|${m.metric_type}|${m.metric_date}`;
    metricsMap.set(key, m);
  }
  const deduplicatedMetrics = Array.from(metricsMap.values());

  console.log(`[RC] Total metrics to upsert: ${deduplicatedMetrics.length} (from ${metricsToInsert.length})`);

  // Upsert all metrics (insert or update if exists)
  const { data: upsertedData, error: upsertError } = await supabase
    .from("realtime_metrics")
    .upsert(deduplicatedMetrics, {
      onConflict: 'app_id,provider,metric_type,metric_date',
      ignoreDuplicates: false
    })
    .select();

  if (upsertError) {
    console.error(`[RC] Upsert error: ${upsertError.message}`, upsertError);
  } else {
    console.log(`[RC] Upserted ${upsertedData?.length || 0} metrics`);
  }

  // Update sync time
  await supabase.from("connected_apps").update({ last_sync_at: new Date().toISOString() }).eq("id", app.id);

  return {
    success: true,
    data: {
      // REAL-TIME metrics (current state)
      active_subscriptions: activeSubs,
      active_trials: activeTrials,
      mrr: mrr,
      // 28-day rolling totals
      new_customers_28d: newCustomers,
      revenue_28d: revenue,
      active_users_28d: activeUsers,
      // Debug: daily values stored
      daily_downloads_stored: metricsToInsert.filter((m: any) => m.metric_type === "downloads_today").map((m: any) => ({ date: m.metric_date, value: m.metric_value })),
      // Debug: Charts API status
      charts_api_status: chartsApiStatus,
      // Debug: upsert result
      upsert_error: upsertError?.message || null,
      upsert_count: upsertedData?.length || 0,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabase.from("connected_apps").select("*").eq("is_active", true);
    if (user_id) query = query.eq("user_id", user_id);

    const { data: apps, error } = await query;
    if (error) throw error;
    if (!apps?.length) {
      return new Response(JSON.stringify({ success: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const app of apps) {
      if (app.provider === "revenuecat") {
        results.push(await syncRevenueCat(supabase, app));
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
