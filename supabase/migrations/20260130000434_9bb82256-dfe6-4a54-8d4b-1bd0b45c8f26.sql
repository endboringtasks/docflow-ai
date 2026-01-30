-- Drop and recreate get_portal_documents with review_status and review_comment
DROP FUNCTION IF EXISTS public.get_portal_documents(text);

CREATE OR REPLACE FUNCTION public.get_portal_documents(p_token text)
 RETURNS TABLE(id uuid, document_name text, is_completed boolean, file_path text, description text, category text, applicant_type text, min_files integer, max_files integer, attachment_count bigint, translation_of_id uuid, translation_target_language text, translation_certification_type_id uuid, translation_certification_type_name text, translation_notes text, requirement_type text, applicability_condition text, is_applicable boolean, review_status text, review_comment text)
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
    AND dc.is_applicable = true
  ORDER BY dc.applicant_type NULLS LAST, dc.category NULLS LAST, dc.document_name;
$function$;