-- Drop the deprecated secure views since we now use RPC functions
DROP VIEW IF EXISTS public.clients_secure;
DROP VIEW IF EXISTS public.google_drive_connections_secure;
DROP VIEW IF EXISTS public.platform_webhooks_secure;
DROP VIEW IF EXISTS public.platform_settings_secure;

-- Add SELECT policy for company members on clients table
CREATE POLICY "Members can view their company clients"
ON public.clients FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));