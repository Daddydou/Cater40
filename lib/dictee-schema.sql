-- ─────────────────────────────────────────────
-- Jeu : La Dictée — schéma Supabase
-- ─────────────────────────────────────────────

CREATE TABLE dictee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id),
  texte_original text,
  status text DEFAULT 'waiting', -- 'waiting' | 'writing' | 'uploading' | 'correcting' | 'finished'
  created_at timestamp DEFAULT now()
);

CREATE TABLE dictee_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES dictee_sessions(id),
  player_id uuid REFERENCES players(id),
  image_url text,
  texte_ocr text,
  fautes_ia jsonb DEFAULT '[]',
  fautes_finales jsonb DEFAULT '[]',
  score integer DEFAULT 20,
  status text DEFAULT 'pending', -- 'pending' | 'uploaded' | 'analyzed' | 'corrected'
  created_at timestamp DEFAULT now()
);

-- RLS
ALTER TABLE dictee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictee_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON dictee_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dictee_copies FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- À faire manuellement dans le dashboard Supabase :
-- 1. Table Editor → dictee_sessions → Realtime → Enable
-- 2. Table Editor → dictee_copies  → Realtime → Enable
-- 3. Storage → New bucket → Nom : "dictee-copies" → Public : oui
-- ─────────────────────────────────────────────
