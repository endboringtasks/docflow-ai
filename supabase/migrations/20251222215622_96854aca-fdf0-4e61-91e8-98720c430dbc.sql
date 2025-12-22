-- Drop the broken policy
DROP POLICY IF EXISTS "Users can add themselves as owner when creating company" ON public.company_members;

-- Recreate with correct condition - compare to the new row being inserted
CREATE POLICY "Users can add themselves as owner when creating company" 
ON public.company_members 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (role = 'owner'::company_role) 
  AND (NOT EXISTS (
    SELECT 1
    FROM public.company_members existing
    WHERE existing.company_id = company_members.company_id
  ))
);