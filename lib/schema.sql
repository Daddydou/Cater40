-- ============================================================
-- Schéma Supabase — Jeu d'anniversaire multijoueur
-- ============================================================

-- Table des salles de jeu
CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'playing', 'finished')),
  current_game TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des joueurs
CREATE TABLE players (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  is_birthday_person BOOLEAN NOT NULL DEFAULT FALSE,
  score             INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des réponses
CREATE TABLE answers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id    TEXT NOT NULL,
  answer     TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index utiles pour les requêtes fréquentes
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_answers_room_id ON answers(room_id);
CREATE INDEX idx_answers_player_id ON answers(player_id);
CREATE INDEX idx_rooms_code ON rooms(code);

-- ============================================================
-- Realtime : activer la publication sur rooms et players
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- ============================================================
-- Row Level Security (RLS) — optionnel mais recommandé
-- Désactivé par défaut pour simplifier le démarrage.
-- Décommentez si vous ajoutez de l'auth plus tard.
-- ============================================================
-- ALTER TABLE rooms   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
