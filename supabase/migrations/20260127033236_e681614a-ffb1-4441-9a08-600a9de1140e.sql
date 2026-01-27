-- Add subcategory_id column to category_applicant_types
-- NULL means the rule applies to all subcategories (default/fallback)
-- A specific value means it only applies to that subcategory

ALTER TABLE public.category_applicant_types 
ADD COLUMN subcategory_id uuid REFERENCES public.application_subcategories(id) ON DELETE CASCADE;

-- Add index for efficient lookups by category + subcategory
CREATE INDEX idx_category_applicant_types_subcategory 
ON public.category_applicant_types(category_id, subcategory_id);