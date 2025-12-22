-- Create enum for company member roles
CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'member', 'guest');

-- Create enum for niche types
CREATE TYPE public.niche_type AS ENUM ('migration', 'audit', 'hr');

-- Create enum for subscription plans
CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'pro', 'enterprise');

-- Create enum for client types
CREATE TYPE public.client_type AS ENUM ('personal', 'corporate');

-- Create enum for matter status
CREATE TYPE public.matter_status AS ENUM ('draft', 'active', 'done');

-- =====================
-- TABLE: companies
-- =====================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche niche_type NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =====================
-- TABLE: company_members
-- =====================
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role company_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- =====================
-- TABLE: clients
-- =====================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_type client_type NOT NULL DEFAULT 'personal',
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  drive_folder_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- =====================
-- TABLE: matters
-- =====================
CREATE TABLE public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  matter_name TEXT NOT NULL,
  visa_subclass TEXT,
  drive_folder_id TEXT,
  status matter_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;

-- =====================
-- TABLE: automation_events
-- =====================
CREATE TABLE public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

-- =====================
-- SECURITY DEFINER FUNCTION: Check if user is member of company
-- =====================
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
  )
$$;

-- =====================
-- SECURITY DEFINER FUNCTION: Check if user has specific role in company
-- =====================
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _company_id UUID, _role company_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = _role
  )
$$;

-- =====================
-- SECURITY DEFINER FUNCTION: Check if user is owner or admin of company
-- =====================
CREATE OR REPLACE FUNCTION public.is_company_admin_or_owner(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role IN ('owner', 'admin')
  )
$$;

-- =====================
-- RLS POLICIES: companies
-- =====================
CREATE POLICY "Users can view companies they belong to"
ON public.companies FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), id));

CREATE POLICY "Users can create companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and admins can update their companies"
ON public.companies FOR UPDATE
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), id));

CREATE POLICY "Only owners can delete companies"
ON public.companies FOR DELETE
TO authenticated
USING (public.has_company_role(auth.uid(), id, 'owner'));

-- =====================
-- RLS POLICIES: company_members
-- =====================
CREATE POLICY "Users can view members of their companies"
ON public.company_members FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Users can add themselves as owner when creating company"
ON public.company_members FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = company_members.company_id
  )
);

CREATE POLICY "Owners and admins can add members"
ON public.company_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  AND role != 'owner'
);

CREATE POLICY "Owners and admins can update member roles"
ON public.company_members FOR UPDATE
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Owners and admins can remove members"
ON public.company_members FOR DELETE
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- =====================
-- RLS POLICIES: clients
-- =====================
CREATE POLICY "Users can view clients of their companies"
ON public.clients FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and owners can delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- =====================
-- RLS POLICIES: matters
-- =====================
CREATE POLICY "Users can view matters of their companies"
ON public.matters FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create matters"
ON public.matters FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can update matters"
ON public.matters FOR UPDATE
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and owners can delete matters"
ON public.matters FOR DELETE
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- =====================
-- RLS POLICIES: automation_events
-- =====================
CREATE POLICY "Users can view automation events of their companies"
ON public.automation_events FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create automation events"
ON public.automation_events FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- =====================
-- INDEXES for performance
-- =====================
CREATE INDEX idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX idx_company_members_company_id ON public.company_members(company_id);
CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_matters_company_id ON public.matters(company_id);
CREATE INDEX idx_matters_client_id ON public.matters(client_id);
CREATE INDEX idx_automation_events_company_id ON public.automation_events(company_id);
CREATE INDEX idx_automation_events_matter_id ON public.automation_events(matter_id);