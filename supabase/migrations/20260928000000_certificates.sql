-- 1. Create a tracking table for certificates that doesn't mess with the existing `teams` JSONB structure
CREATE TABLE public.certificate_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_uuid UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  certificate_sent BOOLEAN NOT NULL DEFAULT false,
  certificate_sent_at TIMESTAMP WITH TIME ZONE,
  certificate_send_error TEXT,
  -- A unique constraint ensures we don't accidentally send multiple certs to the same person on the same team
  UNIQUE(team_uuid, participant_email)
);

-- 2. Create the audit log table
CREATE TABLE public.certificate_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_id UUID REFERENCES public.certificate_tracking(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'test')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Security & RLS (Consistent with your current open setup for organizers)
ALTER TABLE public.certificate_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers manage certificate tracking" ON public.certificate_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Organizers manage certificate logs" ON public.certificate_send_log FOR ALL USING (true) WITH CHECK (true);
