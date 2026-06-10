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
  client_folder_id?: string;
  folderId?: string;
  data?: {
    folder_id?: string;
    client_folder_id?: string;
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
  delivery_timeout_seconds?: number | null;
  max_backoff_seconds?: number | null;
}

// Sleep helper for retry backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface AttemptLog {
  attempt_number: number;
  duration_ms: number;
  status_code: number;
  error_message: string | null;
  will_retry: boolean;
  final_state: string | null;
}

// Send webhook with retry logic.
// BR-3/AC-4: enforces a per-attempt timeout via AbortController.
// BR-12: records every individual attempt via onAttempt callback.
async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  webhookPayload: Record<string, unknown>,
  idempotencyKey: string,
  options: {
    maxRetries: number;
    baseBackoffSeconds: number;
    timeoutSeconds: number;
    maxBackoffSeconds: number | null;
  },
  onAttempt: (log: AttemptLog) => Promise<void> | void
): Promise<{ response: Response; attempts: number }> {
  const { maxRetries, baseBackoffSeconds, timeoutSeconds, maxBackoffSeconds } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // BR-10: stable idempotency key across retries of the same delivery
    "x-idempotency-key": idempotencyKey,
  };

  if (webhook.secret_key) {
    headers["x-webhook-secret"] = webhook.secret_key;
  }

  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;

    if (attempt > 0) {
      // Exponential backoff: baseBackoff * 2^(attempt-1), optionally capped
      let backoffMs = baseBackoffSeconds * 1000 * Math.pow(2, attempt - 1);
      if (maxBackoffSeconds && maxBackoffSeconds > 0) {
        backoffMs = Math.min(backoffMs, maxBackoffSeconds * 1000);
      }
      console.log(`Retry attempt ${attempt}/${maxRetries} for ${webhook.name}, waiting ${backoffMs}ms`);
      await sleep(backoffMs);
    }

    const attemptStartedAt = Date.now();
    const willHaveMoreAttempts = attempt < maxRetries;

    // BR-3/AC-4: enforce per-attempt timeout
    const controller = new AbortController();
    const timeoutMs = Math.max(1, timeoutSeconds) * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(webhookPayload),
        signal: controller.signal,
      });

      if (response.ok) {
        await onAttempt({
          attempt_number: attempts,
          duration_ms: Date.now() - attemptStartedAt,
          status_code: response.status,
          error_message: null,
          will_retry: false,
          final_state: "delivered",
        });
        if (attempt > 0) {
          console.log(`Webhook ${webhook.name} succeeded after ${attempt} retries`);
        }
        return { response, attempts };
      }

      // Non-retryable status codes (client errors except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorText = await response.clone().text();
        const snippet = errorText ? errorText.slice(0, 800) : "";
        console.log(
          `Webhook ${webhook.name} returned non-retryable status ${response.status}${snippet ? `; body: ${snippet}` : ""}`
        );
        await onAttempt({
          attempt_number: attempts,
          duration_ms: Date.now() - attemptStartedAt,
          status_code: response.status,
          error_message: `http_${response.status}${snippet ? `: ${snippet}` : ""}`.slice(0, 800),
          will_retry: false,
          final_state: "failed",
        });
        return { response, attempts };
      }

      // Retryable error - log and continue
      const errorText = await response.text();
      lastError = new Error(`HTTP ${response.status}: ${errorText}`);
      const contentType = response.headers.get("content-type") || "unknown";
      const snippet = errorText ? errorText.slice(0, 800) : "";
      console.log(
        `Webhook ${webhook.name} attempt ${attempt + 1} failed: ${response.status} (content-type: ${contentType})${snippet ? `; body: ${snippet}` : ""}`
      );
      await onAttempt({
        attempt_number: attempts,
        duration_ms: Date.now() - attemptStartedAt,
        status_code: response.status,
        error_message: `http_${response.status}${snippet ? `: ${snippet}` : ""}`.slice(0, 800),
        will_retry: willHaveMoreAttempts,
        final_state: willHaveMoreAttempts ? null : "failed",
      });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      lastError = aborted
        ? new Error(`Request timed out after ${timeoutSeconds}s`)
        : (error instanceof Error ? error : new Error(String(error)));
      console.log(`Webhook ${webhook.name} attempt ${attempt + 1} error: ${lastError.message}`);
      await onAttempt({
        attempt_number: attempts,
        duration_ms: Date.now() - attemptStartedAt,
        status_code: aborted ? 408 : 599,
        error_message: lastError.message.slice(0, 800),
        will_retry: willHaveMoreAttempts,
        final_state: willHaveMoreAttempts ? null : "failed",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // All retries exhausted - throw the last error
  throw lastError || new Error("Unknown error after retries");
}

async function hydratePayloadData(
  eventType: string,
  data: Record<string, unknown>,
  supabase: any
): Promise<Record<string, unknown>> {
  // Support application., visa_application. and legacy matter. event prefixes
  if (!eventType.startsWith("application.") && !eventType.startsWith("visa_application.") && !eventType.startsWith("matter.")) return data;

  let hydrated: Record<string, unknown> = { ...data };

  // Support application_id, visa_application_id and legacy matter_id
  const applicationId = (data.application_id ?? data.visa_application_id ?? data.matter_id ?? data.id) as string | undefined;
  if (applicationId) {
    try {
      const { data: applicationRow, error } = await supabase
        .from("visa_applications")
        .select(
          "id, company_id, client_id, application_name, visa_subclass, status, visa_application_folder_id, folder_status, folder_status_updated_at, created_at"
        )
        .eq("id", applicationId)
        .maybeSingle();

      if (error) {
        console.log("Hydration: failed to load visa application", { application_id: applicationId, error: error.message });
      } else if (applicationRow) {
        hydrated = {
          ...hydrated,
          application_id: applicationRow.id,
          company_id: applicationRow.company_id,
          client_id: applicationRow.client_id,
          application_name: applicationRow.application_name,
          subclass: applicationRow.visa_subclass,
          status: applicationRow.status,
          application_folder_id: applicationRow.visa_application_folder_id,
          folder_status: applicationRow.folder_status,
          folder_status_updated_at: applicationRow.folder_status_updated_at,
          created_at: applicationRow.created_at,
        };
      } else {
        // Record not found (likely deleted) - preserve existing payload fields
        console.log("Hydration: application not found (likely deleted), preserving payload data", { application_id: applicationId });
        // Map incoming field names to standard webhook field names
        hydrated = {
          ...hydrated,
          application_id: hydrated.application_id ?? hydrated.visa_application_id ?? applicationId,
          subclass: hydrated.subclass ?? hydrated.visa_subclass,
          application_folder_id: hydrated.application_folder_id ?? hydrated.visa_application_folder_id,
        };
      }
    } catch (e) {
      console.log("Hydration: exception loading visa application", { application_id: applicationId, error: String(e) });
    }
  }

  const companyId = (hydrated.company_id ?? data.company_id) as string | undefined;
  const clientId = (hydrated.client_id ?? data.client_id) as string | undefined;

  if (clientId) {
    try {
      const { data: clientRow, error } = await supabase
        .from("clients")
        .select("id, client_type, first_name, last_name, company_name, email, phone, client_folder_id")
        .eq("id", clientId)
        .maybeSingle();

      if (error) {
        console.log("Hydration: failed to load client", { client_id: clientId, error: error.message });
      } else if (clientRow) {
        hydrated = {
          ...hydrated,
          client_id: clientRow.id,
          client_type: clientRow.client_type,
          first_name: clientRow.first_name,
          last_name: clientRow.last_name,
          company_name: clientRow.company_name,
          email: clientRow.email,
          phone: clientRow.phone,
          client_folder_id: clientRow.client_folder_id,
        };
      }
    } catch (e) {
      console.log("Hydration: exception loading client", { client_id: clientId, error: String(e) });
    }
  }

  if (companyId) {
    try {
      const { data: connectionRow, error } = await supabase
        .from("google_drive_connections")
        .select("root_folder_id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        console.log("Hydration: failed to load drive connection", { company_id: companyId, error: error.message });
      } else if (connectionRow) {
        hydrated = { ...hydrated, root_folder_id: connectionRow.root_folder_id };
      }
    } catch (e) {
      console.log("Hydration: exception loading drive connection", { company_id: companyId, error: String(e) });
    }
  }

  return hydrated;
}

async function safeLogWebhookRequest(
  supabase: any,
  log: {
    endpoint: string;
    method: string;
    request_id: string;
    status_code: number;
    duration_ms?: number | null;
    error_message?: string | null;
    client_ip?: string | null;
    user_agent?: string | null;
    attempt_number?: number | null;
    will_retry?: boolean | null;
    final_state?: string | null;
  }
) {
  try {
    const { error } = await supabase.from("webhook_request_logs").insert({
      endpoint: log.endpoint,
      method: log.method,
      request_id: log.request_id,
      status_code: log.status_code,
      duration_ms: log.duration_ms ?? null,
      error_message: log.error_message ?? null,
      client_ip: log.client_ip ?? null,
      user_agent: log.user_agent ?? null,
      rate_limited: null,
      attempt_number: log.attempt_number ?? null,
      will_retry: log.will_retry ?? null,
      final_state: log.final_state ?? null,
    });

    if (error) {
      console.log("Failed to write webhook_request_logs", { endpoint: log.endpoint, error: error.message });
    }
  } catch (e) {
    console.log("Failed to write webhook_request_logs (exception)", { endpoint: log.endpoint, error: String(e) });
  }
}


Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }


  const requestId = crypto.randomUUID();
  const requestStartedAt = Date.now();

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
  const userAgent = req.headers.get("user-agent");

  const respondJson = async (status: number, body: unknown, errorMessage?: string | null) => {
    await safeLogWebhookRequest(supabase, {
      endpoint: "dispatch-webhook",
      method: req.method,
      request_id: requestId,
      status_code: status,
      duration_ms: Date.now() - requestStartedAt,
      error_message: errorMessage ?? null,
      client_ip: clientIp,
      user_agent: userAgent,
    });

    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const payload: WebhookPayload = await req.json();
    console.log("Dispatching webhook for event:", payload.event_type);

    // Validate required fields
    if (!payload.event_type || !payload.data) {
      console.error("Missing required fields");
      return await respondJson(400, { error: "Missing required fields: event_type and data" }, "missing_required_fields");
    }

    // Update folder status to 'creating' for client/visa_application created events
    // Determine entity type based on event type, not just presence of IDs (visa applications also have client_id)
    let entityId: string | null = null;
    let entityType: "client" | "visa_application" | null = null;

    if (payload.event_type === "client.created") {
      entityId = payload.data.client_id as string;
      entityType = "client";
    } else if (payload.event_type === "application.created" || payload.event_type === "visa_application.created" || payload.event_type === "matter.created") {
      // Support application., visa_application. and legacy matter. event names
      entityId = (payload.data.application_id || payload.data.visa_application_id || payload.data.matter_id) as string;
      entityType = "visa_application";
    }

    if (entityType && entityId) {
      const table = entityType === "client" ? "clients" : "visa_applications";
      console.log(`Setting folder_status to 'creating' for ${table} ${entityId}`);

      await supabase
        .from(table)
        .update({
          folder_status: "creating",
          folder_status_updated_at: new Date().toISOString(),
        })
        .eq("id", entityId);
    }

    // Get all active webhooks that are subscribed to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from("platform_webhooks")
      .select("*")
      .eq("is_active", true)
      .contains("events", [payload.event_type]);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      return await respondJson(500, { error: "Failed to fetch webhooks" }, webhooksError.message);
    }

    if (!webhooks || webhooks.length === 0) {
      console.log("No active webhooks found for event:", payload.event_type);
      return await respondJson(
        200,
        { success: true, message: "No webhooks configured for this event", dispatched: 0 },
        "no_webhooks_configured"
      );
    }

    console.log(`Found ${webhooks.length} webhook(s) for event:`, payload.event_type);

    const hydratedData = await hydratePayloadData(payload.event_type, payload.data, supabase);
    console.log("Hydrated payload keys:", Object.keys(hydratedData));

    // Helper to rename company_id to organization_id for clearer webhook payloads
    const renameCompanyIdToOrganizationId = (data: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (key === "company_id") {
          result["organization_id"] = value;
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
      const fieldsToInclude = new Set(includedFields.map((f) => (f === "company_id" ? "organization_id" : f)));

      const filteredData: Record<string, unknown> = {};
      for (const key of Object.keys(renamedData)) {
        if (fieldsToInclude.has(key)) {
          filteredData[key] = renamedData[key];
        }
      }

      return filteredData;
    };

    const contextSnippet = `event=${payload.event_type} application_id=${String((hydratedData as any).application_id ?? "")}`;

    // Dispatch to all matching webhooks with retry logic
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const deliveryRequestId = `${requestId}:${webhook.id}`;
        const deliveryStartedAt = Date.now();

        try {
          // Filter the data based on this webhook's included_fields
          const filteredData = filterPayloadData(hydratedData, webhook.included_fields as string[] | null);

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

          const deliveryDurationMs = Date.now() - deliveryStartedAt;

          // Persist delivery attempt
          await safeLogWebhookRequest(supabase, {
            endpoint: webhook.url,
            method: "POST",
            request_id: deliveryRequestId,
            status_code: response.status,
            duration_ms: deliveryDurationMs,
            error_message: response.ok ? null : `http_${response.status} ${contextSnippet}`,
          });

          if (!response.ok) {
            const errorText = await response.text();
            const snippet = errorText ? errorText.slice(0, 800) : "";
            console.error(`Webhook ${webhook.name} failed after ${attempts} attempts:`, response.status, snippet);
            throw new Error(`HTTP ${response.status}: ${snippet}`);
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
          console.log(`Folder update check - entityType: ${entityType}, entityId: ${entityId}, responseData:`, JSON.stringify(responseData));
          
          if (responseData && entityType && entityId) {
            // Handle nested data structure from Make
            const dataObj = responseData.data || responseData;
            console.log(`Extracted dataObj:`, JSON.stringify(dataObj));
            
            // For clients, look for client_folder_id or folder_id
            // For visa_applications, look for visa_application_folder_id or folder_id
            let folderId: string | undefined;
            if (entityType === "client") {
              folderId =
                (dataObj as any).client_folder_id ||
                (dataObj as any).folder_id ||
                (dataObj as any).folderId ||
                responseData.client_folder_id ||
                responseData.folder_id ||
                responseData.folderId;
            } else {
              // Visa application - look for application_folder_id specifically (also support legacy visa_application_folder_id)
              folderId =
                (dataObj as any).application_folder_id ||
                (dataObj as any).visa_application_folder_id ||
                (dataObj as any).folder_id ||
                (dataObj as any).folderId ||
                (responseData as any).application_folder_id ||
                (responseData as any).visa_application_folder_id ||
                responseData.folder_id ||
                responseData.folderId;
            }

            // For client entities, also look for documents_received_folder_id
            let documentsReceivedFolderId: string | undefined;
            if (entityType === "client") {
              documentsReceivedFolderId =
                (dataObj as any).documents_received_folder_id ||
                (responseData as any).documents_received_folder_id;
              if (documentsReceivedFolderId) {
                console.log(`Extracted documents_received_folder_id: ${documentsReceivedFolderId}`);
              }
            }

            console.log(`Extracted folderId: ${folderId}`);

            if (folderId) {
              const table = entityType === "client" ? "clients" : "visa_applications";
              console.log(`Updating ${table} ${entityId} with folder_id: ${folderId}`);

              // Look up Drive connection to snapshot the email at folder-creation time
              const folderCompanyId = (hydratedData as any).company_id ?? (payload.data as any).company_id;
              let driveUpdateFields: Record<string, unknown> = {};
              if (folderCompanyId) {
                const { data: driveConn } = await supabase
                  .from("google_drive_connections")
                  .select("id, connected_email")
                  .eq("company_id", folderCompanyId)
                  .is("disconnected_at", null)
                  .maybeSingle();
                if (driveConn) {
                  driveUpdateFields = {
                    google_drive_connection_id: driveConn.id,
                    ...(entityType === "client" ? { drive_created_email: driveConn.connected_email } : {}),
                  };
                  console.log(`Drive snapshot: connection=${driveConn.id}, email=${driveConn.connected_email}`);
                }
              }

              const folderColumn = entityType === "client" ? "client_folder_id" : "visa_application_folder_id";
              const { data: updateData, error: updateError } = await supabase
                .from(table)
                .update({
                  [folderColumn]: folderId,
                  folder_status: "created",
                  folder_status_updated_at: new Date().toISOString(),
                  ...driveUpdateFields,
                  ...(documentsReceivedFolderId && entityType === "client"
                    ? { documents_received_folder_id: documentsReceivedFolderId }
                    : {}),
                })
                .eq("id", entityId)
                .select();

              if (updateError) {
                console.error(`Failed to update ${table} with folder_id:`, updateError);
              } else {
                console.log(`Successfully updated ${table} ${entityId} with folder_id. Updated rows:`, updateData?.length ?? 0);

                // Log automation event
                const eventType = entityType === "client" ? "client_folder_created" : "visa_application_folder_created";
                await supabase.from("automation_events").insert({
                  company_id: (hydratedData as any).company_id ?? (payload.data as any).company_id,
                  client_id: entityType === "client" ? entityId : (((hydratedData as any).client_id ?? (payload.data as any).client_id) || null),
                  visa_application_id: entityType === "visa_application" ? entityId : null,
                  event_type: eventType,
                  payload: {
                    folder_id: folderId,
                    source: "make_webhook_response",
                    timestamp: new Date().toISOString(),
                  },
                });
              }
            } else if (responseData.error) {
              // Mark as failed if Make returned an error
              const table = entityType === "client" ? "clients" : "visa_applications";
              await supabase.from(table).update({ folder_status: "failed" }).eq("id", entityId);

              console.error(`Make returned error for ${table} ${entityId}:`, responseData.error);
            } else {
              console.log(`No folder_id found in response for ${entityType} ${entityId}`);
            }
          } else {
            console.log(`Skipping folder update - missing: responseData=${!!responseData}, entityType=${entityType}, entityId=${entityId}`);
          }

          console.log(`Webhook ${webhook.name} succeeded after ${attempts} attempt(s):`, response.status);
          return { webhook_id: webhook.id, status: "success", attempts, folder_id: responseData?.folder_id };
        } catch (e) {
          await safeLogWebhookRequest(supabase, {
            endpoint: webhook.url,
            method: "POST",
            request_id: deliveryRequestId,
            status_code: 599,
            duration_ms: Date.now() - deliveryStartedAt,
            error_message: `${String(e)} ${contextSnippet}`.slice(0, 800),
          });
          throw e;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // If all webhooks failed and we have an entity, mark as failed
    if (failed === webhooks.length && entityType && entityId) {
      const table = entityType === "client" ? "clients" : "visa_applications";
      await supabase.from(table).update({ folder_status: "failed" }).eq("id", entityId);
    }

    console.log(`Webhook dispatch complete: ${successful} succeeded, ${failed} failed`);

    return await respondJson(200, {
      success: true,
      dispatched: successful,
      failed,
      total: webhooks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Dispatch webhook error:", error);
    return await respondJson(500, { error: "Internal server error", details: errorMessage }, errorMessage);
  }
});