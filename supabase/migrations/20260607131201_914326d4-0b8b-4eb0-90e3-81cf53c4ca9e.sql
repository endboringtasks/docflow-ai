ALTER TABLE public.team_invitations
  DROP CONSTRAINT IF EXISTS team_invitations_company_id_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_unique
  ON public.team_invitations (company_id, email)
  WHERE status = 'pending';