
-- 1. Create document_definitions table
CREATE TABLE public.document_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL,
  document_name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, category, document_name)
);

-- 2. Enable RLS
ALTER TABLE public.document_definitions ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Company members can view document definitions"
  ON public.document_definitions FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can manage document definitions"
  ON public.document_definitions FOR ALL
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

-- 4. Add document_definition_id FK to document_checklist_templates
ALTER TABLE public.document_checklist_templates
  ADD COLUMN document_definition_id uuid REFERENCES public.document_definitions(id) ON DELETE SET NULL;

-- 5. Backfill: extract unique documents from existing templates into definitions
INSERT INTO public.document_definitions (company_id, category, document_name, description)
SELECT DISTINCT ON (company_id, category, document_name)
  company_id, category, document_name, description
FROM public.document_checklist_templates
WHERE company_id IS NOT NULL AND category IS NOT NULL
ORDER BY company_id, category, document_name, created_at ASC
ON CONFLICT (company_id, category, document_name) DO NOTHING;

-- 6. Backfill: link templates back to definitions
UPDATE public.document_checklist_templates t
SET document_definition_id = dd.id
FROM public.document_definitions dd
WHERE t.company_id = dd.company_id
  AND t.category = dd.category
  AND t.document_name = dd.document_name;

-- 7. Updated at trigger
CREATE TRIGGER update_document_definitions_updated_at
  BEFORE UPDATE ON public.document_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Update sync function to also sync from definitions
CREATE OR REPLACE FUNCTION public.sync_definition_description_to_all(
  p_definition_id uuid,
  p_new_description text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_document_name text;
  v_category text;
  affected integer;
BEGIN
  -- Get definition details
  SELECT company_id, document_name, category
  INTO v_company_id, v_document_name, v_category
  FROM document_definitions WHERE id = p_definition_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Update all templates referencing this definition
  UPDATE document_checklist_templates
  SET description = p_new_description
  WHERE document_definition_id = p_definition_id;

  -- Update all application checklists
  UPDATE document_checklist
  SET description = p_new_description, updated_at = now()
  WHERE company_id = v_company_id
    AND document_name = v_document_name
    AND (category = v_category OR (category IS NULL AND v_category IS NULL));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
