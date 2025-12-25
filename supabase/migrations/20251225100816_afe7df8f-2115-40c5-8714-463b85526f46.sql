-- Add timeout_seconds column to platform_webhooks
ALTER TABLE public.platform_webhooks 
ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 10;

-- Add comment
COMMENT ON COLUMN public.platform_webhooks.timeout_seconds IS 'Timeout in seconds before marking folder creation as failed. Default is 10 seconds.';