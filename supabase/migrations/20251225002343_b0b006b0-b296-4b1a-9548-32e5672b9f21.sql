-- Remove direct SELECT access to google_drive_connections table
-- This prevents any client-side access to tokens, even for admins
DROP POLICY IF EXISTS "Admins can view drive connections" ON public.google_drive_connections;

-- Create a SECURITY DEFINER function that returns only safe fields
-- This function checks admin/owner status but never exposes tokens
CREATE OR REPLACE FUNCTION public.get_drive_connection_status(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  connected_by uuid,
  connected_email text,
  root_folder_id text,
  root_folder_name text,
  token_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    gdc.id,
    gdc.company_id,
    gdc.connected_by,
    gdc.connected_email,
    gdc.root_folder_id,
    gdc.root_folder_name,
    gdc.token_expires_at,
    gdc.created_at,
    gdc.updated_at
  FROM public.google_drive_connections gdc
  WHERE gdc.company_id = p_company_id
    AND public.is_company_admin_or_owner(auth.uid(), p_company_id)
$$;

-- Add comment explaining security model
COMMENT ON FUNCTION public.get_drive_connection_status IS 'Secure function to get Drive connection status without exposing OAuth tokens. Tokens are only accessible via service role (edge functions).';