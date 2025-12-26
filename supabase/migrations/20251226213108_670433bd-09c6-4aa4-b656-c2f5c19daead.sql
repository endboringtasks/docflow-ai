-- Add policy for platform admins to view all companies
CREATE POLICY "Platform admins can view all companies"
ON public.companies
FOR SELECT
USING (is_platform_admin(auth.uid()));