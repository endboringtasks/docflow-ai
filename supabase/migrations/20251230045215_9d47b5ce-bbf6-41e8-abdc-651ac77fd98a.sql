-- Add column to control saving original files to Documents Received folder
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS save_original_to_documents_received BOOLEAN NOT NULL DEFAULT true;