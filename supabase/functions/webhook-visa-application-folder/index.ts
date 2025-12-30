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

interface WebhookData {
  visa_application_folder_id: string;
}

interface WebhookPayload {
  // Support both visa_application_id and legacy matter_id
  visa_application_id?: string;
  matter_id?: string;
  visa_application_folder_id?: string;
  data?: WebhookData;
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
  const ctx = createRequestContext(req, "webhook-visa-application-folder", clientIp);
  
  logRequestStart(ctx);

  const rateLimitResult = await checkRateLimit(supabase, clientIp, "webhook-visa-application-folder", RATE_LIMIT_CONFIG);

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

    // Extract visa_application_folder_id from nested data structure or top level
    const visaApplicationFolderId = payload.data?.visa_application_folder_id || payload.visa_application_folder_id;
    
    // Support both visa_application_id and legacy matter_id
    const visaApplicationId = payload.visa_application_id || payload.matter_id;

    if (!visaApplicationId || !visaApplicationFolderId) {
      logRequestEnd(ctx, 400, { reason: "missing_fields" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 400, errorMessage: "Missing required fields" }));
      return new Response(
        JSON.stringify({ error: "Missing required fields: visa_application_id and visa_application_folder_id", request_id: ctx.requestId }),
        { status: 400, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    const { data: visaApplication, error: updateError } = await supabase
      .from("visa_applications")
      .update({ 
        visa_application_folder_id: visaApplicationFolderId,
        folder_status: "created"
      })
      .eq("id", visaApplicationId)
      .select("id, company_id, client_id, application_name")
      .single();

    if (updateError) {
      logRequestError(ctx, updateError.message, { visa_application_id: visaApplicationId });
      logRequestEnd(ctx, 500, { reason: "update_failed" });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 500, errorMessage: updateError.message }));
      return new Response(
        JSON.stringify({ error: "Failed to update visa application", details: updateError.message, request_id: ctx.requestId }),
        { status: 500, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    if (!visaApplication) {
      logRequestEnd(ctx, 404, { reason: "application_not_found", visa_application_id: visaApplicationId });
      EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 404, errorMessage: "Visa application not found" }));
      return new Response(
        JSON.stringify({ error: "Visa application not found", request_id: ctx.requestId }),
        { status: 404, headers: addRequestIdHeader({ ...corsHeaders, "Content-Type": "application/json" }, ctx.requestId) }
      );
    }

    const { error: eventError } = await supabase
      .from("automation_events")
      .insert({
        company_id: visaApplication.company_id,
        client_id: visaApplication.client_id,
        visa_application_id: visaApplication.id,
        event_type: "visa_application_folder_created",
        payload: {
          visa_application_folder_id: visaApplicationFolderId,
          application_name: visaApplication.application_name,
          request_id: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      logRequestError(ctx, "Failed to log automation event: " + eventError.message);
    }

    logRequestEnd(ctx, 200, { visa_application_id: visaApplication.id });
    EdgeRuntime.waitUntil(saveRequestLog(supabase, { ctx, statusCode: 200 }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Visa application drive folder updated",
        visa_application_id: visaApplication.id,
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