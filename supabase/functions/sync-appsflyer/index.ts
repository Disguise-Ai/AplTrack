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

    if (!app_id || !credentials?.api_token || !credentials?.app_id) {
      throw new Error("Missing app_id or AppsFlyer credentials");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Fetch aggregated data from AppsFlyer Pull API
    const reportUrl = `https://hq1.appsflyer.com/api/agg-data/export/app/${credentials.app_id}/partners_report/v5?from=${yesterday}&to=${today}&timezone=UTC`;

    const response = await fetch(reportUrl, {
      headers: {
        "Authorization": `Bearer ${credentials.api_token}`,
        "Accept": "application/json",
      },
    });

    let metrics: { metric_type: string; metric_value: number }[] = [];

    if (response.ok) {
      const data = await response.json();
      metrics = [
        { metric_type: "installs", metric_value: data.installs || 0 },
        { metric_type: "clicks", metric_value: data.clicks || 0 },
        { metric_type: "impressions", metric_value: data.impressions || 0 },
        { metric_type: "cost", metric_value: data.cost || 0 },
        { metric_type: "revenue", metric_value: data.revenue || 0 },
      ];
    }

    // Store metrics
    for (const metric of metrics) {
      await supabase.from("realtime_metrics").upsert({
        app_id,
        provider: "appsflyer",
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
