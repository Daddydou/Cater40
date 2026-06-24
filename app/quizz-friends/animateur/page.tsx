'use client'
// app/quizz-friends/animateur/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FRIENDS_QUESTIONS } from '@/lib/friends-quiz-data'
import { computeRanking } from '@/lib/friends-ranking'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import Link from 'next/link'

const ROOM_CODE = 'quizz-friends'
const TOTAL_Q   = FRIENDS_QUESTIONS.length

type GameState = {
  id: string
  room_id: string
  status: 'waiting' | 'playing' | 'finished'
  current_question_id: number | null
  question_open: boolean
  reveal_count: number
  cater_player_id: string | null
}

type Player = { id: string; name: string; score: number; avatar_url?: string | null }
type Answer = {
  id: string
  player_id: string
  player_name: string
  question_id: number
  is_correct: boolean | null
  free_text: string | null
  validated: boolean
}

export default function QuizzFriendsAnimateur() {
  const [roomId, setRoomId]           = useState<string | null>(null)
  const [gameState, setGameState]     = useState<GameState | null>(null)
  const [players, setPlayers]         = useState<Player[]>([])
  const [answers, setAnswers]         = useState<Answer[]>([])
  const [passedIds, setPassedIds]     = useState<number[]>([])
  const [revealCount, setRevealCount] = useState(0)
  const [caterPlayerId, setCaterPlayerId] = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const initialized = useRef(false)

  const fetchAll = useCallback(async (rid: string) => {
    const [gsRes, plRes, anRes] = await Promise.all([
      supabase.from('friends_game').select('*').eq('room_id', rid).maybeSingle(),
      supabase.from('players').select('id, name, score, avatar_url').eq('room_id', rid).order('name'),
      supabase.from('friends_answers').select('id, player_id, player_name, question_id, is_correct, free_text, validated').eq('room_id', rid),
    ])
    if (gsRes.data) {
      setGameState(gsRes.data as GameState)
      setRevealCount(gsRes.data.reveal_count ?? 0)
      setCaterPlayerId(gsRes.data.cater_player_id ?? null)
      if (gsRes.data.current_question_id && !gsRes.data.question_open) {
        setPassedIds(prev => prev.includes(gsRes.data!.current_question_id!) ? prev : [...prev, gsRes.data!.current_question_id!])
      }
    }
    if (plRes.data) setPlayers(plRes.data)
    if (anRes.data) {
      setAnswers(anRes.data as Answer[])
      setPassedIds(prev => {
        const merged = [...prev]
        for (const a of anRes.data!) {
          if (!merged.includes(a.question_id)) merged.push(a.question_id)
        }
        return merged
      })
    }
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const init = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) return
      setRoomId(room.id)
      await fetchAll(room.id)
      setLoading(false)
    }
    init()
  }, [fetchAll])

  useEffect(() => {
    if (!roomId) return
    const id = setInterval(() => fetchAll(roomId), 2000)
    return () => clearInterval(id)
  }, [roomId, fetchAll])

  const handleLaunchGame = async () => {
    if (!roomId) return
    await supabase.from('friends_game').upsert(
      { room_id: roomId, status: 'playing', current_question_id: null, question_open: false, updated_at: new Date().toISOString() },
      { onConflict: 'room_id' }
    )
    await fetchAll(roomId)
  }

  const handleLaunchQuestion = async (questionId: number) => {
    if (!roomId) return
    await supabase.from('friends_game')
      .update({ current_question_id: questionId, question_open: true, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    await fetchAll(roomId)
  }

  const handleCloseQuestion = async () => {
    if (!roomId || !gameState?.current_question_id) return
    const closedId = gameState.current_question_id
    await supabase.from('friends_game')
      .update({ question_open: false, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    setPassedIds(prev => prev.includes(closedId) ? prev : [...prev, closedId])
    await fetchAll(roomId)
  }

  const handleToggleValidation = async (answerId: string, currentValidated: boolean) => {
    if (!roomId) return
    await supabase.from('friends_answers')
      .update({ validated: !currentValidated })
      .eq('id', answerId)
    await fetchAll(roomId)
  }

  const handleSetCater = async (playerId: string) => {
    if (!roomId) return
    const newCaterId = caterPlayerId === playerId ? null : playerId
    // Upsert pour créer la ligne si elle n'existe pas encore
    await supabase.from('friends_game').upsert(
      { room_id: roomId, cater_player_id: newCaterId, updated_at: new Date().toISOString() },
      { onConflict: 'room_id' }
    )
    setCaterPlayerId(newCaterId)
    await fetchAll(roomId)
  }

  const handleLaunchClassement = async () => {
    if (!roomId) return
    await supabase.from('friends_game')
      .update({ status: 'finished', question_open: false, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    await fetchAll(roomId)
  }

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

  const handleReset = async () => {
    if (!confirm('Nouvelle partie ? Tous les joueurs et réponses seront supprimés.')) return
    await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    if (roomId) {
      await supabase.from('friends_answers').delete().eq('room_id', roomId)
      await supabase.from('friends_game').delete().eq('room_id', roomId)
    }
    setGameState(null)
    setAnswers([])
    setPassedIds([])
    setPlayers([])
    setRevealCount(0)
    setCaterPlayerId(null)
  }

  const currentQuestion = gameState?.current_question_id
    ? FRIENDS_QUESTIONS.find(q => q.id === gameState.current_question_id) ?? null
    : null

  const answersForCurrentQ = answers.filter(a => a.question_id === gameState?.current_question_id)
  const correctAnswersForCurrentQ = answersForCurrentQ.filter(a => a.is_correct).length
  const validatedAnswersForCurrentQ = answersForCurrentQ.filter(a => a.validated).length

  const pendingQuestions = FRIENDS_QUESTIONS.filter(q =>
    !passedIds.includes(q.id) &&
    q.id !== (gameState?.question_open ? gameState.current_question_id : null)
  )

  const allDone     = passedIds.length >= TOTAL_Q && !gameState?.question_open
  const allRevealed = revealCount >= players.length

  const rankedPlayers = gameState?.status === 'finished'
    ? computeRanking(players, answers, caterPlayerId)
    : []

  const gameUrl       = typeof window !== 'undefined' ? `${window.location.origin}/quizz-friends` : ''
  const classementUrl = typeof window !== 'undefined' ? `${window.location.origin}/quizz-friends/classement` : ''

  if (loading) return (
    <main className="min-h-screen bg-[#1a0a2e] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#1a0a2e] text-white p-5">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Link href="/animateur" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold tracking-wide">← Hub</Link>
            <div>
              <h1 className="text-xl font-bold text-yellow-400">🛋️ We are your Friends</h1>
              <p className="text-white/40 text-sm">Interface animateur</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            gameState?.status === 'waiting'  ? 'bg-yellow-500/20 text-yellow-300' :
            gameState?.status === 'playing'  ? 'bg-green-500/20  text-green-300'  :
            gameState?.status === 'finished' ? 'bg-white/10 text-white/50'        :
                                               'bg-white/5 text-white/30'
          }`}>
            {!gameState              ? '⏳ Attente'    :
             gameState.status === 'waiting'  ? '⏳ Attente'    :
             gameState.status === 'playing'  ? '▶️ En cours'   : '✅ Terminé'}
          </span>
        </div>

        {/* URLs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1 text-xs text-white/40">
          <p>Joueurs → <span className="text-yellow-300/70 font-mono">{gameUrl}</span></p>
          <p>Classement → <span className="text-yellow-300/70 font-mono">{classementUrl}</span></p>
        </div>

        {/* Joueurs inscrits + désignation Cater */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs uppercase tracking-wide">Joueurs ({players.length})</p>
            {players.length > 0 && (
              <p className="text-white/25 text-xs">👑 = bonus beauté si elle ne gagne pas</p>
            )}
          </div>
          {players.length === 0
            ? <p className="text-white/25 text-sm text-center py-2">Aucun joueur pour l&apos;instant</p>
            : players.map((p, i) => {
              const isDesignated = p.id === caterPlayerId
              return (
                <div key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all ${
                  isDesignated ? 'bg-yellow-500/10 border border-yellow-500/30' : ''
                }`}>
                  <span className="text-white/30 text-xs w-4">{i + 1}.</span>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={28} />
                  <span className={`text-sm flex-1 ${isDesignated ? 'text-yellow-300 font-semibold' : ''}`}>
                    {p.name}
                  </span>
                  <button
                    onClick={() => handleSetCater(p.id)}
                    className={`text-xs px-2 py-1 rounded-lg transition-all active:scale-95 ${
                      isDesignated
                        ? 'bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 font-bold'
                        : 'bg-white/5 border border-white/10 text-white/30 hover:text-yellow-400 hover:border-yellow-500/30'
                    }`}
                    title={isDesignated ? 'Retirer le rôle Cater' : 'Désigner comme Cater'}
                  >
                    👑
                  </button>
                </div>
              )
            })
          }
        </div>

        {/* Bouton lancer le quiz */}
        {(!gameState || gameState.status === 'waiting') && (
          <button
            onClick={handleLaunchGame}
            disabled={players.length === 0}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-lg disabled:opacity-30 transition-all active:scale-95"
          >
            ▶️ Lancer le quiz ({TOTAL_Q} questions)
          </button>
        )}

        {/* Phase jeu */}
        {gameState?.status === 'playing' && (
          <div className="space-y-4">

            {/* Question QCM en cours */}
            {gameState.question_open && currentQuestion?.type === 'qcm' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-300 text-xs font-semibold uppercase tracking-wide">
                    ▶️ Q{currentQuestion.id} / {TOTAL_Q} — QCM
                  </span>
                  <span className="text-white/50 text-sm">
                    {answersForCurrentQ.length}/{players.length} réponses
                  </span>
                </div>
                <p className="text-sm font-medium">{currentQuestion.question}</p>

                <div className="bg-green-900/40 border border-green-500/40 rounded-xl px-4 py-2">
                  <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">✅ Bonne réponse</p>
                  <p className="text-white font-semibold">{currentQuestion.options[currentQuestion.correctIndex]}</p>
                </div>

                <p className="text-white/50 text-xs text-center">
                  {correctAnswersForCurrentQ} joueur{correctAnswersForCurrentQ > 1 ? 's ont' : ' a'} la bonne réponse
                </p>

                <button
                  onClick={handleCloseQuestion}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95"
                >
                  ⏹ Fermer la question
                </button>
              </div>
            )}

            {/* Question LIBRE en cours */}
            {gameState.question_open && currentQuestion?.type === 'libre' && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 text-xs font-semibold uppercase tracking-wide">
                    ▶️ Q{currentQuestion.id} / {TOTAL_Q} — Réponse libre
                  </span>
                  <span className="text-white/50 text-sm">
                    {answersForCurrentQ.length}/{players.length} réponses
                  </span>
                </div>
                <p className="text-sm font-medium">{currentQuestion.question}</p>

                <div className="space-y-2">
                  {answersForCurrentQ.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-3">Aucune réponse encore…</p>
                  ) : (
                    answersForCurrentQ.map(a => (
                      <div key={a.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <span className="text-white/40 text-xs block">{a.player_name}</span>
                          <span className="text-sm text-white/90">{a.free_text || <em className="text-white/30">vide</em>}</span>
                        </div>
                        <button
                          onClick={() => handleToggleValidation(a.id, a.validated)}
                          className={`flex-shrink-0 text-xl px-2 py-1 rounded-lg transition-all active:scale-95 ${
                            a.validated
                              ? 'bg-green-500/30 border border-green-500/40 text-green-300'
                              : 'bg-white/10 border border-white/20 text-white/40'
                          }`}
                          title={a.validated ? 'Invalider' : 'Valider'}
                        >
                          {a.validated ? '✅' : '❌'}
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <p className="text-white/40 text-xs text-center">
                  {validatedAnswersForCurrentQ} réponse{validatedAnswersForCurrentQ > 1 ? 's validées' : ' validée'}
                </p>

                <button
                  onClick={handleCloseQuestion}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95"
                >
                  ⏹ Fermer la question
                </button>
              </div>
            )}

            {/* Questions en attente */}
            {pendingQuestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wide">
                  Questions à lancer ({pendingQuestions.length} restantes)
                </p>
                {pendingQuestions.map(q => (
                  <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs">Q{q.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          q.type === 'libre'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-white/10 text-white/40'
                        }`}>
                          {q.type === 'libre' ? '✍️ Libre' : 'QCM'}
                        </span>
                      </div>
                      <span className="text-sm text-white/80 block">{q.question}</span>
                    </div>
                    {!gameState.question_open && (
                      <button
                        onClick={() => handleLaunchQuestion(q.id)}
                        className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
                      >
                        Lancer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Toutes les questions passées → lancer le classement */}
            {allDone && (
              <div className="space-y-2">
                {!caterPlayerId && (
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center">
                    <p className="text-white/40 text-xs">⚠️ Aucune Cater désignée — pas de bonus beauté</p>
                  </div>
                )}
                <button
                  onClick={handleLaunchClassement}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-lg transition-all active:scale-95"
                >
                  🏆 Lancer le classement final !
                </button>
              </div>
            )}

          </div>
        )}

        {/* Phase terminée — pilotage du reveal */}
        {gameState?.status === 'finished' && (
          <div className="space-y-4">

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-yellow-300 text-xs font-semibold uppercase tracking-wide">
                  🏆 Classement final — pilotage
                </p>
                <span className="text-white/50 text-sm font-mono">
                  {revealCount} / {players.length} révélés
                </span>
              </div>

              {/* Liste ordonnée (meilleur en haut = révélé en dernier) */}
              <div className="space-y-1.5">
                {rankedPlayers.map((p, i) => {
                  const N = rankedPlayers.length
                  const isRevealed = revealCount >= N - i
                  const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                  return (
                    <div key={p.id} className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                      isRevealed
                        ? 'bg-white/8 border-white/15'
                        : 'bg-white/3 border-white/5 opacity-50'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm w-6 flex-shrink-0">{medal}</span>
                        <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={24} />
                        <span className="text-sm truncate">{p.name}</span>
                        {p.isCater && <span className="text-yellow-400 text-xs flex-shrink-0">★</span>}
                        {!isRevealed && <span className="text-white/25 text-xs flex-shrink-0">masqué</span>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-white text-sm font-bold tabular-nums">{p.finalScore} pts</span>
                        {p.isCater && p.bonus > 0 && (
                          <span className="text-yellow-400/60 text-xs block">+{p.bonus} beauté</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Boutons reveal */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleRevealNext}
                  disabled={allRevealed}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-3 text-sm disabled:opacity-30 transition-all active:scale-95"
                >
                  Révéler le joueur suivant →
                </button>
                <button
                  onClick={handleRevealAll}
                  disabled={allRevealed}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl py-2.5 text-sm disabled:opacity-30 transition-all active:scale-95"
                >
                  ✨ Tout révéler
                </button>
              </div>
            </div>

            {/* Lien vers l'écran classement (projection) */}
            <a
              href="/quizz-friends/classement"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80 font-semibold rounded-xl py-3 text-sm transition-all"
            >
              📺 Ouvrir l&apos;écran classement (projection)
            </a>

          </div>
        )}

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
