ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DROP TRIGGER IF EXISTS set_companies_updated_at ON public.companies;
CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();