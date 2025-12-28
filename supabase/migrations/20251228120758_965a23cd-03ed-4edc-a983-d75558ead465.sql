-- Add uploaded_at column to track when documents were uploaded
ALTER TABLE public.document_checklist 
ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE;

-- Update existing records that have file_path to set uploaded_at to updated_at
UPDATE public.document_checklist 
SET uploaded_at = updated_at 
WHERE file_path IS NOT NULL;