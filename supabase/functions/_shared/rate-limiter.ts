import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 60,
};

/**
 * Checks rate limit for a given identifier and endpoint.
 * Uses Supabase database for distributed rate limiting.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  endpoint: string,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = { ...DEFAULT_CONFIG, ...config };
  
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("Rate limit check error:", error);
      // On error, allow the request but log the issue
      return {
        allowed: true,
        currentCount: 0,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
        retryAfterSeconds: 0,
      };
    }

    const result = data?.[0];
    if (!result) {
      return {
        allowed: true,
        currentCount: 0,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
        retryAfterSeconds: 0,
      };
    }

    const resetAt = new Date(result.reset_at);
    const retryAfterSeconds = result.allowed 
      ? 0 
      : Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

    return {
      allowed: result.allowed,
      currentCount: result.current_count,
      resetAt,
      retryAfterSeconds,
    };
  } catch (err) {
    console.error("Rate limit check exception:", err);
    // On exception, allow the request
    return {
      allowed: true,
      currentCount: 0,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Gets the client identifier from the request.
 * Uses X-Forwarded-For header, falling back to X-Real-IP or a default.
 */
export function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback for edge cases
  return "unknown";
}

/**
 * Creates rate limit headers for the response.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": maxRequests.toString(),
    "X-RateLimit-Remaining": Math.max(0, maxRequests - result.currentCount).toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt.getTime() / 1000).toString(),
    ...(result.retryAfterSeconds > 0 && {
      "Retry-After": result.retryAfterSeconds.toString(),
    }),
  };
}

/**
 * Creates a 429 Too Many Requests response with appropriate headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  maxRequests: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Please retry after ${result.retryAfterSeconds} seconds.`,
      retry_after: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...getRateLimitHeaders(result, maxRequests),
      },
    }
  );
}
