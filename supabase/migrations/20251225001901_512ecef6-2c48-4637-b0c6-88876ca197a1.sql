-- 1. Create secure view for clients that masks PII for non-admins
CREATE OR REPLACE VIEW public.clients_secure AS
SELECT 
  id,
  company_id,
  client_type,
  first_name,
  last_name,
  company_name,
  CASE 
    WHEN is_company_admin_or_owner(auth.uid(), company_id) THEN email
    ELSE NULL
  END as email,
  CASE 
    WHEN is_company_admin_or_owner(auth.uid(), company_id) THEN phone
    ELSE NULL
  END as phone,
  drive_folder_id,
  created_at
FROM public.clients;

-- 2. Create secure view for google_drive_connections that hides tokens
-- Edge functions use service role and can still access the base table
CREATE OR REPLACE VIEW public.google_drive_connections_secure AS
SELECT 
  id,
  company_id,
  connected_by,
  connected_email,
  root_folder_id,
  root_folder_name,
  token_expires_at,
  created_at,
  updated_at
  -- access_token and refresh_token deliberately excluded
FROM public.google_drive_connections;

-- 3. Create secure view for platform_webhooks that hides secret keys
CREATE OR REPLACE VIEW public.platform_webhooks_secure AS
SELECT 
  id,
  name,
  url,
  events,
  is_active,
  created_by,
  created_at,
  updated_at
  -- secret_key deliberately excluded
FROM public.platform_webhooks;

-- 4. Create secure view for platform_settings that redacts secret values
CREATE OR REPLACE VIEW public.platform_settings_secure AS
SELECT 
  id,
  key,
  CASE 
    WHEN is_secret THEN '{"redacted": true}'::jsonb
    ELSE value
  END as value,
  is_secret,
  description,
  updated_by,
  updated_at
FROM public.platform_settings;

-- Add comments explaining the security model
COMMENT ON VIEW public.clients_secure IS 'Secure view that masks email/phone for non-admin users';
COMMENT ON VIEW public.google_drive_connections_secure IS 'Secure view that excludes OAuth tokens - use base table via service role for token access';
COMMENT ON VIEW public.platform_webhooks_secure IS 'Secure view that excludes webhook secret keys';
COMMENT ON VIEW public.platform_settings_secure IS 'Secure view that redacts values when is_secret=true';