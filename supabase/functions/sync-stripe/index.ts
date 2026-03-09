import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get date in EST timezone
function getESTDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Get timestamp for N days ago
function getDaysAgoTimestamp(days: number): number {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

async function syncStripe(supabase: any, app: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const credentials = app.credentials || {};
  const secretKey = (credentials.secret_key || "").trim();
  const today = getESTDate();

  if (!secretKey) {
    return { success: false, error: "No secret key" };
  }

  if (!secretKey.startsWith("sk_")) {
    return { success: false, error: "Invalid secret key format" };
  }

  const stripeHeaders = {
    "Authorization": `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    // Get current active subscriptions
    let activeSubscriptions = 0;
    let activeTrials = 0;
    let mrr = 0;
    let hasMore = true;
    let startingAfter = "";

    while (hasMore) {
      const subsUrl = new URL("https://api.stripe.com/v1/subscriptions");
      subsUrl.searchParams.set("status", "all");
      subsUrl.searchParams.set("limit", "100");
      if (startingAfter) subsUrl.searchParams.set("starting_after", startingAfter);

      const subsResp = await fetch(subsUrl.toString(), { headers: stripeHeaders });
      if (!subsResp.ok) {
        const error = await subsResp.json();
        return { success: false, error: error.error?.message || "Failed to fetch subscriptions" };
      }

      const subsData = await subsResp.json();

      for (const sub of subsData.data || []) {
        if (sub.status === "active") {
          activeSubscriptions++;
          // Calculate MRR from subscription items
          for (const item of sub.items?.data || []) {
            const price = item.price;
            if (price?.recurring) {
              let amount = (price.unit_amount || 0) / 100;
              const interval = price.recurring.interval;
              const intervalCount = price.recurring.interval_count || 1;

              // Normalize to monthly
              if (interval === "year") {
                amount = amount / (12 * intervalCount);
              } else if (interval === "week") {
                amount = amount * (52 / 12) / intervalCount;
              } else if (interval === "day") {
                amount = amount * (365 / 12) / intervalCount;
              } else {
                amount = amount / intervalCount;
              }

              mrr += amount * (item.quantity || 1);
            }
          }
        } else if (sub.status === "trialing") {
          activeTrials++;
        }
      }

      hasMore = subsData.has_more;
      if (hasMore && subsData.data.length > 0) {
        startingAfter = subsData.data[subsData.data.length - 1].id;
      }
    }

    // Get charges for last 30 days
    const thirtyDaysAgo = getDaysAgoTimestamp(30);
    const dailyRevenue: Record<string, number> = {};
    const dailySales: Record<string, number> = {};
    let totalRevenue30d = 0;
    let totalSales30d = 0;

    hasMore = true;
    startingAfter = "";

    while (hasMore) {
      const chargesUrl = new URL("https://api.stripe.com/v1/charges");
      chargesUrl.searchParams.set("created[gte]", thirtyDaysAgo.toString());
      chargesUrl.searchParams.set("limit", "100");
      if (startingAfter) chargesUrl.searchParams.set("starting_after", startingAfter);

      const chargesResp = await fetch(chargesUrl.toString(), { headers: stripeHeaders });
      if (!chargesResp.ok) break;

      const chargesData = await chargesResp.json();

      for (const charge of chargesData.data || []) {
        if (charge.status === "succeeded" && !charge.refunded) {
          const chargeDate = new Date(charge.created * 1000);
          const dateStr = getESTDate(chargeDate);
          const netAmount = (charge.amount - (charge.amount_refunded || 0)) / 100;

          dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + netAmount;
          dailySales[dateStr] = (dailySales[dateStr] || 0) + 1;
          totalRevenue30d += netAmount;
          totalSales30d++;
        }
      }

      hasMore = chargesData.has_more;
      if (hasMore && chargesData.data.length > 0) {
        startingAfter = chargesData.data[chargesData.data.length - 1].id;
      }
    }

    // Get customer count (new customers in last 30 days)
    let newCustomers30d = 0;
    hasMore = true;
    startingAfter = "";

    while (hasMore) {
      const customersUrl = new URL("https://api.stripe.com/v1/customers");
      customersUrl.searchParams.set("created[gte]", thirtyDaysAgo.toString());
      customersUrl.searchParams.set("limit", "100");
      if (startingAfter) customersUrl.searchParams.set("starting_after", startingAfter);

      const customersResp = await fetch(customersUrl.toString(), { headers: stripeHeaders });
      if (!customersResp.ok) break;

      const customersData = await customersResp.json();
      newCustomers30d += customersData.data?.length || 0;

      hasMore = customersData.has_more;
      if (hasMore && customersData.data.length > 0) {
        startingAfter = customersData.data[customersData.data.length - 1].id;
      }
    }

    // Store metrics
    const metricsToInsert = [
      // Real-time metrics
      { app_id: app.id, provider: "stripe", metric_type: "active_subscriptions", metric_value: activeSubscriptions, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "active_trials", metric_value: activeTrials, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "mrr", metric_value: Math.round(mrr * 100) / 100, metric_date: today },
      // 30-day totals
      { app_id: app.id, provider: "stripe", metric_type: "new_customers_28d", metric_value: newCustomers30d, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "revenue_28d", metric_value: Math.round(totalRevenue30d * 100) / 100, metric_date: today },
      { app_id: app.id, provider: "stripe", metric_type: "active_users", metric_value: newCustomers30d, metric_date: today },
    ];

    // Add daily metrics for chart data
    for (const [dateStr, revenue] of Object.entries(dailyRevenue)) {
      metricsToInsert.push({
        app_id: app.id,
        provider: "stripe",
        metric_type: "revenue_today",
        metric_value: Math.round(revenue * 100) / 100,
        metric_date: dateStr,
      });
    }

    for (const [dateStr, sales] of Object.entries(dailySales)) {
      metricsToInsert.push({
        app_id: app.id,
        provider: "stripe",
        metric_type: "downloads_today",
        metric_value: sales,
        metric_date: dateStr,
      });
    }

    // Upsert all metrics
    const { error: upsertError } = await supabase
      .from("realtime_metrics")
      .upsert(metricsToInsert, {
        onConflict: 'app_id,provider,metric_type,metric_date',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
    }

    // Update sync time
    await supabase
      .from("connected_apps")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", app.id);

    return {
      success: true,
      data: {
        active_subscriptions: activeSubscriptions,
        active_trials: activeTrials,
        mrr: Math.round(mrr * 100) / 100,
        new_customers_30d: newCustomers30d,
        revenue_30d: Math.round(totalRevenue30d * 100) / 100,
        total_sales_30d: totalSales30d,
        days_with_data: Object.keys(dailyRevenue).length,
      },
    };
  } catch (error: any) {
    console.error("Stripe sync error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, app_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabase
      .from("connected_apps")
      .select("*")
      .eq("provider", "stripe")
      .eq("is_active", true);

    if (user_id) query = query.eq("user_id", user_id);
    if (app_id) query = query.eq("id", app_id);

    const { data: apps, error } = await query;
    if (error) throw error;

    if (!apps?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No Stripe apps to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    for (const app of apps) {
      const result = await syncStripe(supabase, app);
      results.push({ app_id: app.id, ...result });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Sync error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
