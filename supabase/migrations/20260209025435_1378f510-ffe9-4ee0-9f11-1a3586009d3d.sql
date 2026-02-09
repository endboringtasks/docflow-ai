-- Create document_attachment_history table for audit trail
CREATE TABLE public.document_attachment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_checklist_id UUID NOT NULL REFERENCES public.document_checklist(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL,
  uploaded_by UUID,
  uploaded_by_client UUID REFERENCES public.client_portal_access(id),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_reason TEXT NOT NULL,
  review_status_at_archive TEXT,
  review_comment_at_archive TEXT,
  reviewed_by_at_archive UUID
);

-- Create indexes for efficient querying
CREATE INDEX idx_document_attachment_history_checklist_id ON public.document_attachment_history(document_checklist_id);
CREATE INDEX idx_document_attachment_history_archived_at ON public.document_attachment_history(archived_at DESC);

-- Enable RLS
ALTER TABLE public.document_attachment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Company members can read history for their company's documents
CREATE POLICY "Company members can view document history"
ON public.document_attachment_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    WHERE dc.id = document_attachment_history.document_checklist_id
    AND public.is_company_member(auth.uid(), dc.company_id)
  )
);

-- RLS Policy: Client portal users can view history for documents in their application
CREATE POLICY "Client portal users can view their document history"
ON public.document_attachment_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_checklist dc
    JOIN public.client_portal_access cpa ON cpa.visa_application_id = dc.visa_application_id
    WHERE dc.id = document_attachment_history.document_checklist_id
    AND cpa.id = document_attachment_history.uploaded_by_client
    AND cpa.token_expires_at > now()
  )
);

-- No INSERT/UPDATE/DELETE policies for regular users - only service role can write
-- This ensures audit logs are append-only and cannot be tampered with

-- Add comment for documentation
COMMENT ON TABLE public.document_attachment_history IS 'Stores archived document attachments for audit trail when documents are rejected and replaced';