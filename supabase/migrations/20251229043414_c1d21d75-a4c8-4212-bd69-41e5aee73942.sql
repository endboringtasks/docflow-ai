-- Add uploaded_by_client column to track client portal uploads separately from team member uploads
ALTER TABLE public.document_checklist 
ADD COLUMN uploaded_by_client uuid REFERENCES public.clients(id);

-- Add comment to clarify the difference between uploaded_by and uploaded_by_client
COMMENT ON COLUMN public.document_checklist.uploaded_by IS 'User ID of team member who uploaded (references auth.users)';
COMMENT ON COLUMN public.document_checklist.uploaded_by_client IS 'Client ID when document was uploaded via client portal (references clients)';