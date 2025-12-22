-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create document_checklist table
CREATE TABLE public.document_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.document_checklist ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view document checklist of their companies"
ON public.document_checklist
FOR SELECT
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create document checklist items"
ON public.document_checklist
FOR INSERT
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can update document checklist items"
ON public.document_checklist
FOR UPDATE
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can delete document checklist items"
ON public.document_checklist
FOR DELETE
USING (is_company_member(auth.uid(), company_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_document_checklist_updated_at
BEFORE UPDATE ON public.document_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_document_checklist_matter_id ON public.document_checklist(matter_id);