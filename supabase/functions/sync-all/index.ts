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

  try {
    const overviewResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    if (overviewResp.ok) {
      const overviewData = await overviewResp.json();
      const metrics = overviewData.metrics || [];

      for (const metric of metrics) {
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
    } else {
      const errText = await overviewResp.text();
      console.error("Overview API error:", overviewResp.status, errText);
    }
  } catch (e: any) {
    console.error("Overview fetch error:", e.message);
  }

  // Downloads = new customers (this is what the user wants)
  const downloads = newCustomers;

  // Final metrics to store
  const metricsToStore = [
    { type: "downloads", value: downloads },
    { type: "new_customers", value: newCustomers },
    { type: "active_users", value: activeUsers },
    { type: "revenue", value: revenue },
    { type: "mrr", value: mrr },
    { type: "active_subscribers", value: activeSubscriptions },
    { type: "active_trials", value: activeTrials },
  ];

  // Store in realtime_metrics
  for (const m of metricsToStore) {
    await supabase.from("realtime_metrics").upsert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: m.type,
      metric_value: m.value,
      metric_date: today,
    }, { onConflict: "app_id,provider,metric_type,metric_date" });
  }

  // Store snapshot for dashboard
  await supabase.from("analytics_snapshots").upsert({
    app_id: app.id,
    date: today,
    downloads: downloads,
    revenue: revenue,
    active_users: activeUsers,
    ratings_count: 0,
    average_rating: 0,
  }, { onConflict: "app_id,date" });

  // Update sync time
  await supabase
    .from("connected_apps")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", app.id);

  return {
    success: true,
    data: {
      downloads,
      newCustomers,
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
    const { user_id } = await req.json();

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
