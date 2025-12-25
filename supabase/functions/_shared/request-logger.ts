import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RequestLogContext {
  requestId: string;
  endpoint: string;
  method: string;
  clientIp: string;
  userAgent?: string;
  startTime: number;
}

interface LogRequestParams {
  ctx: RequestLogContext;
  statusCode: number;
  errorMessage?: string;
  rateLimited?: boolean;
}

/**
 * Generates a unique request ID for tracking.
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Creates a request log context for tracking and logging.
 */
export function createRequestContext(
  req: Request,
  endpoint: string,
  clientIp: string
): RequestLogContext {
  return {
    requestId: generateRequestId(),
    endpoint,
    method: req.method,
    clientIp,
    userAgent: req.headers.get("user-agent") || undefined,
    startTime: Date.now(),
  };
}

/**
 * Logs the start of a request to console.
 */
export function logRequestStart(ctx: RequestLogContext, additionalInfo?: Record<string, unknown>): void {
  console.log(JSON.stringify({
    level: "info",
    type: "request_start",
    request_id: ctx.requestId,
    endpoint: ctx.endpoint,
    method: ctx.method,
    client_ip: ctx.clientIp,
    user_agent: ctx.userAgent,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  }));
}

/**
 * Logs the end of a request to console.
 */
export function logRequestEnd(
  ctx: RequestLogContext,
  statusCode: number,
  additionalInfo?: Record<string, unknown>
): void {
  const durationMs = Date.now() - ctx.startTime;
  console.log(JSON.stringify({
    level: statusCode >= 400 ? "error" : "info",
    type: "request_end",
    request_id: ctx.requestId,
    endpoint: ctx.endpoint,
    method: ctx.method,
    status_code: statusCode,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  }));
}

/**
 * Logs an error during request processing to console.
 */
export function logRequestError(
  ctx: RequestLogContext,
  error: Error | string,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(JSON.stringify({
    level: "error",
    type: "request_error",
    request_id: ctx.requestId,
    endpoint: ctx.endpoint,
    error_message: errorMessage,
    error_stack: errorStack,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  }));
}

/**
 * Adds request ID header to response headers.
 */
export function addRequestIdHeader(
  headers: Record<string, string>,
  requestId: string
): Record<string, string> {
  return {
    ...headers,
    "X-Request-Id": requestId,
  };
}

/**
 * Saves request log to database for monitoring dashboard.
 * This is a fire-and-forget operation - errors are logged but don't affect the response.
 */
export async function saveRequestLog(
  supabase: SupabaseClient,
  params: LogRequestParams
): Promise<void> {
  const { ctx, statusCode, errorMessage, rateLimited } = params;
  const durationMs = Date.now() - ctx.startTime;

  try {
    const { error } = await supabase
      .from("webhook_request_logs")
      .insert({
        request_id: ctx.requestId,
        endpoint: ctx.endpoint,
        method: ctx.method,
        status_code: statusCode,
        client_ip: ctx.clientIp,
        user_agent: ctx.userAgent,
        duration_ms: durationMs,
        error_message: errorMessage,
        rate_limited: rateLimited || false,
      });

    if (error) {
      console.error("Failed to save request log:", error.message);
    }
  } catch (err) {
    console.error("Error saving request log:", err);
  }
}
