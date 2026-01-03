-- Create translation certification types reference table
CREATE TABLE public.translation_certification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.translation_certification_types ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage certification types
CREATE POLICY "Platform admins can manage certification types"
ON public.translation_certification_types
FOR ALL
USING (public.is_platform_admin(auth.uid()));

-- Everyone can read active certification types
CREATE POLICY "Anyone can read active certification types"
ON public.translation_certification_types
FOR SELECT
USING (is_active = true);

-- Pre-populate with common certification types
INSERT INTO public.translation_certification_types (code, name, description, sort_order) VALUES
('naati', 'NAATI Certified', 'National Accreditation Authority for Translators and Interpreters (Australia)', 1),
('ata', 'ATA Certified', 'American Translators Association certified translator', 2),
('sworn', 'Sworn Translator', 'Officially appointed sworn/certified translator', 3),
('notarized', 'Notarized Translation', 'Translation notarized by a public notary', 4),
('in_house', 'In-house Certified', 'Translation certified by qualified in-house translator', 5),
('any_certified', 'Any Certified Translator', 'Any professionally certified translator', 6);

-- Add translation fields to document_checklist_templates
ALTER TABLE public.document_checklist_templates
ADD COLUMN translation_target_language TEXT DEFAULT 'English',
ADD COLUMN translation_certification_type_id UUID REFERENCES public.translation_certification_types(id) ON DELETE SET NULL,
ADD COLUMN translation_notes TEXT;

-- Add translation fields to document_checklist
ALTER TABLE public.document_checklist
ADD COLUMN translation_target_language TEXT DEFAULT 'English',
ADD COLUMN translation_certification_type_id UUID REFERENCES public.translation_certification_types(id) ON DELETE SET NULL,
ADD COLUMN translation_notes TEXT;