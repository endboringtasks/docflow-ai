-- Drop the existing function and recreate with folder_status
DROP FUNCTION IF EXISTS public.get_clients_secure(uuid);

CREATE FUNCTION public.get_clients_secure(p_company_id uuid)
RETURNS TABLE(
  id uuid,
  company_id uuid,
  client_type text,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  drive_folder_id text,
  folder_status text,
  created_at timestamp with time zone
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
    c.folder_status,
    c.created_at
  FROM public.clients c
  WHERE c.company_id = p_company_id
    AND public.is_company_member(auth.uid(), p_company_id)
  ORDER BY c.created_at DESC;
$$;