-- Create storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-attachments', 'document-attachments', false);

-- RLS policies for document-attachments bucket
-- Users can view files for their company's documents
CREATE POLICY "Company members can view document attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'document-attachments' AND
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.company_members cm ON cm.company_id = dc.company_id
    WHERE cm.user_id = auth.uid()
    AND dc.id::text = (storage.foldername(name))[1]
  )
);

-- Users can upload files for their company's documents
CREATE POLICY "Company members can upload document attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'document-attachments' AND
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.company_members cm ON cm.company_id = dc.company_id
    WHERE cm.user_id = auth.uid()
    AND dc.id::text = (storage.foldername(name))[1]
  )
);

-- Users can delete files for their company's documents
CREATE POLICY "Company members can delete document attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-attachments' AND
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.company_members cm ON cm.company_id = dc.company_id
    WHERE cm.user_id = auth.uid()
    AND dc.id::text = (storage.foldername(name))[1]
  )
);

-- Add file_path column to document_checklist
ALTER TABLE public.document_checklist
ADD COLUMN file_path TEXT DEFAULT NULL;