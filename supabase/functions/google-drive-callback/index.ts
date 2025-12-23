import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return redirectWithError("Authorization was denied");
    }

    if (!code || !state) {
      return redirectWithError("Missing authorization code or state");
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectWithError("Invalid state parameter");
    }

    const { userId, companyId, timestamp } = stateData;

    // Check if state is not too old (5 minutes max)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return redirectWithError("Authorization expired, please try again");
    }

    console.log("Processing callback for user:", userId, "company:", companyId);

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
      return redirectWithError("Failed to exchange authorization code");
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
      }, { onConflict: "company_id" });

    if (upsertError) {
      console.error("Database error:", upsertError);
      return redirectWithError("Failed to save connection");
    }

    console.log("Successfully saved Google Drive connection for company:", companyId);

    // Redirect back to settings with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/settings?drive_connected=true`,
      },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return redirectWithError("An unexpected error occurred");
  }
});

function redirectWithError(message: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/settings?drive_error=${encodeURIComponent(message)}`,
    },
  });
}
