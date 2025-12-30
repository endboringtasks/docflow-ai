import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateWebhookSecret } from "../_shared/timing-safe-compare.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getRateLimitHeaders } from "../_shared/rate-limiter.ts";
import { createRequestContext, logRequestStart, logRequestEnd, logRequestError, addRequestIdHeader, saveRequestLog } from "../_shared/request-logger.ts";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const RATE_LIMIT_CONFIG = {
  maxRequests: 100,
  windowSeconds: 60,
};

interface WebhookPayload {
  client_id: string;
  client_folder_id: string;
  documents_received_folder_id?: string;
  // Accept both for flexibility - organization_id is the preferred external name
  company_id?: string;
  organization_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const clientIp = getClientIdentifier(req);
  const ctx = createRequestContext(req, "webhook-client-folder", clientIp);
  
  logRequestStart(ctx);

  const rateLimitResult = await checkRateLimit(supabase, clientIp, "webhook-client-folder", RATE_LIMIT_CONFIG);

  if (!rateLimitResult.allowed) {
    logRequestEnd(ctx, 429, { reason: "rate_limit_exceeded" });
    EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 429, rateLimited: true }));
    const response = createRateLimitResponse(rateLimitResult, RATE_LIMIT_CONFIG.maxRequests, corsHeaders);
    return new Response(response.body, {
      status: response.status,
      headers: addRequestIdHeader(Object.fromEntries(response.headers.entries()), ctx.requestId),
    });
  }

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    if (!validateWebhookSecret(webhookSecret, expectedSecret)) {
      logRequestEnd(ctx, 401, { reason: "invalid_secret" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 401, errorMessage: "Invalid webhook secret" }));
      return new Response(
        JSON.stringify({ error: "Unauthorized", request_id: ctx.requestId }),
        { status: 401, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    const payload: WebhookPayload = await req.json();

    if (!payload.client_id || !payload.client_folder_id) {
      logRequestEnd(ctx, 400, { reason: "missing_fields" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 400, errorMessage: "Missing required fields" }));
      return new Response(
        JSON.stringify({ error: "Missing required fields: client_id and client_folder_id", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    // Build update object - map client_folder_id to drive_folder_id column
    const updateData: { drive_folder_id: string; documents_received_folder_id?: string } = {
      drive_folder_id: payload.client_folder_id,
    };
    if (payload.documents_received_folder_id) {
      updateData.documents_received_folder_id = payload.documents_received_folder_id;
    }

    const { data: client, error: updateError } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", payload.client_id)
      .select("id, company_id, client_type, first_name, last_name, company_name")
      .single();

    if (updateError) {
      logRequestError(ctx, updateError.message, { client_id: payload.client_id });
      logRequestEnd(ctx, 500, { reason: "update_failed" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 500, errorMessage: updateError.message }));
      return new Response(
        JSON.stringify({ error: "Failed to update client", details: updateError.message, request_id: ctx.requestId }),
        { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (!client) {
      logRequestEnd(ctx, 404, { reason: "client_not_found", client_id: payload.client_id });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 404, errorMessage: "Client not found" }));
      return new Response(
        JSON.stringify({ error: "Client not found", request_id: ctx.requestId }),
        { status: 404, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    const clientName = client.client_type === "corporate" 
      ? (client.company_name || "Unnamed Company")
      : (client.last_name ? `${client.first_name} ${client.last_name}` : (client.first_name || "Unnamed Client"));

    const { error: eventError } = await supabase
      .from("automation_events")
      .insert({
        company_id: client.company_id,
        client_id: client.id,
        event_type: "client_folder_created",
        payload: {
          client_folder_id: payload.client_folder_id,
          client_name: clientName,
          request_id: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      logRequestError(ctx, "Failed to log automation event: " + eventError.message);
    }

    logRequestEnd(ctx, 200, { client_id: client.id });
    EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 200 }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Client drive folder updated",
        client_id: client.id,
        request_id: ctx.requestId,
      }),
      { 
        status: 200, 
        headers: addRequestIdHeader({
          ...corsHeaders, 
          "Content-Type": "application/json",
          ...getRateLimitHeaders(rateLimitResult, RATE_LIMIT_CONFIG.maxRequests),
        }, ctx.requestId)
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logRequestError(ctx, error instanceof Error ? error : errorMessage);
    logRequestEnd(ctx, 500, { reason: "internal_error" });
    EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 500, errorMessage }));
    return new Response(
      JSON.stringify({ error: "Internal server error", request_id: ctx.requestId }),
      { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
    );
  }
});