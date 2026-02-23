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
    const event = await req.json();
    const today = new Date().toISOString().split("T")[0];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Log the webhook event
    console.log("RevenueCat webhook received:", event.type);

    // Get the event type
    const eventType = event.type;
    const appUserId = event.app_user_id;
    const productId = event.product_id;
    const price = event.price || event.price_in_purchased_currency || 0;

    // Find the connected app for this project
    const { data: apps } = await supabase
      .from("connected_apps")
      .select("*")
      .eq("provider", "revenuecat")
      .eq("is_active", true);

    if (!apps || apps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected apps" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update metrics based on event type
    for (const app of apps) {
      // Handle different event types
      if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL" || eventType === "NON_RENEWING_PURCHASE") {
        // Increment revenue
        const { data: currentMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "revenuecat")
          .eq("metric_type", "revenue")
          .eq("metric_date", today)
          .single();

        const currentRevenue = currentMetric?.metric_value || 0;
        const newRevenue = currentRevenue + (typeof price === 'number' ? price : parseFloat(price) || 0);

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "revenue",
          metric_value: newRevenue,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Also update mrr
        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "mrr",
          metric_value: newRevenue,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });
      }

      if (eventType === "INITIAL_PURCHASE" || eventType === "SUBSCRIBER_ALIAS") {
        // Increment new customers
        const { data: currentMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "revenuecat")
          .eq("metric_type", "new_customers")
          .eq("metric_date", today)
          .single();

        const currentCount = currentMetric?.metric_value || 0;

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "new_customers",
          metric_value: currentCount + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Also update downloads
        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "downloads",
          metric_value: currentCount + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });
      }

      // Update last sync time
      await supabase
        .from("connected_apps")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", app.id);
    }

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Webhook error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
