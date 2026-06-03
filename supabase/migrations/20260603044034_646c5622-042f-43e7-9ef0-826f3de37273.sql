-- ============ Reverse Engineer: schema ============

-- Projects
CREATE TABLE public.re_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  product_url TEXT,
  description TEXT,
  industry TEXT,
  audience TEXT,
  output_config JSONB NOT NULL DEFAULT '{"ddd":true,"bdd":true,"tech":true,"docs":true}'::jsonb,
  output_format TEXT NOT NULL DEFAULT 'markdown',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_projects TO authenticated;
GRANT ALL ON public.re_projects TO service_role;
ALTER TABLE public.re_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view re_projects" ON public.re_projects
  FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can create re_projects" ON public.re_projects
  FOR INSERT TO authenticated WITH CHECK (is_company_member(auth.uid(), company_id) AND created_by = auth.uid());
CREATE POLICY "Members can update re_projects" ON public.re_projects
  FOR UPDATE TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins can delete re_projects" ON public.re_projects
  FOR DELETE TO authenticated USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE TRIGGER update_re_projects_updated_at
  BEFORE UPDATE ON public.re_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Roles
CREATE TABLE public.re_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_roles TO authenticated;
GRANT ALL ON public.re_roles TO service_role;
ALTER TABLE public.re_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage re_roles" ON public.re_roles
  FOR ALL TO authenticated USING (is_company_member(auth.uid(), company_id)) WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_re_roles_updated_at BEFORE UPDATE ON public.re_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Journeys
CREATE TABLE public.re_journeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  trigger TEXT,
  preconditions TEXT,
  main_steps TEXT,
  variations TEXT,
  errors TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_journeys TO authenticated;
GRANT ALL ON public.re_journeys TO service_role;
ALTER TABLE public.re_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage re_journeys" ON public.re_journeys
  FOR ALL TO authenticated USING (is_company_member(auth.uid(), company_id)) WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_re_journeys_updated_at BEFORE UPDATE ON public.re_journeys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Domain terms
CREATE TABLE public.re_domain_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'noun',
  term TEXT NOT NULL,
  definition TEXT,
  classification TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_domain_terms TO authenticated;
GRANT ALL ON public.re_domain_terms TO service_role;
ALTER TABLE public.re_domain_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage re_domain_terms" ON public.re_domain_terms
  FOR ALL TO authenticated USING (is_company_member(auth.uid(), company_id)) WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_re_domain_terms_updated_at BEFORE UPDATE ON public.re_domain_terms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Data objects
CREATE TABLE public.re_data_objects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  system_of_record TEXT,
  sync_rules TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_data_objects TO authenticated;
GRANT ALL ON public.re_data_objects TO service_role;
ALTER TABLE public.re_data_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage re_data_objects" ON public.re_data_objects
  FOR ALL TO authenticated USING (is_company_member(auth.uid(), company_id)) WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_re_data_objects_updated_at BEFORE UPDATE ON public.re_data_objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- External systems
CREATE TABLE public.re_external_systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT,
  direction TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_external_systems TO authenticated;
GRANT ALL ON public.re_external_systems TO service_role;
ALTER TABLE public.re_external_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage re_external_systems" ON public.re_external_systems
  FOR ALL TO authenticated USING (is_company_member(auth.uid(), company_id)) WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_re_external_systems_updated_at BEFORE UPDATE ON public.re_external_systems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Deliverables
CREATE TABLE public.re_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL,
  category TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL DEFAULT '',
  assumptions TEXT,
  open_questions TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_deliverables TO authenticated;
GRANT ALL ON public.re_deliverables TO service_role;
ALTER TABLE public.re_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage re_deliverables" ON public.re_deliverables
  FOR ALL TO authenticated USING (is_company_member(auth.uid(), company_id)) WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE TRIGGER update_re_deliverables_updated_at BEFORE UPDATE ON public.re_deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_re_projects_company ON public.re_projects(company_id);
CREATE INDEX idx_re_roles_project ON public.re_roles(project_id);
CREATE INDEX idx_re_journeys_project ON public.re_journeys(project_id);
CREATE INDEX idx_re_domain_terms_project ON public.re_domain_terms(project_id);
CREATE INDEX idx_re_data_objects_project ON public.re_data_objects(project_id);
CREATE INDEX idx_re_external_systems_project ON public.re_external_systems(project_id);
CREATE INDEX idx_re_deliverables_project ON public.re_deliverables(project_id);