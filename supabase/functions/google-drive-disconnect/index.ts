import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { decryptToken, isEncrypted } from "../_shared/token-encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Revoke an OAuth token with Google
async function revokeToken(token: string): Promise<boolean> {
  console.log("Revoking OAuth token with Google...");
  const response = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to revoke token:", error);
    return false;
  }

  console.log("Successfully revoked OAuth token");
  return true;
}

// Get all permissions for a folder
async function getFolderPermissions(
  accessToken: string,
  folderId: string
): Promise<Array<{ id: string; emailAddress?: string; role: string; type: string }>> {
  console.log(`Getting permissions for folder ${folderId}...`);
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?fields=permissions(id,emailAddress,role,type)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to get folder permissions:", error);
    return [];
  }

  const data = await response.json();
  return data.permissions || [];
}

// Remove a specific permission from a folder
async function removePermission(
  accessToken: string,
  folderId: string,
  permissionId: string
): Promise<boolean> {
  console.log(`Removing permission ${permissionId} from folder ${folderId}...`);
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions/${permissionId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to remove permission ${permissionId}:`, error);
    return false;
  }

  console.log(`Successfully removed permission ${permissionId}`);
  return true;
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to refresh access token:", error);
    return null;
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Use service role client to bypass RLS for reading tokens
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Also create user client to verify membership
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      throw new Error(`Unauthorized: ${userError?.message || "No user found"}`);
    }

    const { companyId } = await req.json();
    if (!companyId) {
      throw new Error("Company ID required");
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

    // Fetch the connection details using service role (to get tokens)
    const { data: connection, error: fetchError } = await supabaseAdmin
      .from("google_drive_connections")
      .select("id, access_token, refresh_token, root_folder_id, tokens_encrypted, connected_email")
      .eq("company_id", companyId)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch connection error:", fetchError);
      throw new Error("Failed to fetch connection details");
    }

    if (!connection) {
      console.log("No connection found for company:", companyId);
      return new Response(JSON.stringify({ success: true, message: "No connection to disconnect" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt tokens if needed
    let refreshToken = connection.refresh_token;
    if (connection.tokens_encrypted && isEncrypted(refreshToken)) {
      refreshToken = await decryptToken(refreshToken);
    }

    // Remove shared permissions from the root folder if it exists
    if (connection.root_folder_id) {
      console.log("Removing shared permissions from root folder:", connection.root_folder_id);
      
      try {
        let accessToken = connection.access_token;
        if (connection.tokens_encrypted && isEncrypted(accessToken)) {
          accessToken = await decryptToken(accessToken);
        }

        // Try to refresh the access token to ensure it's valid
        const freshAccessToken = await refreshAccessToken(refreshToken);
        if (freshAccessToken) {
          accessToken = freshAccessToken;
        }

        // Get all permissions on the folder
        const permissions = await getFolderPermissions(accessToken, connection.root_folder_id);
        
        // Get the Make.com email to identify which permission to remove
        const makeGoogleEmail = Deno.env.get("MAKE_GOOGLE_EMAIL");
        
        // Remove shared permissions (not the owner)
        for (const permission of permissions) {
          if (permission.role === "owner") {
            console.log("Skipping owner permission");
            continue;
          }
          
          if (makeGoogleEmail && permission.emailAddress === makeGoogleEmail) {
            await removePermission(accessToken, connection.root_folder_id, permission.id);
          } else if (!makeGoogleEmail && permission.type === "user" && permission.role !== "owner") {
            await removePermission(accessToken, connection.root_folder_id, permission.id);
          }
        }
        
        console.log("Finished removing shared permissions");
      } catch (permError) {
        console.error("Error removing folder permissions (continuing with disconnect):", permError);
      }
    }

    // Revoke the OAuth token with Google (best-effort)
    try {
      await revokeToken(refreshToken);
    } catch (revokeError) {
      console.error("Error revoking token (continuing with disconnect):", revokeError);
    }

    // Soft-delete: UPDATE instead of DELETE — preserve connected_email and folder IDs on clients/applications
    const { error: updateError } = await supabaseAdmin
      .from("google_drive_connections")
      .update({
        access_token: "",
        refresh_token: "",
        root_folder_id: null,
        root_folder_name: null,
        tokens_encrypted: false,
        disconnected_at: new Date().toISOString(),
      })
      .eq("company_id", companyId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to disconnect");
    }

    console.log("Disconnected Google Drive for company:", companyId, "(soft-delete, folder IDs preserved)");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Disconnect error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
