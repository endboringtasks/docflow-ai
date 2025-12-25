import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateWebhookSecret } from "../_shared/timing-safe-compare.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getRateLimitHeaders } from "../_shared/rate-limiter.ts";

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

// List of PII field names to strip from payloads (case-insensitive)
const PII_FIELDS = new Set([
  'email',
  'phone',
  'phone_number',
  'telephone',
  'mobile',
  'address',
  'street',
  'city',
  'zip',
  'zipcode',
  'postal_code',
  'ssn',
  'social_security',
  'tax_id',
  'passport',
  'driver_license',
  'drivers_license',
  'date_of_birth',
  'dob',
  'birthdate',
  'birth_date',
  'credit_card',
  'card_number',
  'cvv',
  'bank_account',
  'routing_number',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'private_key',
  'ip_address',
  'ip',
  'user_agent',
]);

// Allowed payload fields - only these will be stored
const ALLOWED_PAYLOAD_FIELDS = new Set([
  'event_source',
  'event_category',
  'action',
  'status',
  'result',
  'count',
  'duration_ms',
  'error_code',
  'error_type',
  'entity_type',
  'entity_id',
  'previous_status',
  'new_status',
  'change_type',
  'workflow_id',
  'step_name',
  'timestamp',
  'received_at',
  'drive_folder_id',
  'matter_name',
  'client_name',
  'folder_name',
]);

/**
 * Sanitizes payload by:
 * 1. Removing any PII fields
 * 2. Only allowing whitelisted fields
 * 3. Truncating string values to prevent large data storage
 * 4. Limiting nested depth
 */
function sanitizePayload(
  payload: Record<string, unknown> | undefined,
  depth: number = 0
): Record<string, unknown> {
  if (!payload || depth > 2) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  const maxStringLength = 200;
  const maxArrayLength = 10;

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    
    // Skip PII fields
    if (PII_FIELDS.has(lowerKey)) {
      console.log(`Stripped PII field from payload: ${key}`);
      continue;
    }

    // Only allow whitelisted fields at the top level
    if (depth === 0 && !ALLOWED_PAYLOAD_FIELDS.has(lowerKey)) {
      console.log(`Stripped non-whitelisted field from payload: ${key}`);
      continue;
    }

    // Handle different value types
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'string') {
      // Truncate long strings
      sanitized[key] = value.length > maxStringLength 
        ? value.substring(0, maxStringLength) + '...[truncated]' 
        : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      // Limit array size and sanitize each element
      sanitized[key] = value.slice(0, maxArrayLength).map(item => {
        if (typeof item === 'object' && item !== null) {
          return sanitizePayload(item as Record<string, unknown>, depth + 1);
        }
        if (typeof item === 'string' && item.length > maxStringLength) {
          return item.substring(0, maxStringLength) + '...[truncated]';
        }
        return item;
      });
    } else if (typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizePayload(value as Record<string, unknown>, depth + 1);
    }
  }

  return sanitized;
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

  // Check rate limit
  const clientId = getClientIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    supabase,
    clientId,
    "webhook-automation-event",
    RATE_LIMIT_CONFIG
  );

  if (!rateLimitResult.allowed) {
    console.warn(`Rate limit exceeded for ${clientId} on webhook-automation-event`);
    return createRateLimitResponse(rateLimitResult, RATE_LIMIT_CONFIG.maxRequests, corsHeaders);
  }

  try {
    // Validate webhook secret using constant-time comparison
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    if (!validateWebhookSecret(webhookSecret, expectedSecret)) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const eventData: AutomationEventPayload = await req.json();
    console.log("Received automation event:", { 
      company_id: eventData.company_id,
      event_type: eventData.event_type,
      client_id: eventData.client_id,
      matter_id: eventData.matter_id,
      // Don't log raw payload to prevent PII in logs
      payload_keys: eventData.payload ? Object.keys(eventData.payload) : []
    });

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

    // Validate event_type format (alphanumeric with underscores/dots)
    if (!/^[a-zA-Z0-9_.-]+$/.test(eventData.event_type)) {
      return new Response(
        JSON.stringify({ error: "event_type must contain only alphanumeric characters, underscores, dots, and hyphens" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Sanitize the payload to remove PII
    const sanitizedPayload = sanitizePayload(eventData.payload);
    
    // Add metadata
    const finalPayload = {
      ...sanitizedPayload,
      received_at: new Date().toISOString(),
    };

    console.log("Sanitized payload:", finalPayload);

    // Insert the automation event
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
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          ...getRateLimitHeaders(rateLimitResult, RATE_LIMIT_CONFIG.maxRequests),
        } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});