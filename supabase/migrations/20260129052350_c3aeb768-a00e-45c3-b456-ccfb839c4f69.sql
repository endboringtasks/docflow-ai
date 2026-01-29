-- Add related_applicant_id column to store JSON-based related applicant IDs
-- For non-primary applicants, this will store the id from the client's related_applicants JSONB

ALTER TABLE public.application_applicants 
ADD COLUMN related_applicant_id text NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.application_applicants.related_applicant_id IS 'For non-primary applicants, stores the id from the clients.related_applicants JSONB array. For primary applicants, this is null.';

-- Modify client_id to reference the primary client's ID for all applicants
-- (both primary and related applicants will point to the same client_id - the primary client)
COMMENT ON COLUMN public.application_applicants.client_id IS 'References the primary client. For related applicants, this still points to the primary client''s record, and related_applicant_id identifies the specific person within the JSONB.';