ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS application_applicant_id uuid;