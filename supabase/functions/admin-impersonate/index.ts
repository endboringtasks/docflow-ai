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

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Helper to write audit log entries (best-effort)
    const logAudit = async (
      actorId: string | null,
      action: string,
      targetId: string | null,
      details: Record<string, unknown>,
    ) => {
      try {
        await supabaseAdmin.from("platform_audit_logs").insert({
          user_id: actorId,
          action,
          entity_type: "user",
          entity_id: targetId,
          details,
        });
      } catch (e) {
        console.error("Failed to write audit log:", e);
      }
    };

    // Create user client to verify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is a platform admin
    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from("platform_admins")
      .select("id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    if (adminError || !adminRecord) {
      console.error("Not a platform admin:", callingUser.id);
      await logAudit(callingUser.id, "impersonate_start_failed", null, {
        admin_email: callingUser.email,
        reason: "caller_not_super_admin",
      });
      return new Response(
        JSON.stringify({ error: "Access denied. Super admin required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the target user ID from request body
    const { targetUserId } = await req.json();
    if (!targetUserId) {
      await logAudit(callingUser.id, "impersonate_start_failed", null, {
        admin_email: callingUser.email,
        reason: "missing_target_user_id",
      });
      return new Response(
        JSON.stringify({ error: "Target user ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent impersonating yourself
    if (targetUserId === callingUser.id) {
      await logAudit(callingUser.id, "impersonate_start_failed", targetUserId, {
        admin_email: callingUser.email,
        reason: "self_impersonation",
      });
      return new Response(
        JSON.stringify({ error: "Cannot impersonate yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user info
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("email, display_name")
      .eq("id", targetUserId)
      .single();

    // BR-13: target user must exist
    if (targetError || !targetProfile?.email) {
      await logAudit(callingUser.id, "impersonate_start_failed", targetUserId, {
        admin_email: callingUser.email,
        reason: "target_user_not_found",
      });
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for the target user (creates a session)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email,
      options: {
        redirectTo: `${req.headers.get("origin") || supabaseUrl}/`,
      },
    });

    // BR-14: on token generation failure, do not change the current session
    if (linkError || !linkData.properties?.hashed_token) {
      console.error("Failed to generate impersonation link:", linkError);
      await logAudit(callingUser.id, "impersonate_start_failed", targetUserId, {
        admin_email: callingUser.email,
        target_email: targetProfile.email,
        reason: "token_generation_failed",
      });
      return new Response(
        JSON.stringify({ error: "Failed to generate impersonation session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the admin's own profile for display in the banner
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", callingUser.id)
      .maybeSingle();

    // Log the impersonation start (dual attribution)
    await logAudit(callingUser.id, "impersonate_start", targetUserId, {
      admin_id: callingUser.id,
      admin_email: callingUser.email,
      target_id: targetUserId,
      target_email: targetProfile.email,
      target_name: targetProfile.display_name,
    });

    console.log(`Admin ${callingUser.email} impersonating user ${targetProfile.email}`);

    // Return the token properties for the client to use
    return new Response(
      JSON.stringify({
        success: true,
        token: linkData.properties.hashed_token,
        targetUser: {
          id: targetUserId,
          email: targetProfile.email,
          display_name: targetProfile.display_name,
        },
        admin: {
          id: callingUser.id,
          email: callingUser.email,
          display_name: adminProfile?.display_name ?? null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Impersonation error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
