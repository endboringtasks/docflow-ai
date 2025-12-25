-- Drop the security definer view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.webhook_hourly_stats;

CREATE OR REPLACE VIEW public.webhook_hourly_stats
WITH (security_invoker = true) AS
SELECT 
  date_trunc('hour', created_at) as hour,
  endpoint,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
  COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as client_error_count,
  COUNT(*) FILTER (WHERE status_code >= 500) as server_error_count,
  COUNT(*) FILTER (WHERE rate_limited = true) as rate_limited_count,
  AVG(duration_ms)::integer as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM public.webhook_request_logs
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY date_trunc('hour', created_at), endpoint
ORDER BY hour DESC;