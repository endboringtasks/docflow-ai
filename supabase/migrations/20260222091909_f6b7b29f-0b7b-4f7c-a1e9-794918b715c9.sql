
-- Remove the overly permissive INSERT policy - service role bypasses RLS anyway
DROP POLICY IF EXISTS "Service role can insert document history" ON public.document_attachment_history;
