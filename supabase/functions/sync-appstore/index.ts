import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateJWT(keyId: string, issuerId: string, privateKey: string): Promise<string> {
  // Clean up the private key
  const cleanKey = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  // Import the key
  const keyData = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 1200, // 20 minutes
    aud: "appstoreconnect-v1",
  };

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const jwt = await create(header, payload, cryptoKey);
  return jwt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { app_id, credentials } = await req.json();

    if (!app_id || !credentials?.key_id || !credentials?.issuer_id || !credentials?.private_key || !credentials?.app_id) {
      throw new Error("Missing app_id or App Store Connect credentials");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split("T")[0];

    // Generate JWT for App Store Connect API
    const jwt = await generateJWT(
      credentials.key_id,
      credentials.issuer_id,
      credentials.private_key
    );

    const baseUrl = "https://api.appstoreconnect.apple.com/v1";
    const headers = {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };

    let metrics: { metric_type: string; metric_value: number }[] = [];

    // Fetch app info
    const appResponse = await fetch(
      `${baseUrl}/apps/${credentials.app_id}`,
      { headers }
    );

    if (appResponse.ok) {
      const appData = await appResponse.json();
      // Store app name in metadata
    }

    // Fetch sales reports (requires specific report type)
    // Note: Sales reports have 24-48 hour delay
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const salesReportUrl = `${baseUrl}/salesReports?filter[reportType]=SALES&filter[reportSubType]=SUMMARY&filter[frequency]=DAILY&filter[reportDate]=${yesterday}&filter[vendorNumber]=YOUR_VENDOR_NUMBER`;

    try {
      const salesResponse = await fetch(salesReportUrl, { headers });
      if (salesResponse.ok) {
        const salesData = await salesResponse.text();
        // Parse TSV sales report
        const lines = salesData.split("\n");
        if (lines.length > 1) {
          let totalUnits = 0;
          let totalRevenue = 0;

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split("\t");
            if (cols.length > 7) {
              totalUnits += parseInt(cols[7]) || 0; // Units column
              totalRevenue += parseFloat(cols[8]) || 0; // Revenue column
            }
          }

          metrics.push({ metric_type: "downloads", metric_value: totalUnits });
          metrics.push({ metric_type: "revenue", metric_value: totalRevenue });
        }
      }
    } catch (e) {
      console.log("Sales report not available:", e);
    }

    // Fetch customer reviews
    const reviewsUrl = `${baseUrl}/apps/${credentials.app_id}/customerReviews?limit=50&sort=-createdDate`;
    try {
      const reviewsResponse = await fetch(reviewsUrl, { headers });
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        const reviews = reviewsData.data || [];

        // Calculate average rating from recent reviews
        if (reviews.length > 0) {
          const avgRating = reviews.reduce((sum: number, r: any) => sum + (r.attributes?.rating || 0), 0) / reviews.length;
          metrics.push({ metric_type: "average_rating", metric_value: avgRating });
          metrics.push({ metric_type: "reviews_count", metric_value: reviews.length });
        }
      }
    } catch (e) {
      console.log("Reviews not available:", e);
    }

    // Store metrics
    for (const metric of metrics) {
      await supabase.from("realtime_metrics").upsert({
        app_id,
        provider: "appstore",
        metric_type: metric.metric_type,
        metric_value: metric.metric_value,
        metric_date: today,
      }, { onConflict: "app_id,provider,metric_type,metric_date" });
    }

    // Also store in analytics_snapshots for backwards compatibility
    if (metrics.length > 0) {
      const downloads = metrics.find(m => m.metric_type === "downloads")?.metric_value || 0;
      const revenue = metrics.find(m => m.metric_type === "revenue")?.metric_value || 0;
      const rating = metrics.find(m => m.metric_type === "average_rating")?.metric_value;

      await supabase.from("analytics_snapshots").upsert({
        app_id,
        date: today,
        downloads,
        revenue,
        average_rating: rating,
      }, { onConflict: "app_id,date" });
    }

    // Update last sync time
    await supabase
      .from("connected_apps")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", app_id);

    return new Response(
      JSON.stringify({ success: true, metrics_synced: metrics.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
