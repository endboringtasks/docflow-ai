
DROP FUNCTION IF EXISTS public.get_drive_connection_status(uuid);

CREATE FUNCTION public.get_drive_connection_status(p_company_id uuid)
 RETURNS TABLE(id uuid, company_id uuid, connected_by uuid, connected_email text, root_folder_id text, root_folder_name text, token_expires_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, disconnected_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    gdc.id,
    gdc.company_id,
    gdc.connected_by,
    gdc.connected_email,
    gdc.root_folder_id,
    gdc.root_folder_name,
    gdc.token_expires_at,
    gdc.created_at,
    gdc.updated_at,
    gdc.disconnected_at
  FROM public.google_drive_connections gdc
  WHERE gdc.company_id = p_company_id
    AND public.is_company_admin_or_owner(auth.uid(), p_company_id)
$function$;
