-- Add policy to allow users to view companies they created
CREATE POLICY "Users can view companies they created" 
ON public.companies 
FOR SELECT 
USING (auth.uid() = created_by);