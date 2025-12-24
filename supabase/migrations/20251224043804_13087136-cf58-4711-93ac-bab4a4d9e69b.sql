-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Create a security definer function to check if users share a company
CREATE OR REPLACE FUNCTION public.shares_company_with(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm1
    INNER JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
    WHERE cm1.user_id = _viewer_id
      AND cm2.user_id = _profile_id
  )
$$;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can view profiles of users in the same company
CREATE POLICY "Users can view profiles of company members"
ON public.profiles
FOR SELECT
USING (public.shares_company_with(auth.uid(), id));

-- Platform admins can view all profiles
CREATE POLICY "Platform admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_platform_admin(auth.uid()));