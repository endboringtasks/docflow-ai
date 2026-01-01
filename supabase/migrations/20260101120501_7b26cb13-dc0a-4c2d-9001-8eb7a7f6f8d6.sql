-- Create junction table for document templates to application names (visa_types)
CREATE TABLE public.document_template_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_template_id UUID NOT NULL REFERENCES public.document_checklist_templates(id) ON DELETE CASCADE,
  visa_type_id UUID NOT NULL REFERENCES public.visa_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_template_id, visa_type_id)
);

-- Enable RLS
ALTER TABLE public.document_template_applications ENABLE ROW LEVEL SECURITY;

-- Create policies for platform admins
CREATE POLICY "Platform admins can manage document template applications"
ON public.document_template_applications
FOR ALL
USING (public.is_platform_admin(auth.uid()));

-- Create policy for reading (everyone can read for templates)
CREATE POLICY "Anyone can view document template applications"
ON public.document_template_applications
FOR SELECT
USING (true);

-- Create indexes for performance
CREATE INDEX idx_document_template_applications_template_id ON public.document_template_applications(document_template_id);
CREATE INDEX idx_document_template_applications_visa_type_id ON public.document_template_applications(visa_type_id);

-- Migrate existing data from visa_type_id column to junction table
INSERT INTO public.document_template_applications (document_template_id, visa_type_id)
SELECT id, visa_type_id
FROM public.document_checklist_templates
WHERE visa_type_id IS NOT NULL;