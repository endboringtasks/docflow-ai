-- Add is_standard_for_client column to document_checklist table
-- This tracks which documents should be visible to clients in their portal

ALTER TABLE public.document_checklist
ADD COLUMN is_standard_for_client BOOLEAN DEFAULT false;