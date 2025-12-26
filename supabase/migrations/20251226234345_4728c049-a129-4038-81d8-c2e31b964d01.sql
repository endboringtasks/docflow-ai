-- Add RLS policy for webhook_rate_limits table
-- This is an internal system table managed by edge functions using service role
-- Platform admins should be able to view it for monitoring purposes
CREATE POLICY "Platform admins can view rate limits"
ON public.webhook_rate_limits
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Allow service role to manage (implicit via service role key, but add explicit policy for clarity)
CREATE POLICY "Service role can manage rate limits"
ON public.webhook_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);