-- Create applicant_types reference table
CREATE TABLE public.applicant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default values
INSERT INTO public.applicant_types (name, code, sort_order) VALUES
  ('Primary Applicant', 'primary', 1),
  ('Partner', 'partner', 2),
  ('Dependant', 'dependant', 3),
  ('Sponsor', 'sponsor', 4);

-- Add RLS policies
ALTER TABLE public.applicant_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicant types are publicly readable"
  ON public.applicant_types FOR SELECT USING (true);

CREATE POLICY "Platform admins can manage applicant types"
  ON public.applicant_types FOR ALL USING (is_platform_admin(auth.uid()));

-- Add columns to document_checklist_templates
ALTER TABLE public.document_checklist_templates
  ADD COLUMN applicant_type_id UUID REFERENCES public.applicant_types(id) ON DELETE SET NULL,
  ADD COLUMN age_condition TEXT;

-- Add columns to document_checklist
ALTER TABLE public.document_checklist
  ADD COLUMN applicant_type TEXT,
  ADD COLUMN age_condition TEXT;