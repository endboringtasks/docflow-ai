-- Allow platform admins to manage document checklist templates (for global templates)
CREATE POLICY "Platform admins can manage document templates"
ON public.document_checklist_templates
FOR ALL
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));