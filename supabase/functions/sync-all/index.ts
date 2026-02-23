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

  let debug: any = {};
  let totalCustomers: number = 0;
  let totalRevenue: number = 0;
  let activeSubscribers: number = 0;
  let totalSubscriptions: number = 0;
  let samplePurchase: any = null;

  // STEP 1: Get projects
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
    if (!projectId) projectId = projects[0].id;
    debug.project = projectId;
  } catch (e: any) {
    return { success: false, error: `Projects error: ${e.message}` };
  }

  // STEP 2: Get ALL customers (paginate through all pages)
  let customerIds: string[] = [];
  let nextPage: string | null = null;
  let pageCount = 0;

  try {
    do {
      const url = nextPage
        ? `https://api.revenuecat.com/v2/projects/${projectId}/customers?limit=100&starting_after=${nextPage}`
        : `https://api.revenuecat.com/v2/projects/${projectId}/customers?limit=100`;

      const resp = await fetch(url, { headers: { "Authorization": `Bearer ${apiKey}` } });

      if (resp.ok) {
        const data = await resp.json();
        const customers = data.items || [];
        customerIds.push(...customers.map((c: any) => c.id));
        pageCount++;

        // Check if there's a next page
        nextPage = data.next_page ? customers[customers.length - 1]?.id : null;

        // Safety limit - max 10 pages (1000 customers)
        if (pageCount >= 10) break;
      } else {
        break;
      }
    } while (nextPage);

    totalCustomers = customerIds.length;
  } catch (e: any) {
    debug.customerError = e.message;
  }

  debug.customers = totalCustomers;
  debug.pages = pageCount;

  // STEP 3: For each customer, get their subscriptions and purchases using V2 API
  let v2Success = 0;
  let v2Errors = 0;

  for (const customerId of customerIds.slice(0, 30)) {
    // Get subscriptions for this customer (V2 API)
    try {
      const subResp = await fetch(
        `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(customerId)}/subscriptions`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );

      if (subResp.ok) {
        v2Success++;
        const subData = await subResp.json();
        const subscriptions = subData.items || [];

        for (const sub of subscriptions) {
          totalSubscriptions++;

          // Check if active using multiple fields
          const isActive = sub.gives_access === true ||
                          sub.status === "active" ||
                          (sub.current_period_ends_at && new Date(sub.current_period_ends_at) > new Date()) ||
                          (sub.ends_at && new Date(sub.ends_at) > new Date());

          if (isActive) {
            activeSubscribers++;
          }

          // Get revenue from subscription - check all possible price fields
          let price: number = 0;
          if (typeof sub.price_in_usd === 'number') price = sub.price_in_usd;
          else if (typeof sub.price === 'number') price = sub.price;
          else if (typeof sub.total_revenue_in_usd === 'number') price = sub.total_revenue_in_usd;
          else if (typeof sub.revenue === 'number') price = sub.revenue;
          else if (typeof sub.price_in_purchased_currency === 'number') price = sub.price_in_purchased_currency;
          else {
            // Estimate from product ID
            const pid = (sub.product_id || sub.product_identifier || sub.id || "").toLowerCase();
            if (pid.includes("weekly") || pid.includes("week")) price = 2.99;
            else if (pid.includes("monthly") || pid.includes("month")) price = 9.99;
            else if (pid.includes("yearly") || pid.includes("year") || pid.includes("annual")) price = 49.99;
            else if (pid.includes("lifetime")) price = 99.99;
            else price = 4.99;
          }

          totalRevenue = totalRevenue + price;

          // Save sample
          if (!samplePurchase) {
            samplePurchase = {
              type: "subscription",
              product: sub.product_id || sub.product_identifier || sub.id,
              status: sub.status,
              gives_access: sub.gives_access,
              fields: Object.keys(sub).slice(0, 10),
            };
          }
        }
      } else {
        v2Errors++;
        if (!debug.subError) {
          const errText = await subResp.text();
          debug.subError = `${subResp.status}: ${errText.substring(0, 80)}`;
        }
      }
    } catch (e: any) {
      v2Errors++;
    }

    // Also try to get purchases (non-subscription)
    try {
      const purchResp = await fetch(
        `https://api.revenuecat.com/v2/projects/${projectId}/customers/${encodeURIComponent(customerId)}/purchases`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );

      if (purchResp.ok) {
        const purchData = await purchResp.json();
        const purchases = purchData.items || [];

        for (const purch of purchases) {
          totalSubscriptions++;

          let price: number = 0;
          if (typeof purch.price_in_usd === 'number') price = purch.price_in_usd;
          else if (typeof purch.price === 'number') price = purch.price;
          else if (typeof purch.revenue_in_usd === 'number') price = purch.revenue_in_usd;
          else price = 0.99;

          totalRevenue = totalRevenue + price;

          if (!samplePurchase) {
            samplePurchase = {
              type: "purchase",
              product: purch.product_id || purch.product_identifier,
              fields: Object.keys(purch).slice(0, 10),
            };
          }
        }
      }
    } catch (e: any) {
      // Continue
    }
  }

  debug.v2Results = { success: v2Success, errors: v2Errors };
  debug.subscriptions = totalSubscriptions;
  debug.sample = samplePurchase;

  // If we still have no revenue data, try getting it from the overview endpoint
  if (totalRevenue === 0) {
    try {
      // Try metrics overview
      const overviewResp = await fetch(
        `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
        { headers: { "Authorization": `Bearer ${apiKey}` } }
      );

      if (overviewResp.ok) {
        const overview = await overviewResp.json();
        debug.overview = Object.keys(overview);

        if (typeof overview.revenue === 'number') totalRevenue = overview.revenue;
        else if (typeof overview.mrr === 'number') totalRevenue = overview.mrr;
        if (typeof overview.active_subscribers === 'number') activeSubscribers = overview.active_subscribers;
      } else {
        debug.overviewStatus = overviewResp.status;
      }
    } catch (e: any) {
      debug.overviewError = e.message;
    }
  }

  // Downloads = total customers (new + active from RevenueCat)
  const downloadCount = totalCustomers;
  // Active count = active subscribers found, or total subscriptions, or total customers
  const activeCount = activeSubscribers > 0 ? activeSubscribers :
                      (totalSubscriptions > 0 ? totalSubscriptions : totalCustomers);

  // Final metrics
  const metrics = {
    new_customers: downloadCount,
    downloads: downloadCount,
    installs: downloadCount,
    revenue: totalRevenue,
    mrr: totalRevenue,
    active_subscribers: activeCount,
    active_users: activeCount,
    daily_active_users: activeCount,
  };

  // Store all metric types for dashboard compatibility
  const metricTypes = [
    { type: "new_customers", value: downloadCount },
    { type: "downloads", value: downloadCount },
    { type: "installs", value: downloadCount },
    { type: "revenue", value: totalRevenue },
    { type: "mrr", value: totalRevenue },
    { type: "active_subscribers", value: activeCount },
    { type: "active_users", value: activeCount },
    { type: "daily_active_users", value: activeCount },
  ];

  for (const m of metricTypes) {
    await supabase.from("realtime_metrics").upsert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: m.type,
      metric_value: m.value,
      metric_date: today,
    }, { onConflict: "app_id,provider,metric_type,metric_date" });
  }

  // Store snapshot for today
  await supabase.from("analytics_snapshots").upsert({
    app_id: app.id,
    date: today,
    downloads: downloadCount,
    revenue: totalRevenue,
    active_users: activeCount,
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
      customers: totalCustomers,
      revenue: (typeof totalRevenue === 'number' ? totalRevenue : 0).toFixed(2),
      activeSubscribers,
      subscriptions: totalSubscriptions,
      debug,
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
