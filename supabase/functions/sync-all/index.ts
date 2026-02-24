import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function syncRevenueCat(supabase: any, app: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const credentials = app.credentials || {};
  const apiKey = (credentials.api_key || "").trim();
  let projectId = (credentials.project_id || credentials.app_id || "").trim();
  const today = new Date().toISOString().split("T")[0];

  console.log(`[RevenueCat] Starting sync for app ${app.id}`);
  console.log(`[RevenueCat] API Key length: ${apiKey.length}, starts with: ${apiKey.substring(0, 10)}...`);
  console.log(`[RevenueCat] Project ID: ${projectId}`);

  if (!apiKey) {
    return { success: false, error: "No API key found in credentials" };
  }

  // STEP 1: Get projects if no projectId provided
  if (!projectId) {
    try {
      console.log(`[RevenueCat] No project ID, fetching projects list...`);
      const resp = await fetch("https://api.revenuecat.com/v2/projects", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });

      console.log(`[RevenueCat] Projects response: ${resp.status}`);

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[RevenueCat] Projects error: ${errText}`);
        return { success: false, error: `API error ${resp.status}: ${errText.substring(0, 100)}` };
      }

      const data = await resp.json();
      const projects = data.items || [];
      console.log(`[RevenueCat] Found ${projects.length} projects`);

      if (projects.length === 0) {
        return { success: false, error: "No projects found in RevenueCat account" };
      }
      projectId = projects[0].id;
      console.log(`[RevenueCat] Using first project: ${projectId}`);
    } catch (e: any) {
      console.error(`[RevenueCat] Projects fetch error: ${e.message}`);
      return { success: false, error: `Failed to fetch projects: ${e.message}` };
    }
  }

  // STEP 2: Get overview metrics
  let newCustomers = 0;
  let revenue = 0;
  let activeUsers = 0;
  let mrr = 0;
  let activeSubscriptions = 0;
  let activeTrials = 0;

  try {
    console.log(`[RevenueCat] Fetching overview for project: ${projectId}`);
    const overviewResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    console.log(`[RevenueCat] Overview response: ${overviewResp.status}`);

    if (overviewResp.ok) {
      const overviewData = await overviewResp.json();
      console.log(`[RevenueCat] Overview data:`, JSON.stringify(overviewData).substring(0, 1000));

      const metrics = overviewData.metrics || [];

      // Log ALL metrics to see what RevenueCat returns
      console.log(`[RevenueCat] All metrics:`, JSON.stringify(metrics));

      for (const metric of metrics) {
        const id = metric.id || metric.name || "";
        const value = metric.value ?? metric.total ?? 0;
        console.log(`[RevenueCat] Metric: ${id} = ${value}`);

        switch (id.toLowerCase()) {
          case "new_customers":
          case "new customers":
          case "customers":
            newCustomers = value;
            break;
          case "revenue":
          case "total_revenue":
            revenue = value;
            break;
          case "active_users":
          case "active_customers":
          case "active customers":
            activeUsers = value;
            break;
          case "mrr":
          case "monthly_recurring_revenue":
            mrr = value;
            break;
          case "active_subscriptions":
          case "active subscriptions":
            activeSubscriptions = value;
            break;
          case "active_trials":
          case "active trials":
            activeTrials = value;
            break;
        }
      }
    } else {
      const errText = await overviewResp.text();
      console.error(`[RevenueCat] Overview error: ${overviewResp.status} - ${errText}`);
      return { success: false, error: `Overview API error: ${overviewResp.status}` };
    }
  } catch (e: any) {
    console.error(`[RevenueCat] Overview fetch error: ${e.message}`);
    return { success: false, error: `Failed to fetch overview: ${e.message}` };
  }

  console.log(`[RevenueCat] Final metrics - New Customers: ${newCustomers}, Revenue: $${revenue}, Active Users: ${activeUsers}, MRR: $${mrr}, Active Subs: ${activeSubscriptions}`);

  // Skip if no data at all
  if (newCustomers === 0 && revenue === 0 && activeUsers === 0 && mrr === 0 && activeSubscriptions === 0) {
    console.log(`[RevenueCat] No data returned from API`);
    return { success: false, error: "No data returned from RevenueCat - check project ID" };
  }

  // Use EXACT values from RevenueCat - don't manipulate them
  // These are 28-day totals
  const totalDownloads28d = newCustomers;
  const totalRevenue28d = revenue;

  // Calculate daily averages for chart display
  const dailyDownloads = Math.round(totalDownloads28d / 28);
  const dailyRevenue = totalRevenue28d / 28;

  // CLEAR old data first to avoid stale values
  console.log(`[RevenueCat] Clearing old metrics for app ${app.id}...`);
  await supabase.from("realtime_metrics").delete().eq("app_id", app.id);
  await supabase.from("analytics_snapshots").delete().eq("app_id", app.id);

  // Store metrics for the last 28 days
  console.log(`[RevenueCat] Storing EXACT metrics from RevenueCat:`);
  console.log(`[RevenueCat]   - Total Downloads (28d): ${totalDownloads28d}`);
  console.log(`[RevenueCat]   - Total Revenue (28d): $${totalRevenue28d}`);
  console.log(`[RevenueCat]   - Active Users: ${activeUsers}`);
  console.log(`[RevenueCat]   - MRR: $${mrr}`);
  console.log(`[RevenueCat]   - Active Subscriptions: ${activeSubscriptions}`);

  // Store the EXACT 28-day totals as a special metric
  await supabase.from("realtime_metrics").insert({
    app_id: app.id,
    provider: "revenuecat",
    metric_type: "total_downloads_28d",
    metric_value: totalDownloads28d,
    metric_date: today,
  });

  await supabase.from("realtime_metrics").insert({
    app_id: app.id,
    provider: "revenuecat",
    metric_type: "total_revenue_28d",
    metric_value: totalRevenue28d,
    metric_date: today,
  });

  // Store daily breakdown for chart (using exact division, no rounding)
  for (let i = 0; i < 28; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    // Use exact values - don't round
    const exactDailyDownloads = totalDownloads28d / 28;
    const exactDailyRevenue = totalRevenue28d / 28;

    // Store in realtime_metrics
    await supabase.from("realtime_metrics").insert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: "downloads_daily",
      metric_value: exactDailyDownloads,
      metric_date: dateStr,
    });

    await supabase.from("realtime_metrics").insert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: "revenue",
      metric_value: exactDailyRevenue,
      metric_date: dateStr,
    });

    // Store in analytics_snapshots
    await supabase.from("analytics_snapshots").insert({
      app_id: app.id,
      date: dateStr,
      downloads: Math.round(exactDailyDownloads),
      revenue: exactDailyRevenue,
      active_users: i === 0 ? activeUsers : 0,
      ratings_count: 0,
      average_rating: 0,
    });
  }

  // Store today's current metrics
  await supabase.from("realtime_metrics").insert({
    app_id: app.id,
    provider: "revenuecat",
    metric_type: "active_users",
    metric_value: activeUsers,
    metric_date: today,
  });

  await supabase.from("realtime_metrics").insert({
    app_id: app.id,
    provider: "revenuecat",
    metric_type: "mrr",
    metric_value: mrr,
    metric_date: today,
  });

  await supabase.from("realtime_metrics").insert({
    app_id: app.id,
    provider: "revenuecat",
    metric_type: "active_subscriptions",
    metric_value: activeSubscriptions,
    metric_date: today,
  });

  // Update last sync time
  await supabase
    .from("connected_apps")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", app.id);

  console.log(`[RevenueCat] Sync complete for app ${app.id}`);

  return {
    success: true,
    data: {
      total_downloads_28d: totalDownloads28d,
      total_revenue_28d: totalRevenue28d,
      daily_avg_downloads: dailyDownloads,
      daily_avg_revenue: dailyRevenue,
      active_users: activeUsers,
      mrr: mrr,
      active_subscriptions: activeSubscriptions,
      active_trials: activeTrials,
      project: projectId,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id } = body;

    console.log(`[sync-all] Starting sync for user: ${user_id || 'all users'}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get connected apps - use service role to access credentials
    let query = supabase.from("connected_apps").select("*").eq("is_active", true);
    if (user_id) query = query.eq("user_id", user_id);

    const { data: apps, error } = await query;

    if (error) {
      console.error(`[sync-all] Database error: ${error.message}`);
      throw error;
    }

    console.log(`[sync-all] Found ${apps?.length || 0} connected apps`);

    if (!apps || apps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "No connected apps found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    for (const app of apps) {
      console.log(`[sync-all] Processing app: ${app.id}, provider: ${app.provider}`);
      console.log(`[sync-all] Credentials keys: ${Object.keys(app.credentials || {}).join(', ')}`);

      if (app.provider === "revenuecat") {
        const result = await syncRevenueCat(supabase, app);
        results.push({ provider: "revenuecat", app_id: app.id, ...result });
      }
    }

    const synced = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[sync-all] Complete - synced: ${synced}, failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, synced, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(`[sync-all] Error: ${e.message}`);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
