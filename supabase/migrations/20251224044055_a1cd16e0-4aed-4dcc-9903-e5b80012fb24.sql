-- Create function to check if user has access to a client via matters
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins and owners can see all clients
    is_company_admin_or_owner(_user_id, _company_id)
    OR
    -- Members can see clients that have at least one matter in their company
    EXISTS (
      SELECT 1
      FROM public.matters m
      WHERE m.client_id = _client_id
        AND m.company_id = _company_id
        AND is_company_member(_user_id, m.company_id)
    )
$$;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view clients of their companies" ON public.clients;

-- Admins and owners can view all clients in their company
CREATE POLICY "Admins can view all clients"
ON public.clients
FOR SELECT
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Members can view clients that have matters (active cases)
CREATE POLICY "Members can view clients with matters"
ON public.clients
FOR SELECT
USING (
  is_company_member(auth.uid(), company_id)
  AND EXISTS (
    SELECT 1 FROM public.matters m 
    WHERE m.client_id = clients.id 
    AND m.company_id = clients.company_id
  )
);