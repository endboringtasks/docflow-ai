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

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret_key: string | null;
  included_fields: string[] | null;
  max_retries: number;
  retry_backoff_seconds: number;
}

// Sleep helper for retry backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Send webhook with retry logic
async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  webhookPayload: Record<string, unknown>,
  maxRetries: number,
  baseBackoffSeconds: number
): Promise<{ response: Response; attempts: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (webhook.secret_key) {
    headers["x-webhook-secret"] = webhook.secret_key;
  }

  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    
    if (attempt > 0) {
      // Exponential backoff: baseBackoff * 2^(attempt-1)
      const backoffMs = baseBackoffSeconds * 1000 * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxRetries} for ${webhook.name}, waiting ${backoffMs}ms`);
      await sleep(backoffMs);
    }

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        if (attempt > 0) {
          console.log(`Webhook ${webhook.name} succeeded after ${attempt} retries`);
        }
        return { response, attempts };
      }

      // Non-retryable status codes (client errors except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.log(`Webhook ${webhook.name} returned non-retryable status ${response.status}`);
        return { response, attempts };
      }

      // Retryable error - log and continue
      const errorText = await response.text();
      lastError = new Error(`HTTP ${response.status}: ${errorText}`);
      console.log(`Webhook ${webhook.name} attempt ${attempt + 1} failed: ${response.status}`);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Webhook ${webhook.name} attempt ${attempt + 1} error: ${lastError.message}`);
    }
  }

  // All retries exhausted - throw the last error
  throw lastError || new Error("Unknown error after retries");
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
    // Determine entity type based on event type, not just presence of IDs (matters also have client_id)
    let entityId: string | null = null;
    let entityType: 'client' | 'matter' | null = null;
    
    if (payload.event_type === 'client.created') {
      entityId = payload.data.client_id as string;
      entityType = 'client';
    } else if (payload.event_type === 'matter.created') {
      entityId = payload.data.matter_id as string;
      entityType = 'matter';
    }
    
    if (entityType && entityId) {
      const table = entityType === 'client' ? 'clients' : 'matters';
      console.log(`Setting folder_status to 'creating' for ${table} ${entityId}`);
      
      await supabase
        .from(table)
        .update({ 
          folder_status: 'creating',
          folder_status_updated_at: new Date().toISOString()
        })
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

    // Helper to rename company_id to organization_id for clearer webhook payloads
    const renameCompanyIdToOrganizationId = (data: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (key === 'company_id') {
          result['organization_id'] = value;
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    // Helper to filter data based on webhook's included_fields setting
    const filterPayloadData = (data: Record<string, unknown>, includedFields: string[] | null) => {
      // First rename company_id to organization_id
      const renamedData = renameCompanyIdToOrganizationId(data);
      
      // If no included_fields specified or empty array, include all fields
      if (!includedFields || includedFields.length === 0) {
        return renamedData;
      }
      
      // Only include specified fields (map company_id -> organization_id in the filter)
      const fieldsToInclude = new Set(
        includedFields.map(f => f === 'company_id' ? 'organization_id' : f)
      );
      
      const filteredData: Record<string, unknown> = {};
      for (const key of Object.keys(renamedData)) {
        if (fieldsToInclude.has(key)) {
          filteredData[key] = renamedData[key];
        }
      }
      
      return filteredData;
    };

    // Dispatch to all matching webhooks with retry logic
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        // Filter the data based on this webhook's included_fields
        const filteredData = filterPayloadData(
          payload.data, 
          webhook.included_fields as string[] | null
        );
        
        const webhookPayload = {
          event: payload.event_type,
          timestamp: new Date().toISOString(),
          data: filteredData,
        };

        console.log(`Sending to webhook: ${webhook.name} (${webhook.url})`);
        
        // Get retry configuration with defaults
        const maxRetries = webhook.max_retries ?? 3;
        const retryBackoffSeconds = webhook.retry_backoff_seconds ?? 5;
        
        console.log(`Webhook ${webhook.name} retry config: max_retries=${maxRetries}, backoff=${retryBackoffSeconds}s`);

        const { response, attempts } = await sendWebhookWithRetry(
          webhook as WebhookConfig,
          webhookPayload,
          maxRetries,
          retryBackoffSeconds
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Webhook ${webhook.name} failed after ${attempts} attempts:`, response.status, errorText);
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

        console.log(`Webhook ${webhook.name} succeeded after ${attempts} attempt(s):`, response.status);
        return { webhook_id: webhook.id, status: "success", attempts, folder_id: responseData?.folder_id };
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
