import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send push notification helper
async function sendPushNotification(supabase: any, userId: string, type: string, data: any = {}) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token, app_name')
      .eq('id', userId)
      .single();

    if (!profile?.push_token) {
      console.log(`No push token for user ${userId}`);
      return;
    }

    let notification = { title: 'Statly', body: 'You have a new notification' };

    if (type === 'new_download') {
      notification = {
        title: '🎉 New Download!',
        body: `${profile.app_name || 'Your app'} just got a new download!`
      };
    } else if (type === 'new_sale' || type === 'purchase') {
      const amount = data.price ? `$${data.price.toFixed(2)}` : '';
      notification = {
        title: '💰 New Sale!',
        body: `${profile.app_name || 'Your app'} just made a sale! ${amount}`.trim()
      };
    } else if (type === 'new_subscriber') {
      notification = {
        title: '⭐ New Subscriber!',
        body: `${profile.app_name || 'Your app'} has a new subscriber!`
      };
    } else if (type === 'renewal') {
      const amount = data.price ? `$${data.price.toFixed(2)}` : '';
      notification = {
        title: '🔄 Subscription Renewed!',
        body: `A subscription was renewed! ${amount}`.trim()
      };
    }

    const result = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.push_token,
        title: notification.title,
        body: notification.body,
        data: { type, ...data },
        sound: 'default',
        badge: 1,
      }),
    });

    const response = await result.json();
    console.log(`Push notification sent to ${userId}:`, response);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

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
    console.log("RevenueCat webhook received:", event.type, JSON.stringify(event));

    // Get the event type and project info
    const eventType = event.type;
    const appUserId = event.app_user_id;
    const productId = event.product_id;
    const eventProjectId = event.app_id || event.project_id; // RevenueCat sends app_id
    const price = event.price || event.price_in_purchased_currency || 0;
    const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;

    console.log(`[Webhook] Event: ${eventType}, Project: ${eventProjectId}, Product: ${productId}`);

    // Find ALL connected RevenueCat apps
    const { data: allApps } = await supabase
      .from("connected_apps")
      .select("*, user_id")
      .eq("provider", "revenuecat")
      .eq("is_active", true);

    if (!allApps || allApps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected apps" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to only apps that match this project (if project ID is provided)
    let apps = allApps;
    if (eventProjectId) {
      apps = allApps.filter(app => {
        const creds = app.credentials || {};
        const appProjectId = creds.project_id || creds.app_id;
        // Match if project IDs match, or if no project ID stored (legacy)
        return !appProjectId || appProjectId === eventProjectId;
      });
      console.log(`[Webhook] Matched ${apps.length} apps for project ${eventProjectId}`);
    }

    // Update metrics based on event type
    for (const app of apps) {
      const userId = app.user_id;

      // Handle purchase events
      if (eventType === "INITIAL_PURCHASE" || eventType === "NON_RENEWING_PURCHASE") {
        // Increment revenue
        const { data: currentMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "revenuecat")
          .eq("metric_type", "revenue_today")
          .eq("metric_date", today)
          .single();

        const currentRevenue = currentMetric?.metric_value || 0;
        const newRevenue = currentRevenue + priceNum;

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "revenue_today",
          metric_value: newRevenue,
          metric_date: today,
          metadata: { last_event: eventType, product_id: productId },
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Send push notification for new purchase
        await sendPushNotification(supabase, userId, 'new_sale', {
          price: priceNum,
          product_id: productId
        });

        // If initial purchase, also notify about new subscriber
        if (eventType === "INITIAL_PURCHASE") {
          // Increment active subscriptions
          const { data: subMetric } = await supabase
            .from("realtime_metrics")
            .select("metric_value")
            .eq("app_id", app.id)
            .eq("provider", "revenuecat")
            .eq("metric_type", "active_subscriptions")
            .eq("metric_date", today)
            .single();

          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "revenuecat",
            metric_type: "active_subscriptions",
            metric_value: (subMetric?.metric_value || 0) + 1,
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });

          // Also send new subscriber notification
          await sendPushNotification(supabase, userId, 'new_subscriber', {
            product_id: productId
          });
        }
      }

      // Handle renewal events
      if (eventType === "RENEWAL") {
        const { data: currentMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "revenuecat")
          .eq("metric_type", "revenue_today")
          .eq("metric_date", today)
          .single();

        const currentRevenue = currentMetric?.metric_value || 0;

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "revenue_today",
          metric_value: currentRevenue + priceNum,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Send push notification for renewal
        await sendPushNotification(supabase, userId, 'renewal', {
          price: priceNum,
          product_id: productId
        });
      }

      // Handle new customers/downloads
      if (eventType === "INITIAL_PURCHASE" || eventType === "SUBSCRIBER_ALIAS") {
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

        // Update downloads_today
        const { data: dlMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "revenuecat")
          .eq("metric_type", "downloads_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "revenuecat",
          metric_type: "downloads_today",
          metric_value: (dlMetric?.metric_value || 0) + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Send push notification for new download/customer
        await sendPushNotification(supabase, userId, 'new_download', {});
      }

      // Handle cancellation
      if (eventType === "CANCELLATION" || eventType === "EXPIRATION") {
        const { data: subMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "revenuecat")
          .eq("metric_type", "active_subscriptions")
          .eq("metric_date", today)
          .single();

        const currentSubs = subMetric?.metric_value || 0;
        if (currentSubs > 0) {
          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "revenuecat",
            metric_type: "active_subscriptions",
            metric_value: currentSubs - 1,
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });
        }
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
