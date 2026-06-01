-- ============================================================
-- Supabase Storage — buckets jeu-bras & jeu-photos-gens
-- À exécuter dans le SQL Editor du projet ubnkuwyqclrjckogldlc
-- ============================================================

-- Créer les buckets (public = lecture directe sans auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('jeu-bras', 'jeu-bras', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('jeu-photos-gens', 'jeu-photos-gens', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================
-- Policies RLS — bucket jeu-bras
-- ============================================================

-- Lecture publique (list + GET)
CREATE POLICY "jeu-bras public select" ON storage.objects
  FOR SELECT USING (bucket_id = 'jeu-bras');

-- Upload public sans authentification
CREATE POLICY "jeu-bras public insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'jeu-bras');

-- Permettre l'upsert (mise à jour d'un fichier existant)
CREATE POLICY "jeu-bras public update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'jeu-bras');

-- ============================================================
-- Policies RLS — bucket jeu-photos-gens
-- ============================================================

CREATE POLICY "jeu-photos-gens public select" ON storage.objects
  FOR SELECT USING (bucket_id = 'jeu-photos-gens');

CREATE POLICY "jeu-photos-gens public insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'jeu-photos-gens');

CREATE POLICY "jeu-photos-gens public update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'jeu-photos-gens');
