
-- Fix: document_checklist.uploaded_by_client FK to use ON DELETE SET NULL
ALTER TABLE public.document_checklist
  DROP CONSTRAINT document_checklist_uploaded_by_client_fkey;

ALTER TABLE public.document_checklist
  ADD CONSTRAINT document_checklist_uploaded_by_client_fkey
  FOREIGN KEY (uploaded_by_client) REFERENCES public.clients(id) ON DELETE SET NULL;

-- Fix: document_attachment_history.uploaded_by_client FK to use ON DELETE SET NULL
ALTER TABLE public.document_attachment_history
  DROP CONSTRAINT document_attachment_history_uploaded_by_client_fkey;

ALTER TABLE public.document_attachment_history
  ADD CONSTRAINT document_attachment_history_uploaded_by_client_fkey
  FOREIGN KEY (uploaded_by_client) REFERENCES public.client_portal_access(id) ON DELETE SET NULL;
