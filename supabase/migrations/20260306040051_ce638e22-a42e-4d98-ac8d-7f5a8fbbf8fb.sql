CREATE OR REPLACE FUNCTION public.sync_template_description_to_checklists(
  p_company_id uuid,
  p_document_name text,
  p_category text,
  p_new_description text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE document_checklist
  SET description = p_new_description, updated_at = now()
  WHERE company_id = p_company_id
    AND document_name = p_document_name
    AND (category = p_category OR (category IS NULL AND p_category IS NULL));
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;