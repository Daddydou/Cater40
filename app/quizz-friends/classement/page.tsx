'use client'
// app/quizz-friends/classement/page.tsx

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'quizz-friends'

type PlayerScore = {
  id: string
  name: string
  avatar_url?: string | null
  rawScore: number
  bonus: number
  finalScore: number
  isCater: boolean
}

const FRIENDS_CONFETTI = ['☂️', '☕', '🛋️', '📺', '💛', '❤️', '💙', '🍕']
const LETTERS = 'FRIENDS'.split('')

function normalizePrenom(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function isCaterPrenom(name: string): boolean {
  const n = normalizePrenom(name)
  return n.includes('cater') || n.includes('sophie')
}

export default function QuizzFriendsClassement() {
  const [players, setPlayers]               = useState<PlayerScore[]>([])
  const [caterBonus, setCaterBonus]         = useState(0)
  const [revealed, setRevealed]             = useState<Set<string>>(new Set())
  const [caterBonusVisible, setCaterBonusVisible] = useState(false)
  const [caterFinalVisible, setCaterFinalVisible] = useState(false)
  const [showConfetti, setShowConfetti]     = useState(false)
  const [showMessage, setShowMessage]       = useState(false)
  const [loading, setLoading]               = useState(true)
  const [isAnimateur, setIsAnimateur]       = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) return

      const [{ data: playersData }, { data: answersData }] = await Promise.all([
        supabase.from('players').select('id, name, avatar_url').eq('room_id', room.id),
        supabase.from('friends_answers').select('player_id, is_correct').eq('room_id', room.id),
      ])

      if (!playersData) return

      // Calculer scores bruts
      const rawScores: Record<string, number> = {}
      for (const p of playersData) rawScores[p.id] = 0
      for (const a of (answersData ?? [])) {
        if (a.is_correct) rawScores[a.player_id] = (rawScores[a.player_id] ?? 0) + 1
      }

      // Identifier Cater
      const caterPlayer = playersData.find(p => isCaterPrenom(p.name))
      const others       = playersData.filter(p => !isCaterPrenom(p.name))
      const maxOthers    = others.length > 0
        ? Math.max(...others.map(p => rawScores[p.id] ?? 0))
        : 0

      let bonus = 0
      if (caterPlayer) {
        const caterRaw = rawScores[caterPlayer.id] ?? 0
        if (caterRaw < maxOthers) {
          bonus = maxOthers - caterRaw + 1
        }
      }
      setCaterBonus(bonus)

      const result: PlayerScore[] = playersData.map(p => {
        const raw  = rawScores[p.id] ?? 0
        const isCater = isCaterPrenom(p.name)
        const b    = isCater ? bonus : 0
        return {
          id: p.id,
          name: p.name,
          avatar_url: p.avatar_url,
          rawScore: raw,
          bonus: b,
          finalScore: raw + b,
          isCater,
        }
      })

      // Trier par score final décroissant (meilleur en tête = Cater)
      result.sort((a, b) => b.finalScore - a.finalScore)
      setPlayers(result)
      setLoading(false)
    }
    load()
  }, [])

  const handleReveal = (id: string) => {
    const next = new Set(revealed)
    next.add(id)
    setRevealed(next)

    const player = players.find(p => p.id === id)
    if (player?.isCater && player.bonus > 0) {
      setTimeout(() => setCaterBonusVisible(true), 900)
      setTimeout(() => setCaterFinalVisible(true), 2200)
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 3200)
    } else if (next.size === players.length) {
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
    }
  }

  const handleRevealAll = () => {
    const allIds = new Set(players.map(p => p.id))
    setRevealed(allIds)
    const cater = players.find(p => p.isCater)
    if (cater && cater.bonus > 0) {
      setTimeout(() => setCaterBonusVisible(true), 900)
      setTimeout(() => setCaterFinalVisible(true), 2200)
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 3200)
    } else {
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
    }
  }

  const confettiPieces = showConfetti
    ? Array.from({ length: 45 }, (_, i) => ({
        id: i,
        char: i % 4 === 0
          ? FRIENDS_CONFETTI[i % FRIENDS_CONFETTI.length]
          : LETTERS[i % LETTERS.length],
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2.5,
        size: 14 + Math.random() * 18,
      }))
    : []

  if (loading) return (
    <main className="min-h-screen bg-[#1a0a2e] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#1a0a2e] text-white p-5 overflow-hidden relative">

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
          <div className="text-4xl mb-2">🛋️</div>
          <h1 className="text-2xl font-bold text-yellow-400">Classement final</h1>
          <p className="text-white/40 text-sm mt-1">Quizz Friends</p>
        </div>

        {/* Toggle animateur */}
        <button
          onClick={() => setIsAnimateur(v => !v)}
          className="w-full text-xs text-white/20 hover:text-white/40 transition-colors py-1"
        >
          {isAnimateur ? '👁 Mode animateur actif' : '🔒 Mode spectateur'}
        </button>

        {/* Classement */}
        <div className="space-y-3">
          {players.map((p, i) => {
            const rank    = i + 1
            const isShown = revealed.has(p.id) || !isAnimateur
            const medal   = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
            const isCaterRevealed = p.isCater && isShown && caterBonusVisible

            return (
              <div key={p.id} className="transition-all duration-500">
                {isShown ? (
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between rounded-2xl p-4 border ${
                      rank === 1
                        ? 'bg-yellow-500/15 border-yellow-500/40'
                        : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{medal}</span>
                        <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={36} />
                        <span className="font-semibold text-lg">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold tabular-nums transition-all duration-700 ${rank === 1 ? 'text-yellow-400' : ''}`}>
                          {p.isCater
                            ? (caterFinalVisible ? p.finalScore : p.rawScore)
                            : p.finalScore
                          } pts
                        </span>
                      </div>
                    </div>

                    {/* Badge bonus Cater */}
                    {p.isCater && p.bonus > 0 && isCaterRevealed && (
                      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-4 text-center pop-in">
                        <p className="text-yellow-300 text-lg font-bold leading-snug">
                          ✨ +{p.bonus} points bonus pour ton éclatante beauté ✨
                        </p>
                        <p className="text-yellow-400/60 text-xs mt-1">Score final : {p.finalScore} pts</p>
                      </div>
                    )}

                    {/* Victoire naturelle Cater (pas de bonus) */}
                    {p.isCater && p.bonus === 0 && isShown && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                        <p className="text-yellow-300 text-sm font-semibold">
                          👑 Victoire incontestable ! Elle gagnait déjà !
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-16 bg-white/3 border border-white/5 rounded-2xl flex items-center justify-center">
                    <span className="text-white/20 text-sm">???</span>
                  </div>
                )}

                {/* Bouton révéler */}
                {isAnimateur && !isShown && (
                  <button
                    onClick={() => handleReveal(p.id)}
                    className="w-full mt-1 bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/30 text-yellow-300 text-sm font-semibold rounded-xl py-2 transition-all active:scale-95"
                  >
                    Révéler →
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Tout révéler */}
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
            <p className="text-2xl font-bold text-yellow-400 leading-snug">
              Joyeux anniversaire Cater ! 🎂
            </p>
            <p className="text-5xl">🎉</p>
          </div>
        )}

      </div>
    </main>
  )
}
