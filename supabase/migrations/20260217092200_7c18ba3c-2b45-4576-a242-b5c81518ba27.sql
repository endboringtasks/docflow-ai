
CREATE OR REPLACE FUNCTION public.accept_pending_invitations(p_user_id UUID, p_email TEXT)
RETURNS VOID AS $$
DECLARE
  inv RECORD;
BEGIN
  FOR inv IN
    SELECT id, company_id, role
    FROM public.team_invitations
    WHERE email = lower(p_email)
      AND status = 'pending'
  LOOP
    -- Create company_members record if not already a member
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (inv.company_id, p_user_id, inv.role)
    ON CONFLICT DO NOTHING;

    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET status = 'accepted'
    WHERE id = inv.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.accept_pending_invitations(UUID, TEXT) TO authenticated;
