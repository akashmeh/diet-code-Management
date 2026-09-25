-- Remove the requirement for users to be 'authenticated' to manage data.
-- This makes the dashboard open to anyone who has the URL.

DROP POLICY IF EXISTS "Organizers manage teams" ON public.teams;
CREATE POLICY "Organizers manage teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Organizers manage checkpoints" ON public.checkpoints;
CREATE POLICY "Organizers manage checkpoints" ON public.checkpoints FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Organizers manage scans" ON public.scans;
CREATE POLICY "Organizers manage scans" ON public.scans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Organizers manage email_logs" ON public.email_logs;
CREATE POLICY "Organizers manage email_logs" ON public.email_logs FOR ALL USING (true) WITH CHECK (true);
