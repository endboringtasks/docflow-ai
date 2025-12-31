-- Create application_categories table
CREATE TABLE public.application_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint for category code per country
CREATE UNIQUE INDEX application_categories_country_code_idx ON public.application_categories(country_id, code);

-- Enable RLS
ALTER TABLE public.application_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for application_categories
CREATE POLICY "Application categories are publicly readable"
ON public.application_categories
FOR SELECT
USING (true);

CREATE POLICY "Platform admins can manage application categories"
ON public.application_categories
FOR ALL
USING (is_platform_admin(auth.uid()));

-- Add category_id to visa_types table
ALTER TABLE public.visa_types
ADD COLUMN category_id UUID REFERENCES public.application_categories(id) ON DELETE SET NULL;

-- Add category_id to visa_applications table
ALTER TABLE public.visa_applications
ADD COLUMN category_id UUID REFERENCES public.application_categories(id) ON DELETE SET NULL;

-- Insert default categories for all existing countries
INSERT INTO public.application_categories (country_id, name, code, description, icon, sort_order)
SELECT 
  c.id,
  cat.name,
  cat.code,
  cat.description,
  cat.icon,
  cat.sort_order
FROM public.countries c
CROSS JOIN (
  VALUES 
    ('Visa', 'visa', 'Immigration and travel visas', 'Stamp', 1),
    ('Skill Assessment', 'skill_assessment', 'Skills validation and recognition', 'Award', 2),
    ('Sponsorship', 'sponsorship', 'Employer or state nomination', 'Building2', 3),
    ('Police Check', 'police_check', 'Background and character checks', 'Shield', 4),
    ('Citizenship', 'citizenship', 'Naturalization applications', 'Flag', 5)
) AS cat(name, code, description, icon, sort_order);

-- Link existing visa_types to their country's "Visa" category
UPDATE public.visa_types vt
SET category_id = ac.id
FROM public.application_categories ac
WHERE ac.country_id = vt.country_id
  AND ac.code = 'visa';

-- Link existing visa_applications to their country's "Visa" category
UPDATE public.visa_applications va
SET category_id = ac.id
FROM public.application_categories ac
WHERE ac.country_id = va.country_id
  AND ac.code = 'visa';