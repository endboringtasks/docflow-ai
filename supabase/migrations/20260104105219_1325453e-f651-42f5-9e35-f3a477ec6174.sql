-- Create beta_feedback table for collecting user feedback
CREATE TABLE public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'question', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  current_page TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'wont_fix')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users can submit feedback (must be authenticated)
CREATE POLICY "Users can submit feedback"
  ON public.beta_feedback 
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.beta_feedback 
  FOR SELECT
  USING (auth.uid() = user_id);

-- Platform admins can view all feedback
CREATE POLICY "Platform admins can view all feedback"
  ON public.beta_feedback 
  FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- Platform admins can update feedback (status, notes)
CREATE POLICY "Platform admins can update feedback"
  ON public.beta_feedback 
  FOR UPDATE
  USING (is_platform_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_beta_feedback_updated_at
  BEFORE UPDATE ON public.beta_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();