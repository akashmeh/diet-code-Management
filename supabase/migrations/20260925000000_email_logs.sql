CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_uuid UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','test')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by TEXT  -- organizer email
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers manage email_logs" ON public.email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
