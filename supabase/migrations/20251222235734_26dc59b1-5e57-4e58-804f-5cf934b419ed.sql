-- Create profiles table to store user display info
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can view profiles (needed for team member display)
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- System can insert profiles (via trigger)
CREATE POLICY "System can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create team invitations table
CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.company_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Company members can view invitations
CREATE POLICY "Members can view company invitations"
ON public.team_invitations
FOR SELECT
USING (is_company_member(auth.uid(), company_id));

-- Admins/owners can create invitations
CREATE POLICY "Admins can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id) AND role <> 'owner');

-- Admins/owners can delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.team_invitations
FOR DELETE
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Admins/owners can update invitations
CREATE POLICY "Admins can update invitations"
ON public.team_invitations
FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Function to accept invitation when user logs in
CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invitation RECORD;
BEGIN
  -- Find pending invitations for this user's email
  FOR invitation IN
    SELECT * FROM public.team_invitations
    WHERE email = NEW.email AND status = 'pending'
  LOOP
    -- Add user to company
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (invitation.company_id, NEW.id, invitation.role)
    ON CONFLICT DO NOTHING;
    
    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET status = 'accepted'
    WHERE id = invitation.id;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to accept invitations on signup
CREATE TRIGGER on_auth_user_created_accept_invitations
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_pending_invitations();