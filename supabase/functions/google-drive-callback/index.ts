import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create a folder in Google Drive
async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to create folder:", error);
    throw new Error(`Failed to create folder: ${folderName}`);
  }

  const folder = await response.json();
  console.log(`Created folder: ${folderName} (${folder.id})`);
  return { id: folder.id, name: folder.name };
}

// Create the default folder structure: DocFlow AI > Migration Services > Clients
async function createDefaultFolderStructure(accessToken: string): Promise<{ id: string; name: string }> {
  console.log("Creating default folder structure...");

  // Create DocFlow AI folder at root
  const docflowFolder = await createDriveFolder(accessToken, "DocFlow AI");

  // Create Migration Services folder inside DocFlow AI
  const migrationFolder = await createDriveFolder(
    accessToken,
    "Migration Services",
    docflowFolder.id
  );

  // Create Clients folder inside Migration Services
  const clientsFolder = await createDriveFolder(
    accessToken,
    "Clients",
    migrationFolder.id
  );

  console.log("Folder structure created successfully. Clients folder ID:", clientsFolder.id);
  return clientsFolder;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return redirectWithError("Authorization was denied", "");
    }

    if (!code || !state) {
      return redirectWithError("Missing authorization code or state", "");
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError("Invalid state parameter", "");
    }

    const { userId, companyId, origin, timestamp } = stateData;

    // Check if state is not too old (5 minutes max)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return redirectWithError("Authorization expired, please try again", origin);
    }

    console.log("Processing callback for user:", userId, "company:", companyId, "origin:", origin);

    // Exchange code for tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-drive-callback`;
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData);
      return redirectWithError("Failed to exchange authorization code", origin);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user email from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userInfo = await userInfoResponse.json();
    const connectedEmail = userInfo.email;

    console.log("Connected Google account:", connectedEmail);

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Create the default folder structure and get the Clients folder
    let rootFolderId: string | null = null;
    let rootFolderName: string | null = null;

    try {
      const clientsFolder = await createDefaultFolderStructure(access_token);
      rootFolderId = clientsFolder.id;
      rootFolderName = "DocFlow AI / Migration Services / Clients";
    } catch (folderError) {
      console.error("Failed to create folder structure:", folderError);
      // Continue without setting root folder - user can set it manually later
    }

    // Save to database using service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await supabase
      .from("google_drive_connections")
      .upsert({
        company_id: companyId,
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        connected_by: userId,
        connected_email: connectedEmail,
        root_folder_id: rootFolderId,
        root_folder_name: rootFolderName,
      }, { onConflict: "company_id" });

    if (upsertError) {
      console.error("Database error:", upsertError);
      return redirectWithError("Failed to save connection", origin);
    }

    console.log("Successfully saved Google Drive connection for company:", companyId);
    if (rootFolderId) {
      console.log("Root folder set to:", rootFolderName, "(", rootFolderId, ")");
    }

    // Redirect back to settings with success using the app origin
    const appSettingsPath = "/app/settings";
    const redirectUrl = origin ? `${origin}${appSettingsPath}?drive_connected=true` : `${appSettingsPath}?drive_connected=true`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return redirectWithError("An unexpected error occurred", "");
  }
});

function redirectWithError(message: string, origin: string) {
  const appSettingsPath = "/app/settings";
  const redirectUrl = origin
    ? `${origin}${appSettingsPath}?drive_error=${encodeURIComponent(message)}`
    : `${appSettingsPath}?drive_error=${encodeURIComponent(message)}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl,
    },
  });
}
