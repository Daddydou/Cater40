export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  current_game: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_birthday_person: boolean;
  score: number;
  created_at: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface Answer {
  id: string;
  room_id: string;
  player_id: string;
  game_id: string;
  answer: string;
  is_correct: boolean;
  created_at: string;
}
