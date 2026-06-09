import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate using the ORIGINAL admin token, passed explicitly by the client
    // (the active Supabase session at this point belongs to the impersonated user).
    const { targetUserId, adminAccessToken } = await req.json();

    if (!adminAccessToken) {
      return new Response(
        JSON.stringify({ error: "Admin access token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${adminAccessToken}` } },
    });

    const { data: { user: adminUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is (was) a platform admin
    const { data: adminRecord } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("user_id", adminUser.id)
      .maybeSingle();

    if (!adminRecord) {
      return new Response(
        JSON.stringify({ error: "Access denied. Super admin required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up target details for dual attribution (best-effort)
    let targetEmail: string | null = null;
    let targetName: string | null = null;
    if (targetUserId) {
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, display_name")
        .eq("id", targetUserId)
        .maybeSingle();
      targetEmail = targetProfile?.email ?? null;
      targetName = targetProfile?.display_name ?? null;
    }

    // Write the impersonation end audit record
    await supabaseAdmin.from("platform_audit_logs").insert({
      user_id: adminUser.id,
      action: "impersonate_end",
      entity_type: "user",
      entity_id: targetUserId ?? null,
      details: {
        admin_id: adminUser.id,
        admin_email: adminUser.email,
        target_id: targetUserId ?? null,
        target_email: targetEmail,
        target_name: targetName,
        outcome: "success",
      },
    });

    console.log(`Admin ${adminUser.email} ended impersonation of ${targetEmail ?? targetUserId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("End impersonation error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
