-- Add country_id column to application_subcategories
ALTER TABLE public.application_subcategories
ADD COLUMN country_id uuid REFERENCES public.countries(id);

-- Create index for better query performance
CREATE INDEX idx_application_subcategories_country_id ON public.application_subcategories(country_id);