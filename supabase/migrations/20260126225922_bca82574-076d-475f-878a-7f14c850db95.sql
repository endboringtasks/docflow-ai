-- Add related_applicants JSONB column to clients table
-- This stores Partner, Dependant, and Witness data as a JSON array on the client profile

ALTER TABLE public.clients
ADD COLUMN related_applicants JSONB DEFAULT '[]'::jsonb;

-- Add a comment to document the expected structure
COMMENT ON COLUMN public.clients.related_applicants IS 'JSON array of related applicants (partners, dependants, witnesses). Each object contains: id (uuid), type (partner|dependant|witness), first_name, last_name, date_of_birth, passport_number, nationality, relationship';