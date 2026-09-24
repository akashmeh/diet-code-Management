CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  captain_name TEXT,
  captain_email TEXT,
  captain_phone TEXT,
  department TEXT,
  register_number TEXT,
  team_size INTEGER,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  registration_status TEXT NOT NULL DEFAULT 'registered',
  qr_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_uuid UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  checkpoint_id UUID REFERENCES public.checkpoints(id) ON DELETE SET NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('attendance','checkpoint')),
  organizer_id UUID,
  organizer_email TEXT,
  is_override BOOLEAN NOT NULL DEFAULT false,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX scans_unique_attendance ON public.scans (team_uuid) WHERE scan_type = 'attendance' AND is_override = false;
CREATE UNIQUE INDEX scans_unique_checkpoint ON public.scans (team_uuid, checkpoint_id) WHERE scan_type = 'checkpoint' AND is_override = false;
CREATE INDEX scans_scanned_at_idx ON public.scans (scanned_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoints TO authenticated;
GRANT ALL ON public.checkpoints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers manage teams" ON public.teams FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Organizers manage checkpoints" ON public.checkpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Organizers manage scans" ON public.scans FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.checkpoints (name, position) VALUES ('Registration', 1), ('Checkpoint 1', 2), ('Checkpoint 2', 3), ('Final Submission', 4);