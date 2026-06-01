-- Une Cater en or — schema

DROP TABLE IF EXISTS public.cater_questions;
DROP TABLE IF EXISTS public.cater_players;
DROP TABLE IF EXISTS public.cater_sessions;

CREATE TABLE public.cater_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished')),
  current_question_index integer NOT NULL DEFAULT 0,
  team_a_name text,
  team_b_name text,
  team_a_score integer NOT NULL DEFAULT 0,
  team_b_score integer NOT NULL DEFAULT 0,
  active_team text CHECK (active_team IN ('A', 'B')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cater_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cater_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  team text CHECK (team IN ('A', 'B'))
);

CREATE TABLE public.cater_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cater_sessions(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  order_index integer NOT NULL
);

ALTER TABLE public.cater_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cater_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cater_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cater_sessions_public" ON public.cater_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "cater_players_public" ON public.cater_players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "cater_questions_public" ON public.cater_questions FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.cater_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cater_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cater_questions;
