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

// Get timestamp for N days ago
function getDaysAgoTimestamp(days: number): number {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

async function syncStripeApp(supabase: any, app: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const credentials = app.credentials || {};
  const secretKey = (credentials.secret_key || "").trim();
  const today = getESTDate();

  if (!secretKey) {
    return { success: false, error: "No secret key" };
  }

  if (!secretKey.startsWith("sk_")) {
    return { success: false, error: "Invalid secret key format" };
  }

  const stripeHeaders = {
    "Authorization": `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    // Get current active subscriptions
    let activeSubscriptions = 0;
    let activeTrials = 0;
    let mrr = 0;
    let hasMore = true;
    let startingAfter = "";

    while (hasMore) {
      const subsUrl = new URL("https://api.stripe.com/v1/subscriptions");
      subsUrl.searchParams.set("status", "all");
      subsUrl.searchParams.set("limit", "100");
      if (startingAfter) subsUrl.searchParams.set("starting_after", startingAfter);

      const subsResp = await fetch(subsUrl.toString(), { headers: stripeHeaders });
      if (!subsResp.ok) {
        const error = await subsResp.json();
        return { success: false, error: error.error?.message || "Failed to fetch subscriptions" };
      }

      const subsData = await subsResp.json();

      for (const sub of subsData.data || []) {
        if (sub.status === "active") {
          activeSubscriptions++;
          for (const item of sub.items?.data || []) {
            const price = item.price;
            if (price?.recurring) {
              let amount = (price.unit_amount || 0) / 100;
              const interval = price.recurring.interval;
              const intervalCount = price.recurring.interval_count || 1;
              if (interval === "year") amount = amount / (12 * intervalCount);
              else if (interval === "week") amount = amount * (52 / 12) / intervalCount;
              else if (interval === "day") amount = amount * (365 / 12) / intervalCount;
              else amount = amount / intervalCount;
              mrr += amount * (item.quantity || 1);
            }
          }
        } else if (sub.status === "trialing") {
          activeTrials++;
        }
      }

      hasMore = subsData.has_more;
      if (hasMore && subsData.data.length > 0) {
        startingAfter = subsData.data[subsData.data.length - 1].id;
      }
    }

    // Get charges for last 30 days
    const thirtyDaysAgo = getDaysAgoTimestamp(30);
    const dailyRevenue: Record<string, number> = {};
    const dailySales: Record<string, number> = {};
    let totalRevenue30d = 0;
    let totalSales30d = 0;

    hasMore = true;
    startingAfter = "";

    while (hasMore) {
      const chargesUrl = new URL("https://api.stripe.com/v1/charges");
      chargesUrl.searchParams.set("created[gte]", thirtyDaysAgo.toString());
      chargesUrl.searchParams.set("limit", "100");
      if (startingAfter) chargesUrl.searchParams.set("starting_after", startingAfter);

      const chargesResp = await fetch(chargesUrl.toString(), { headers: stripeHeaders });
      if (!chargesResp.ok) break;

      const chargesData = await chargesResp.json();

      for (const charge of chargesData.data || []) {
        if (charge.status === "succeeded" && !charge.refunded) {
          const chargeDate = new Date(charge.created * 1000);
          const dateStr = getESTDate(chargeDate);
          const netAmount = (charge.amount - (charge.amount_refunded || 0)) / 100;
          dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + netAmount;
          dailySales[dateStr] = (dailySales[dateStr] || 0) + 1;
          totalRevenue30d += netAmount;
          totalSales30d++;
        }
      }

      hasMore = chargesData.has_more;
      if (hasMore && chargesData.data.length > 0) {
        startingAfter = chargesData.data[chargesData.data.length - 1].id;
      }
    }

    // Get new customers in last 30 days
    let newCustomers30d = 0;
    hasMore = true;
    startingAfter = "";

    while (hasMore) {
      const customersUrl = new URL("https://api.stripe.com/v1/customers");
      customersUrl.searchParams.set("created[gte]", thirtyDaysAgo.toString());
      customersUrl.searchParams.set("limit", "100");
      if (startingAfter) customersUrl.searchParams.set("starting_after", startingAfter);

      const customersResp = await fetch(customersUrl.toString(), { headers: stripeHeaders });
      if (!customersResp.ok) break;

      const customersData = await customersResp.json();
      newCustomers30d += customersData.data?.length || 0;

      hasMore = customersData.has_more;
      if (hasMore && customersData.data.length > 0) {
        startingAfter = customersData.data[customersData.data.length - 1].id;
      }
    }

    // Store metrics
    const metricsToInsert = [
      { app_id: app.id, provider: "stripe", metric_type: "active_subscriptions", metric_value: activeSubscriptions, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "active_trials", metric_value: activeTrials, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "mrr", metric_value: Math.round(mrr * 100) / 100, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "new_customers_28d", metric_value: newCustomers30d, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "revenue_28d", metric_value: Math.round(totalRevenue30d * 100) / 100, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "active_users", metric_value: newCustomers30d, metric_date: today },
    ];

    for (const [dateStr, revenue] of Object.entries(dailyRevenue)) {
      metricsToInsert.push({ app_id: app.id, provider: "stripe", metric_type: "revenue_today", metric_value: Math.round(revenue * 100) / 100, metric_date: dateStr });
    }
    for (const [dateStr, sales] of Object.entries(dailySales)) {
      metricsToInsert.push({ app_id: app.id, provider: "stripe", metric_type: "downloads_today", metric_value: sales, metric_date: dateStr });
    }

    await supabase.from("realtime_metrics").upsert(metricsToInsert, { onConflict: 'app_id,provider,metric_type,metric_date', ignoreDuplicates: false });
    await supabase.from("connected_apps").update({ last_sync_at: new Date().toISOString() }).eq("id", app.id);

    return {
      success: true,
      data: { active_subscriptions: activeSubscriptions, active_trials: activeTrials, mrr: Math.round(mrr * 100) / 100, new_customers_30d: newCustomers30d, revenue_30d: Math.round(totalRevenue30d * 100) / 100 },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function syncRevenueCat(supabase: any, app: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const credentials = app.credentials || {};
  const apiKey = (credentials.api_key || "").trim();
  const specifiedProjectId = (credentials.project_id || credentials.app_id || "").trim();
  const today = getESTDate();

  if (!apiKey) {
    return { success: false, error: "No API key" };
  }

  // Get projects associated with this API key
  let projectIds: string[] = [];
  let projectNames: string[] = [];

  if (specifiedProjectId) {
    projectIds = [specifiedProjectId];
  } else {
    const resp = await fetch("https://api.revenuecat.com/v2/projects", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!resp.ok) return { success: false, error: "Invalid API key" };
    const data = await resp.json();
    if (!data.items?.length) return { success: false, error: "No projects" };
    projectIds = data.items.map((item: any) => item.id);
    projectNames = data.items.map((item: any) => item.name);
  }

  // Aggregate metrics from ALL projects
  let newCustomers = 0, revenue = 0, activeUsers = 0, mrr = 0, activeSubs = 0, activeTrials = 0;

  for (const projectId of projectIds) {
    const overviewResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    if (!overviewResp.ok) continue;

    const overviewData = await overviewResp.json();
    const metrics = overviewData.metrics || [];

    for (const m of metrics) {
      const id = (m.id || "").toLowerCase();
      const val = parseFloat(m.value || 0);
      if (id === "new_customers") newCustomers += val;
      if (id === "revenue") revenue += val;
      if (id === "active_users" || id === "active_customers") activeUsers += val;
      if (id === "mrr") mrr += val;
      if (id === "active_subscriptions") activeSubs += val;
      if (id === "active_trials") activeTrials += val;
    }
  }

  const primaryProjectId = projectIds[0];
  const metricsToInsert = [];
  const yesterdayStr = getESTYesterday();

  // Get baseline from most recent cumulative value (single query)
  const { data: recentCumulative } = await supabase
    .from("realtime_metrics")
    .select("metric_value")
    .eq("app_id", app.id)
    .eq("provider", "revenuecat")
    .eq("metric_type", "downloads_cumulative")
    .order("metric_date", { ascending: false })
    .limit(1)
    .single();

  const customerBaseline = recentCumulative?.metric_value ?? 0;
  let downloadsToday = Math.max(0, newCustomers - customerBaseline);

  // Cap unrealistic first-sync values
  if (downloadsToday > 100 && !recentCumulative) {
    downloadsToday = Math.min(activeSubs, 10);
  }

  // Get revenue baseline (single query)
  const { data: recentRevenue } = await supabase
    .from("realtime_metrics")
    .select("metric_value")
    .eq("app_id", app.id)
    .eq("provider", "revenuecat")
    .in("metric_type", ["revenue_28d", "revenue_30d", "revenue"])
    .order("metric_date", { ascending: false })
    .limit(1)
    .single();

  const revenueBaseline = recentRevenue?.metric_value ?? revenue;
  const revenueToday = Math.max(0, revenue - revenueBaseline);

  // Store all metrics for today (upsert handles duplicates)
  metricsToInsert.push(
    // REAL-TIME METRICS (current state, not rolling totals)
    { app_id: app.id, provider: "revenuecat", metric_type: "active_subscriptions", metric_value: activeSubs, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "active_trials", metric_value: activeTrials, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "mrr", metric_value: mrr, metric_date: today },
    // 28-day rolling totals (RevenueCat Overview API uses 28-day window)
    { app_id: app.id, provider: "revenuecat", metric_type: "new_customers_28d", metric_value: newCustomers, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "revenue_28d", metric_value: revenue, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "active_users", metric_value: activeUsers || newCustomers, metric_date: today },
    // Daily metrics
    { app_id: app.id, provider: "revenuecat", metric_type: "downloads_today", metric_value: downloadsToday, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "revenue_today", metric_value: revenueToday, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "downloads_cumulative", metric_value: newCustomers, metric_date: today },
  );

  // Fetch daily breakdown from RevenueCat Charts API (28 days)
  const startDate = getESTDaysAgo(27);
  let chartsApiStatus = "not_called";
  let chartsTodayValue: number | null = null;
  let charts28DayCustomers = 0;
  let charts28DayRevenue = 0;

  try {
    // Get daily new customers
    let chartResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${primaryProjectId}/charts/customers_new?start_date=${startDate}&end_date=${today}&realtime=true`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    if (!chartResp.ok) {
      chartResp = await fetch(
        `https://api.revenuecat.com/v2/projects/${primaryProjectId}/charts/customers_new?start_date=${startDate}&end_date=${today}&realtime=false`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );
    }

    chartsApiStatus = `${chartResp.status}`;

    if (chartResp.ok) {
      const chartData = await chartResp.json();
      const values = chartData.values || [];

      for (const point of values) {
        if (Array.isArray(point) && point.length >= 2) {
          const pointDate = new Date(point[0] * 1000).toISOString().split('T')[0];
          const pointValue = point[1];

          charts28DayCustomers += pointValue;
          if (pointDate === today) chartsTodayValue = pointValue;

          metricsToInsert.push({
            app_id: app.id,
            provider: "revenuecat",
            metric_type: "downloads_today",
            metric_value: pointValue,
            metric_date: pointDate,
          });
        }
      }
    }

    // Get daily revenue
    const revenueChartResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${primaryProjectId}/charts/revenue?start_date=${startDate}&end_date=${today}&realtime=true`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    if (revenueChartResp.ok) {
      const revenueChartData = await revenueChartResp.json();
      const revenueValues = revenueChartData.values || [];

      for (const point of revenueValues) {
        if (Array.isArray(point) && point.length >= 2) {
          const pointDate = new Date(point[0] * 1000).toISOString().split('T')[0];
          const pointValue = point[1];

          charts28DayRevenue += pointValue;

          metricsToInsert.push({
            app_id: app.id,
            provider: "revenuecat",
            metric_type: "revenue_today",
            metric_value: pointValue,
            metric_date: pointDate,
          });
        }
      }
    }
  } catch (chartError) {
    // Charts API failed, use overview values
  }

  // Use Charts API values if available
  if (chartsTodayValue !== null) downloadsToday = chartsTodayValue;

  if (charts28DayCustomers > 0) {
    newCustomers = charts28DayCustomers;
    const nc28Index = metricsToInsert.findIndex(m => m.metric_type === "new_customers_28d" && m.metric_date === today);
    if (nc28Index >= 0) metricsToInsert[nc28Index].metric_value = charts28DayCustomers;
  }

  if (charts28DayRevenue > 0) {
    revenue = charts28DayRevenue;
    const rev28Index = metricsToInsert.findIndex(m => m.metric_type === "revenue_28d" && m.metric_date === today);
    if (rev28Index >= 0) metricsToInsert[rev28Index].metric_value = charts28DayRevenue;
  }

  // Deduplicate metrics (keep last value for each key)
  const metricsMap = new Map<string, any>();
  for (const m of metricsToInsert) {
    metricsMap.set(`${m.app_id}|${m.metric_type}|${m.metric_date}`, m);
  }
  const deduplicatedMetrics = Array.from(metricsMap.values());

  // Upsert all metrics
  const { error: upsertError } = await supabase
    .from("realtime_metrics")
    .upsert(deduplicatedMetrics, {
      onConflict: 'app_id,provider,metric_type,metric_date',
      ignoreDuplicates: false
    });

  // Update sync time
  await supabase.from("connected_apps").update({ last_sync_at: new Date().toISOString() }).eq("id", app.id);

  return {
    success: true,
    data: {
      active_subscriptions: activeSubs,
      active_trials: activeTrials,
      mrr: mrr,
      new_customers_28d: newCustomers,
      revenue_28d: revenue,
      charts_api_status: chartsApiStatus,
      metrics_count: deduplicatedMetrics.length,
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
      } else if (app.provider === "stripe") {
        // Call the sync-stripe function
        try {
          const stripeResult = await syncStripeApp(supabase, app);
          results.push(stripeResult);
        } catch (e: any) {
          results.push({ success: false, error: e.message, provider: "stripe" });
        }
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
