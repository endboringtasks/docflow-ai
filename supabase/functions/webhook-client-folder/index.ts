import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  client_id: string;
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
    console.log("Received client folder webhook:", JSON.stringify(payload));

    // Validate required fields
    if (!payload.client_id || !payload.drive_folder_id) {
      console.error("Missing required fields:", { client_id: !!payload.client_id, drive_folder_id: !!payload.drive_folder_id });
      return new Response(
        JSON.stringify({ error: "Missing required fields: client_id and drive_folder_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update the client with the drive folder ID
    const { data: client, error: updateError } = await supabase
      .from("clients")
      .update({ drive_folder_id: payload.drive_folder_id })
      .eq("id", payload.client_id)
      .select("id, company_id, full_name")
      .single();

    if (updateError) {
      console.error("Error updating client:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update client", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      console.error("Client not found:", payload.client_id);
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the automation event
    const { error: eventError } = await supabase
      .from("automation_events")
      .insert({
        company_id: client.company_id,
        client_id: client.id,
        event_type: "client_folder_created",
        payload: {
          drive_folder_id: payload.drive_folder_id,
          client_name: client.full_name,
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      console.warn("Failed to log automation event:", eventError);
    }

    console.log("Successfully updated client drive folder:", { client_id: client.id, drive_folder_id: payload.drive_folder_id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Client drive folder updated",
        client_id: client.id 
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
