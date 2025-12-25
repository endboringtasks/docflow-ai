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
  matter_id: string;
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
  const ctx = createRequestContext(req, "webhook-matter-folder", clientIp);
  
  logRequestStart(ctx);

  // Check rate limit
  const rateLimitResult = await checkRateLimit(
    supabase,
    clientIp,
    "webhook-matter-folder",
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
    if (!payload.matter_id || !payload.drive_folder_id) {
      logRequestEnd(ctx, 400, { reason: "missing_fields" });
      return new Response(
        JSON.stringify({ error: "Missing required fields: matter_id and drive_folder_id", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    // Update the matter with the drive folder ID
    const { data: matter, error: updateError } = await supabase
      .from("matters")
      .update({ drive_folder_id: payload.drive_folder_id })
      .eq("id", payload.matter_id)
      .select("id, company_id, client_id, matter_name")
      .single();

    if (updateError) {
      logRequestError(ctx, updateError.message, { matter_id: payload.matter_id });
      logRequestEnd(ctx, 500, { reason: "update_failed" });
      return new Response(
        JSON.stringify({ error: "Failed to update matter", details: updateError.message, request_id: ctx.requestId }),
        { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (!matter) {
      logRequestEnd(ctx, 404, { reason: "matter_not_found", matter_id: payload.matter_id });
      return new Response(
        JSON.stringify({ error: "Matter not found", request_id: ctx.requestId }),
        { status: 404, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
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
          request_id: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      logRequestError(ctx, "Failed to log automation event: " + eventError.message);
    }

    logRequestEnd(ctx, 200, { matter_id: matter.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Matter drive folder updated",
        matter_id: matter.id,
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