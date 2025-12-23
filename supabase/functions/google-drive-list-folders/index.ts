import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      throw new Error(`Unauthorized: ${userError?.message || "No user found"}`);
    }

    const { companyId, parentId } = await req.json();
    if (!companyId) {
      throw new Error("Company ID required");
    }

    // Validate parentId format if provided (Google Drive folder IDs are alphanumeric with hyphens/underscores)
    if (parentId && !/^[a-zA-Z0-9_-]+$/.test(parentId)) {
      return new Response(
        JSON.stringify({ error: "Invalid folder ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is a member of the company
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Access denied. You are not a member of this company." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the connection with tokens
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connection, error: connError } = await serviceClient
      .from("google_drive_connections")
      .select("access_token, refresh_token, token_expires_at")
      .eq("company_id", companyId)
      .single();

    if (connError || !connection) {
      throw new Error("Google Drive not connected");
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.token_expires_at);
    
    if (expiresAt <= new Date()) {
      console.log("Token expired, refreshing...");
      
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (refreshData.error) {
        console.error("Token refresh failed:", refreshData);
        throw new Error("Failed to refresh Google Drive token");
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

      // Update token in database
      await serviceClient
        .from("google_drive_connections")
        .update({
          access_token: accessToken,
          token_expires_at: newExpiresAt,
        })
        .eq("company_id", companyId);
    }

    // List folders from Google Drive - parentId already validated above
    const query = parentId 
      ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      : `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const driveData = await driveResponse.json();

    if (driveData.error) {
      console.error("Drive API error:", driveData.error);
      throw new Error("Failed to list folders");
    }

    console.log(`Listed ${driveData.files?.length || 0} folders for company ${companyId}`);

    return new Response(JSON.stringify({ folders: driveData.files || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error listing folders:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
