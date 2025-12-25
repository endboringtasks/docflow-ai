import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  event_type: string;
  data: Record<string, unknown>;
}

interface MakeWebhookResponse {
  folder_id?: string;
  drive_folder_id?: string;
  folderId?: string;
  data?: {
    folder_id?: string;
    drive_folder_id?: string;
    folderId?: string;
  };
  success?: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log("Dispatching webhook for event:", payload.event_type);

    // Validate required fields
    if (!payload.event_type || !payload.data) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: event_type and data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update folder status to 'creating' for client/matter created events
    const entityId = payload.data.client_id || payload.data.matter_id;
    const entityType = payload.data.client_id ? 'client' : (payload.data.matter_id ? 'matter' : null);
    
    if (entityType && entityId && ['client.created', 'matter.created'].includes(payload.event_type)) {
      const table = entityType === 'client' ? 'clients' : 'matters';
      console.log(`Setting folder_status to 'creating' for ${table} ${entityId}`);
      
      await supabase
        .from(table)
        .update({ folder_status: 'creating' })
        .eq('id', entityId);
    }

    // Get all active webhooks that are subscribed to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from("platform_webhooks")
      .select("*")
      .eq("is_active", true)
      .contains("events", [payload.event_type]);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhooks" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!webhooks || webhooks.length === 0) {
      console.log("No active webhooks found for event:", payload.event_type);
      return new Response(
        JSON.stringify({ success: true, message: "No webhooks configured for this event", dispatched: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${webhooks.length} webhook(s) for event:`, payload.event_type);

    // Dispatch to all matching webhooks
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const webhookPayload = {
          event: payload.event_type,
          timestamp: new Date().toISOString(),
          data: payload.data,
        };

        console.log(`Sending to webhook: ${webhook.name} (${webhook.url})`);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Add secret key if configured
        if (webhook.secret_key) {
          headers["x-webhook-secret"] = webhook.secret_key;
        }

        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(webhookPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Webhook ${webhook.name} failed:`, response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Try to parse the response to get folder_id from Make
        let responseData: MakeWebhookResponse | null = null;
        try {
          const responseText = await response.text();
          console.log(`Webhook ${webhook.name} response:`, responseText);
          
          if (responseText) {
            const parsed = JSON.parse(responseText);
            // Handle array responses from Make (returns [{data: {drive_folder_id: "..."}}])
            if (Array.isArray(parsed) && parsed.length > 0) {
              responseData = parsed[0];
            } else {
              responseData = parsed;
            }
          }
        } catch (parseError) {
          console.log(`Could not parse response from ${webhook.name}:`, parseError);
        }

        // If we got a folder_id in the response, update the entity
        if (responseData && entityType && entityId) {
          // Handle nested data structure from Make
          const dataObj = responseData.data || responseData;
          const folderId = dataObj.folder_id || dataObj.drive_folder_id || dataObj.folderId ||
                           responseData.folder_id || responseData.drive_folder_id || responseData.folderId;
          
          if (folderId) {
            const table = entityType === 'client' ? 'clients' : 'matters';
            console.log(`Updating ${table} ${entityId} with folder_id: ${folderId}`);
            
            const { error: updateError } = await supabase
              .from(table)
              .update({ 
                drive_folder_id: folderId,
                folder_status: 'created'
              })
              .eq('id', entityId);
            
            if (updateError) {
              console.error(`Failed to update ${table} with folder_id:`, updateError);
            } else {
              console.log(`Successfully updated ${table} ${entityId} with folder_id`);
              
              // Log automation event
              const eventType = entityType === 'client' ? 'client_folder_created' : 'matter_folder_created';
              await supabase.from('automation_events').insert({
                company_id: payload.data.company_id,
                client_id: entityType === 'client' ? entityId : (payload.data.client_id || null),
                matter_id: entityType === 'matter' ? entityId : null,
                event_type: eventType,
                payload: {
                  drive_folder_id: folderId,
                  source: 'make_webhook_response',
                  timestamp: new Date().toISOString(),
                },
              });
            }
          } else if (responseData.error) {
            // Mark as failed if Make returned an error
            const table = entityType === 'client' ? 'clients' : 'matters';
            await supabase
              .from(table)
              .update({ folder_status: 'failed' })
              .eq('id', entityId);
            
            console.error(`Make returned error for ${table} ${entityId}:`, responseData.error);
          }
        }

        console.log(`Webhook ${webhook.name} succeeded:`, response.status);
        return { webhook_id: webhook.id, status: "success", folder_id: responseData?.folder_id };
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // If all webhooks failed and we have an entity, mark as failed
    if (failed === webhooks.length && entityType && entityId) {
      const table = entityType === 'client' ? 'clients' : 'matters';
      await supabase
        .from(table)
        .update({ folder_status: 'failed' })
        .eq('id', entityId);
    }

    console.log(`Webhook dispatch complete: ${successful} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: successful,
        failed,
        total: webhooks.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Dispatch webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});