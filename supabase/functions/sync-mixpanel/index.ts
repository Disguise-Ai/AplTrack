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

    if (!app_id || !credentials?.api_secret || !credentials?.project_id) {
      throw new Error("Missing app_id or Mixpanel credentials");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    // Fetch insights from Mixpanel Query API
    // Using JQL to get user and event counts
    const authHeader = btoa(`${credentials.api_secret}:`);

    // Get active users
    const usersUrl = `https://mixpanel.com/api/2.0/engage?project_id=${credentials.project_id}`;
    const usersResponse = await fetch(usersUrl, {
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
      },
    });

    // Get event counts
    const eventsUrl = `https://mixpanel.com/api/2.0/events?project_id=${credentials.project_id}&type=general&unit=day&from_date=${thirtyDaysAgo}&to_date=${today}`;
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
      },
    });

    let metrics: { metric_type: string; metric_value: number }[] = [];

    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      metrics.push({ metric_type: "total_users", metric_value: usersData.total || 0 });
    }

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      // Sum up today's events
      let totalEvents = 0;
      const todayKey = today.replace(/-/g, "-");

      if (eventsData.data && eventsData.data.values) {
        for (const eventName in eventsData.data.values) {
          const eventData = eventsData.data.values[eventName];
          if (eventData[todayKey]) {
            totalEvents += eventData[todayKey];
          }
        }
      }

      metrics.push({ metric_type: "events_today", metric_value: totalEvents });
    }

    // Store metrics
    for (const metric of metrics) {
      await supabase.from("realtime_metrics").upsert({
        app_id,
        provider: "mixpanel",
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
