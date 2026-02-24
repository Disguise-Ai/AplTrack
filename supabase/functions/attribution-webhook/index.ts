import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Match time window in minutes
const MATCH_WINDOW_MINUTES = 60;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body).substring(0, 500));

    // Handle RevenueCat webhook
    // Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
    const event = body.event || body;
    const eventType = event.type || body.type;

    // We care about new installs/purchases
    const relevantEvents = [
      'INITIAL_PURCHASE',
      'NON_RENEWING_PURCHASE',
      'TEST',
      'SUBSCRIBER_ALIAS',
    ];

    if (!relevantEvents.includes(eventType) && eventType !== undefined) {
      console.log('Ignoring event type:', eventType);
      return new Response(JSON.stringify({ status: 'ignored', type: eventType }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract info from webhook
    const appUserId = event.app_user_id || body.app_user_id;
    const revenue = event.price || event.revenue || body.price || 0;
    const productId = event.product_id || body.product_id;
    const country = event.country_code || body.country_code;

    // Try to find the app/user this belongs to
    // First, check if app_user_id matches a user ID in our system
    let linkId: string | null = null;
    let userId: string | null = null;

    // Try to find by RevenueCat customer ID
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('revenuecat_customer_id', appUserId)
      .single();

    if (subscription) {
      userId = subscription.user_id;

      // Get their tracking link
      const { data: link } = await supabase
        .from('tracking_links')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (link) {
        linkId = link.id;
      }
    }

    // If we found a link, try to match with recent clicks
    if (linkId) {
      // Find recent clicks that could match this install
      const matchWindow = new Date(Date.now() - MATCH_WINDOW_MINUTES * 60 * 1000).toISOString();

      const { data: recentClicks } = await supabase
        .from('link_clicks')
        .select('*')
        .eq('link_id', linkId)
        .gte('clicked_at', matchWindow)
        .order('clicked_at', { ascending: false })
        .limit(1);

      let matchedClick = recentClicks?.[0] || null;
      let source = matchedClick?.source || 'direct';
      let deviceType = matchedClick?.device_type || null;

      // Create attribution record
      await supabase.from('install_attributions').insert({
        link_id: linkId,
        click_id: matchedClick?.id || null,
        source,
        device_type: deviceType,
        country,
        revenue: revenue || 0,
      });

      console.log('Attribution created:', { linkId, source, revenue });
    }

    return new Response(JSON.stringify({ status: 'ok', linkId, userId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
