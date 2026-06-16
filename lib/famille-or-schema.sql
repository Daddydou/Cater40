CREATE TABLE famille_or_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id),
  equipe1_nom text DEFAULT 'Équipe 1',
  equipe2_nom text DEFAULT 'Équipe 2',
  equipe1_score integer DEFAULT 0,
  equipe2_score integer DEFAULT 0,
  question_active_id uuid,
  status text DEFAULT 'waiting',
  created_at timestamp DEFAULT now()
);

CREATE TABLE famille_or_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES famille_or_sessions(id),
  ordre integer,
  question text,
  status text DEFAULT 'pending',
  equipe_active integer DEFAULT 1,
  croix_equipe1 integer DEFAULT 0,
  croix_equipe2 integer DEFAULT 0,
  phase text DEFAULT 'normal',
  created_at timestamp DEFAULT now()
);

CREATE TABLE famille_or_reponses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES famille_or_questions(id),
  ordre integer,
  texte text,
  points integer DEFAULT 0,
  revealed boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Migration : colonnes finale sur la session
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_status text;
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_rep_eq1 uuid;
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_rep_eq2 uuid;
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_question_ordre integer DEFAULT 0;

-- Colonnes représentants et révélation sur les questions
ALTER TABLE famille_or_questions ADD COLUMN IF NOT EXISTS representant_eq1 uuid;
ALTER TABLE famille_or_questions ADD COLUMN IF NOT EXISTS representant_eq2 uuid;
ALTER TABLE famille_or_questions ADD COLUMN IF NOT EXISTS buzzer_winner_id uuid;

-- Table finale
CREATE TABLE IF NOT EXISTS famille_or_finale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES famille_or_sessions(id),
  ordre integer,
  question text,
  reponse_eq1 text,
  reponse_eq2 text,
  points integer DEFAULT 20,
  status text DEFAULT 'pending',
  reponses text,
  points_eq1 integer DEFAULT 0,
  points_eq2 integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Migration : colonnes points par équipe sur les questions finale
ALTER TABLE famille_or_finale ADD COLUMN IF NOT EXISTS reponses text;
ALTER TABLE famille_or_finale ADD COLUMN IF NOT EXISTS points_eq1 INTEGER DEFAULT 0;
ALTER TABLE famille_or_finale ADD COLUMN IF NOT EXISTS points_eq2 INTEGER DEFAULT 0;

-- Migration : colonnes validation et correction sur la session
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_rep1_valide BOOLEAN DEFAULT FALSE;
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_rep2_valide BOOLEAN DEFAULT FALSE;
ALTER TABLE famille_or_sessions ADD COLUMN IF NOT EXISTS finale_correction_ordre INTEGER DEFAULT 1;

ALTER TABLE famille_or_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE famille_or_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE famille_or_reponses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON famille_or_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON famille_or_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON famille_or_reponses FOR ALL USING (true) WITH CHECK (true);

-- Active le Realtime sur les trois tables dans le dashboard Supabase :
-- Database > Replication > famille_or_sessions, famille_or_questions, famille_or_reponses
