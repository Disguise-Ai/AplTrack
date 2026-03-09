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
    const { type } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get ALL users with push tokens
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, push_token, app_name')
      .not('push_token', 'is', null);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users with push tokens found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const profile of profiles) {
      if (!profile.push_token) continue;

      let notification = { title: 'Test', body: 'Test notification', sound: 'default' };

      if (type === 'download') {
        notification = {
          title: '🎉 New Download!',
          body: `${profile.app_name || 'Your app'} just got a new download!`,
          sound: 'new_download.caf'
        };
      } else if (type === 'purchase') {
        notification = {
          title: '💰 New Sale!',
          body: `${profile.app_name || 'Your app'} just made a sale! $9.99`,
          sound: 'new_purchase.caf'
        };
      }

      const result = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          title: notification.title,
          body: notification.body,
          sound: notification.sound,
          badge: 1,
        }),
      });

      const response = await result.json();
      results.push({ user_id: profile.id, response });
    }

    return new Response(
      JSON.stringify({ success: true, type, sent_to: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
