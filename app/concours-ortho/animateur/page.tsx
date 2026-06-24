'use client'
// app/concours-ortho/animateur/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { defaultQuestions } from '@/lib/concours-ortho-data'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import Link from 'next/link'

const ROOM_CODE = 'concours-ortho'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type Question = {
  id: string
  ordre: number
  type: 'qcm' | 'libre'
  question: string
  propositions: string[] | null
  bonne_reponse: string
  status: string
}

type Reponse = {
  id: string
  question_id: string
  player_id: string
  reponse: string
  is_correct: boolean | null
}

type Player = { id: string; name: string; score: number; avatar_url?: string | null }

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

export default function ConcursOrthoAnimateur() {
  const [roomId, setRoomId]         = useState<string | null>(null)
  const [roomStatus, setRoomStatus] = useState<string>('waiting')
  const [questions, setQuestions]   = useState<Question[]>([])
  const [players, setPlayers]       = useState<Player[]>([])
  const [reponses, setReponses]     = useState<Reponse[]>([])
  const [phase, setPhase]           = useState<'setup' | 'questions' | 'classement'>('setup')
  const [bonneReponseAnim, setBonneReponseAnim] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [revealCount, setRevealCount]   = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showMessage, setShowMessage]   = useState(false)
  const initialized = useRef(false)

  const fetchPlayers = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('players').select('id, name, score, avatar_url')
      .eq('room_id', rid).order('score', { ascending: false })
    if (data) setPlayers(data)
  }, [])

  const fetchQuestions = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('ortho_questions').select('*')
      .eq('room_id', rid).order('ordre')
    if (data) setQuestions(data)
  }, [])

  const fetchReponses = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('ortho_reponses')
      .select('id, question_id, player_id, reponse, is_correct')
      .eq('room_id', rid)
    if (data) setReponses(data as Reponse[])
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id, status').eq('code', ROOM_CODE).single()
      if (!room) return

      setRoomId(room.id)
      setRoomStatus(room.status)
      setLoading(false)

      await Promise.all([
        fetchPlayers(room.id),
        fetchQuestions(room.id),
      ])

      supabase
        .channel(`anim-ortho-players-${room.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'players',
          filter: `room_id=eq.${room.id}`,
        }, () => fetchPlayers(room.id))
        .subscribe()

      supabase
        .channel(`anim-ortho-reponses-${room.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ortho_reponses',
          filter: `room_id=eq.${room.id}`,
        }, () => fetchReponses(room.id))
        .subscribe()
    }

    init()
  }, [fetchPlayers, fetchQuestions, fetchReponses])

  const handleSetup = async () => {
    if (!roomId) return
    const toInsert = defaultQuestions.map(q => ({
      room_id: roomId,
      ordre: q.ordre,
      type: q.type,
      question: q.question,
      propositions: q.propositions,
      bonne_reponse: q.bonne_reponse,
      status: 'pending',
    }))
    await supabase.from('ortho_questions').insert(toInsert)
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
    setRoomStatus('playing')
    await fetchQuestions(roomId)
    setPhase('questions')
  }

  const handleLaunchQuestion = async (q: Question) => {
    if (!roomId) return
    await supabase.from('ortho_questions')
      .update({ status: 'closed' })
      .eq('room_id', roomId).eq('status', 'active')
    await supabase.from('ortho_questions')
      .update({ status: 'active' }).eq('id', q.id)
    await fetchQuestions(roomId)
  }

  const handleCloseQuestion = async () => {
    if (!roomId) return
    const reponseCorrecte = activeQ?.bonne_reponse ?? null
    await supabase.from('ortho_questions')
      .update({ status: 'closed' })
      .eq('room_id', roomId).eq('status', 'active')
    await fetchQuestions(roomId)
    if (reponseCorrecte) {
      setBonneReponseAnim(reponseCorrecte)
      setTimeout(() => setBonneReponseAnim(null), 4000)
    }
  }

  const handleLaunchClassement = async () => {
    if (!roomId) return
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    setRoomStatus('finished')
    await fetchPlayers(roomId)
    setPhase('classement')
  }

  const handleRevealNext = async () => {
    if (!roomId) return
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
    const groups = groupByScore(sortedPlayers)
    const next = Math.min(revealCount + 1, groups.length)
    await supabase.from('rooms').update({ reveal_count: next }).eq('id', roomId)
    setRevealCount(next)
    if (next >= groups.length) {
      setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
    }
  }

  const handleRevealAll = async () => {
    if (!roomId) return
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
    const groups = groupByScore(sortedPlayers)
    await supabase.from('rooms').update({ reveal_count: groups.length }).eq('id', roomId)
    setRevealCount(groups.length)
    setTimeout(() => { setShowConfetti(true); setShowMessage(true) }, 600)
  }

  const handleReset = async () => {
    if (!confirm('Remettre à zéro ? Tout sera supprimé.')) return
    await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    if (roomId) {
      await Promise.all([
        supabase.from('ortho_questions').delete().eq('room_id', roomId),
        supabase.from('ortho_reponses').delete().eq('room_id', roomId),
        supabase.from('rooms').update({ reveal_count: 0 }).eq('id', roomId),
      ])
    }
    setPlayers([]); setQuestions([]); setReponses([])
    setRevealCount(0); setShowConfetti(false); setShowMessage(false)
    setRoomStatus('waiting'); setPhase('setup')
  }

  const activeQ = questions.find(q => q.status === 'active')
  const allClosed = questions.length > 0 && !activeQ && questions.every(q => q.status === 'closed')

  const getQuestionLabel = (q: Question) => {
    if (q.question.includes("Chassez l'intrus") && q.propositions) {
      return "Chassez l'intrus — " + q.propositions.map(p => p.replace(/^[A-E] — /, '')).join(' / ')
    }
    return q.question
  }

  const gameUrl       = typeof window !== 'undefined' ? `${window.location.origin}/concours-ortho` : ''
  const classementUrl = typeof window !== 'undefined' ? `${window.location.origin}/concours-ortho/classement` : ''

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

  return (
    <main className="min-h-screen bg-[#0B3D3A] text-white p-5 relative overflow-hidden">

      {/* Confettis */}
      {confettiPieces.map(p => (
        <span key={p.id} className="letter-confetti select-none pointer-events-none"
          style={{ left: `${p.left}%`, fontSize: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}>
          {p.char}
        </span>
      ))}

      <div className="max-w-lg mx-auto space-y-5 relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Link href="/animateur" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold tracking-wide">← Hub</Link>
            <div>
              <h1 className="text-xl font-bold">✍️ Concours Ortho</h1>
              <p className="text-white/40 text-sm">Interface animateur</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            roomStatus === 'waiting' ? 'bg-yellow-500/20 text-yellow-300' :
            roomStatus === 'playing' ? 'bg-green-500/20 text-green-300' :
                                       'bg-white/10 text-white/50'
          }`}>
            {roomStatus === 'waiting' ? '⏳ Attente' : roomStatus === 'playing' ? '▶️ En cours' : '✅ Terminé'}
          </span>
        </div>

        {/* URLs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1 text-xs text-white/40">
          <p>Joueurs → <span className="text-blue-300 font-mono">{gameUrl}</span></p>
          <p>Classement → <span className="text-blue-300 font-mono">{classementUrl}</span></p>
        </div>

        {/* Joueurs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wide">Joueurs ({players.length})</p>
          {players.length === 0
            ? <p className="text-white/25 text-sm text-center py-2">Aucun joueur</p>
            : players.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs">{i + 1}.</span>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={32} />
                  <span>{p.name}</span>
                </div>
                <span className="text-white/50 text-sm tabular-nums">{p.score} pts</span>
              </div>
            ))
          }
        </div>

        {/* Phase setup */}
        {phase === 'setup' && roomStatus === 'waiting' && (
          <button
            onClick={handleSetup}
            disabled={players.length === 0}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl py-4 disabled:opacity-30 transition-all active:scale-95"
          >
            ▶️ Lancer le concours ({defaultQuestions.length} questions)
          </button>
        )}

        {/* Phase questions */}
        {phase === 'questions' && (
          <div className="space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wide">Questions</p>

            {/* Question en cours */}
            {activeQ && (() => {
              const reponsesQ = reponses.filter(r => r.question_id === activeQ.id)
              return (
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-teal-300 text-xs font-semibold">▶️ EN COURS — Q{activeQ.ordre}</span>
                  </div>
                  <p className="text-sm">{getQuestionLabel(activeQ)}</p>
                  <button
                    onClick={handleCloseQuestion}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-2 text-sm font-semibold transition-all active:scale-95"
                  >
                    ⏹ Fermer cette question
                  </button>
                  <p className="text-center text-white/50 text-sm">
                    💬 {reponsesQ.length} / {players.length} réponses
                  </p>
                </div>
              )
            })()}

            {/* Bonne réponse */}
            {bonneReponseAnim && (
              <div className="bg-green-900/60 border border-green-500/50 rounded-2xl p-4 text-center space-y-2">
                <p className="text-green-300 text-xs font-bold uppercase tracking-widest">✅ Bonne réponse :</p>
                <p className="text-white font-bold text-lg">{bonneReponseAnim}</p>
              </div>
            )}

            {/* Questions en attente */}
            {questions
              .filter(q => q.status === 'pending')
              .sort((a, b) => a.ordre - b.ordre)
              .map(q => (
              <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-white/30">Q{q.ordre}</span>
                    <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/50">QCM</span>
                  </div>
                  <p className="text-sm text-white/80 line-clamp-2">{getQuestionLabel(q)}</p>
                </div>
                {!activeQ && (
                  <button
                    onClick={() => handleLaunchQuestion(q)}
                    className="flex-shrink-0 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
                  >
                    Lancer
                  </button>
                )}
              </div>
            ))}

            {/* Questions terminées (résumé) */}
            {questions.filter(q => q.status === 'closed').length > 0 && (
              <p className="text-white/25 text-xs text-center">
                ✓ {questions.filter(q => q.status === 'closed').length} question(s) terminée(s)
              </p>
            )}

            {/* Bouton lancer classement */}
            {allClosed && (
              <button
                onClick={handleLaunchClassement}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 transition-all active:scale-95"
              >
                🏆 Lancer le classement final
              </button>
            )}
          </div>
        )}

        {/* Phase classement */}
        {phase === 'classement' && (() => {
          const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
          const groups = groupByScore(sortedPlayers)
          const totalGroups = groups.length
          const allRevealed = revealCount >= totalGroups && totalGroups > 0

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs uppercase tracking-wide">Classement final</p>
                <span className="text-white/30 text-xs font-mono">
                  {revealCount} / {totalGroups} révélés
                </span>
              </div>

              {/* Lien vers la page spectateur */}
              <a
                href="/concours-ortho/classement"
                target="_blank"
                className="block w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm font-semibold rounded-xl py-2.5 transition-all"
              >
                📺 Ouvrir l&apos;écran classement (projection)
              </a>

              {/* Classement complet — tous visibles pour l'animateur */}
              <div className="space-y-2">
                {groups.map((group, gi) => {
                  const rank     = gi + 1
                  const revealed = revealCount >= totalGroups - gi
                  const medal    = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
                  return (
                    <div key={gi} className={`rounded-xl p-3 border transition-all duration-300 ${
                      revealed ? 'bg-white/8 border-white/15' : 'bg-white/3 border-white/5 opacity-40'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{medal}</span>
                          <div>
                            {group.map(p => (
                              <div key={p.id} className="flex items-center gap-2">
                                <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={24} />
                                <span className="text-sm font-medium">{p.name}</span>
                              </div>
                            ))}
                          </div>
                          {!revealed && <span className="text-white/25 text-xs ml-2">masqué</span>}
                        </div>
                        <span className="font-bold tabular-nums">{group[0].score} pts</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Boutons révélation */}
              <button
                onClick={handleRevealNext}
                disabled={allRevealed}
                className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl py-3 disabled:opacity-30 transition-all active:scale-95"
              >
                Révéler le suivant →
              </button>
              <button
                onClick={handleRevealAll}
                disabled={allRevealed}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl py-3 disabled:opacity-30 transition-all active:scale-95"
              >
                ✨ Tout révéler
              </button>

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
          )
        })()}

        {/* Reset */}
        <button
          onClick={handleReset}
          className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl py-3 transition-all active:scale-95"
        >
          🔄 Nouvelle partie (reset)
        </button>

      </div>
    </main>
  )
}
