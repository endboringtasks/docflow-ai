-- Allow platform admins to view all clients for admin dashboard
CREATE POLICY "Platform admins can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));