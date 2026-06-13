'use client'
// app/quizz-friends/classement/page.tsx

import { useState, useEffect, useRef } from 'react'
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
  const [players, setPlayers]                     = useState<PlayerScore[]>([])
  const [roomId, setRoomId]                       = useState<string | null>(null)
  const [revealCount, setRevealCount]             = useState(0)
  const [caterBonusVisible, setCaterBonusVisible] = useState(false)
  const [caterFinalVisible, setCaterFinalVisible] = useState(false)
  const [showConfetti, setShowConfetti]           = useState(false)
  const [showMessage, setShowMessage]             = useState(false)
  const [loading, setLoading]                     = useState(true)
  // Même mécanisme que /concours-ortho/classement : toggle local.
  // Démarre à false (spectateur) pour que les joueurs ne voient aucun bouton.
  const [isAnimateur, setIsAnimateur]             = useState(false)

  const caterAnimTriggered = useRef(false)

  // Chargement initial : players, scores, reveal_count courant
  useEffect(() => {
    const load = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) return
      setRoomId(room.id)

      const [{ data: playersData }, { data: answersData }, { data: gameData }] = await Promise.all([
        supabase.from('players').select('id, name, avatar_url').eq('room_id', room.id),
        supabase.from('friends_answers').select('player_id, is_correct').eq('room_id', room.id),
        supabase.from('friends_game').select('reveal_count').eq('room_id', room.id).maybeSingle(),
      ])

      if (!playersData) { setLoading(false); return }

      // Scores bruts
      const rawScores: Record<string, number> = {}
      for (const p of playersData) rawScores[p.id] = 0
      for (const a of (answersData ?? [])) {
        if (a.is_correct) rawScores[a.player_id] = (rawScores[a.player_id] ?? 0) + 1
      }

      // Bonus Cater
      const caterPlayer = playersData.find(p => isCaterPrenom(p.name))
      const others       = playersData.filter(p => !isCaterPrenom(p.name))
      const maxOthers    = others.length > 0
        ? Math.max(...others.map(p => rawScores[p.id] ?? 0))
        : 0

      let bonus = 0
      if (caterPlayer) {
        const caterRaw = rawScores[caterPlayer.id] ?? 0
        if (caterRaw < maxOthers) bonus = maxOthers - caterRaw + 1
      }

      const result: PlayerScore[] = playersData.map(p => {
        const raw = rawScores[p.id] ?? 0
        const ic  = isCaterPrenom(p.name)
        return { id: p.id, name: p.name, avatar_url: p.avatar_url, rawScore: raw, bonus: ic ? bonus : 0, finalScore: raw + (ic ? bonus : 0), isCater: ic }
      })
      result.sort((a, b) => b.finalScore - a.finalScore)
      setPlayers(result)

      const rc = gameData?.reveal_count ?? 0
      setRevealCount(rc)

      // Révélation déjà complète au chargement → état final immédiat, sans animation
      if (rc >= result.length && result.length > 0) {
        caterAnimTriggered.current = true
        const cater = result.find(p => p.isCater)
        if (cater && cater.bonus > 0) { setCaterBonusVisible(true); setCaterFinalVisible(true) }
        setShowConfetti(true)
        setShowMessage(true)
      }

      setLoading(false)
    }
    load()
  }, [])

  // Polling reveal_count toutes les 2s (joueurs passifs)
  useEffect(() => {
    if (!roomId) return
    const poll = async () => {
      const { data } = await supabase
        .from('friends_game').select('reveal_count').eq('room_id', roomId).maybeSingle()
      if (data?.reveal_count !== undefined) setRevealCount(data.reveal_count)
    }
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [roomId])

  // Déclencher l'animation Cater quand reveal_count atteint players.length
  useEffect(() => {
    if (players.length === 0 || caterAnimTriggered.current) return
    if (revealCount >= players.length) {
      caterAnimTriggered.current = true
      const cater = players.find(p => p.isCater)
      if (cater && cater.bonus > 0) {
        setTimeout(() => setCaterBonusVisible(true), 900)
        setTimeout(() => setCaterFinalVisible(true), 2200)
        setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 3200)
      } else {
        setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
      }
    }
  }, [revealCount, players])

  // Animateur : révèle le joueur suivant (du pire au meilleur)
  const handleRevealNext = async () => {
    if (!roomId || revealCount >= players.length) return
    const next = revealCount + 1
    await supabase.from('friends_game')
      .update({ reveal_count: next, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    setRevealCount(next)
  }

  const handleRevealAll = async () => {
    if (!roomId || players.length === 0) return
    await supabase.from('friends_game')
      .update({ reveal_count: players.length, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    setRevealCount(players.length)
  }

  // players[i] est révélé si revealCount >= players.length - i
  // i=0 → meilleur (Cater) → révélé en dernier
  // i=N-1 → pire → révélé en premier
  const isRevealed = (i: number) => revealCount >= players.length - i

  const confettiPieces = showConfetti
    ? Array.from({ length: 45 }, (_, i) => ({
        id: i,
        char: i % 4 === 0 ? FRIENDS_CONFETTI[i % FRIENDS_CONFETTI.length] : LETTERS[i % LETTERS.length],
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

  const allRevealed = revealCount >= players.length

  return (
    <main className="min-h-screen bg-[#1a0a2e] text-white p-5 overflow-hidden relative">

      {/* Confettis */}
      {confettiPieces.map(p => (
        <span key={p.id} className="letter-confetti select-none pointer-events-none"
          style={{ left: `${p.left}%`, fontSize: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}>
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

        {/* Toggle animateur — même pattern que /concours-ortho/classement */}
        <button
          onClick={() => setIsAnimateur(v => !v)}
          className="w-full text-xs text-white/20 hover:text-white/40 transition-colors py-1"
        >
          {isAnimateur ? '👁 Mode animateur actif' : '🔒 Mode spectateur'}
        </button>

        {/* Classement */}
        <div className="space-y-3">
          {players.map((p, i) => {
            const rank          = i + 1
            const shown         = isRevealed(i)
            const medal         = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
            const bonusShown    = p.isCater && shown && caterBonusVisible

            return (
              <div key={p.id} className="transition-all duration-500">
                {shown ? (
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between rounded-2xl p-4 border pop-in ${
                      rank === 1 ? 'bg-yellow-500/15 border-yellow-500/40' : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{medal}</span>
                        <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={36} />
                        <span className="font-semibold text-lg">{p.name}</span>
                      </div>
                      <span className={`text-2xl font-bold tabular-nums transition-all duration-700 ${rank === 1 ? 'text-yellow-400' : ''}`}>
                        {p.isCater ? (caterFinalVisible ? p.finalScore : p.rawScore) : p.finalScore} pts
                      </span>
                    </div>

                    {/* Badge bonus Cater */}
                    {p.isCater && p.bonus > 0 && bonusShown && (
                      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-4 text-center pop-in">
                        <p className="text-yellow-300 text-lg font-bold leading-snug">
                          ✨ +{p.bonus} points bonus pour ton éclatante beauté ✨
                        </p>
                        <p className="text-yellow-400/60 text-xs mt-1">Score final : {p.finalScore} pts</p>
                      </div>
                    )}

                    {/* Victoire naturelle (bonus = 0) */}
                    {p.isCater && p.bonus === 0 && shown && (
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
              </div>
            )
          })}
        </div>

        {/* Boutons reveal — animateur uniquement */}
        {isAnimateur && !allRevealed && (
          <div className="space-y-2">
            <button
              onClick={handleRevealNext}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95"
            >
              Révéler le joueur suivant →
            </button>
            <button
              onClick={handleRevealAll}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-95"
            >
              ✨ Tout révéler
            </button>
          </div>
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
