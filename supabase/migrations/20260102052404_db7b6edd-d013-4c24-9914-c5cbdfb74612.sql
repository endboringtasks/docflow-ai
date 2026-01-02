-- Add category column to document_checklist for grouping
ALTER TABLE public.document_checklist
ADD COLUMN IF NOT EXISTS category TEXT;

-- Update the get_portal_documents RPC to include category
DROP FUNCTION IF EXISTS public.get_portal_documents(text);

CREATE FUNCTION public.get_portal_documents(p_token text)
RETURNS TABLE(
  id uuid, 
  document_name text, 
  is_completed boolean, 
  file_path text,
  description text,
  category text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dc.id,
    dc.document_name,
    dc.is_completed,
    dc.file_path,
    dc.description,
    dc.category
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  ORDER BY dc.category NULLS LAST, dc.document_name;
$$;