-- Create webhook request logs table for detailed monitoring
CREATE TABLE public.webhook_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  status_code INTEGER NOT NULL,
  client_ip TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  rate_limited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_request_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_endpoint ON public.webhook_request_logs (endpoint);
CREATE INDEX idx_webhook_logs_status_code ON public.webhook_request_logs (status_code);
CREATE INDEX idx_webhook_logs_request_id ON public.webhook_request_logs (request_id);

-- Enable RLS
ALTER TABLE public.webhook_request_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view logs
CREATE POLICY "Platform admins can view webhook logs"
ON public.webhook_request_logs
FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Create a view for hourly stats aggregation
CREATE OR REPLACE VIEW public.webhook_hourly_stats AS
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