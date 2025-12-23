-- Create table to store Google Drive connections per company
CREATE TABLE public.google_drive_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  root_folder_id TEXT,
  root_folder_name TEXT,
  connected_by UUID NOT NULL,
  connected_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;

-- Only company admins/owners can view connections
CREATE POLICY "Admins can view drive connections"
ON public.google_drive_connections
FOR SELECT
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Only admins/owners can insert connections
CREATE POLICY "Admins can create drive connections"
ON public.google_drive_connections
FOR INSERT
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

-- Only admins/owners can update connections
CREATE POLICY "Admins can update drive connections"
ON public.google_drive_connections
FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Only admins/owners can delete connections
CREATE POLICY "Admins can delete drive connections"
ON public.google_drive_connections
FOR DELETE
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Add trigger for updated_at
CREATE TRIGGER update_google_drive_connections_updated_at
BEFORE UPDATE ON public.google_drive_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();