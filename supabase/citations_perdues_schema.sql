-- Citations Perdues — schema
-- À exécuter dans le SQL Editor du projet ubnkuwyqclrjckogldlc

DROP TABLE IF EXISTS public.citations_game;

CREATE TABLE public.citations_game (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  points        integer NOT NULL DEFAULT 0,
  lettres_achetees text[]  NOT NULL DEFAULT '{}',
  associations  jsonb   NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.citations_game ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citations_game_public" ON public.citations_game
  FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.citations_game;

-- ── Bucket citations-photos ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('citations-photos', 'citations-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "citations_photos_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'citations-photos');

CREATE POLICY "citations_photos_public_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'citations-photos');

CREATE POLICY "citations_photos_public_update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'citations-photos');
