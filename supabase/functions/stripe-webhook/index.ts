import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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

    if (type === 'new_sale' || type === 'charge.succeeded') {
      const amount = data.amount ? `$${(data.amount / 100).toFixed(2)}` : '';
      notification = {
        title: '💰 New Sale!',
        body: `You just made a sale! ${amount}`.trim(),
        sound: 'new_purchase.caf'
      };
    } else if (type === 'new_subscriber' || type === 'customer.subscription.created') {
      notification = {
        title: '⭐ New Subscriber!',
        body: `You have a new subscriber!`,
        sound: 'new_purchase.caf'
      };
    } else if (type === 'subscription_renewed' || type === 'invoice.paid') {
      const amount = data.amount ? `$${(data.amount / 100).toFixed(2)}` : '';
      notification = {
        title: '🔄 Subscription Renewed!',
        body: `A subscription was renewed! ${amount}`.trim(),
        sound: 'new_purchase.caf'
      };
    } else if (type === 'refund') {
      const amount = data.amount ? `$${(data.amount / 100).toFixed(2)}` : '';
      notification = {
        title: '↩️ Refund Processed',
        body: `A refund of ${amount} was processed`.trim(),
        sound: 'default'
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
    console.error("Push notification error:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body);
    const today = new Date().toISOString().split("T")[0];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Stripe webhook structure:
    // { id, object: "event", type: "charge.succeeded", data: { object: {...} } }
    const eventType = event.type;
    const eventData = event.data?.object || {};

    // Get the Stripe account ID from the event (for Connect) or use livemode indicator
    const stripeAccountId = event.account || eventData.account;
    const isLiveMode = event.livemode;

    // Find connected Stripe apps
    const { data: allApps } = await supabase
      .from("connected_apps")
      .select("*, user_id")
      .eq("provider", "stripe")
      .eq("is_active", true);

    if (!allApps || allApps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected Stripe apps" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For now, process for all connected Stripe apps
    // In production, you'd match by webhook signing secret or account ID
    for (const app of allApps) {
      const userId = app.user_id;

      // Handle successful charge (one-time payment)
      if (eventType === "charge.succeeded") {
        const amount = eventData.amount || 0; // in cents
        const amountRefunded = eventData.amount_refunded || 0;
        const netAmount = amount - amountRefunded;
        const currency = eventData.currency?.toUpperCase() || "USD";

        // Update revenue for today
        const { data: currentRevenue } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "stripe")
          .eq("metric_type", "revenue_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "stripe",
          metric_type: "revenue_today",
          metric_value: (currentRevenue?.metric_value || 0) + (netAmount / 100),
          metric_date: today,
          metadata: { currency, last_charge_id: eventData.id },
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Update sales count
        const { data: salesMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "stripe")
          .eq("metric_type", "downloads_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "stripe",
          metric_type: "downloads_today",
          metric_value: (salesMetric?.metric_value || 0) + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Send notification
        await sendPushNotification(supabase, userId, 'new_sale', {
          amount: netAmount,
          currency,
          charge_id: eventData.id
        });
      }

      // Handle successful payment intent
      if (eventType === "payment_intent.succeeded") {
        const amount = eventData.amount_received || eventData.amount || 0;
        const currency = eventData.currency?.toUpperCase() || "USD";

        // Only process if not already handled by charge.succeeded
        if (!eventData.latest_charge) {
          const { data: currentRevenue } = await supabase
            .from("realtime_metrics")
            .select("metric_value")
            .eq("app_id", app.id)
            .eq("provider", "stripe")
            .eq("metric_type", "revenue_today")
            .eq("metric_date", today)
            .single();

          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "stripe",
            metric_type: "revenue_today",
            metric_value: (currentRevenue?.metric_value || 0) + (amount / 100),
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });

          await sendPushNotification(supabase, userId, 'new_sale', {
            amount,
            currency
          });
        }
      }

      // Handle new subscription
      if (eventType === "customer.subscription.created") {
        const { data: subMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "stripe")
          .eq("metric_type", "active_subscriptions")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "stripe",
          metric_type: "active_subscriptions",
          metric_value: (subMetric?.metric_value || 0) + 1,
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        // Check if it's a trial
        if (eventData.status === "trialing") {
          const { data: trialMetric } = await supabase
            .from("realtime_metrics")
            .select("metric_value")
            .eq("app_id", app.id)
            .eq("provider", "stripe")
            .eq("metric_type", "active_trials")
            .eq("metric_date", today)
            .single();

          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "stripe",
            metric_type: "active_trials",
            metric_value: (trialMetric?.metric_value || 0) + 1,
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });
        }

        await sendPushNotification(supabase, userId, 'new_subscriber', {
          subscription_id: eventData.id,
          status: eventData.status
        });
      }

      // Handle subscription updated (e.g., trial ended, upgraded)
      if (eventType === "customer.subscription.updated") {
        const previousStatus = event.data?.previous_attributes?.status;
        const currentStatus = eventData.status;

        // Trial converted to active
        if (previousStatus === "trialing" && currentStatus === "active") {
          const { data: trialMetric } = await supabase
            .from("realtime_metrics")
            .select("metric_value")
            .eq("app_id", app.id)
            .eq("provider", "stripe")
            .eq("metric_type", "active_trials")
            .eq("metric_date", today)
            .single();

          if ((trialMetric?.metric_value || 0) > 0) {
            await supabase.from("realtime_metrics").upsert({
              app_id: app.id,
              provider: "stripe",
              metric_type: "active_trials",
              metric_value: (trialMetric?.metric_value || 0) - 1,
              metric_date: today,
            }, { onConflict: "app_id,provider,metric_type,metric_date" });
          }
        }
      }

      // Handle subscription deleted/canceled
      if (eventType === "customer.subscription.deleted") {
        const { data: subMetric } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "stripe")
          .eq("metric_type", "active_subscriptions")
          .eq("metric_date", today)
          .single();

        if ((subMetric?.metric_value || 0) > 0) {
          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "stripe",
            metric_type: "active_subscriptions",
            metric_value: (subMetric?.metric_value || 0) - 1,
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });
        }
      }

      // Handle invoice paid (subscription renewal)
      if (eventType === "invoice.paid") {
        const amount = eventData.amount_paid || 0;
        const isSubscription = eventData.subscription != null;

        if (isSubscription && amount > 0) {
          // This is a subscription renewal payment
          const { data: currentRevenue } = await supabase
            .from("realtime_metrics")
            .select("metric_value")
            .eq("app_id", app.id)
            .eq("provider", "stripe")
            .eq("metric_type", "revenue_today")
            .eq("metric_date", today)
            .single();

          await supabase.from("realtime_metrics").upsert({
            app_id: app.id,
            provider: "stripe",
            metric_type: "revenue_today",
            metric_value: (currentRevenue?.metric_value || 0) + (amount / 100),
            metric_date: today,
          }, { onConflict: "app_id,provider,metric_type,metric_date" });

          await sendPushNotification(supabase, userId, 'subscription_renewed', {
            amount,
            invoice_id: eventData.id
          });
        }
      }

      // Handle refunds
      if (eventType === "charge.refunded") {
        const amountRefunded = eventData.amount_refunded || 0;

        // Subtract from today's revenue
        const { data: currentRevenue } = await supabase
          .from("realtime_metrics")
          .select("metric_value")
          .eq("app_id", app.id)
          .eq("provider", "stripe")
          .eq("metric_type", "revenue_today")
          .eq("metric_date", today)
          .single();

        await supabase.from("realtime_metrics").upsert({
          app_id: app.id,
          provider: "stripe",
          metric_type: "revenue_today",
          metric_value: Math.max(0, (currentRevenue?.metric_value || 0) - (amountRefunded / 100)),
          metric_date: today,
        }, { onConflict: "app_id,provider,metric_type,metric_date" });

        await sendPushNotification(supabase, userId, 'refund', {
          amount: amountRefunded
        });
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
    console.error("Stripe webhook error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
