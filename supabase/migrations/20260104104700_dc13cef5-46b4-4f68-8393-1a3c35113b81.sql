-- Fix critical RLS policy issues on client_form_data table
-- The "Anyone can insert/update" policies are too permissive
-- Client portal edge functions use service role (bypasses RLS), so these can be restricted

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert form data" ON public.client_form_data;
DROP POLICY IF EXISTS "Anyone can update form data" ON public.client_form_data;

-- Create proper policies that require company membership
CREATE POLICY "Company members can insert form data" 
ON public.client_form_data 
FOR INSERT 
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can update form data" 
ON public.client_form_data 
FOR UPDATE 
USING (is_company_member(auth.uid(), company_id));