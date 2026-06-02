'use client'
// ============================================================
// PATTERN À APPLIQUER DANS CHAQUE PAGE JOUEUR / ANIMATEUR
// Remplace complètement la logique room/[code]/
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getRoomId, type GameSlug } from '@/lib/room'

// Hook réutilisable — à copier dans chaque page ou dans lib/useRoom.ts
export function useRoom(slug: GameSlug) {
  const [roomId, setRoomId]   = useState<string | null>(null)
  const [status, setStatus]   = useState<string>('waiting')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>

    const init = async () => {
      const id = await getRoomId(slug)
      setRoomId(id)

      const { data } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', id)
        .single()

      if (data) setStatus(data.status)
      setLoading(false)

      // Écouter les changements de statut en temps réel
      channel = supabase.channel(`room-status-${slug}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${id}`,
        }, (payload) => {
          setStatus(payload.new.status)
        })
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [slug])

  const setRoomStatus = async (newStatus: string) => {
    if (!roomId) return
    await supabase.from('rooms').update({ status: newStatus }).eq('id', roomId)
    setStatus(newStatus)
  }

  return { roomId, status, loading, setRoomStatus }
}

// ============================================================
// EXEMPLE D'UTILISATION dans app/jeu-bras/page.tsx
// ============================================================
/*
export default function JeuBras() {
  const { roomId, status, loading } = useRoom('jeu-bras')

  if (loading) return <Loading />
  if (status === 'waiting') return <Attente />

  // ... reste du composant avec roomId disponible
}
*/

// ============================================================
// EXEMPLE D'UTILISATION dans app/jeu-bras/animateur/page.tsx
// ============================================================
/*
export default function JeuBrasAnimateur() {
  const { roomId, status, loading, setRoomStatus } = useRoom('jeu-bras')

  const handleStart  = () => setRoomStatus('playing')
  const handleFinish = () => setRoomStatus('finished')
  const handleReset  = () => resetRoom('jeu-bras')

  // ... reste du composant
}
*/
