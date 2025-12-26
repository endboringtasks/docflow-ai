-- Create client_portal_access table for magic link tokens
CREATE TABLE public.client_portal_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_form_data table to store auto-saved form data
CREATE TABLE public.client_form_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(matter_id, client_id)
);

-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_form_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_portal_access
CREATE POLICY "Company members can view portal access"
  ON public.client_portal_access FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can create portal access"
  ON public.client_portal_access FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can update portal access"
  ON public.client_portal_access FOR UPDATE
  USING (is_company_member(auth.uid(), company_id));

-- Public access for clients via token (no auth required for reading)
CREATE POLICY "Anyone can read with valid token"
  ON public.client_portal_access FOR SELECT
  USING (true);

-- RLS policies for client_form_data
CREATE POLICY "Company members can view form data"
  ON public.client_form_data FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Anyone can insert form data"
  ON public.client_form_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update form data"
  ON public.client_form_data FOR UPDATE
  USING (true);

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Company members can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id));

-- Create indexes
CREATE INDEX idx_client_portal_access_token ON public.client_portal_access(access_token);
CREATE INDEX idx_client_portal_access_matter ON public.client_portal_access(matter_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Trigger for updated_at
CREATE TRIGGER update_client_portal_access_updated_at
  BEFORE UPDATE ON public.client_portal_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_form_data_updated_at
  BEFORE UPDATE ON public.client_form_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();