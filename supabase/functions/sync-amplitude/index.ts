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

    if (!app_id || !credentials?.api_key || !credentials?.secret_key) {
      throw new Error("Missing app_id or Amplitude credentials");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split("T")[0];
    const authHeader = btoa(`${credentials.api_key}:${credentials.secret_key}`);

    // Fetch active users from Amplitude Dashboard REST API
    const activeUsersUrl = `https://amplitude.com/api/2/users/day?start=${today}&end=${today}`;
    const activeUsersResponse = await fetch(activeUsersUrl, {
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
      },
    });

    // Fetch session data
    const sessionsUrl = `https://amplitude.com/api/2/sessions/average?start=${today}&end=${today}`;
    const sessionsResponse = await fetch(sessionsUrl, {
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
      },
    });

    // Fetch retention data
    const retentionUrl = `https://amplitude.com/api/2/retention?start=${today}&end=${today}`;
    const retentionResponse = await fetch(retentionUrl, {
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
      },
    });

    let metrics: { metric_type: string; metric_value: number }[] = [];

    if (activeUsersResponse.ok) {
      const data = await activeUsersResponse.json();
      const todayUsers = data.data?.xValues?.[0] || 0;
      metrics.push({ metric_type: "daily_active_users", metric_value: todayUsers });
    }

    if (sessionsResponse.ok) {
      const data = await sessionsResponse.json();
      const avgSession = data.data?.seriesCollapsed?.[0]?.[0] || 0;
      metrics.push({ metric_type: "avg_session_length", metric_value: avgSession });
    }

    if (retentionResponse.ok) {
      const data = await retentionResponse.json();
      const day1Retention = data.data?.[0]?.retentionPercents?.[1] || 0;
      metrics.push({ metric_type: "day1_retention", metric_value: day1Retention });
    }

    // Store metrics
    for (const metric of metrics) {
      await supabase.from("realtime_metrics").upsert({
        app_id,
        provider: "amplitude",
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
