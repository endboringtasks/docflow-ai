-- Add description column to document_checklist_templates
ALTER TABLE public.document_checklist_templates
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add description column to document_checklist
ALTER TABLE public.document_checklist
ADD COLUMN IF NOT EXISTS description TEXT;