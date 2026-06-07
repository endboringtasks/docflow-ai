-- 3.1 application_applicants: soft delete + created_by
ALTER TABLE public.application_applicants
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Partial unique indexes (only over non-deleted rows)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_app_primary_applicant
  ON public.application_applicants (visa_application_id)
  WHERE is_primary = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_app_applicant_type
  ON public.application_applicants (visa_application_id, applicant_type_id)
  WHERE deleted_at IS NULL AND is_primary = false AND related_applicant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_app_related_person
  ON public.application_applicants (visa_application_id, related_applicant_id)
  WHERE related_applicant_id IS NOT NULL AND deleted_at IS NULL;

-- 3.2 document_checklist: link a document to a specific applicant
ALTER TABLE public.document_checklist
  ADD COLUMN IF NOT EXISTS application_applicant_id uuid;

CREATE INDEX IF NOT EXISTS idx_document_checklist_applicant
  ON public.document_checklist (application_applicant_id)
  WHERE application_applicant_id IS NOT NULL;

-- 3.3 application_timeline (new)
CREATE TABLE IF NOT EXISTS public.application_timeline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visa_application_id uuid NOT NULL,
  company_id uuid NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  actor_id uuid,
  description text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.application_timeline TO authenticated;
GRANT ALL ON public.application_timeline TO service_role;

ALTER TABLE public.application_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view application timeline"
  ON public.application_timeline FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can create application timeline"
  ON public.application_timeline FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_application_timeline_app
  ON public.application_timeline (visa_application_id, created_at DESC);

-- Widen applicant management to all company members (not only owners/admins)
DROP POLICY IF EXISTS "Company admins and owners can manage application applicants" ON public.application_applicants;

CREATE POLICY "Company members can manage application applicants"
  ON public.application_applicants FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.visa_applications va
    WHERE va.id = application_applicants.visa_application_id
      AND public.is_company_member(auth.uid(), va.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.visa_applications va
    WHERE va.id = application_applicants.visa_application_id
      AND public.is_company_member(auth.uid(), va.company_id)
  ));