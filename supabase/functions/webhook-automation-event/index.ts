import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface AutomationEventPayload {
  company_id: string;
  client_id?: string;
  matter_id?: string;
  event_type: string;
  payload?: Record<string, unknown>;
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
    const eventData: AutomationEventPayload = await req.json();
    console.log("Received automation event:", JSON.stringify(eventData));

    // Validate required fields
    if (!eventData.company_id || !eventData.event_type) {
      console.error("Missing required fields:", { company_id: !!eventData.company_id, event_type: !!eventData.event_type });
      return new Response(
        JSON.stringify({ error: "Missing required fields: company_id and event_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate event_type length and format
    if (eventData.event_type.length > 100) {
      return new Response(
        JSON.stringify({ error: "event_type must be less than 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", eventData.company_id)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", eventData.company_id);
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the automation event
    const { data: event, error: insertError } = await supabase
      .from("automation_events")
      .insert({
        company_id: eventData.company_id,
        client_id: eventData.client_id || null,
        matter_id: eventData.matter_id || null,
        event_type: eventData.event_type,
        payload: {
          ...eventData.payload,
          received_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting automation event:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to log event", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully logged automation event:", { event_id: event.id, event_type: eventData.event_type });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Automation event logged",
        event_id: event.id 
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
