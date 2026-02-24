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
  const metrics = overviewData.metrics || [];

  // Parse RevenueCat metrics
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

  console.log(`[RC] Data: downloads=${newCustomers}, revenue=$${revenue}, active=${activeUsers}, mrr=$${mrr}`);

  // Delete ALL old data for this app
  await supabase.from("realtime_metrics").delete().eq("app_id", app.id);
  await supabase.from("analytics_snapshots").delete().eq("app_id", app.id);

  // Store EXACT 28-day totals (these are what RevenueCat shows)
  const metricsToInsert = [
    { app_id: app.id, provider: "revenuecat", metric_type: "downloads_28d", metric_value: newCustomers, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "revenue_28d", metric_value: revenue, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "active_users", metric_value: activeUsers, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "mrr", metric_value: mrr, metric_date: today },
    { app_id: app.id, provider: "revenuecat", metric_type: "active_subscriptions", metric_value: activeSubs, metric_date: today },
  ];

  // Store daily data for chart (using EXACT division - no rounding)
  const dailyDownloads = newCustomers / 28;
  const dailyRevenue = revenue / 28;

  for (let i = 0; i < 28; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    metricsToInsert.push({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: "downloads",
      metric_value: dailyDownloads, // EXACT decimal, no rounding
      metric_date: dateStr,
    });

    metricsToInsert.push({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: "revenue",
      metric_value: dailyRevenue,
      metric_date: dateStr,
    });
  }

  // Insert all metrics
  const { error: insertError } = await supabase.from("realtime_metrics").insert(metricsToInsert);
  if (insertError) {
    console.error(`[RC] Insert error: ${insertError.message}`);
  }

  // Update sync time
  await supabase.from("connected_apps").update({ last_sync_at: new Date().toISOString() }).eq("id", app.id);

  return {
    success: true,
    data: { downloads_28d: newCustomers, revenue_28d: revenue, activeUsers, mrr, activeSubs },
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
