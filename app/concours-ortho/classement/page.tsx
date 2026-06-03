'use client'
// app/concours-ortho/classement/page.tsx

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'concours-ortho'

type Player = { id: string; name: string; score: number; avatar_url?: string | null }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function ConcursOrthoClassement() {
  const [players, setPlayers]       = useState<Player[]>([])
  const [revealed, setRevealed]     = useState<Set<string>>(new Set())
  const [showConfetti, setShowConfetti] = useState(false)
  const [showMessage, setShowMessage]   = useState(false)
  const [loading, setLoading]           = useState(true)
  const [isAnimateur, setIsAnimateur]   = useState(true)

useEffect(() => {
  const load = async () => {
    const { data: room } = await supabase
      .from('rooms').select('id').eq('code', ROOM_CODE).single()
    if (!room) { console.log('Room non trouvée'); return }

    console.log('Room ID:', room.id)

    const { data, error } = await supabase
      .from('players').select('id, name, score, avatar_url')
      .eq('room_id', room.id)
      .order('score', { ascending: true })
    
    console.log('Players:', data, 'Error:', error)
    if (data) setPlayers(data)
    setLoading(false)
  }
  load()
}, [])

  const handleReveal = (id: string) => {
    const next = new Set(revealed)
    next.add(id)
    setRevealed(next)
    if (next.size === players.length) {
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
    }
  }

  const handleRevealAll = () => {
    setRevealed(new Set(players.map(p => p.id)))
    setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
  }

  // Confettis lettres + ananas
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

  if (loading) return (
    <main className="min-h-screen bg-[#0B3D3A] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  // Classement inversé pour l'affichage (meilleur en haut quand révélé)
  const displayOrder = [...players].reverse()

  return (
    <main className="min-h-screen bg-[#0B3D3A] text-white p-5 overflow-hidden relative">

      {/* Confettis */}
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

        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <h1 className="text-2xl font-bold">🏆 Classement final</h1>
          <p className="text-white/40 text-sm mt-1">Concours Ortho</p>
        </div>

        {/* Toggle animateur */}
        <button
          onClick={() => setIsAnimateur(v => !v)}
          className="w-full text-xs text-white/20 hover:text-white/40 transition-colors py-1"
        >
          {isAnimateur ? '👁 Mode animateur actif' : '🔒 Mode spectateur'}
        </button>

        {/* Podium / liste */}
        <div className="space-y-3">
          {displayOrder.map((p, i) => {
            const rank    = displayOrder.length - i
            const isShown = revealed.has(p.id) || !isAnimateur
            const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`

            return (
              <div
                key={p.id}
                className={`transition-all duration-500 ${isShown ? 'pop-in' : 'opacity-0 scale-95'}`}
              >
                {isShown ? (
                  <div className={`flex items-center justify-between rounded-2xl p-4 border ${
                    rank === 1
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{medal}</span>
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={36} />
                      <span className="font-semibold text-lg">{p.name}</span>
                    </div>
                    <span className="text-2xl font-bold tabular-nums">{p.score} pts</span>
                  </div>
                ) : (
                  <div className="h-16 bg-white/3 border border-white/5 rounded-2xl flex items-center justify-center">
                    <span className="text-white/20 text-sm">???</span>
                  </div>
                )}

                {/* Bouton révéler (animateur uniquement) */}
                {isAnimateur && !isShown && (
                  <button
                    onClick={() => handleReveal(p.id)}
                    className="w-full mt-1 bg-teal-500/20 hover:bg-teal-500/40 border border-teal-500/30 text-teal-300 text-sm font-semibold rounded-xl py-2 transition-all active:scale-95"
                  >
                    Révéler →
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Bouton tout révéler */}
        {isAnimateur && revealed.size < players.length && (
          <button
            onClick={handleRevealAll}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl py-3 transition-all active:scale-95"
          >
            ✨ Tout révéler
          </button>
        )}

        {/* Message final */}
        {showMessage && (
          <div className="text-center py-6 space-y-3 pop-in">
            <p className="text-2xl font-bold leading-snug">
              Envie d&apos;engager une autre personne dans ton cabinet ?
            </p>
            <p className="text-4xl">😄</p>
          </div>
        )}

      </div>
    </main>
  )
}
