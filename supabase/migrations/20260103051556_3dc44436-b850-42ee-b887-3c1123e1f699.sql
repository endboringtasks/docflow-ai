-- Drop and recreate get_portal_documents to include translation fields
DROP FUNCTION IF EXISTS public.get_portal_documents(TEXT);

CREATE FUNCTION public.get_portal_documents(p_token TEXT)
RETURNS TABLE (
  id UUID,
  document_name TEXT,
  is_completed BOOLEAN,
  file_path TEXT,
  description TEXT,
  category TEXT,
  applicant_type TEXT,
  min_files INTEGER,
  max_files INTEGER,
  attachment_count BIGINT,
  translation_of_id UUID,
  translation_target_language TEXT,
  translation_certification_type_id UUID,
  translation_certification_type_name TEXT,
  translation_notes TEXT
) AS $$
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
    dc.translation_notes
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  LEFT JOIN public.translation_certification_types tct ON tct.id = dc.translation_certification_type_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  ORDER BY dc.applicant_type NULLS LAST, dc.category NULLS LAST, dc.document_name;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;