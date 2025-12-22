import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  matter_id: string;
  drive_folder_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: WebhookPayload = await req.json();
    console.log("Received matter folder webhook:", JSON.stringify(payload));

    // Validate required fields
    if (!payload.matter_id || !payload.drive_folder_id) {
      console.error("Missing required fields:", { matter_id: !!payload.matter_id, drive_folder_id: !!payload.drive_folder_id });
      return new Response(
        JSON.stringify({ error: "Missing required fields: matter_id and drive_folder_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update the matter with the drive folder ID
    const { data: matter, error: updateError } = await supabase
      .from("matters")
      .update({ drive_folder_id: payload.drive_folder_id })
      .eq("id", payload.matter_id)
      .select("id, company_id, client_id, matter_name")
      .single();

    if (updateError) {
      console.error("Error updating matter:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update matter", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!matter) {
      console.error("Matter not found:", payload.matter_id);
      return new Response(
        JSON.stringify({ error: "Matter not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the automation event
    const { error: eventError } = await supabase
      .from("automation_events")
      .insert({
        company_id: matter.company_id,
        client_id: matter.client_id,
        matter_id: matter.id,
        event_type: "matter_folder_created",
        payload: {
          drive_folder_id: payload.drive_folder_id,
          matter_name: matter.matter_name,
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      console.warn("Failed to log automation event:", eventError);
    }

    console.log("Successfully updated matter drive folder:", { matter_id: matter.id, drive_folder_id: payload.drive_folder_id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Matter drive folder updated",
        matter_id: matter.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
