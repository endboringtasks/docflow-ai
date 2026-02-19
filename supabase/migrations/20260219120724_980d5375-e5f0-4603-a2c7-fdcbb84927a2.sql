
-- 1. Add drive_created_email column
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS drive_created_email text;

-- 2. Update get_clients_secure RPC to prefer snapshot email
CREATE OR REPLACE FUNCTION public.get_clients_secure(p_company_id uuid)
 RETURNS TABLE(id uuid, company_id uuid, client_type text, first_name text, last_name text, company_name text, email text, phone text, client_folder_id text, folder_status text, created_at timestamp with time zone, drive_connected_email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    c.id,
    c.company_id,
    c.client_type::text,
    c.first_name,
    c.last_name,
    c.company_name,
    CASE 
      WHEN public.is_company_admin_or_owner(auth.uid(), c.company_id) THEN c.email
      ELSE NULL
    END as email,
    CASE 
      WHEN public.is_company_admin_or_owner(auth.uid(), c.company_id) THEN c.phone
      ELSE NULL
    END as phone,
    c.client_folder_id,
    c.folder_status,
    c.created_at,
    COALESCE(c.drive_created_email, gdc.connected_email) as drive_connected_email
  FROM public.clients c
  LEFT JOIN public.google_drive_connections gdc 
    ON gdc.id = c.google_drive_connection_id
  WHERE c.company_id = p_company_id
    AND public.is_company_member(auth.uid(), p_company_id)
  ORDER BY c.created_at DESC;
$function$;

-- 3. Backfill existing clients (best effort)
UPDATE clients c
SET drive_created_email = gdc.connected_email
FROM google_drive_connections gdc
WHERE gdc.company_id = c.company_id
  AND c.client_folder_id IS NOT NULL
  AND c.drive_created_email IS NULL;
