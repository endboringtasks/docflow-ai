-- Create application_subcategories table
CREATE TABLE public.application_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.application_categories(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(category_id, code)
);

-- Add subcategory_id to visa_types (nullable to support existing data)
ALTER TABLE public.visa_types 
ADD COLUMN subcategory_id UUID REFERENCES public.application_subcategories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.application_subcategories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Application subcategories are publicly readable"
ON public.application_subcategories
FOR SELECT
USING (true);

CREATE POLICY "Platform admins can manage application subcategories"
ON public.application_subcategories
FOR ALL
USING (is_platform_admin(auth.uid()));