-- Create super admin role enum
CREATE TYPE public.platform_role AS ENUM ('super_admin');

-- Create platform admins table (separate from company roles)
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role platform_role NOT NULL DEFAULT 'super_admin',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
  )
$$;

-- RLS policies for platform_admins table
CREATE POLICY "Platform admins can view all admins"
ON public.platform_admins
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can add new admins"
ON public.platform_admins
FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can remove admins"
ON public.platform_admins
FOR DELETE
USING (is_platform_admin(auth.uid()));

-- Create webhooks configuration table
CREATE TABLE public.platform_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  secret_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhooks
CREATE POLICY "Platform admins can manage webhooks"
ON public.platform_webhooks
FOR ALL
USING (is_platform_admin(auth.uid()));

-- Create platform settings table for API keys and configurations
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  is_secret boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for platform settings
CREATE POLICY "Platform admins can manage settings"
ON public.platform_settings
FOR ALL
USING (is_platform_admin(auth.uid()));

-- Create audit logs table
CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit logs (only super admins can view)
CREATE POLICY "Platform admins can view audit logs"
ON public.platform_audit_logs
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "System can insert audit logs"
ON public.platform_audit_logs
FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at on platform_webhooks
CREATE TRIGGER update_platform_webhooks_updated_at
BEFORE UPDATE ON public.platform_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on platform_settings
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();