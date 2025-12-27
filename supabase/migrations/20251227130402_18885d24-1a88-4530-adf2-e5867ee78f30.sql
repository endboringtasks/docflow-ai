-- Enable RLS on the webhook_hourly_stats view
-- Note: Views don't support RLS directly, so we need to recreate it as a security definer function
-- or add a policy through the underlying table

-- First, check if it's a view and drop it
DROP VIEW IF EXISTS public.webhook_hourly_stats;

-- Recreate as a security definer function that only platform admins can call
CREATE OR REPLACE FUNCTION public.get_webhook_hourly_stats()
RETURNS TABLE (
  hour timestamp with time zone,
  endpoint text,
  total_requests bigint,
  success_count bigint,
  client_error_count bigint,
  server_error_count bigint,
  rate_limited_count bigint,
  avg_duration_ms integer,
  max_duration_ms integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    date_trunc('hour', created_at) as hour,
    endpoint,
    count(*) as total_requests,
    count(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
    count(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as client_error_count,
    count(*) FILTER (WHERE status_code >= 500) as server_error_count,
    count(*) FILTER (WHERE rate_limited = true) as rate_limited_count,
    avg(duration_ms)::integer as avg_duration_ms,
    max(duration_ms) as max_duration_ms
  FROM public.webhook_request_logs
  WHERE public.is_platform_admin(auth.uid())
  GROUP BY date_trunc('hour', created_at), endpoint
  ORDER BY hour DESC;
$$;