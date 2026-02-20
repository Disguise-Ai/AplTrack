import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  try {
    const { app_id } = await req.json();
    if (!app_id) return new Response(JSON.stringify({ error: 'app_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: app, error: appError } = await supabase.from('connected_apps').select('*').eq('id', app_id).single();
    if (appError || !app) return new Response(JSON.stringify({ error: 'App not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    // Note: Actual App Store Connect API integration would go here
    return new Response(JSON.stringify({ success: true, message: 'Analytics sync triggered' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (error) { return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
});
