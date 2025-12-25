-- Add SELECT policy to google_drive_connections table to prevent token theft
CREATE POLICY "Admins can view drive connections" 
ON public.google_drive_connections 
FOR SELECT 
USING (is_company_admin_or_owner(auth.uid(), company_id));