ALTER TABLE public.platform_webhooks
  ADD COLUMN IF NOT EXISTS delivery_timeout_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_backoff_seconds integer;

ALTER TABLE public.webhook_request_logs
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS will_retry boolean,
  ADD COLUMN IF NOT EXISTS final_state text;