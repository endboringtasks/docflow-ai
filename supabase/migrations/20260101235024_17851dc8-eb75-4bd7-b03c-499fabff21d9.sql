-- Add subcategory_id column to visa_applications table
ALTER TABLE public.visa_applications
ADD COLUMN subcategory_id uuid REFERENCES public.application_subcategories(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_visa_applications_subcategory_id ON public.visa_applications(subcategory_id);