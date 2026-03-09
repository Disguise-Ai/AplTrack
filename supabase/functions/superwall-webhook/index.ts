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

    if (!profile?.push_token) return;

    let notification = { title: 'Statly', body: 'You have a new notification', sound: 'default' };

    if (type === 'new_download') {
      notification = {
        title: '🎉 New Download!',
        body: `${profile.app_name || 'Your app'} just got a new download!`,
        sound: 'new_download.caf'
      };
    } else if (type === 'new_sale' || type === 'purchase') {
      const amount = data.price ? `$${data.price.toFixed(2)}` : '';
      notification = {
        title: '💰 New Sale!',
        body: `${profile.app_name || 'Your app'} just made a sale! ${amount}`.trim(),
        sound: 'new_purchase.caf'
      };
    } else if (type === 'new_subscriber') {
      notification = {
        title: '⭐ New Subscriber!',
        body: `${profile.app_name || 'Your app'} has a new subscriber!`,
        sound: 'new_purchase.caf'
      };
    } else if (type === 'renewal') {
      const amount = data.price ? `$${data.price.toFixed(2)}` : '';
      notification = {
        title: '🔄 Subscription Renewed!',
        body: `A subscription was renewed! ${amount}`.trim(),
        sound: 'new_purchase.caf'
      };
    } else if (type === 'trial_started') {
      notification = {
        title: '🆓 New Trial Started!',
        body: `${profile.app_name || 'Your app'} has a new trial user!`,
        sound: 'new_download.caf'
      };
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.push_token,
        title: notification.title,
        body: notification.body,
        data: { type, ...data },
        sound: notification.sound,
        badge: 1,
      }),
    });
  } catch (error) {
    // Push notification failed silently
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

    // Superwall webhook structure:
    // { object: "event", type: "initial_purchase", projectId, applicationId, timestamp, data: {...} }
    const eventType = event.type;
    const eventData = event.data || {};
    const projectId = event.projectId?.toString() || event.applicationId?.toString();

    // Extract key metrics from Superwall payload
    const price = eventData.price || 0;
    const proceeds = eventData.proceeds || 0;
    const productId = eventData.productId;
    const store = eventData.store; // APP_STORE, PLAY_STORE, or STRIPE
    const periodType = eventData.periodType; // TRIAL, INTRO, or NORMAL
    const isTrialConversion = eventData.isTrialConversion || false;
    const bundleId = eventData.bundleId;

    // Find connected Superwall apps matching this project/bundle
    const { data: allApps } = await supabase
      .from("connected_apps")
      .select("*, user_id")
      .eq("provider", "superwall")
      .eq("is_active", true);

    if (!allApps || allApps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected Superwall apps" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to apps that match this project/bundle
    let apps = allApps;
    if (projectId || bundleId) {
      apps = allApps.filter(app => {
        const creds = app.credentials || {};
        const appProjectId = creds.project_id || creds.app_id;
        const appBundleId = creds.bundle_id;
        return (!appProjectId || appProjectId === projectId) ||
               (!appBundleId || appBundleId === bundleId);
      });
    }

    // Process event for each matching app
    for (const app of apps) {
      const userId = app.user_id;

      // Handle initial purchase (new subscriber or one-time purchase)
      if (eventType === "initial_purchase" || eventType === "non_renewing_purchase") {
        // Update revenue
        const { data: currentRevenue } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "superwall")
          .eq("metric_type", "revenue_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "superwall",
          metric_type: "revenue_today",
          metric_value: (currentRevenue?.metric_value || 0) + proceeds,
          metric_date: today,
          metadata: { last_event: eventType, product_id: productId, store },
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Send sale notification
        await sendPushNotification(supabase, userId, 'new_sale', {
          price: proceeds,
          product_id: productId
        });

        // If it's a subscription (not one-time), update subscriber count
        if (eventType === "initial_purchase") {
          const { data: subMetric } = await supabase
            .from("realtime_metrics")
            .select("metric_value")
            .eq("app_id", app.id)
            .eq("provider", "superwall")
            .eq("metric_type", "active_subscriptions")
            .eq("metric_date", today)
            .single();

          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "superwall",
            metric_type: "active_subscriptions",
            metric_value: (subMetric?.metric_value || 0) + 1,
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });

          // Check if it's a trial conversion or new subscriber
          if (isTrialConversion) {
            // Trial converted to paid
            const { data: trialMetric } = await supabase
              .from("realtime_metrics")
              .select("metric_value")
              .eq("app_id", app.id)
              .eq("provider", "superwall")
              .eq("metric_type", "active_trials")
              .eq("metric_date", today)
              .single();

            if ((trialMetric?.metric_value || 0) > 0) {
              await supabase.from("realtime_metrics").upsert({
                app_id: app.id,
                provider: "superwall",
                metric_type: "active_trials",
                metric_value: (trialMetric?.metric_value || 0) - 1,
                metric_date: today,
              }, { onConflict: "app_id,provider,metric_type,metric_date" });
            }
          }

          // Send new subscriber notification
          await sendPushNotification(supabase, userId, 'new_subscriber', {
            product_id: productId
          });
        }

        // Update downloads/new customers count
        const { data: dlMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "superwall")
          .eq("metric_type", "downloads_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "superwall",
          metric_type: "downloads_today",
          metric_value: (dlMetric?.metric_value || 0) + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        await sendPushNotification(supabase, userId, 'new_download', {});
      }

      // Handle renewal
      if (eventType === "renewal") {
        const { data: currentRevenue } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "superwall")
          .eq("metric_type", "revenue_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "superwall",
          metric_type: "revenue_today",
          metric_value: (currentRevenue?.metric_value || 0) + proceeds,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        await sendPushNotification(supabase, userId, 'renewal', {
          price: proceeds,
          product_id: productId
        });
      }

      // Handle trial start (periodType === "TRIAL" on initial_purchase)
      if (eventType === "initial_purchase" && periodType === "TRIAL") {
        const { data: trialMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "superwall")
          .eq("metric_type", "active_trials")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "superwall",
          metric_type: "active_trials",
          metric_value: (trialMetric?.metric_value || 0) + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        await sendPushNotification(supabase, userId, 'trial_started', {
          product_id: productId
        });
      }

      // Handle cancellation
      if (eventType === "cancellation") {
        // Note: Don't decrement active_subscriptions here - they're still active until expiration
        // Just log for analytics
        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "superwall",
          metric_type: "cancellations_today",
          metric_value: 1,
          metric_date: today,
          metadata: { cancel_reason: eventData.cancelReason },
        }, { onConflict: "app_id,provider,metric_type,metric_date" });
      }

      // Handle expiration (subscription actually ended)
      if (eventType === "expiration") {
        const { data: subMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "superwall")
          .eq("metric_type", "active_subscriptions")
          .eq("metric_date", today)
          .single();

        if ((subMetric?.metric_value || 0) > 0) {
          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "superwall",
            metric_type: "active_subscriptions",
            metric_value: (subMetric?.metric_value || 0) - 1,
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });
        }
      }

      // Handle uncancellation (user reactivated)
      if (eventType === "uncancellation") {
        // Subscription was cancelled but user reactivated before expiration
        // No metric change needed, just log
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
    console.error("Superwall webhook error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
