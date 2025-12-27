-- Add retry configuration columns to platform_webhooks table
ALTER TABLE public.platform_webhooks 
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS retry_backoff_seconds integer DEFAULT 5;

-- Add comment for documentation
COMMENT ON COLUMN public.platform_webhooks.max_retries IS 'Maximum number of retry attempts for failed webhook deliveries (0-10)';
COMMENT ON COLUMN public.platform_webhooks.retry_backoff_seconds IS 'Base backoff time in seconds between retries, doubles each attempt (5-60)';