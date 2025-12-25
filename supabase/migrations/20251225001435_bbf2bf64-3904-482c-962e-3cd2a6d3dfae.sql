-- Drop existing policies
DROP POLICY IF EXISTS "Users can view automation events of their companies" ON public.automation_events;
DROP POLICY IF EXISTS "Members can create automation events" ON public.automation_events;

-- Create new policies for platform admins only
CREATE POLICY "Platform admins can view all automation events"
ON public.automation_events FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can create automation events"
ON public.automation_events FOR INSERT
TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));

-- Note: Edge functions use service role which bypasses RLS, so they can still insert events