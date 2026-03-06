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

    // Use EST timezone for consistent date handling
    const getESTDate = (daysAgo = 0) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    };

    const today = getESTDate(0);
    const yesterday = getESTDate(1);
    const weekAgo = getESTDate(7);

    console.log("[RevenueCat] Syncing for dates - today:", today, "yesterday:", yesterday);

    let metrics = {
      mrr: 0,
      revenue: 0,
      revenue_today: 0,
      active_subscriptions: 0,
      active_trials: 0,
      new_customers: 0,
      new_customers_today: 0,
      downloads_today: 0,
      churn_rate: 0,
      active_users: 0,
    };
    let apiSuccess = false;
    let apiError = "";
    let rawResponse: any = null;

    // Determine key type
    const isSecretKey = apiKey.startsWith("sk_");

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
            console.log("[RevenueCat] Projects response:", JSON.stringify(projectsData));
            if (projectsData.items && projectsData.items.length > 0) {
              targetProjectId = projectsData.items[0].id;
              console.log("[RevenueCat] Using project:", targetProjectId);
            }
          } else {
            const errorText = await projectsResponse.text();
            console.log("[RevenueCat] Projects error:", errorText);
          }
        }

        if (targetProjectId) {
          // Get overview metrics - this is the Charts API endpoint
          const overviewResponse = await fetch(
            `https://api.revenuecat.com/v2/projects/${targetProjectId}/metrics/overview`,
            {
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log("[RevenueCat] Overview response status:", overviewResponse.status);

          if (overviewResponse.ok) {
            const data = await overviewResponse.json();
            rawResponse = data;
            console.log("[RevenueCat] Overview data:", JSON.stringify(data));

            // Parse the overview metrics - the API returns an ARRAY of metric objects
            // Each metric has: { id, name, value, description, period, unit, ... }
            const metricsArray = data.metrics || data;
            console.log("[RevenueCat] Metrics array type:", Array.isArray(metricsArray) ? "array" : typeof metricsArray);

            if (Array.isArray(metricsArray)) {
              // Handle array format: [{id: "mrr", value: 7}, {id: "new_customers", value: 1017}, ...]
              for (const m of metricsArray) {
                const id = m.id || m.name?.toLowerCase().replace(/\s+/g, '_');
                const value = parseFloat(m.value || 0);
                console.log(`[RevenueCat] Metric: ${id} = ${value}`);

                switch (id) {
                  case 'mrr':
                  case 'monthly_recurring_revenue':
                    metrics.mrr = value;
                    break;
                  case 'revenue':
                  case 'revenue_last_28_days':
                    metrics.revenue = value;
                    break;
                  case 'active_subscriptions':
                  case 'active_subscribers':
                    metrics.active_subscriptions = Math.round(value);
                    break;
                  case 'active_trials':
                    metrics.active_trials = Math.round(value);
                    break;
                  case 'new_customers':
                  case 'new_customers_last_28_days':
                    metrics.new_customers = Math.round(value);
                    break;
                  case 'active_customers':
                  case 'active_users':
                    metrics.active_users = Math.round(value);
                    break;
                  case 'churn':
                  case 'churn_rate':
                    metrics.churn_rate = value > 1 ? value : value * 100;
                    break;
                }
              }
            } else {
              // Fallback: Handle object format (legacy or different response)
              metrics.mrr = parseFloat(metricsArray.mrr?.value || metricsArray.mrr || 0);
              metrics.revenue = parseFloat(metricsArray.revenue?.value || metricsArray.revenue || 0);
              metrics.active_subscriptions = parseInt(metricsArray.active_subscriptions?.value || metricsArray.active_subscriptions || metricsArray.active_subscribers?.value || metricsArray.active_subscribers || 0);
              metrics.active_trials = parseInt(metricsArray.active_trials?.value || metricsArray.active_trials || 0);
              metrics.new_customers = parseInt(metricsArray.new_customers?.value || metricsArray.new_customers || 0);
              metrics.active_users = parseInt(metricsArray.active_customers?.value || metricsArray.active_customers || metricsArray.active_users?.value || metricsArray.active_users || 0);
              const churn = parseFloat(metricsArray.churn_rate?.value || metricsArray.churn || 0);
              metrics.churn_rate = churn > 1 ? churn : churn * 100;
            }

            console.log("[RevenueCat] Parsed metrics:", JSON.stringify(metrics));
            apiSuccess = true;
          } else {
            const errorText = await overviewResponse.text();
            apiError = `V2 Overview API: ${overviewResponse.status} - ${errorText}`;
            console.log("[RevenueCat] Overview error:", apiError);
          }

          // Use Charts API for daily breakdown data (last 7 days)
          try {
            // Get revenue chart with realtime data
            const revenueResponse = await fetch(
              `https://api.revenuecat.com/v2/projects/${targetProjectId}/charts/revenue?start_date=${weekAgo}&end_date=${today}&resolution=day&realtime=true`,
              {
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (revenueResponse.ok) {
              const revenueData = await revenueResponse.json();
              console.log("[RevenueCat] Charts revenue data:", JSON.stringify(revenueData));

              // Parse daily revenue values
              const values = revenueData.values || revenueData.data || [];
              for (const v of values) {
                const date = v.date || v.timestamp?.split('T')[0];
                const value = parseFloat(v.value || v.revenue || 0);
                if (date === today) {
                  metrics.revenue_today = value;
                }
                // Store daily breakdown in database
                if (date && value > 0) {
                  await supabase.from("realtime_metrics").upsert({
                    app_id,
                    provider: "revenuecat",
                    metric_type: "revenue_today",
                    metric_value: value,
                    metric_date: date,
                    metadata: { source: "charts_api" },
                  }, { onConflict: "app_id,provider,metric_type,metric_date" });
                }
              }
            } else {
              console.log("[RevenueCat] Charts revenue error:", await revenueResponse.text());
            }
          } catch (e) {
            console.log("[RevenueCat] Charts revenue fetch error:", e);
          }

          // Get new customers chart with realtime data
          try {
            const customersResponse = await fetch(
              `https://api.revenuecat.com/v2/projects/${targetProjectId}/charts/customers_new?start_date=${weekAgo}&end_date=${today}&resolution=day&realtime=true`,
              {
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (customersResponse.ok) {
              const customersData = await customersResponse.json();
              console.log("[RevenueCat] Charts customers data:", JSON.stringify(customersData));

              // Parse daily customer values
              const values = customersData.values || customersData.data || [];
              for (const v of values) {
                const date = v.date || v.timestamp?.split('T')[0];
                const value = parseInt(v.value || v.count || v.customers || 0);
                if (date === today) {
                  metrics.new_customers_today = value;
                  metrics.downloads_today = value;
                }
                // Store daily breakdown in database
                if (date && value > 0) {
                  await supabase.from("realtime_metrics").upsert({
                    app_id,
                    provider: "revenuecat",
                    metric_type: "downloads_today",
                    metric_value: value,
                    metric_date: date,
                    metadata: { source: "charts_api" },
                  }, { onConflict: "app_id,provider,metric_type,metric_date" });
                }
              }
            } else {
              console.log("[RevenueCat] Charts customers error:", await customersResponse.text());
            }
          } catch (e) {
            console.log("[RevenueCat] Charts customers fetch error:", e);
          }

          // Get active subscriptions chart
          try {
            const subsResponse = await fetch(
              `https://api.revenuecat.com/v2/projects/${targetProjectId}/charts/active_subscriptions?start_date=${today}&end_date=${today}&realtime=true`,
              {
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (subsResponse.ok) {
              const subsData = await subsResponse.json();
              console.log("[RevenueCat] Charts subscriptions data:", JSON.stringify(subsData));

              const values = subsData.values || subsData.data || [];
              if (values.length > 0) {
                const latest = values[values.length - 1];
                const activeSubs = parseInt(latest.value || latest.count || 0);
                if (activeSubs > 0) {
                  metrics.active_subscriptions = activeSubs;
                }
              }
            }
          } catch (e) {
            console.log("[RevenueCat] Charts subscriptions fetch error:", e);
          }
        }

        // If V2 overview didn't work, try getting subscriber list
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
            let trialCount = 0;
            let totalRevenue = 0;

            for (const sub of subscribers) {
              if (sub.subscriber) {
                const subs = Object.values(sub.subscriber.subscriptions || {}) as any[];
                for (const s of subs) {
                  if (s.expires_date && new Date(s.expires_date) > new Date()) {
                    if (s.period_type === "trial") {
                      trialCount++;
                    } else {
                      activeCount++;
                    }
                  }
                }
              }
            }

            metrics.active_subscriptions = activeCount;
            metrics.active_trials = trialCount;
            apiSuccess = true;
          }
        }
      } catch (e: any) {
        apiError = `V2 API error: ${e.message}`;
        console.log("[RevenueCat] V2 error:", e);
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

        if (testResponse.ok || testResponse.status === 404) {
          // 404 is fine - means API key works but no subscriber found
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

    console.log("[RevenueCat] FINAL metrics to store:", JSON.stringify(metrics));

    // Store metrics in realtime_metrics table
    const metricTypes = [
      { type: "mrr", value: metrics.mrr },
      { type: "revenue", value: metrics.revenue },
      { type: "revenue_30d", value: metrics.revenue },
      { type: "revenue_today", value: metrics.revenue_today },
      { type: "active_subscriptions", value: metrics.active_subscriptions },
      { type: "active_trials", value: metrics.active_trials },
      { type: "new_customers", value: metrics.new_customers },
      { type: "new_customers_30d", value: metrics.new_customers },
      { type: "downloads_today", value: metrics.downloads_today || metrics.new_customers_today },
      { type: "active_users", value: metrics.active_users || metrics.active_subscriptions },
      { type: "churn_rate", value: metrics.churn_rate },
    ];

    for (const m of metricTypes) {
      if (m.value > 0 || m.type === "churn_rate") {
        const { error: upsertError } = await supabase.from("realtime_metrics").upsert({
          app_id,
          provider: "revenuecat",
          metric_type: m.type,
          metric_value: m.value,
          metric_date: today,
          metadata: { api_success: apiSuccess, source: "charts_api" },
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        if (upsertError) {
          console.error("[RevenueCat] Upsert error:", upsertError);
        }
      }
    }

    // Store in analytics_snapshots for dashboard
    const { error: snapshotError } = await supabase.from("analytics_snapshots").upsert({
      app_id,
      date: today,
      downloads: metrics.new_customers || metrics.downloads_today,
      revenue: metrics.revenue || metrics.mrr,
      active_users: metrics.active_subscriptions || metrics.active_users,
      ratings_count: 0,
      average_rating: 0,
    }, { onConflict: "app_id,date" });

    if (snapshotError) {
      console.error("[RevenueCat] Snapshot error:", snapshotError);
    }

    // Update last sync time
    await supabase
      .from("connected_apps")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", app_id);

    console.log("[RevenueCat] Sync complete. Metrics:", JSON.stringify(metrics));

    return new Response(
      JSON.stringify({
        success: apiSuccess,
        metrics,
        key_type: isSecretKey ? "secret" : "public",
        api_error: apiError || undefined,
        raw_metrics: rawResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[RevenueCat] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
