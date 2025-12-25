-- Drop the overly permissive SELECT policy for members
DROP POLICY IF EXISTS "Members can view their company clients" ON public.clients;

-- Create a more restrictive SELECT policy: only admins/owners can directly access the table
CREATE POLICY "Admins and owners can view clients directly"
ON public.clients
FOR SELECT
USING (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR public.is_platform_admin(auth.uid())
);

-- Also restrict UPDATE to admins/owners for sensitive data protection
DROP POLICY IF EXISTS "Members can update clients" ON public.clients;

CREATE POLICY "Admins and owners can update clients"
ON public.clients
FOR UPDATE
USING (
  public.is_company_admin_or_owner(auth.uid(), company_id)
);

-- Keep INSERT for all members (they can add clients but can't view PII of others)
-- The existing "Members can create clients" policy is fine

-- Add a comment documenting the security model
COMMENT ON TABLE public.clients IS 'Client records with PII. Direct access restricted to admins/owners. Regular members must use get_clients_secure() RPC function which masks email/phone.';