-- Create table for visa document templates
CREATE TABLE public.visa_document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  visa_subclass TEXT NOT NULL,
  category TEXT NOT NULL,
  document_name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate documents within the same visa type for a company
  UNIQUE(company_id, visa_subclass, category, document_name)
);

-- Create index for efficient queries
CREATE INDEX idx_visa_document_templates_company_visa ON public.visa_document_templates(company_id, visa_subclass);

-- Enable Row Level Security
ALTER TABLE public.visa_document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view document templates" 
ON public.visa_document_templates 
FOR SELECT 
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can create document templates" 
ON public.visa_document_templates 
FOR INSERT 
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admins can update document templates" 
ON public.visa_document_templates 
FOR UPDATE 
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admins can delete document templates" 
ON public.visa_document_templates 
FOR DELETE 
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_visa_document_templates_updated_at
BEFORE UPDATE ON public.visa_document_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();