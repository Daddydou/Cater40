import { supabase } from '@/lib/supabase'

export async function uploadAvatar(file: File, roomId: string, playerId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${roomId}/${playerId}.${ext}`

  const { error } = await supabase.storage
    .from('player-avatars')
    .upload(path, file, { upsert: true })

  if (error) return null

  const { data } = supabase.storage.from('player-avatars').getPublicUrl(path)
  return data.publicUrl
}
