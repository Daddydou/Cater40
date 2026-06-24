'use client'
// app/concours-ortho/classement/page.tsx

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'concours-ortho'

type Player = { id: string; name: string; score: number; avatar_url?: string | null }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function groupByScore(players: Player[]): Player[][] {
  if (players.length === 0) return []
  const groups: Player[][] = []
  let currentGroup: Player[] = []
  for (const p of players) {
    if (currentGroup.length === 0 || p.score === currentGroup[0].score) {
      currentGroup.push(p)
    } else {
      groups.push(currentGroup)
      currentGroup = [p]
    }
  }
  groups.push(currentGroup)
  return groups
}

export default function ConcursOrthoClassement() {
  const [players, setPlayers]           = useState<Player[]>([])
  const [roomId, setRoomId]             = useState<string | null>(null)
  const [revealCount, setRevealCount]   = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showMessage, setShowMessage]   = useState(false)
  const [loading, setLoading]           = useState(true)
  const confettiTriggered = useRef(false)

  useEffect(() => {
    const load = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id, reveal_count').eq('code', ROOM_CODE).single()
      if (!room) { setLoading(false); return }

      setRoomId(room.id)
      const rc = room.reveal_count ?? 0
      setRevealCount(rc)

      const { data } = await supabase
        .from('players').select('id, name, score, avatar_url')
        .eq('room_id', room.id).order('score', { ascending: false })
      if (data) {
        setPlayers(data)
        const groups = groupByScore(data)
        if (rc >= groups.length && groups.length > 0) {
          confettiTriggered.current = true
          setShowConfetti(true)
          setShowMessage(true)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  // Polling reveal_count toutes les 2s
  useEffect(() => {
    if (!roomId) return
    const id = setInterval(async () => {
      const { data } = await supabase
        .from('rooms').select('reveal_count').eq('id', roomId).single()
      if (data?.reveal_count !== undefined) setRevealCount(data.reveal_count)
    }, 2000)
    return () => clearInterval(id)
  }, [roomId])

  // Déclencher confettis quand tout est révélé
  useEffect(() => {
    if (players.length === 0 || confettiTriggered.current) return
    const groups = groupByScore(players)
    if (revealCount >= groups.length && groups.length > 0) {
      confettiTriggered.current = true
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
    }
  }, [revealCount, players])

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

  const groups = groupByScore(players)
  const totalGroups = groups.length
  // groups[0] = meilleur (révélé en dernier) — groups[N-1] = pire (révélé en premier)
  const isGroupRevealed = (gi: number) => revealCount >= totalGroups - gi

  return (
    <main className="min-h-screen bg-[#0B3D3A] text-white p-5 overflow-hidden relative">

      {/* Confettis lettres + ananas */}
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

        {/* Classement par groupes */}
        <div className="space-y-3">
          {groups.map((group, gi) => {
            const rank  = gi + 1
            const shown = isGroupRevealed(gi)
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`

            if (!shown) {
              return (
                <div key={gi} className="h-16 bg-white/3 border border-white/5 rounded-2xl flex items-center justify-center">
                  <span className="text-white/20 text-sm">???</span>
                </div>
              )
            }

            return (
              <div
                key={gi}
                className={`rounded-2xl p-4 border pop-in ${
                  rank === 1
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{medal}</span>
                    <div className="space-y-1">
                      {group.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                          <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={36} />
                          <span className="font-semibold text-lg">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{group[0].score} pts</span>
                </div>
              </div>
            )
          })}
        </div>

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
