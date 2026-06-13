-- Exécuter dans Supabase SQL Editor

-- 1. Ajouter la room quizz-friends
insert into rooms (code, status) values ('quizz-friends', 'waiting') on conflict (code) do nothing;

-- 2. Table état du jeu (une ligne par room)
create table if not exists friends_game (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  status text not null default 'waiting', -- waiting | playing | finished
  current_question_id int,                -- null = aucune question active
  question_open boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists friends_game_room_id_unique on friends_game(room_id);

-- 3. Table réponses joueurs
create table if not exists friends_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  player_id uuid not null,
  player_name text not null,
  question_id int not null,
  chosen_index int not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, question_id)
);

-- 4. RLS (accès public pour le jeu)
alter table friends_game enable row level security;
alter table friends_answers enable row level security;

create policy "friends_game_all" on friends_game for all using (true) with check (true);
create policy "friends_answers_all" on friends_answers for all using (true) with check (true);
