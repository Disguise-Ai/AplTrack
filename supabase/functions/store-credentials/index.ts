import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple encryption using AES-GCM (in production, use a proper key management service)
const ENCRYPTION_KEY = Deno.env.get("CREDENTIALS_ENCRYPTION_KEY") || "statly-secure-key-change-in-prod";

async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Create a key from the password
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_KEY),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
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

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function validateCredentials(provider: string, credentials: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case "revenuecat": {
        const apiKey = credentials.api_key;
        const response = await fetch("https://api.revenuecat.com/v2/projects", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });
        if (response.ok || response.status === 200) {
          return { valid: true };
        }
        // Try V1 API as fallback
        const v1Response = await fetch(
          `https://api.revenuecat.com/v1/subscribers/$RCAnonymousID:test`,
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "X-Platform": "ios",
            },
          }
        );
        return { valid: v1Response.ok || v1Response.status === 404 }; // 404 is OK, means key works but user doesn't exist
      }

      case "stripe": {
        const response = await fetch("https://api.stripe.com/v1/balance", {
          headers: {
            "Authorization": `Bearer ${credentials.secret_key}`,
          },
        });
        return { valid: response.ok };
      }

      case "mixpanel": {
        // Mixpanel doesn't have a simple validation endpoint, accept if format is correct
        return { valid: !!credentials.api_secret && credentials.api_secret.length > 10 };
      }

      case "amplitude": {
        return { valid: !!credentials.api_key && !!credentials.secret_key };
      }

      default:
        // For other providers, just check that required fields exist
        return { valid: Object.values(credentials).every(v => v && v.length > 0) };
    }
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (action === "store") {
      // Validate credentials first
      const validation = await validateCredentials(provider, credentials);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: validation.error || "Invalid credentials. Please check and try again."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encrypt sensitive credentials
      const encryptedCredentials: Record<string, string> = {};
      const maskedCredentials: Record<string, string> = {};

      for (const [key, value] of Object.entries(credentials)) {
        if (key.includes("key") || key.includes("secret") || key.includes("token") || key.includes("private")) {
          encryptedCredentials[key] = await encrypt(value as string);
          maskedCredentials[key] = maskCredential(value as string);
        } else {
          encryptedCredentials[key] = value as string;
          maskedCredentials[key] = value as string;
        }
      }

      // Store encrypted credentials
      const { data, error } = await supabase.from("connected_apps").insert({
        user_id,
        provider,
        credentials: encryptedCredentials,
        credentials_masked: maskedCredentials,
        app_store_app_id: credentials.app_id || credentials.project_id || credentials.app_token || "",
        is_active: true,
        is_encrypted: true,
      }).select("id, provider, credentials_masked, created_at, last_sync_at").single();

      if (error) {
        console.error("Store error:", error);
        throw new Error(error.message);
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
          JSON.stringify({
            success: false,
            error: validation.error || "Invalid credentials. Please check and try again."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encrypt sensitive credentials
      const encryptedCredentials: Record<string, string> = {};
      const maskedCredentials: Record<string, string> = {};

      for (const [key, value] of Object.entries(credentials)) {
        if (key.includes("key") || key.includes("secret") || key.includes("token") || key.includes("private")) {
          encryptedCredentials[key] = await encrypt(value as string);
          maskedCredentials[key] = maskCredential(value as string);
        } else {
          encryptedCredentials[key] = value as string;
          maskedCredentials[key] = value as string;
        }
      }

      const { data, error } = await supabase.from("connected_apps")
        .update({
          credentials: encryptedCredentials,
          credentials_masked: maskedCredentials,
          is_encrypted: true,
        })
        .eq("id", app_id)
        .select("id, provider, credentials_masked, created_at, last_sync_at")
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
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
