import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_SECONDS = 10;

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
    
    const cutoffTime = new Date(Date.now() - TIMEOUT_SECONDS * 1000).toISOString();
    console.log(`Checking for records with folder_status='creating' older than ${cutoffTime}`);

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

    // Update stale matter records
    const { data: mattersUpdated, error: mattersError } = await supabase
      .from("matters")
      .update({ folder_status: "failed" })
      .eq("folder_status", "creating")
      .lt("folder_status_updated_at", cutoffTime)
      .select("id");

    if (mattersError) {
      console.error("Error updating matters:", mattersError);
      throw mattersError;
    }

    const result = {
      success: true,
      timeout_seconds: TIMEOUT_SECONDS,
      cutoff_time: cutoffTime,
      clients_timed_out: clientsUpdated?.length || 0,
      matters_timed_out: mattersUpdated?.length || 0,
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
