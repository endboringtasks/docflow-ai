-- 1. Table
CREATE TABLE public.document_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Grants
GRANT SELECT ON public.document_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_categories TO authenticated;
GRANT ALL ON public.document_categories TO service_role;

-- 3. RLS
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document categories are publicly readable"
ON public.document_categories
FOR SELECT
USING (true);

CREATE POLICY "Platform admins can manage document categories"
ON public.document_categories
FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 4. updated_at trigger
CREATE TRIGGER update_document_categories_updated_at
BEFORE UPDATE ON public.document_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed with defaults + existing distinct categories
INSERT INTO public.document_categories (name, sort_order)
VALUES
  ('Identity', 1), ('Character', 2), ('Health', 3), ('Employment', 4),
  ('Skills', 5), ('English', 6), ('Education', 7), ('Financial', 8),
  ('Relationship', 9), ('Sponsor', 10), ('Insurance', 11),
  ('Nomination', 12), ('Other', 13)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.document_categories (name, sort_order)
SELECT DISTINCT category, 100
FROM public.document_definitions
WHERE category IS NOT NULL AND btrim(category) <> ''
ON CONFLICT (name) DO NOTHING;

-- 6. Rename helper: re-label all usages across tables
CREATE OR REPLACE FUNCTION public.rename_document_category(p_old_name text, p_new_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected integer := 0;
  cnt integer;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform admins can rename document categories.';
  END IF;

  UPDATE public.document_definitions SET category = p_new_name, updated_at = now()
  WHERE category = p_old_name;
  GET DIAGNOSTICS cnt = ROW_COUNT; affected := affected + cnt;

  UPDATE public.document_checklist_templates SET category = p_new_name
  WHERE category = p_old_name;
  GET DIAGNOSTICS cnt = ROW_COUNT; affected := affected + cnt;

  UPDATE public.document_checklist SET category = p_new_name, updated_at = now()
  WHERE category = p_old_name;
  GET DIAGNOSTICS cnt = ROW_COUNT; affected := affected + cnt;

  RETURN affected;
END;
$function$;

-- 7. Usage counter: how many records still reference a category name
CREATE OR REPLACE FUNCTION public.count_document_category_usage(p_name text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*) FROM public.document_definitions WHERE category = p_name)
  + (SELECT count(*) FROM public.document_checklist_templates WHERE category = p_name)
  + (SELECT count(*) FROM public.document_checklist WHERE category = p_name);
$function$;