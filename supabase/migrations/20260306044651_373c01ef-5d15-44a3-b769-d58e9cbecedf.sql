
CREATE POLICY "Platform admins can manage document definitions"
ON public.document_definitions
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));
