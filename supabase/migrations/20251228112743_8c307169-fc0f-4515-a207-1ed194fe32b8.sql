-- Add document review columns to document_checklist
ALTER TABLE public.document_checklist 
ADD COLUMN review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
ADD COLUMN review_comment TEXT,
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);

-- Create index for faster filtering by review status
CREATE INDEX idx_document_checklist_review_status ON public.document_checklist(review_status);

COMMENT ON COLUMN public.document_checklist.review_status IS 'Document review status: pending, approved, rejected, needs_revision';
COMMENT ON COLUMN public.document_checklist.review_comment IS 'Reviewer comment or feedback for the client';
COMMENT ON COLUMN public.document_checklist.reviewed_at IS 'When the document was last reviewed';
COMMENT ON COLUMN public.document_checklist.reviewed_by IS 'User ID of the reviewer';