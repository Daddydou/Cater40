// lib/rooms.ts
// Rooms fixes — une par jeu, identifiées par leur "code" en DB

import { supabase } from '@/lib/supabase'

export const ROOM_CODES = {
  'jeu-bras':          'jeu-bras',
  'concours-ortho':    'concours-ortho',
  'dictee':            'dictee',
  'famille-or':        'famille-or',
  'cater-en-or':       'cater-en-or',
  'photos-gens':       'photos-gens',
  'citations-perdues': 'citations-perdues',
} as const

export type GameSlug = keyof typeof ROOM_CODES

// Retourne l'UUID réel de la room à partir de son code
// Usage : const roomId = await getRoomId('jeu-bras')
export async function getRoomId(slug: GameSlug): Promise<string> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id')
    .eq('code', ROOM_CODES[slug])
    .single()

  if (error || !data) throw new Error(`Room introuvable pour le slug : ${slug}`)
  return data.id
}

// Reset complet d'un jeu (supprime joueurs + réponses, remet status à 'waiting')
export async function resetRoom(slug: GameSlug): Promise<void> {
  await supabase.rpc('reset_room', { p_code: ROOM_CODES[slug] })
}
