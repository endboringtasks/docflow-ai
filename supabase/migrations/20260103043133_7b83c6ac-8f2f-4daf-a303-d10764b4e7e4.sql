-- Phase 1: Multi-File Document Upload Schema

-- 1.1 Create document_attachments table
CREATE TABLE public.document_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_checklist_id UUID NOT NULL REFERENCES public.document_checklist(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_client UUID REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_document_attachments_checklist ON public.document_attachments(document_checklist_id);
CREATE INDEX idx_document_attachments_uploaded_at ON public.document_attachments(uploaded_at DESC);

-- 1.2 Add min_files and max_files to document_checklist_templates
ALTER TABLE public.document_checklist_templates
ADD COLUMN min_files INTEGER NOT NULL DEFAULT 1,
ADD COLUMN max_files INTEGER DEFAULT 1;

-- 1.3 Add min_files and max_files to document_checklist
ALTER TABLE public.document_checklist
ADD COLUMN min_files INTEGER NOT NULL DEFAULT 1,
ADD COLUMN max_files INTEGER DEFAULT 1;

-- 1.4 Enable RLS on document_attachments
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_attachments

-- SELECT: Company members can view attachments for documents in their company
CREATE POLICY "Company members can view document attachments"
ON public.document_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.visa_applications va ON va.id = dc.visa_application_id
    WHERE dc.id = document_attachments.document_checklist_id
      AND public.is_company_member(auth.uid(), va.company_id)
  )
);

-- INSERT: Company members can add attachments
CREATE POLICY "Company members can add document attachments"
ON public.document_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.visa_applications va ON va.id = dc.visa_application_id
    WHERE dc.id = document_attachments.document_checklist_id
      AND public.is_company_member(auth.uid(), va.company_id)
  )
);

-- DELETE: Company members can remove attachments
CREATE POLICY "Company members can delete document attachments"
ON public.document_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.visa_applications va ON va.id = dc.visa_application_id
    WHERE dc.id = document_attachments.document_checklist_id
      AND public.is_company_member(auth.uid(), va.company_id)
  )
);

-- 1.5 Create function to get document attachments for portal
CREATE OR REPLACE FUNCTION public.get_document_attachments(p_token text, p_document_id uuid)
RETURNS TABLE(
  id uuid,
  file_path text,
  file_name text,
  file_type text,
  file_size integer,
  uploaded_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    da.id,
    da.file_path,
    da.file_name,
    da.file_type,
    da.file_size,
    da.uploaded_at
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  INNER JOIN public.document_attachments da ON da.document_checklist_id = dc.id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
    AND dc.id = p_document_id
  ORDER BY da.uploaded_at ASC;
$$;

-- 1.6 Update get_portal_documents to include min_files, max_files, and attachment_count
DROP FUNCTION IF EXISTS public.get_portal_documents(text);

CREATE OR REPLACE FUNCTION public.get_portal_documents(p_token text)
RETURNS TABLE(
  id uuid, 
  document_name text, 
  is_completed boolean, 
  file_path text, 
  description text, 
  category text, 
  applicant_type text,
  min_files integer,
  max_files integer,
  attachment_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dc.id,
    dc.document_name,
    dc.is_completed,
    dc.file_path,
    dc.description,
    dc.category,
    dc.applicant_type,
    dc.min_files,
    dc.max_files,
    COALESCE((
      SELECT COUNT(*) FROM public.document_attachments da 
      WHERE da.document_checklist_id = dc.id
    ), 0) as attachment_count
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.visa_application_id = cpa.visa_application_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  ORDER BY dc.applicant_type NULLS LAST, dc.category NULLS LAST, dc.document_name;
$$;