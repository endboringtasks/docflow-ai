-- Drop and recreate the SELECT policy to ensure it's correct
DROP POLICY IF EXISTS "Admins can view drive connections" ON public.google_drive_connections;

-- Create a stricter SELECT policy that only allows admins and owners
CREATE POLICY "Only admins and owners can view drive connections"
ON public.google_drive_connections
FOR SELECT
USING (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR public.is_platform_admin(auth.uid())
);

-- Add comment documenting the security model
COMMENT ON TABLE public.google_drive_connections IS 'Contains sensitive OAuth tokens. Direct access restricted to company admins/owners and platform admins only. Regular members should not have any access to this table.';