'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'dictee'

type Player = { id: string; name: string; score: number; avatar_url?: string | null }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function DicteeClassement() {
  const searchParams  = useSearchParams()
  const isAnimateur   = searchParams.get('a') === '1'

  const [players, setPlayers]           = useState<Player[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showMessage, setShowMessage]   = useState(false)
  const [loading, setLoading]           = useState(true)
  const roomIdRef = useRef<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', ROOM_CODE)
        .maybeSingle()
      if (!room) { setLoading(false); return }
      roomIdRef.current = room.id

      const { data } = await supabase
        .from('players')
        .select('id, name, score, avatar_url')
        .eq('room_id', room.id)
        .order('score', { ascending: true })
      if (data) setPlayers(data)
      setLoading(false)
    }
    load()
  }, [])

  // Spectateur : tout révéler immédiatement
  useEffect(() => {
    if (!loading && !isAnimateur && players.length > 0) {
      setRevealedCount(players.length)
    }
  }, [loading, isAnimateur, players.length])

  const handleNext = () => {
    const next = revealedCount + 1
    setRevealedCount(next)
    if (next >= players.length) {
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
    }
  }

  const handleRevealAll = () => {
    setRevealedCount(players.length)
    setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
  }

  const confettiPieces = showConfetti
    ? Array.from({ length: 40 }, (_, i) => ({
        id: i,
        char: i % 3 === 0 ? '🍍' : LETTERS[i % LETTERS.length],
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2,
        size: 16 + Math.random() * 16,
      }))
    : []

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex items-center justify-center text-white">
        <p className="text-white/40">Chargement…</p>
      </main>
    )
  }

  // displayOrder : meilleur en haut (index 0), moins bon en bas (index N-1)
  // On révèle du bas vers le haut : index N-1 en premier, index 0 en dernier
  const displayOrder = [...players].reverse()

  return (
    <main className="min-h-screen bg-[#1a1a0f] text-white p-5 overflow-hidden relative">

      {confettiPieces.map(p => (
        <span
          key={p.id}
          className="letter-confetti select-none pointer-events-none"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.char}
        </span>
      ))}

      <div className="max-w-lg mx-auto space-y-5 relative z-10">

        <div className="text-center pt-4 pb-2">
          <h1 className="text-2xl font-bold">🏆 Classement final</h1>
          <p className="text-white/40 text-sm mt-1">La Dictée — scores sur 20</p>
        </div>

        {isAnimateur && (
          <p className="text-center text-xs text-white/20">👁 Mode animateur</p>
        )}

        {/* Liste joueurs du meilleur (haut) au moins bon (bas) */}
        <div className="space-y-3">
          {displayOrder.map((p, i) => {
            // rank : 1 = meilleur (index 0 de displayOrder)
            const rank    = i + 1
            // révélé si on a révélé suffisamment depuis le bas
            const isShown = i >= displayOrder.length - revealedCount
            const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`

            return (
              <div key={p.id} className="transition-all duration-500">
                {isShown ? (
                  <div className={`flex items-center justify-between rounded-2xl p-4 border pop-in ${
                    rank === 1 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl w-8">{medal}</span>
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={36} />
                      <span className="font-semibold text-lg">{p.name}</span>
                    </div>
                    <span className="text-2xl font-bold tabular-nums">
                      {p.score}<span className="text-white/30 text-base">/20</span>
                    </span>
                  </div>
                ) : (
                  <div className="h-16 bg-white/3 border border-white/5 rounded-2xl flex items-center justify-center">
                    <span className="text-white/20 text-sm">???</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Boutons animateur */}
        {isAnimateur && revealedCount < players.length && (
          <div className="space-y-2">
            <button
              onClick={handleNext}
              className="w-full bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 text-amber-300 font-semibold rounded-xl py-3 transition-all active:scale-95"
            >
              Joueur suivant →
            </button>
            <button
              onClick={handleRevealAll}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/60 text-sm rounded-xl py-2 transition-all"
            >
              ✨ Tout révéler
            </button>
          </div>
        )}

        {showMessage && (
          <div className="text-center py-6 space-y-3 pop-in">
            <p className="text-2xl font-bold">La meilleure orthographe du cabinet !</p>
            <p className="text-4xl">🏅</p>
          </div>
        )}

      </div>
    </main>
  )
}
