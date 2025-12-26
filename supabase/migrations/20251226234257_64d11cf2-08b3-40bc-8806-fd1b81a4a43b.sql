-- Fix 1: Remove the overly permissive "Anyone can read with valid token" policy from client_portal_access
-- This policy allows unauthenticated access to all tokens which is a critical security issue
DROP POLICY IF EXISTS "Anyone can read with valid token" ON public.client_portal_access;

-- Create a secure RPC function for token validation instead of a permissive policy
-- This function validates the token and returns the portal access data only if the token is valid and not expired
CREATE OR REPLACE FUNCTION public.validate_portal_access_token(p_token text)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  matter_id uuid,
  company_id uuid,
  email text,
  is_submitted boolean,
  submitted_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  token_expires_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cpa.id,
    cpa.client_id,
    cpa.matter_id,
    cpa.company_id,
    cpa.email,
    cpa.is_submitted,
    cpa.submitted_at,
    cpa.last_accessed_at,
    cpa.token_expires_at
  FROM public.client_portal_access cpa
  WHERE cpa.access_token = p_token
    AND cpa.token_expires_at > now()
  LIMIT 1;
$$;

-- Create a function to update last accessed time (for when clients access the portal)
CREATE OR REPLACE FUNCTION public.update_portal_access_timestamp(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.client_portal_access
  SET last_accessed_at = now()
  WHERE access_token = p_token
    AND token_expires_at > now();
  
  RETURN FOUND;
END;
$$;

-- Fix 2: Ensure clients table policies are properly restrictive
-- The current policies use RESTRICTIVE mode which is correct, but let's verify they're all properly authenticated
-- Drop and recreate as PERMISSIVE policies (the standard) with proper auth checks

-- First, drop existing SELECT policies
DROP POLICY IF EXISTS "Admins and owners can view clients directly" ON public.clients;
DROP POLICY IF EXISTS "Platform admins can view all clients" ON public.clients;

-- Recreate as properly authenticated PERMISSIVE policies
CREATE POLICY "Admins and owners can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Platform admins can view all clients"
ON public.clients
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Also ensure the INSERT, UPDATE, DELETE policies target authenticated users
DROP POLICY IF EXISTS "Members can create clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and owners can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and owners can delete clients" ON public.clients;

CREATE POLICY "Members can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and owners can update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admins and owners can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));