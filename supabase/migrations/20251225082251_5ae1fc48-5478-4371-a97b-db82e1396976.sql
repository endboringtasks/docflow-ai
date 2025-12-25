-- Create rate limiting table for webhook endpoints
CREATE TABLE public.webhook_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for efficient upserts
CREATE UNIQUE INDEX idx_rate_limits_identifier_endpoint 
ON public.webhook_rate_limits (identifier, endpoint);

-- Create index for cleanup queries
CREATE INDEX idx_rate_limits_window_start 
ON public.webhook_rate_limits (window_start);

-- Enable RLS (but allow service role full access)
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table

-- Create function to clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webhook_rate_limits 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to check and increment rate limit atomically
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  reset_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Try to insert or update the rate limit record
  INSERT INTO public.webhook_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, now())
  ON CONFLICT (identifier, endpoint) DO UPDATE
  SET 
    request_count = CASE 
      WHEN webhook_rate_limits.window_start < v_window_start THEN 1
      ELSE webhook_rate_limits.request_count + 1
    END,
    window_start = CASE 
      WHEN webhook_rate_limits.window_start < v_window_start THEN now()
      ELSE webhook_rate_limits.window_start
    END
  RETURNING 
    webhook_rate_limits.request_count,
    webhook_rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL
  INTO v_current_count, v_reset_at;
  
  RETURN QUERY SELECT 
    v_current_count <= p_max_requests AS allowed,
    v_current_count AS current_count,
    v_reset_at AS reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;