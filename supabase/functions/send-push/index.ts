import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  try {
    const { user_id, type, data } = await req.json();
    if (!user_id || !type) return new Response(JSON.stringify({ error: 'user_id and type are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supabase.from('profiles').select('push_token, app_name').eq('id', user_id).single();
    if (!profile?.push_token) return new Response(JSON.stringify({ error: 'Push token not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    let notification = { title: 'AplTrack', body: 'You have a new notification' };
    if (type === 'new_download') notification = { title: 'New Download!', body: `${profile.app_name || 'Your app'} just got a new download!` };
    else if (type === 'new_sale') notification = { title: 'New Sale!', body: `${profile.app_name || 'Your app'} just made a sale!` };
    const result = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: profile.push_token, title: notification.title, body: notification.body, data: { type, ...data }, sound: 'default' }) });
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (error) { return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
});
