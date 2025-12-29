-- Add uploaded_by column to track who uploaded the document
ALTER TABLE public.document_checklist 
ADD COLUMN uploaded_by uuid REFERENCES auth.users(id);