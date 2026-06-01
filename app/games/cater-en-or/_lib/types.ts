export type SessionStatus = 'lobby' | 'playing' | 'finished';
export type TeamSide = 'A' | 'B';

export interface CaterSession {
  id: string;
  status: SessionStatus;
  current_question_index: number;
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_score: number;
  team_b_score: number;
  active_team: TeamSide | null;
  created_at: string;
}

export interface CaterPlayer {
  id: string;
  session_id: string;
  name: string;
  team: TeamSide | null;
}

export interface CaterQuestion {
  id: string;
  session_id: string;
  question_text: string;
  order_index: number;
}

export const DEFAULT_QUESTIONS = [
  'Prénoms féminins commençant par la lettre M',
  'Marques de voiture françaises',
  'Capitales européennes',
  'Plats italiens',
  "Sports olympiques d'été",
  "Pays d'Afrique subsaharienne",
  'Instruments de musique à cordes',
  'Films avec Leonardo DiCaprio',
  'Légumes verts',
  'Chanteurs français des années 80',
];
