-- Drop and recreate get_portal_documents to include applicant_type
DROP FUNCTION IF EXISTS public.get_portal_documents(text);

CREATE FUNCTION public.get_portal_documents(p_token text)
 RETURNS TABLE(id uuid, document_name text, is_completed boolean, file_path text, description text, category text, applicant_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    dc.id,
    dc.document_name,
    dc.is_completed,
    dc.file_path,
    dc.description,
    dc.category,
    dc.applicant_type
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  ORDER BY dc.applicant_type NULLS LAST, dc.category NULLS LAST, dc.document_name;
$function$;