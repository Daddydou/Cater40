-- Run this in Supabase SQL Editor

ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE POLICY "Allow avatar uploads" ON storage.objects
FOR ALL USING (bucket_id = 'player-avatars')
WITH CHECK (bucket_id = 'player-avatars');
