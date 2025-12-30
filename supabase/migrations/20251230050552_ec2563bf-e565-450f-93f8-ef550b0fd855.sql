-- Drop existing constraint first
ALTER TABLE public.document_checklist DROP CONSTRAINT IF EXISTS document_checklist_review_status_check;

-- Update existing data to new values
UPDATE public.document_checklist 
SET review_status = 'pending_client' 
WHERE review_status = 'pending';

UPDATE public.document_checklist 
SET review_status = 'pending_client' 
WHERE review_status = 'needs_revision';

-- Add new constraint with updated values
ALTER TABLE public.document_checklist 
ADD CONSTRAINT document_checklist_review_status_check 
CHECK (review_status IN ('pending_client', 'in_review', 'approved', 'rejected'));