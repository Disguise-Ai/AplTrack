import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { app_id, credentials } = await req.json();

    if (!app_id || !credentials?.api_token || !credentials?.app_token) {
      throw new Error("Missing app_id or Adjust credentials");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Fetch KPIs from Adjust Datascape API
    const kpiUrl = `https://dash.adjust.com/control-center/reports-service/report?app_token__in=${credentials.app_token}&date_period=${startDate}:${today}&dimensions=day&metrics=installs,clicks,impressions,sessions,revenue,cost`;

    const response = await fetch(kpiUrl, {
      headers: {
        "Authorization": `Bearer ${credentials.api_token}`,
        "Accept": "application/json",
      },
    });

    let metrics: { metric_type: string; metric_value: number }[] = [];

    if (response.ok) {
      const data = await response.json();
      const rows = data.rows || [];

      // Aggregate today's data
      const todayData = rows.find((r: any) => r.day === today) || rows[0] || {};

      metrics = [
        { metric_type: "installs", metric_value: todayData.installs || 0 },
        { metric_type: "clicks", metric_value: todayData.clicks || 0 },
        { metric_type: "impressions", metric_value: todayData.impressions || 0 },
        { metric_type: "sessions", metric_value: todayData.sessions || 0 },
        { metric_type: "revenue", metric_value: todayData.revenue || 0 },
        { metric_type: "cost", metric_value: todayData.cost || 0 },
      ];
    }

    // Store metrics
    for (const metric of metrics) {
      await supabase.from("realtime_metrics").upsert({
        app_id,
        provider: "adjust",
        metric_type: metric.metric_type,
        metric_value: metric.metric_value,
        metric_date: today,
      }, { onConflict: "app_id,provider,metric_type,metric_date" });
    }

    // Update last sync time
    await supabase
      .from("connected_apps")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", app_id);

    return new Response(
      JSON.stringify({ success: true, metrics_synced: metrics.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
