-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS public.validate_portal_access_token(text);

-- Recreate with visa_application_id instead of matter_id
CREATE OR REPLACE FUNCTION public.validate_portal_access_token(p_token text)
 RETURNS TABLE(id uuid, client_id uuid, visa_application_id uuid, company_id uuid, email text, is_submitted boolean, submitted_at timestamp with time zone, last_accessed_at timestamp with time zone, token_expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    cpa.id,
    cpa.client_id,
    cpa.visa_application_id,
    cpa.company_id,
    cpa.email,
    cpa.is_submitted,
    cpa.submitted_at,
    cpa.last_accessed_at,
    cpa.token_expires_at
  FROM public.client_portal_access cpa
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  LIMIT 1;
$function$;