-- create contact_submissions table to store user contact form submissions
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- create index for faster queries
CREATE INDEX idx_contact_submissions_user_id ON public.contact_submissions(user_id);
CREATE INDEX idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);

-- enable rls
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- create rls policies
CREATE POLICY "users can view their own submissions"
  ON public.contact_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert their own submissions"
  ON public.contact_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- admin policy (service role can see all)
CREATE POLICY "service role can view all submissions"
  ON public.contact_submissions FOR ALL
  USING (auth.role() = 'service_role');

-- create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS on_contact_submission_updated ON public.contact_submissions;
CREATE TRIGGER on_contact_submission_updated
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

