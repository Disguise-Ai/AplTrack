import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate credentials with provider API
async function validateCredentials(provider: string, credentials: Record<string, string>): Promise<{ valid: boolean; error?: string; projectId?: string }> {
  try {
    switch (provider) {
      case "revenuecat": {
        const apiKey = credentials.api_key?.trim();
        if (!apiKey) {
          return { valid: false, error: "API key is required" };
        }

        console.log(`[validate] Testing RevenueCat API key: ${apiKey.substring(0, 10)}...`);

        // Try to fetch projects to validate the key
        const response = await fetch("https://api.revenuecat.com/v2/projects", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        console.log(`[validate] RevenueCat response: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          const projects = data.items || [];
          console.log(`[validate] Found ${projects.length} projects`);

          if (projects.length > 0) {
            return { valid: true, projectId: projects[0].id };
          }
          return { valid: true };
        }

        if (response.status === 401) {
          return { valid: false, error: "Invalid API key - please check and try again" };
        }

        const errText = await response.text();
        return { valid: false, error: `API error: ${response.status} - ${errText.substring(0, 100)}` };
      }

      case "stripe": {
        const secretKey = credentials.secret_key?.trim();
        if (!secretKey) {
          return { valid: false, error: "Secret key is required" };
        }

        const response = await fetch("https://api.stripe.com/v1/balance", {
          headers: { "Authorization": `Bearer ${secretKey}` },
        });

        if (response.ok) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid Stripe secret key" };
      }

      default:
        // For other providers, just check that required fields exist
        const hasValues = Object.values(credentials).every(v => v && v.trim().length > 0);
        return { valid: hasValues, error: hasValues ? undefined : "All fields are required" };
    }
  } catch (error: any) {
    console.error(`[validate] Error: ${error.message}`);
    return { valid: false, error: `Validation failed: ${error.message}` };
  }
}

// Mask credential for display (show first 4 and last 4 chars)
function maskCredential(value: string): string {
  if (!value || value.length < 8) return "••••••••";
  return value.substring(0, 4) + "••••••••" + value.substring(value.length - 4);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, user_id, provider, credentials, app_id } = await req.json();

    console.log(`[store-credentials] Action: ${action}, Provider: ${provider}, User: ${user_id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (action === "store") {
      // Validate credentials first
      console.log(`[store-credentials] Validating credentials...`);
      const validation = await validateCredentials(provider, credentials);

      if (!validation.valid) {
        console.log(`[store-credentials] Validation failed: ${validation.error}`);
        return new Response(
          JSON.stringify({ success: false, error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[store-credentials] Validation passed, storing credentials...`);

      // Create masked version for display
      const maskedCredentials: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        if (key.includes("key") || key.includes("secret") || key.includes("token") || key.includes("private")) {
          maskedCredentials[key] = maskCredential(value as string);
        } else {
          maskedCredentials[key] = value as string;
        }
      }

      // Store credentials (plain, not encrypted for now)
      const { data, error } = await supabase.from("connected_apps").insert({
        user_id,
        provider,
        credentials: credentials, // Store plain credentials
        credentials_masked: maskedCredentials,
        app_store_app_id: credentials.app_id || credentials.project_id || validation.projectId || "",
        is_active: true,
        is_encrypted: false,
      }).select("id, provider, credentials_masked, is_active, last_sync_at, created_at").single();

      if (error) {
        console.error(`[store-credentials] Database error: ${error.message}`);
        throw new Error(error.message);
      }

      console.log(`[store-credentials] Stored app: ${data.id}`);

      // IMMEDIATELY sync data after storing credentials
      console.log(`[store-credentials] Triggering immediate sync...`);
      try {
        const syncResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-all`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ user_id }),
          }
        );
        const syncResult = await syncResponse.json();
        console.log(`[store-credentials] Sync result:`, syncResult);
      } catch (syncErr: any) {
        console.error(`[store-credentials] Sync error:`, syncErr.message);
      }

      return new Response(
        JSON.stringify({ success: true, app: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      // Validate new credentials
      const validation = await validateCredentials(provider, credentials);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create masked version
      const maskedCredentials: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        if (key.includes("key") || key.includes("secret") || key.includes("token") || key.includes("private")) {
          maskedCredentials[key] = maskCredential(value as string);
        } else {
          maskedCredentials[key] = value as string;
        }
      }

      const { data, error } = await supabase.from("connected_apps")
        .update({
          credentials: credentials,
          credentials_masked: maskedCredentials,
          is_encrypted: false,
        })
        .eq("id", app_id)
        .select("id, provider, credentials_masked, is_active, last_sync_at, created_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Response(
        JSON.stringify({ success: true, app: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`[store-credentials] Error: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
