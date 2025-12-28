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
  maxRequests: 200,
  windowSeconds: 60,
};

interface AutomationEventPayload {
  company_id: string;
  client_id?: string;
  matter_id?: string;
  event_type: string;
  payload?: Record<string, unknown>;
}

const PII_FIELDS = new Set([
  'email', 'phone', 'phone_number', 'telephone', 'mobile', 'address', 'street',
  'city', 'zip', 'zipcode', 'postal_code', 'ssn', 'social_security', 'tax_id',
  'passport', 'driver_license', 'drivers_license', 'date_of_birth', 'dob',
  'birthdate', 'birth_date', 'credit_card', 'card_number', 'cvv', 'bank_account',
  'routing_number', 'password', 'secret', 'token', 'api_key', 'apikey',
  'access_token', 'refresh_token', 'private_key', 'ip_address', 'ip', 'user_agent',
]);

const ALLOWED_PAYLOAD_FIELDS = new Set([
  'event_source', 'event_category', 'action', 'status', 'result', 'count',
  'duration_ms', 'error_code', 'error_type', 'entity_type', 'entity_id',
  'previous_status', 'new_status', 'change_type', 'workflow_id', 'step_name',
  'timestamp', 'received_at', 'visa_application_folder_id', 'matter_name', 'client_name',
  'folder_name', 'request_id',
]);

function sanitizePayload(payload: Record<string, unknown> | undefined, depth = 0): Record<string, unknown> {
  if (!payload || depth > 2) return {};

  const sanitized: Record<string, unknown> = {};
  const maxStringLength = 200;
  const maxArrayLength = 10;

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (PII_FIELDS.has(lowerKey)) continue;
    if (depth === 0 && !ALLOWED_PAYLOAD_FIELDS.has(lowerKey)) continue;

    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'string') {
      sanitized[key] = value.length > maxStringLength ? value.substring(0, maxStringLength) + '...[truncated]' : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, maxArrayLength).map(item => {
        if (typeof item === 'object' && item !== null) return sanitizePayload(item as Record<string, unknown>, depth + 1);
        if (typeof item === 'string' && item.length > maxStringLength) return item.substring(0, maxStringLength) + '...[truncated]';
        return item;
      });
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizePayload(value as Record<string, unknown>, depth + 1);
    }
  }
  return sanitized;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const clientIp = getClientIdentifier(req);
  const ctx = createRequestContext(req, "webhook-automation-event", clientIp);
  
  logRequestStart(ctx);

  const rateLimitResult = await checkRateLimit(supabase, clientIp, "webhook-automation-event", RATE_LIMIT_CONFIG);

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

    const eventData: AutomationEventPayload = await req.json();

    if (!eventData.company_id || !eventData.event_type) {
      logRequestEnd(ctx, 400, { reason: "missing_fields" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 400, errorMessage: "Missing required fields" }));
      return new Response(
        JSON.stringify({ error: "Missing required fields: company_id and event_type", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (eventData.event_type.length > 100) {
      logRequestEnd(ctx, 400, { reason: "event_type_too_long" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 400, errorMessage: "event_type too long" }));
      return new Response(
        JSON.stringify({ error: "event_type must be less than 100 characters", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(eventData.event_type)) {
      logRequestEnd(ctx, 400, { reason: "invalid_event_type_format" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 400, errorMessage: "Invalid event_type format" }));
      return new Response(
        JSON.stringify({ error: "event_type must contain only alphanumeric characters, underscores, dots, and hyphens", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", eventData.company_id)
      .maybeSingle();

    if (companyError) {
      logRequestError(ctx, companyError.message);
      logRequestEnd(ctx, 500, { reason: "company_lookup_failed" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 500, errorMessage: companyError.message }));
      return new Response(
        JSON.stringify({ error: "Failed to verify company", request_id: ctx.requestId }),
        { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (!company) {
      logRequestEnd(ctx, 404, { reason: "company_not_found" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 404, errorMessage: "Company not found" }));
      return new Response(
        JSON.stringify({ error: "Company not found", request_id: ctx.requestId }),
        { status: 404, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    const sanitizedPayload = sanitizePayload(eventData.payload);
    const finalPayload = { ...sanitizedPayload, request_id: ctx.requestId, received_at: new Date().toISOString() };

    const { data: event, error: insertError } = await supabase
      .from("automation_events")
      .insert({
        company_id: eventData.company_id,
        client_id: eventData.client_id || null,
        matter_id: eventData.matter_id || null,
        event_type: eventData.event_type,
        payload: finalPayload,
      })
      .select("id")
      .single();

    if (insertError) {
      logRequestError(ctx, insertError.message);
      logRequestEnd(ctx, 500, { reason: "insert_failed" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 500, errorMessage: insertError.message }));
      return new Response(
        JSON.stringify({ error: "Failed to log event", request_id: ctx.requestId }),
        { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    logRequestEnd(ctx, 200, { event_id: event.id, event_type: eventData.event_type });
    EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 200 }));

    return new Response(
      JSON.stringify({ success: true, message: "Automation event logged", event_id: event.id, request_id: ctx.requestId }),
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