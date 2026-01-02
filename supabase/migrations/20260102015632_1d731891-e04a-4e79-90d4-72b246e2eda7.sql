-- Add is_standard_for_client column to document_checklist_templates
-- This field indicates whether a document should be shown to clients in the client portal

ALTER TABLE public.document_checklist_templates
ADD COLUMN is_standard_for_client BOOLEAN DEFAULT false;