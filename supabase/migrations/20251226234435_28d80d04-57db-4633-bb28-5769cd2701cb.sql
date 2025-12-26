-- Create a secure function to mark portal access as submitted
-- This allows unauthenticated clients to submit their forms with a valid token
CREATE OR REPLACE FUNCTION public.submit_portal_access(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_id uuid;
BEGIN
  -- Find and update the portal access record
  UPDATE public.client_portal_access
  SET 
    is_submitted = true,
    submitted_at = now()
  WHERE access_token = p_token
    AND token_expires_at > now()
    AND is_submitted = false
  RETURNING id INTO v_portal_id;
  
  RETURN v_portal_id IS NOT NULL;
END;
$$;

-- Create a secure function to get matter details for the portal
-- This allows the client portal to fetch matter info without direct table access
CREATE OR REPLACE FUNCTION public.get_portal_matter_details(p_token text)
RETURNS TABLE(
  matter_id uuid,
  matter_name text,
  visa_subclass text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id as matter_id,
    m.matter_name,
    m.visa_subclass,
    m.status::text
  FROM public.client_portal_access cpa
  INNER JOIN public.matters m ON m.id = cpa.matter_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  LIMIT 1;
$$;

-- Create a secure function to get client details for the portal
CREATE OR REPLACE FUNCTION public.get_portal_client_details(p_token text)
RETURNS TABLE(
  first_name text,
  last_name text,
  company_name text,
  client_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.first_name,
    c.last_name,
    c.company_name,
    c.client_type::text
  FROM public.client_portal_access cpa
  INNER JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  LIMIT 1;
$$;

-- Create a secure function to get document checklist for the portal
CREATE OR REPLACE FUNCTION public.get_portal_documents(p_token text)
RETURNS TABLE(
  id uuid,
  document_name text,
  is_completed boolean,
  file_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dc.id,
    dc.document_name,
    dc.is_completed,
    dc.file_path
  FROM public.client_portal_access cpa
  INNER JOIN public.document_checklist dc ON dc.matter_id = cpa.matter_id
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  ORDER BY dc.document_name;
$$;