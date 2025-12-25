-- Drop the overly permissive INSERT policy that allows any authenticated user to insert audit logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public.platform_audit_logs;

-- Audit logs will now only be writable via:
-- 1. Service role (edge functions like admin-impersonate)
-- 2. Database triggers with SECURITY DEFINER
-- No client-side INSERT access is needed or allowed