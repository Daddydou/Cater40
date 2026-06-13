'use client'
// app/quizz-friends/animateur/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FRIENDS_QUESTIONS } from '@/lib/friends-quiz-data'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'quizz-friends'
const TOTAL_Q   = FRIENDS_QUESTIONS.length

type GameState = {
  id: string
  room_id: string
  status: 'waiting' | 'playing' | 'finished'
  current_question_id: number | null
  question_open: boolean
}

type Player  = { id: string; name: string; score: number; avatar_url?: string | null }
type Answer  = { id: string; player_id: string; question_id: number; is_correct: boolean }

export default function QuizzFriendsAnimateur() {
  const [roomId, setRoomId]       = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers]     = useState<Player[]>([])
  const [answers, setAnswers]     = useState<Answer[]>([])
  const [passedIds, setPassedIds] = useState<number[]>([])
  const [loading, setLoading]     = useState(true)
  const initialized = useRef(false)

  const fetchAll = useCallback(async (rid: string) => {
    const [gsRes, plRes, anRes] = await Promise.all([
      supabase.from('friends_game').select('*').eq('room_id', rid).maybeSingle(),
      supabase.from('players').select('id, name, score, avatar_url').eq('room_id', rid).order('name'),
      supabase.from('friends_answers').select('id, player_id, question_id, is_correct').eq('room_id', rid),
    ])
    if (gsRes.data) {
      setGameState(gsRes.data)
      // Ajouter la question courante aux passées si elle est fermée
      if (gsRes.data.current_question_id && !gsRes.data.question_open) {
        setPassedIds(prev => prev.includes(gsRes.data!.current_question_id!) ? prev : [...prev, gsRes.data!.current_question_id!])
      }
    }
    if (plRes.data) setPlayers(plRes.data)
    if (anRes.data) {
      setAnswers(anRes.data)
      // Initialiser passedIds depuis les réponses existantes
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

  // Polling 2s
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

  const handleLaunchClassement = async () => {
    if (!roomId) return
    await supabase.from('friends_game')
      .update({ status: 'finished', question_open: false, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
    await fetchAll(roomId)
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
  }

  const currentQuestion = gameState?.current_question_id
    ? FRIENDS_QUESTIONS.find(q => q.id === gameState.current_question_id) ?? null
    : null

  const answersForCurrentQ = answers.filter(a => a.question_id === gameState?.current_question_id)
  const correctAnswersForCurrentQ = answersForCurrentQ.filter(a => a.is_correct).length

  const pendingQuestions = FRIENDS_QUESTIONS.filter(q =>
    !passedIds.includes(q.id) &&
    q.id !== (gameState?.question_open ? gameState.current_question_id : null)
  )

  const allDone = passedIds.length >= TOTAL_Q && !gameState?.question_open

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
          <div>
            <h1 className="text-xl font-bold text-yellow-400">🛋️ Quizz Friends</h1>
            <p className="text-white/40 text-sm">Interface animateur</p>
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

        {/* Joueurs inscrits */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wide">Joueurs ({players.length})</p>
          {players.length === 0
            ? <p className="text-white/25 text-sm text-center py-2">Aucun joueur pour l&apos;instant</p>
            : players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-white/30 text-xs w-4">{i + 1}.</span>
                <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={28} />
                <span className="text-sm">{p.name}</span>
              </div>
            ))
          }
        </div>

        {/* Bouton lancer le quiz */}
        {!gameState && (
          <button
            onClick={handleLaunchGame}
            disabled={players.length === 0}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-lg disabled:opacity-30 transition-all active:scale-95"
          >
            ▶️ Lancer le quiz ({TOTAL_Q} questions)
          </button>
        )}

        {gameState?.status === 'waiting' && (
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

            {/* Question en cours */}
            {gameState.question_open && currentQuestion && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-300 text-xs font-semibold uppercase tracking-wide">
                    ▶️ Question {currentQuestion.id} / {TOTAL_Q}
                  </span>
                  <span className="text-white/50 text-sm">
                    {answersForCurrentQ.length}/{players.length} réponses
                  </span>
                </div>
                <p className="text-sm font-medium">{currentQuestion.question}</p>

                {/* Bonne réponse visible animateur */}
                <div className="bg-green-900/40 border border-green-500/40 rounded-xl px-4 py-2">
                  <p className="text-green-300 text-xs font-bold uppercase tracking-widest mb-1">✅ Bonne réponse</p>
                  <p className="text-white font-semibold">{currentQuestion.options[currentQuestion.correctIndex]}</p>
                </div>

                {/* Compteur correct */}
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

            {/* Questions en attente */}
            {pendingQuestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wide">
                  Questions à lancer ({pendingQuestions.length} restantes)
                </p>
                {pendingQuestions.map(q => (
                  <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-white/30 text-xs mr-2">Q{q.id}</span>
                      <span className="text-sm text-white/80">{q.question}</span>
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

            {/* Toutes les questions passées */}
            {allDone && gameState.status !== 'finished' && (
              <button
                onClick={handleLaunchClassement}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-lg transition-all active:scale-95"
              >
                🏆 Lancer le classement final !
              </button>
            )}

          </div>
        )}

        {/* Phase terminée */}
        {gameState?.status === 'finished' && (
          <a
            href="/quizz-friends/classement"
            className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-center text-lg transition-all active:scale-95"
          >
            🏆 Ouvrir le classement final
          </a>
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
