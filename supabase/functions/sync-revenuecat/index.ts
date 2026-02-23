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

    if (!app_id || !credentials?.api_key) {
      throw new Error("Missing app_id or API key");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKey = credentials.api_key;
    const projectId = credentials.project_id || credentials.app_id;
    const today = new Date().toISOString().split("T")[0];

    let metrics = {
      mrr: 0,
      revenue: 0,
      active_subscribers: 0,
      active_trials: 0,
      new_customers: 0,
      churn_rate: 0,
    };
    let apiSuccess = false;
    let apiError = "";
    let rawResponse: any = null;

    // Determine key type
    const isSecretKey = apiKey.startsWith("sk_");
    const isPublicKey = apiKey.startsWith("appl_");

    if (isSecretKey) {
      // Try RevenueCat V2 API for overview metrics
      try {
        // First, get the list of projects if no projectId provided
        let targetProjectId = projectId;

        if (!targetProjectId) {
          const projectsResponse = await fetch(
            "https://api.revenuecat.com/v2/projects",
            {
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json();
            if (projectsData.items && projectsData.items.length > 0) {
              targetProjectId = projectsData.items[0].id;
            }
          }
        }

        if (targetProjectId) {
          // Get overview metrics
          const overviewResponse = await fetch(
            `https://api.revenuecat.com/v2/projects/${targetProjectId}/metrics/overview`,
            {
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (overviewResponse.ok) {
            const data = await overviewResponse.json();
            rawResponse = data;

            metrics.mrr = data.mrr || data.metrics?.mrr || 0;
            metrics.revenue = data.revenue || data.metrics?.revenue || 0;
            metrics.active_subscribers = data.active_subscribers || data.metrics?.active_subscribers || 0;
            metrics.active_trials = data.active_trials || data.metrics?.active_trials || 0;
            metrics.new_customers = data.new_customers || data.metrics?.new_customers || 0;
            apiSuccess = true;
          } else {
            const errorText = await overviewResponse.text();
            apiError = `V2 Overview API: ${overviewResponse.status} - ${errorText}`;
          }
        }

        // If V2 overview didn't work, try getting subscriber stats
        if (!apiSuccess && targetProjectId) {
          const subscribersResponse = await fetch(
            `https://api.revenuecat.com/v2/projects/${targetProjectId}/subscribers?limit=100`,
            {
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (subscribersResponse.ok) {
            const data = await subscribersResponse.json();
            rawResponse = data;

            // Count active subscribers
            const subscribers = data.items || [];
            let activeCount = 0;
            let totalRevenue = 0;

            for (const sub of subscribers) {
              if (sub.subscriber) {
                const subs = Object.values(sub.subscriber.subscriptions || {}) as any[];
                for (const s of subs) {
                  if (s.expires_date && new Date(s.expires_date) > new Date()) {
                    activeCount++;
                  }
                }
              }
            }

            metrics.active_subscribers = activeCount;
            apiSuccess = true;
          }
        }
      } catch (e: any) {
        apiError = `V2 API error: ${e.message}`;
      }
    }

    // For public keys or as fallback, try V1 API
    if (!apiSuccess) {
      try {
        // Test connection with V1 API
        const testResponse = await fetch(
          `https://api.revenuecat.com/v1/subscribers/$RCAnonymousID:apltrack_test`,
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "X-Platform": "ios",
            },
          }
        );

        if (testResponse.ok) {
          apiSuccess = true;
          rawResponse = { connection: "verified", key_type: isSecretKey ? "secret" : "public" };
        } else {
          const errorText = await testResponse.text();
          apiError += ` V1 API: ${testResponse.status} - ${errorText}`;
        }
      } catch (e: any) {
        apiError += ` V1 error: ${e.message}`;
      }
    }

    // Store metrics in realtime_metrics table
    const metricTypes = [
      { type: "mrr", value: metrics.mrr },
      { type: "revenue", value: metrics.revenue },
      { type: "active_subscribers", value: metrics.active_subscribers },
      { type: "active_trials", value: metrics.active_trials },
      { type: "new_customers", value: metrics.new_customers },
      { type: "churn_rate", value: metrics.churn_rate },
    ];

    for (const m of metricTypes) {
      const { error: upsertError } = await supabase.from("realtime_metrics").upsert({
        app_id,
        provider: "revenuecat",
        metric_type: m.type,
        metric_value: m.value,
        metric_date: today,
        metadata: { api_success: apiSuccess },
      }, { onConflict: "app_id,provider,metric_type,metric_date" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }
    }

    // Store in analytics_snapshots for dashboard
    const { error: snapshotError } = await supabase.from("analytics_snapshots").upsert({
      app_id,
      date: today,
      downloads: metrics.new_customers,
      revenue: metrics.revenue || metrics.mrr,
      active_users: metrics.active_subscribers,
      ratings_count: 0,
      average_rating: 0,
    }, { onConflict: "app_id,date" });

    if (snapshotError) {
      console.error("Snapshot error:", snapshotError);
    }

    // Update last sync time
    await supabase
      .from("connected_apps")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", app_id);

    return new Response(
      JSON.stringify({
        success: apiSuccess,
        metrics,
        key_type: isSecretKey ? "secret" : isPublicKey ? "public" : "unknown",
        api_error: apiError || undefined,
        raw_sample: rawResponse ? JSON.stringify(rawResponse).substring(0, 500) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
