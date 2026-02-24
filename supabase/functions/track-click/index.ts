import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Parse referrer to get source
function parseSource(referrer: string | null): string {
  if (!referrer) return 'direct';

  const url = referrer.toLowerCase();

  if (url.includes('twitter.com') || url.includes('t.co') || url.includes('x.com')) {
    return 'Twitter';
  }
  if (url.includes('reddit.com')) {
    return 'Reddit';
  }
  if (url.includes('instagram.com') || url.includes('l.instagram.com')) {
    return 'Instagram';
  }
  if (url.includes('tiktok.com')) {
    return 'TikTok';
  }
  if (url.includes('facebook.com') || url.includes('fb.com') || url.includes('l.facebook.com')) {
    return 'Facebook';
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube';
  }
  if (url.includes('linkedin.com')) {
    return 'LinkedIn';
  }
  if (url.includes('google.com')) {
    return 'Google';
  }
  if (url.includes('bing.com')) {
    return 'Bing';
  }

  // Extract domain for other sources
  try {
    const domain = new URL(referrer).hostname.replace('www.', '');
    return domain;
  } catch {
    return 'direct';
  }
}

// Parse user agent for device type
function parseDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'Unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('mac')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('linux')) return 'Linux';

  return 'Unknown';
}

// Create a fingerprint for matching (non-PII)
function createFingerprint(ip: string, userAgent: string | null): string {
  const data = `${ip}-${userAgent || 'unknown'}`;
  // Simple hash - in production use crypto
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.pathname.replace('/track-click/', '').replace('/', '');

    if (!slug) {
      return new Response('Missing app slug', { status: 400, headers: corsHeaders });
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the tracking link
    const { data: link, error: linkError } = await supabase
      .from('tracking_links')
      .select('*')
      .eq('app_slug', slug.toLowerCase())
      .single();

    if (linkError || !link) {
      // Link not found - redirect to App Store search
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `https://apps.apple.com/search?term=${encodeURIComponent(slug)}`,
        },
      });
    }

    // Parse request info
    const referrer = req.headers.get('referer') || req.headers.get('referrer');
    const userAgent = req.headers.get('user-agent');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('cf-connecting-ip') ||
               'unknown';

    const source = parseSource(referrer);
    const deviceType = parseDeviceType(userAgent);
    const fingerprint = createFingerprint(ip, userAgent);

    // Get geo info from Cloudflare headers if available
    const country = req.headers.get('cf-ipcountry') || null;
    const city = req.headers.get('cf-ipcity') || null;

    // Log the click
    await supabase.from('link_clicks').insert({
      link_id: link.id,
      source,
      device_type: deviceType,
      country,
      city,
      fingerprint,
    });

    // Redirect to App Store
    const redirectUrl = link.app_store_url ||
      `https://apps.apple.com/search?term=${encodeURIComponent(link.app_name || slug)}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
