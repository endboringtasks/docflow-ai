-- Allow platform admins to delete feedback
CREATE POLICY "Platform admins can delete feedback"
  ON public.beta_feedback 
  FOR DELETE
  USING (is_platform_admin(auth.uid()));