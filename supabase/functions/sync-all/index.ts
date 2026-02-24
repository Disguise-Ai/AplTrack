import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Encryption key - must match store-credentials function
const ENCRYPTION_KEY = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY") || "statly-secure-key-change-in-prod";

// Decrypt function to reverse the encryption
async function decrypt(encryptedText: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedText).split("").map((c) => c.charCodeAt(0))
    );

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    // Create key from password
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(ENCRYPTION_KEY),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encrypted
    );

    return decoder.decode(decrypted);
  } catch (e: any) {
    console.error("[decrypt] Error:", e.message);
    // Return the original value if decryption fails (might be unencrypted)
    return encryptedText;
  }
}

// Helper to decrypt credentials object
async function decryptCredentials(credentials: Record<string, string>, isEncrypted: boolean): Promise<Record<string, string>> {
  if (!isEncrypted) {
    return credentials;
  }

  const decrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    // Only decrypt fields that would have been encrypted
    if (key.includes("key") || key.includes("secret") || key.includes("token") || key.includes("private")) {
      decrypted[key] = await decrypt(value);
    } else {
      decrypted[key] = value;
    }
  }
  return decrypted;
}

async function syncRevenueCat(supabase: any, app: any): Promise<{ success: boolean; data?: any; error?: string }> {
  // Decrypt credentials if encrypted
  const rawCredentials = app.credentials || {};
  const credentials = await decryptCredentials(rawCredentials, app.is_encrypted === true);
  const apiKey = (credentials.api_key || "").trim();
  let projectId = (credentials.project_id || credentials.app_id || "").trim();
  const today = new Date().toISOString().split("T")[0];

  if (!apiKey) {
    return { success: false, error: "No API key" };
  }

  // STEP 1: Get projects if no projectId
  if (!projectId) {
    try {
      const resp = await fetch("https://api.revenuecat.com/v2/projects", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return { success: false, error: `Projects: ${resp.status} - ${errText.substring(0, 100)}` };
      }

      const data = await resp.json();
      const projects = data.items || [];
      if (projects.length === 0) {
        return { success: false, error: "No projects found" };
      }
      projectId = projects[0].id;
    } catch (e: any) {
      return { success: false, error: `Projects error: ${e.message}` };
    }
  }

  // STEP 2: Get overview metrics first (this always works)
  let activeUsers = 0;
  let mrr = 0;
  let activeSubscriptions = 0;
  let activeTrials = 0;
  let newCustomers = 0;
  let totalRevenue = 0;

  console.log(`[RevenueCat] Fetching metrics for project: ${projectId}`);

  // Get overview data (this is reliable)
  try {
    const overviewResp = await fetch(
      `https://api.revenuecat.com/v2/projects/${projectId}/metrics/overview`,
      { headers: { "Authorization": `Bearer ${apiKey}` } }
    );

    console.log(`[RevenueCat] Overview response: ${overviewResp.status}`);

    if (overviewResp.ok) {
      const overviewData = await overviewResp.json();
      console.log(`[RevenueCat] Overview data:`, JSON.stringify(overviewData).substring(0, 1000));

      const metrics = overviewData.metrics || [];

      for (const metric of metrics) {
        console.log(`[RevenueCat] Metric: ${metric.id} = ${metric.value}`);
        switch (metric.id) {
          case "new_customers":
            newCustomers = metric.value || 0;
            break;
          case "revenue":
            totalRevenue = metric.value || 0;
            break;
          case "active_users":
            activeUsers = metric.value || 0;
            break;
          case "mrr":
            mrr = metric.value || 0;
            break;
          case "active_subscriptions":
            activeSubscriptions = metric.value || 0;
            break;
          case "active_trials":
            activeTrials = metric.value || 0;
            break;
        }
      }
      console.log(`[RevenueCat] Parsed - Downloads: ${newCustomers}, Revenue: ${totalRevenue}, Active: ${activeUsers}, MRR: ${mrr}`);
    } else {
      const errText = await overviewResp.text();
      console.error(`[RevenueCat] Overview error: ${overviewResp.status} - ${errText}`);
    }
  } catch (e: any) {
    console.error("[RevenueCat] Overview fetch error:", e.message);
  }

  // Calculate date range for last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Try to fetch daily data from charts API
  const dailyDownloads: Record<string, number> = {};
  const dailyRevenue: Record<string, number> = {};

  // Try different endpoint formats for daily data
  const chartEndpoints = [
    `https://api.revenuecat.com/v2/projects/${projectId}/metrics/new_customers?start_date=${startDateStr}&end_date=${endDateStr}&resolution=day`,
    `https://api.revenuecat.com/v2/projects/${projectId}/charts/new_customers?start_date=${startDateStr}&end_date=${endDateStr}`,
  ];

  for (const endpoint of chartEndpoints) {
    if (Object.keys(dailyDownloads).length > 0) break;

    try {
      console.log(`[RevenueCat] Trying: ${endpoint}`);
      const resp = await fetch(endpoint, { headers: { "Authorization": `Bearer ${apiKey}` } });
      console.log(`[RevenueCat] Response: ${resp.status}`);

      if (resp.ok) {
        const data = await resp.json();
        console.log(`[RevenueCat] Chart data:`, JSON.stringify(data).substring(0, 500));

        // Try different response formats
        const values = data.values || data.data || data.items || [];
        for (const entry of values) {
          const date = entry.date || entry.x || entry.timestamp;
          const value = entry.value || entry.y || entry.count || 0;
          if (date) {
            dailyDownloads[date.split('T')[0]] = value;
          }
        }
      }
    } catch (e: any) {
      console.log(`[RevenueCat] Chart error: ${e.message}`);
    }
  }

  console.log(`[RevenueCat] Got ${Object.keys(dailyDownloads).length} days of daily data`);

  // If no daily data, distribute the 28-day totals across days (as estimate)
  if (Object.keys(dailyDownloads).length === 0 && newCustomers > 0) {
    console.log(`[RevenueCat] No daily data, using overview totals: ${newCustomers} downloads, $${totalRevenue} revenue`);

    // Store today's data with the overview totals divided by 28 (approximate daily)
    const dailyAvgDownloads = Math.round(newCustomers / 28);
    const dailyAvgRevenue = totalRevenue / 28;

    // Fill in the last 28 days with estimated daily values
    for (let i = 0; i < 28; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyDownloads[dateStr] = dailyAvgDownloads;
      dailyRevenue[dateStr] = dailyAvgRevenue;
    }

    // Also store today with the full period totals in a special metric
    dailyDownloads[today] = dailyAvgDownloads;
    dailyRevenue[today] = dailyAvgRevenue;
  }

  // Check if we got any data
  const hasData = newCustomers > 0 || totalRevenue > 0 || activeUsers > 0 || Object.keys(dailyDownloads).length > 0;

  // Skip this app if it returned no meaningful data
  if (!hasData) {
    console.log(`[RevenueCat] Skipping app ${app.id} - no data returned`);
    return {
      success: false,
      error: "No data returned - check project ID or API key",
      data: { downloads: 0, project: projectId },
    };
  }

  // Store daily metrics for each day we have data
  let totalDownloadsStored = 0;
  let totalRevenueStored = 0;

  console.log(`[RevenueCat] Storing daily metrics for ${Object.keys(dailyDownloads).length} days`);

  // Store downloads for each day
  for (const [date, downloads] of Object.entries(dailyDownloads)) {
    totalDownloadsStored += downloads;

    const { error } = await supabase.from("realtime_metrics").upsert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: "downloads_daily",
      metric_value: downloads,
      metric_date: date,
    }, { onConflict: "app_id,provider,metric_type,metric_date" });

    if (error) {
      console.error(`[RevenueCat] Error storing downloads for ${date}:`, error.message);
    }

    // Also store in analytics_snapshots for chart compatibility
    const revenueForDate = dailyRevenue[date] || 0;
    await supabase.from("analytics_snapshots").upsert({
      app_id: app.id,
      date: date,
      downloads: downloads,
      revenue: revenueForDate,
      active_users: date === today ? activeUsers : 0,
      ratings_count: 0,
      average_rating: 0,
    }, { onConflict: "app_id,date" });
  }

  // Store revenue for each day
  for (const [date, revenue] of Object.entries(dailyRevenue)) {
    totalRevenueStored += revenue;

    const { error } = await supabase.from("realtime_metrics").upsert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: "revenue",
      metric_value: revenue,
      metric_date: date,
    }, { onConflict: "app_id,provider,metric_type,metric_date" });

    if (error) {
      console.error(`[RevenueCat] Error storing revenue for ${date}:`, error.message);
    }
  }

  // Store today's overview metrics (including 28-day totals)
  const todayMetrics = [
    { type: "active_users", value: activeUsers },
    { type: "mrr", value: mrr },
    { type: "active_subscribers", value: activeSubscriptions },
    { type: "active_trials", value: activeTrials },
    { type: "new_customers_28d", value: newCustomers },
    { type: "revenue_28d", value: totalRevenue },
  ];

  for (const m of todayMetrics) {
    await supabase.from("realtime_metrics").upsert({
      app_id: app.id,
      provider: "revenuecat",
      metric_type: m.type,
      metric_value: m.value,
      metric_date: today,
    }, { onConflict: "app_id,provider,metric_type,metric_date" });
  }

  // Get today's downloads for response
  const downloadsToday = dailyDownloads[today] || 0;
  const revenueToday = dailyRevenue[today] || 0;

  console.log(`[RevenueCat] Stored data - Today: ${downloadsToday} downloads, $${revenueToday} revenue. Total 30 days: ${totalDownloadsStored} downloads`);

  // Update sync time
  await supabase
    .from("connected_apps")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", app.id);

  return {
    success: true,
    data: {
      downloads_today: downloadsToday,
      downloads_30_days: totalDownloadsStored,
      new_customers_28d: newCustomers,
      revenue_today: revenueToday,
      revenue_30_days: totalRevenueStored,
      total_revenue_28d: totalRevenue,
      activeUsers,
      mrr,
      activeSubscriptions,
      activeTrials,
      project: projectId,
      days_synced: Object.keys(dailyDownloads).length,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, cleanup } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabase.from("connected_apps").select("*").eq("is_active", true);
    if (user_id) query = query.eq("user_id", user_id);

    const { data: apps, error } = await query;
    if (error) throw error;

    if (!apps || apps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "No apps", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    for (const app of apps) {
      if (app.provider === "revenuecat") {
        const result = await syncRevenueCat(supabase, app);
        results.push({ provider: "revenuecat", ...result });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
