'use client'
// app/concours-ortho/animateur/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { defaultQuestions } from '@/lib/concours-ortho-data'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'concours-ortho'

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
  players: { name: string }
  ortho_questions: { question: string }
}

type Player = { id: string; name: string; score: number; avatar_url?: string | null }

export default function ConcursOrthoAnimateur() {
  const [roomId, setRoomId]         = useState<string | null>(null)
  const [roomStatus, setRoomStatus] = useState<string>('waiting')
  const [questions, setQuestions]   = useState<Question[]>([])
  const [players, setPlayers]       = useState<Player[]>([])
  const [reponses, setReponses]     = useState<Reponse[]>([])
  const [phase, setPhase]                         = useState<'setup' | 'questions' | 'correction' | 'classement'>('setup')
  const [currentQuestionLibreIdx, setCurrentQuestionLibreIdx] = useState(0)
  const [bonneReponseAnim, setBonneReponseAnim]   = useState<string | null>(null)
  const [loading, setLoading]                     = useState(true)
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
      .select('id, question_id, player_id, reponse, is_correct, players(name), ortho_questions(question)')
      .eq('room_id', rid)
    if (data) setReponses(data as unknown as Reponse[])
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

  const handleCorrectLibre = async (reponseId: string, correct: boolean, playerId: string) => {
    await supabase.from('ortho_reponses')
      .update({ is_correct: correct }).eq('id', reponseId)
    if (correct && roomId) {
      const player = players.find(p => p.id === playerId)
      if (player) {
        await supabase.from('players')
          .update({ score: player.score + 1 }).eq('id', playerId)
        await fetchPlayers(roomId)
      }
    }
    await fetchReponses(roomId!)
  }

  const handleLaunchClassement = async () => {
    if (!roomId) return
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    setRoomStatus('finished')
    setPhase('classement')
  }

  const handleReset = async () => {
    if (!confirm('Remettre à zéro ? Tout sera supprimé.')) return
    await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    if (roomId) {
      await supabase.from('ortho_questions').delete().eq('room_id', roomId)
      await supabase.from('ortho_reponses').delete().eq('room_id', roomId)
    }
    setPlayers([]); setQuestions([]); setReponses([])
    setRoomStatus('waiting'); setPhase('setup')
  }

  const activeQ = questions.find(q => q.status === 'active')

  const getQuestionLabel = (q: Question) => {
    if (q.question.includes("Chassez l'intrus") && q.propositions) {
      return "Chassez l'intrus — " + q.propositions.map(p => p.replace(/^[A-E] — /, '')).join(' / ')
    }
    return q.question
  }

  console.log('phase actuelle:', phase, 'questions:', questions.map(q => q.status))
  const gameUrl = typeof window !== 'undefined' ? `${window.location.origin}/concours-ortho` : ''
  const classementUrl = typeof window !== 'undefined' ? `${window.location.origin}/concours-ortho/classement` : ''

  if (loading) return (
    <main className="min-h-screen bg-[#0B3D3A] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#0B3D3A] text-white p-5">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">✍️ Concours Ortho</h1>
            <p className="text-white/40 text-sm">Interface animateur</p>
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

            {activeQ && (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 space-y-2">
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
              </div>
            )}

            {bonneReponseAnim && (
              <div className="bg-green-900/60 border border-green-500/50 rounded-2xl p-4 text-center space-y-2">
                <p className="text-green-300 text-xs font-bold uppercase tracking-widest">✅ Bonne réponse :</p>
                <p className="text-white font-bold text-lg">{bonneReponseAnim}</p>
              </div>
            )}

            {questions
              .filter(q => q.status === 'pending')
              .sort((a, b) => a.ordre - b.ordre)
              .map(q => (
              <div key={q.id} className={`bg-white/5 border rounded-xl p-3 flex items-start justify-between gap-3 ${
                q.status === 'active' ? 'border-teal-500/30 opacity-50' :
                q.status === 'closed' ? 'border-white/5 opacity-40' : 'border-white/10'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-white/30">Q{q.ordre}</span>
                    <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/50">
                      {q.type === 'qcm' ? 'QCM' : 'Libre'}
                    </span>
                    {q.status === 'closed' && <span className="text-xs text-white/30">✓ Terminée</span>}
                  </div>
                  <p className="text-sm text-white/80 line-clamp-2">{getQuestionLabel(q)}</p>
                </div>
                {q.status === 'pending' && !activeQ && (
                  <button
                    onClick={() => handleLaunchQuestion(q)}
                    className="flex-shrink-0 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
                  >
                    Lancer
                  </button>
                )}
              </div>
            ))}

            {questions.length > 0 && !activeQ && questions.some(q => q.type === 'libre') && (
              <button
                onClick={() => {
                  console.log('=== ENTREE CORRECTION ===')
                  console.log('questions:', questions)
                  console.log('reponses avant fetch:', reponses)
                  fetchReponses(roomId!)
                  console.log('reponses apres fetch:', reponses)
                  setPhase('correction')
                  setCurrentQuestionLibreIdx(0)
                }}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl py-4 transition-all active:scale-95"
              >
                🔍 Passer à la correction des réponses libres
              </button>
            )}
          </div>
        )}

        {/* Phase correction */}
        {phase === 'correction' && (() => {
          const questionsLibres = questions.filter(q => q.type === 'libre')
          console.log('questionsLibres count:', questionsLibres.length, 'tous les types:', questions.map(q => ({ ordre: q.ordre, type: q.type })))
          const currentQ = questionsLibres[currentQuestionLibreIdx]
          const reponsesQ = currentQ ? reponses.filter(r => r.question_id === currentQ.id) : []
          const allCorrected = reponsesQ.length === 0 || reponsesQ.every(r => r.is_correct !== null)
          const isLast = currentQuestionLibreIdx >= questionsLibres.length - 1

          return (
            <div className="space-y-3">
              {/* Compteur */}
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs uppercase tracking-wide">Correction — réponses libres</p>
                <span className="text-white/30 text-xs font-mono">
                  {currentQuestionLibreIdx + 1} / {questionsLibres.length}
                </span>
              </div>

              {/* Texte de la question */}
              {currentQ && (
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl px-4 py-3">
                  <p className="text-teal-300 text-xs font-semibold mb-1">Q{currentQ.ordre} — Réponse libre</p>
                  <p className="text-sm text-white">{currentQ.question}</p>
                </div>
              )}

              {/* Réponses des joueurs */}
              {reponsesQ.length === 0 && (
                <p className="text-white/25 text-sm text-center py-3">Aucune réponse pour cette question</p>
              )}

              {reponsesQ.map(r => {
                const nom = (r.players as { name?: string })?.name ?? '?'
                const questionTexte = (r.ortho_questions as { question?: string })?.question
                return (
                  <div key={r.id} className={`border rounded-xl p-3 space-y-2 transition-colors ${
                    r.is_correct === true  ? 'bg-green-500/10 border-green-500/30' :
                    r.is_correct === false ? 'bg-red-500/10   border-red-500/30'   :
                                             'bg-white/5      border-white/10'
                  }`}>
                    {questionTexte && (
                      <p className="text-white/30 text-xs italic border-b border-white/10 pb-2">{questionTexte}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-white/50 text-xs font-semibold">{nom}</p>
                      {r.is_correct === true  && <span className="text-green-400 text-xs">✅ Valide</span>}
                      {r.is_correct === false && <span className="text-red-400   text-xs">❌ Incorrect</span>}
                    </div>
                    <p className="text-sm font-medium">&quot;{r.reponse}&quot;</p>
                    {r.is_correct === null && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCorrectLibre(r.id, true, r.player_id)}
                          className="flex-1 bg-green-500/20 hover:bg-green-500/40 border border-green-500/30 text-green-300 text-sm font-semibold rounded-lg py-2 transition-all active:scale-95"
                        >
                          ✅ Valide
                        </button>
                        <button
                          onClick={() => handleCorrectLibre(r.id, false, r.player_id)}
                          className="flex-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 text-sm font-semibold rounded-lg py-2 transition-all active:scale-95"
                        >
                          ❌ Incorrect
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Navigation */}
              {allCorrected && !isLast && (
                <button
                  onClick={() => setCurrentQuestionLibreIdx(i => i + 1)}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl py-4 transition-all active:scale-95"
                >
                  Question suivante →
                </button>
              )}

              {allCorrected && isLast && (
                <button
                  onClick={handleLaunchClassement}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 transition-all active:scale-95"
                >
                  🏆 Lancer le classement final
                </button>
              )}
            </div>
          )
        })()}

        {/* Phase classement */}
        {phase === 'classement' && (
          <a
            href="/concours-ortho/classement"
            className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-center transition-all active:scale-95"
          >
            🏆 Ouvrir le classement
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
