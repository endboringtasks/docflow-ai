-- Add included_fields column to platform_webhooks table
-- This stores which optional fields should be included in webhook payloads
-- NULL or empty array means use default minimal fields only
ALTER TABLE public.platform_webhooks 
ADD COLUMN IF NOT EXISTS included_fields text[] DEFAULT '{}'::text[];