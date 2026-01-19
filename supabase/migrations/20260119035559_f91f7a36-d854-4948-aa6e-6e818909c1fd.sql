-- Create junction table linking categories to applicant types with configuration
CREATE TABLE public.category_applicant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.application_categories(id) ON DELETE CASCADE,
  applicant_type_id UUID NOT NULL REFERENCES public.applicant_types(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT false,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  min_count INTEGER NOT NULL DEFAULT 0,
  max_count INTEGER DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, applicant_type_id)
);

-- Create table to track applicants per application
CREATE TABLE public.application_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_application_id UUID NOT NULL REFERENCES public.visa_applications(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  applicant_type_id UUID NOT NULL REFERENCES public.applicant_types(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(visa_application_id, client_id, applicant_type_id)
);

-- Enable Row Level Security
ALTER TABLE public.category_applicant_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_applicants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for category_applicant_types (admin only for write, all authenticated for read)
CREATE POLICY "Platform admins can manage category applicant types"
ON public.category_applicant_types
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Authenticated users can view category applicant types"
ON public.category_applicant_types
FOR SELECT
TO authenticated
USING (true);

-- Create RLS policies for application_applicants (company-based access)
CREATE POLICY "Company members can view application applicants"
ON public.application_applicants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.visa_applications va
    JOIN public.company_members cm ON cm.company_id = va.company_id
    WHERE va.id = application_applicants.visa_application_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Company admins and owners can manage application applicants"
ON public.application_applicants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.visa_applications va
    JOIN public.company_members cm ON cm.company_id = va.company_id
    WHERE va.id = application_applicants.visa_application_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.visa_applications va
    JOIN public.company_members cm ON cm.company_id = va.company_id
    WHERE va.id = application_applicants.visa_application_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- Create indexes for performance
CREATE INDEX idx_category_applicant_types_category ON public.category_applicant_types(category_id);
CREATE INDEX idx_category_applicant_types_applicant ON public.category_applicant_types(applicant_type_id);
CREATE INDEX idx_application_applicants_application ON public.application_applicants(visa_application_id);
CREATE INDEX idx_application_applicants_client ON public.application_applicants(client_id);
CREATE INDEX idx_application_applicants_type ON public.application_applicants(applicant_type_id);