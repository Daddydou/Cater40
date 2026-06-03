'use client'
// app/photos-gens/animateur/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const ROOM_CODE = 'photos-gens'

type Player = { id: string; name: string; score: number }

export default function PhotosGensAnimateur() {
  const initialized = useRef(false)
  const [roomId, setRoomId]   = useState<string | null>(null)
  const [status, setStatus]   = useState<string>('waiting')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPlayers = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('players')
      .select('id, name, score')
      .eq('room_id', rid)
      .order('score', { ascending: false })
    if (data) setPlayers(data)
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const init = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('code', ROOM_CODE)
        .single()
      if (!data) return
      setRoomId(data.id)
      setStatus(data.status)
      setLoading(false)
      fetchPlayers(data.id)

      // Realtime joueurs
      const ch = supabase
        .channel(`animateur-photos-gens-${data.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'players',
          filter: `room_id=eq.${data.id}`,
        }, () => fetchPlayers(data.id))
        .subscribe()

      return () => { supabase.removeChannel(ch) }
    }
    init()
    setInterval(() => {
      if (roomId) fetchPlayers(roomId)
    }, 5000)
  }, [])

  const setRoomStatus = async (s: string) => {
    if (!roomId) return
    await supabase.from('rooms').update({ status: s }).eq('id', roomId)
    setStatus(s)
  }

  const handleReset = async () => {
    if (!confirm('Remettre à zéro ? Tous les joueurs et scores seront supprimés.')) return
    await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    setPlayers([])
    setStatus('waiting')
  }

  const gameUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/photos-gens`
    : 'cater40.vercel.app/photos-gens'

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-white">
        <p className="text-white/40">Chargement…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">📸 Photos Gens</h1>
            <p className="text-white/40 text-sm">Interface animateur</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            status === 'waiting'  ? 'bg-yellow-500/20 text-yellow-300' :
            status === 'playing'  ? 'bg-green-500/20 text-green-300'  :
                                    'bg-white/10 text-white/50'
          }`}>
            {status === 'waiting' ? '⏳ Attente' : status === 'playing' ? '▶️ En cours' : '✅ Terminé'}
          </span>
        </div>

        {/* Lien joueurs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
          <p className="text-white/40 text-xs uppercase tracking-wide">Lien pour les joueurs</p>
          <p className="font-mono text-sm text-blue-300 break-all">{gameUrl}</p>
          <p className="text-white/25 text-xs">À projeter ou partager en QR code</p>
        </div>

        {/* Joueurs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs uppercase tracking-wide">
              Joueurs ({players.length})
            </p>
            <button
              onClick={() => roomId && fetchPlayers(roomId)}
              className="text-white/30 hover:text-white/60 text-xs transition-colors"
            >
              ↻ Rafraîchir
            </button>
          </div>
          {players.length === 0
            ? <p className="text-white/25 text-sm text-center py-3">Aucun joueur inscrit</p>
            : players.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs w-5 text-right">{i + 1}.</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <span className="text-white/50 text-sm tabular-nums">{p.score} pts</span>
              </div>
            ))
          }
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {status === 'waiting' && (
            <button
              onClick={() => setRoomStatus('playing')}
              disabled={players.length === 0}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-4 text-lg disabled:opacity-30 transition-all active:scale-95"
            >
              ▶️ Lancer le jeu
            </button>
          )}

          {status === 'playing' && (
            <button
              onClick={() => setRoomStatus('finished')}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl py-4 transition-all active:scale-95"
            >
              ⏹ Terminer le jeu
            </button>
          )}

          {status === 'finished' && players.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <p className="text-white/40 text-xs uppercase tracking-wide">🏆 Classement final</p>
              {players.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="font-bold tabular-nums">{p.score} pts</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl py-3 transition-all active:scale-95"
          >
            🔄 Nouvelle partie (reset complet)
          </button>
        </div>

      </div>
    </main>
  )
}
