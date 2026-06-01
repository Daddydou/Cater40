-- Questions du Concours Ortho
CREATE TABLE ortho_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id),
  ordre integer,
  type text, -- 'qcm' ou 'libre'
  question text,
  propositions jsonb, -- null si libre, array de strings si QCM
  bonne_reponse text,
  status text DEFAULT 'pending' -- 'pending', 'active', 'closed'
);

-- Réponses des joueurs
CREATE TABLE ortho_reponses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id),
  question_id uuid REFERENCES ortho_questions(id),
  player_id uuid REFERENCES players(id),
  reponse text,
  is_correct boolean DEFAULT NULL,
  created_at timestamp DEFAULT now()
);

-- Activer le Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ortho_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE ortho_reponses;
