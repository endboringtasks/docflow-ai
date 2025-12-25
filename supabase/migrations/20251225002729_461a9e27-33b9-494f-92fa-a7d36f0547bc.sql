-- Remove direct SELECT access to clients table
-- Members can still INSERT/UPDATE clients but cannot directly query all data
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Members can view clients with matters" ON public.clients;

-- Create a SECURITY DEFINER function that masks PII for non-admins
CREATE OR REPLACE FUNCTION public.get_clients_secure(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  client_type text,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  drive_folder_id text,
  created_at timestamptz
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.company_id,
    c.client_type::text,
    c.first_name,
    c.last_name,
    c.company_name,
    -- Mask email and phone for non-admins
    CASE 
      WHEN public.is_company_admin_or_owner(auth.uid(), c.company_id) THEN c.email
      ELSE NULL
    END as email,
    CASE 
      WHEN public.is_company_admin_or_owner(auth.uid(), c.company_id) THEN c.phone
      ELSE NULL
    END as phone,
    c.drive_folder_id,
    c.created_at
  FROM public.clients c
  WHERE c.company_id = p_company_id
    AND public.is_company_member(auth.uid(), p_company_id)
  ORDER BY c.created_at DESC
$$;

-- Create a function to get a single client by ID (also with PII masking)
CREATE OR REPLACE FUNCTION public.get_client_by_id(p_client_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  client_type text,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  drive_folder_id text,
  created_at timestamptz
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.company_id,
    c.client_type::text,
    c.first_name,
    c.last_name,
    c.company_name,
    -- Mask email and phone for non-admins
    CASE 
      WHEN public.is_company_admin_or_owner(auth.uid(), c.company_id) THEN c.email
      ELSE NULL
    END as email,
    CASE 
      WHEN public.is_company_admin_or_owner(auth.uid(), c.company_id) THEN c.phone
      ELSE NULL
    END as phone,
    c.drive_folder_id,
    c.created_at
  FROM public.clients c
  WHERE c.id = p_client_id
    AND public.is_company_member(auth.uid(), c.company_id)
$$;

-- Add comments
COMMENT ON FUNCTION public.get_clients_secure IS 'Secure function to get clients with PII masked for non-admin users';
COMMENT ON FUNCTION public.get_client_by_id IS 'Secure function to get a single client with PII masked for non-admin users';