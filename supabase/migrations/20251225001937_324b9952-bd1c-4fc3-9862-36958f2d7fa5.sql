-- Fix security definer warnings by explicitly setting SECURITY INVOKER
-- This ensures views use the permissions of the querying user (correct behavior)

ALTER VIEW public.clients_secure SET (security_invoker = on);
ALTER VIEW public.google_drive_connections_secure SET (security_invoker = on);
ALTER VIEW public.platform_webhooks_secure SET (security_invoker = on);
ALTER VIEW public.platform_settings_secure SET (security_invoker = on);