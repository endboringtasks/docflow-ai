ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_by uuid,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

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
    AND cpa.status <> 'revoked'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_portal_visa_application_details(p_token text)
 RETURNS TABLE(visa_application_id uuid, application_name text, visa_subclass text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    va.id as visa_application_id,
    va.application_name,
    va.visa_subclass,
    va.status::text
  FROM public.client_portal_access cpa
  INNER JOIN public.visa_applications va ON va.id = cpa.visa_application_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
    AND cpa.status <> 'revoked'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_portal_client_details(p_token text)
 RETURNS TABLE(first_name text, last_name text, company_name text, client_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    c.first_name,
    c.last_name,
    c.company_name,
    c.client_type::text
  FROM public.client_portal_access cpa
  INNER JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
    AND cpa.status <> 'revoked'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_portal_documents(p_token text)
 RETURNS TABLE(id uuid, document_name text, is_completed boolean, file_path text, description text, instructions text, category text, applicant_type text, min_files integer, max_files integer, attachment_count bigint, translation_of_id uuid, translation_target_language text, translation_certification_type_id uuid, translation_certification_type_name text, translation_notes text, requirement_type text, applicability_condition text, is_applicable boolean, review_status text, review_comment text)
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
    dc.instructions,
    dc.category,
    dc.applicant_type,
    dc.min_files,
    dc.max_files,
    COALESCE((
      SELECT COUNT(*) FROM public.document_attachments da 
      WHERE da.document_checklist_id = dc.id
    ), 0) as attachment_count,
    dc.translation_of_id,
    dc.translation_target_language,
    dc.translation_certification_type_id,
    tct.name as translation_certification_type_name,
    dc.translation_notes,
    dc.requirement_type::text,
    dc.applicability_condition,
    dc.is_applicable,
    dc.review_status,
    dc.review_comment
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  LEFT JOIN public.translation_certification_types tct ON tct.id = dc.translation_certification_type_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
    AND cpa.status <> 'revoked'
    AND dc.is_applicable = true
  ORDER BY dc.applicant_type NULLS LAST, dc.category NULLS LAST, dc.document_name;
$function$;

CREATE OR REPLACE FUNCTION public.get_document_attachments(p_token text, p_document_id uuid)
 RETURNS TABLE(id uuid, file_path text, file_name text, file_type text, file_size integer, uploaded_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    da.id,
    da.file_path,
    da.file_name,
    da.file_type,
    da.file_size,
    da.uploaded_at
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  INNER JOIN public.document_attachments da ON da.document_checklist_id = dc.id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
    AND cpa.status <> 'revoked'
    AND dc.id = p_document_id
  ORDER BY da.uploaded_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.update_portal_access_timestamp(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.client_portal_access
  SET last_accessed_at = now()
  WHERE access_token = p_token
    AND token_expires_at > now()
    AND status <> 'revoked';
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_portal_access(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_portal_id uuid;
BEGIN
  UPDATE public.client_portal_access
  SET 
    is_submitted = true,
    submitted_at = now()
  WHERE access_token = p_token
    AND token_expires_at > now()
    AND status <> 'revoked'
    AND is_submitted = false
  RETURNING id INTO v_portal_id;
  
  RETURN v_portal_id IS NOT NULL;
END;
$function$;