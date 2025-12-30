import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TIMEOUT_SECONDS = 10;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting folder creation timeout check...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the minimum timeout from active webhooks that handle folder creation events
    const { data: webhooks, error: webhooksError } = await supabase
      .from("platform_webhooks")
      .select("timeout_seconds, events")
      .eq("is_active", true);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      throw webhooksError;
    }

    // Find webhooks that handle client.created or visa_application.created events
    const folderCreationWebhooks = webhooks?.filter(w => 
      w.events?.includes("client.created") || 
      w.events?.includes("visa_application.created") ||
      w.events?.includes("matter.created") // Legacy support
    ) || [];

    // Use the maximum timeout from folder creation webhooks, or default
    const timeoutSeconds = folderCreationWebhooks.length > 0
      ? Math.max(...folderCreationWebhooks.map(w => w.timeout_seconds || DEFAULT_TIMEOUT_SECONDS))
      : DEFAULT_TIMEOUT_SECONDS;

    const cutoffTime = new Date(Date.now() - timeoutSeconds * 1000).toISOString();
    console.log(`Using timeout of ${timeoutSeconds}s. Checking for records older than ${cutoffTime}`);

    // Update stale client records
    const { data: clientsUpdated, error: clientsError } = await supabase
      .from("clients")
      .update({ folder_status: "failed" })
      .eq("folder_status", "creating")
      .lt("folder_status_updated_at", cutoffTime)
      .select("id");

    if (clientsError) {
      console.error("Error updating clients:", clientsError);
      throw clientsError;
    }

    // Update stale visa application records
    const { data: applicationsUpdated, error: applicationsError } = await supabase
      .from("visa_applications")
      .update({ folder_status: "failed" })
      .eq("folder_status", "creating")
      .lt("folder_status_updated_at", cutoffTime)
      .select("id");

    if (applicationsError) {
      console.error("Error updating visa applications:", applicationsError);
      throw applicationsError;
    }

    const result = {
      success: true,
      timeout_seconds: timeoutSeconds,
      cutoff_time: cutoffTime,
      clients_timed_out: clientsUpdated?.length || 0,
      visa_applications_timed_out: applicationsUpdated?.length || 0,
      timestamp: new Date().toISOString(),
    };

    console.log("Timeout check complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Timeout check failed:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});