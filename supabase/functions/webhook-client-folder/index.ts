import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateWebhookSecret } from "../_shared/timing-safe-compare.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getRateLimitHeaders } from "../_shared/rate-limiter.ts";
import { createRequestContext, logRequestStart, logRequestEnd, logRequestError, addRequestIdHeader } from "../_shared/request-logger.ts";

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
  drive_folder_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client early for rate limiting
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get client identifier and create request context
  const clientIp = getClientIdentifier(req);
  const ctx = createRequestContext(req, "webhook-client-folder", clientIp);
  
  logRequestStart(ctx);

  // Check rate limit
  const rateLimitResult = await checkRateLimit(
    supabase,
    clientIp,
    "webhook-client-folder",
    RATE_LIMIT_CONFIG
  );

  if (!rateLimitResult.allowed) {
    logRequestEnd(ctx, 429, { reason: "rate_limit_exceeded" });
    const response = createRateLimitResponse(rateLimitResult, RATE_LIMIT_CONFIG.maxRequests, corsHeaders);
    return new Response(response.body, {
      status: response.status,
      headers: addRequestIdHeader(Object.fromEntries(response.headers.entries()), ctx.requestId),
    });
  }

  try {
    // Validate webhook secret using constant-time comparison
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    if (!validateWebhookSecret(webhookSecret, expectedSecret)) {
      logRequestEnd(ctx, 401, { reason: "invalid_secret" });
      return new Response(
        JSON.stringify({ error: "Unauthorized", request_id: ctx.requestId }),
        { status: 401, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    // Parse request body
    const payload: WebhookPayload = await req.json();

    // Validate required fields
    if (!payload.client_id || !payload.drive_folder_id) {
      logRequestEnd(ctx, 400, { reason: "missing_fields" });
      return new Response(
        JSON.stringify({ error: "Missing required fields: client_id and drive_folder_id", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    // Update the client with the drive folder ID
    const { data: client, error: updateError } = await supabase
      .from("clients")
      .update({ drive_folder_id: payload.drive_folder_id })
      .eq("id", payload.client_id)
      .select("id, company_id, client_type, first_name, last_name, company_name")
      .single();

    if (updateError) {
      logRequestError(ctx, updateError.message, { client_id: payload.client_id });
      logRequestEnd(ctx, 500, { reason: "update_failed" });
      return new Response(
        JSON.stringify({ error: "Failed to update client", details: updateError.message, request_id: ctx.requestId }),
        { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (!client) {
      logRequestEnd(ctx, 404, { reason: "client_not_found", client_id: payload.client_id });
      return new Response(
        JSON.stringify({ error: "Client not found", request_id: ctx.requestId }),
        { status: 404, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    // Get client display name based on type
    const clientName = client.client_type === "corporate" 
      ? (client.company_name || "Unnamed Company")
      : (client.last_name ? `${client.first_name} ${client.last_name}` : (client.first_name || "Unnamed Client"));

    // Log the automation event
    const { error: eventError } = await supabase
      .from("automation_events")
      .insert({
        company_id: client.company_id,
        client_id: client.id,
        event_type: "client_folder_created",
        payload: {
          drive_folder_id: payload.drive_folder_id,
          client_name: clientName,
          request_id: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      logRequestError(ctx, "Failed to log automation event: " + eventError.message);
    }

    logRequestEnd(ctx, 200, { client_id: client.id });

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
    return new Response(
      JSON.stringify({ error: "Internal server error", request_id: ctx.requestId }),
      { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
    );
  }
});