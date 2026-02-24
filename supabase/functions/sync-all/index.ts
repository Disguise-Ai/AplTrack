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

  if (!apiKey) {
    return { success: false, error: "No API key" };
  }

  // STEP 1: Get projects if no projectId
  if (!projectId) {
    try {
      const resp = await fetch("https://api.revenuecat.com/v2/projects", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return { success: false, error: `Projects: ${resp.status} - ${errText.substring(0, 100)}` };
      }

      const data = await resp.json();
      const projects = data.items || [];
      if (projects.length === 0) {
        return { success: false, error: "No projects found" };
      }
      projectId = projects[0].id;
    } catch (e: any) {
      return { success: false, error: `Projects error: ${e.message}` };
    }
  }

  // STEP 2: Get metrics from overview endpoint (this gives accurate 28-day data)
  let newCustomers = 0;
  let activeUsers = 0;
  let revenue = 0;
  let mrr = 0;
  let activeSubscriptions = 0;
  let activeTrials = 0;

  console.log(`[RevenueCat] Fetching metrics for project: ${projectId}`);

  try {
    const overviewResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    console.log(`[RevenueCat] Overview response status: ${overviewResp.status}`);

    if (overviewResp.ok) {
      const overviewData = await overviewResp.json();
      console.log(`[RevenueCat] Overview data:`, JSON.stringify(overviewData).substring(0, 500));

      const metrics = overviewData.metrics || [];

      for (const metric of metrics) {
        console.log(`[RevenueCat] Metric: ${metric.id} = ${metric.value}`);
        switch (metric.id) {
          case "new_customers":
            newCustomers = metric.value || 0;
            break;
          case "active_users":
            activeUsers = metric.value || 0;
            break;
          case "revenue":
            revenue = metric.value || 0;
            break;
          case "mrr":
            mrr = metric.value || 0;
            break;
          case "active_subscriptions":
            activeSubscriptions = metric.value || 0;
            break;
          case "active_trials":
            activeTrials = metric.value || 0;
            break;
        }
      }

      console.log(`[RevenueCat] Final counts - Downloads: ${newCustomers}, Revenue: ${revenue}, Active: ${activeUsers}`);
    } else {
      const errText = await overviewResp.text();
      console.error("[RevenueCat] Overview API error:", overviewResp.status, errText);
    }
  } catch (e: any) {
    console.error("[RevenueCat] Overview fetch error:", e.message);
  }

  // Downloads = new customers (this is the cumulative 28-day total)
  const downloads = newCustomers;

  // Skip this app if it returned no meaningful data (likely wrong project or credentials)
  if (downloads === 0 && activeUsers === 0 && revenue === 0) {
    console.log(`[RevenueCat] Skipping app ${app.id} - no data returned (likely incorrect credentials or project)`);
    return {
      success: false,
      error: "No data returned - check project ID",
      data: { downloads: 0, project: projectId },
    };
  }

  // Calculate "downloads today" by comparing to yesterday's cumulative total
  let downloadsToday = 0;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  try {
    // Get yesterday's cumulative downloads
    const { data: yesterdayMetric } = await supabase
      .from("realtime_metrics")
      .select("metric_value")
      .eq("app_id", app.id)
      .eq("metric_type", "downloads_cumulative")
      .eq("metric_date", yesterdayStr)
      .single();

    if (yesterdayMetric) {
      downloadsToday = Math.max(0, downloads - yesterdayMetric.metric_value);
      console.log(`[RevenueCat] Downloads today: ${downloads} - ${yesterdayMetric.metric_value} = ${downloadsToday}`);
    } else {
      // No yesterday data, check if we have any previous cumulative data
      const { data: lastMetric } = await supabase
        .from("realtime_metrics")
        .select("metric_value, metric_date")
        .eq("app_id", app.id)
        .eq("metric_type", "downloads_cumulative")
        .order("metric_date", { ascending: false })
        .limit(1)
        .single();

      if (lastMetric) {
        downloadsToday = Math.max(0, downloads - lastMetric.metric_value);
        console.log(`[RevenueCat] Downloads since ${lastMetric.metric_date}: ${downloadsToday}`);
      } else {
        // First time syncing, can't calculate daily change
        console.log(`[RevenueCat] First sync, no previous data to compare`);
        downloadsToday = 0;
      }
    }
  } catch (e: any) {
    console.log(`[RevenueCat] Error calculating daily downloads: ${e.message}`);
  }

  // Final metrics to store
  const metricsToStore = [
    { type: "downloads_daily", value: downloadsToday }, // Daily downloads (NEW today)
    { type: "downloads_cumulative", value: downloads }, // Cumulative 28-day total
    { type: "active_users", value: activeUsers },
    { type: "revenue", value: revenue },
    { type: "mrr", value: mrr },
    { type: "active_subscribers", value: activeSubscriptions },
    { type: "active_trials", value: activeTrials },
  ];

  // Store in realtime_metrics
  console.log(`[RevenueCat] Storing ${metricsToStore.length} metrics for app ${app.id} - downloads: ${downloads}`);
  for (const m of metricsToStore) {
    const { error: metricsError } = await supabase.from("realtime_metrics").upsert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: m.type,
      metric_value: m.value,
      metric_date: today,
    }, { onConflict: "app_id,provider,metric_type,metric_date" });

    if (metricsError) {
      console.error(`[RevenueCat] Error storing metric ${m.type}:`, metricsError.message);
    }
  }

  // Store snapshot for dashboard (use daily downloads, not cumulative)
  console.log(`[RevenueCat] Storing snapshot: downloads_today=${downloadsToday}, cumulative=${downloads}, revenue=${revenue}, active=${activeUsers}`);
  const { error: snapshotError } = await supabase.from("analytics_snapshots").upsert({
    app_id: app.id,
    date: today,
    downloads: downloadsToday, // Daily downloads, not cumulative
    revenue: revenue,
    active_users: activeUsers,
    ratings_count: 0,
    average_rating: 0,
  }, { onConflict: "app_id,date" });

  if (snapshotError) {
    console.error(`[RevenueCat] Error storing snapshot:`, snapshotError.message);
  }

  // Update sync time
  await supabase
    .from("connected_apps")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", app.id);

  return {
    success: true,
    data: {
      downloads_today: downloadsToday,
      downloads_cumulative: downloads,
      activeUsers,
      revenue,
      mrr,
      activeSubscriptions,
      activeTrials,
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
    const { user_id, cleanup } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabase.from("connected_apps").select("*").eq("is_active", true);
    if (user_id) query = query.eq("user_id", user_id);

    const { data: apps, error } = await query;
    if (error) throw error;

    if (!apps || apps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "No apps", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    for (const app of apps) {
      if (app.provider === "revenuecat") {
        const result = await syncRevenueCat(supabase, app);
        results.push({ provider: "revenuecat", ...result });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
