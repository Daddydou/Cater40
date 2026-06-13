'use client'
// app/quizz-friends/page.tsx — écran joueur

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import { uploadAvatar } from '@/lib/hooks/useAvatarUpload'
import { FRIENDS_QUESTIONS, seededShuffle } from '@/lib/friends-quiz-data'

const ROOM_CODE = 'quizz-friends'

type GameState = {
  id: string
  room_id: string
  status: 'waiting' | 'playing' | 'finished'
  current_question_id: number | null
  question_open: boolean
}

export default function QuizzFriends() {
  const router = useRouter()
  const [step, setStep]                     = useState<'prenom' | 'attente' | 'jeu'>('prenom')
  const [prenom, setPrenom]                 = useState('')
  const [playerId, setPlayerId]             = useState<string | null>(null)
  const [roomId, setRoomId]                 = useState<string | null>(null)
  const [gameState, setGameState]           = useState<GameState | null>(null)
  const [answered, setAnswered]             = useState(false)
  const [avatarFile, setAvatarFile]         = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null)
  const avatarRef        = useRef<HTMLInputElement>(null)
  const lastQuestionId   = useRef<number | null>(null)
  const stepRef          = useRef(step)
  stepRef.current        = step
  const playerIdRef      = useRef<string | null>(null)
  playerIdRef.current    = playerId
  const roomIdRef        = useRef<string | null>(null)
  const initialized      = useRef(false)

  // Charger la room
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (data) {
        setRoomId(data.id)
        roomIdRef.current = data.id
      }
    }
    load()
  }, [])

  // Polling 2s
  useEffect(() => {
    if (!roomId) return

    const poll = async () => {
      const { data } = await supabase
        .from('friends_game').select('*').eq('room_id', roomId).maybeSingle()
      if (!data) return
      setGameState(data)

      if (data.status === 'finished') {
        router.push('/quizz-friends/classement')
        return
      }
      if (data.status === 'playing' && stepRef.current === 'attente') {
        setStep('jeu')
      }
      // Nouvelle question détectée
      if (data.current_question_id !== lastQuestionId.current) {
        lastQuestionId.current = data.current_question_id
        if (stepRef.current === 'jeu') {
          // Vérifier si déjà répondu à cette question
          const pid = playerIdRef.current
          if (pid && data.current_question_id) {
            const { data: existing } = await supabase
              .from('friends_answers')
              .select('id')
              .eq('room_id', roomId)
              .eq('player_id', pid)
              .eq('question_id', data.current_question_id)
              .maybeSingle()
            setAnswered(!!existing)
          } else {
            setAnswered(false)
          }
        }
      }
    }

    if (!initialized.current) {
      initialized.current = true
      poll()
    }
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [roomId, router])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleJoin = async () => {
    if (!prenom.trim() || !roomId) return
    const { data } = await supabase
      .from('players')
      .insert({ room_id: roomId, name: prenom.trim(), score: 0 })
      .select().single()
    if (!data) return
    setPlayerId(data.id)
    playerIdRef.current = data.id
    if (avatarFile) {
      const url = await uploadAvatar(avatarFile, roomId, data.id)
      if (url) await supabase.from('players').update({ avatar_url: url }).eq('id', data.id)
    }
    const { data: gs } = await supabase
      .from('friends_game').select('*').eq('room_id', roomId).maybeSingle()
    if (gs?.status === 'playing') setStep('jeu')
    else setStep('attente')
    if (gs) setGameState(gs)
  }

  const handleAnswer = async (chosenIndex: number) => {
    if (answered || !playerId || !gameState?.current_question_id || !gameState.question_open) return
    const question = FRIENDS_QUESTIONS.find(q => q.id === gameState.current_question_id)
    if (!question) return
    const shuffled = seededShuffle(question.options, question.id)
    const correctText = question.options[question.correctIndex]
    const is_correct = shuffled[chosenIndex] === correctText
    setAnswered(true)
    await supabase.from('friends_answers').upsert(
      {
        room_id: roomId,
        player_id: playerId,
        player_name: prenom,
        question_id: question.id,
        chosen_index: chosenIndex,
        is_correct,
      },
      { onConflict: 'room_id,player_id,question_id' }
    )
  }

  const currentQuestion = gameState?.current_question_id
    ? FRIENDS_QUESTIONS.find(q => q.id === gameState.current_question_id) ?? null
    : null
  const shuffledOptions = currentQuestion
    ? seededShuffle(currentQuestion.options, currentQuestion.id)
    : []

  const OPTION_LABELS = ['A', 'B', 'C', 'D']
  const OPTION_COLORS = [
    'hover:bg-yellow-500/20 hover:border-yellow-500/50',
    'hover:bg-red-500/20 hover:border-red-500/50',
    'hover:bg-blue-500/20 hover:border-blue-500/50',
    'hover:bg-purple-500/20 hover:border-purple-500/50',
  ]

  // ── Saisie prénom ─────────────────────────────────────────
  if (step === 'prenom') {
    return (
      <main className="min-h-screen bg-[#1a0a2e] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl">🛋️</div>
          <h1 className="text-3xl font-bold text-yellow-400">Quizz Friends</h1>
          <p className="text-white/50 text-sm">Tu sais tout sur la série ? Prouve-le !</p>
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-yellow-500/50 transition-colors"
            autoFocus
          />
          <div className="flex flex-col items-center gap-3">
            <div onClick={() => avatarRef.current?.click()} className="cursor-pointer">
              <PlayerAvatar name={prenom || '?'} avatarUrl={avatarPreview} size={72} />
            </div>
            <button type="button" onClick={() => avatarRef.current?.click()}
              className="text-xs text-white/40 hover:text-white/70 transition-colors">
              {avatarPreview ? '📷 Changer la photo' : '📷 Ajouter une photo (optionnel)'}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <button
            onClick={handleJoin}
            disabled={!prenom.trim()}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-3 text-lg disabled:opacity-30 transition-all active:scale-95"
          >
            Participer →
          </button>
        </div>
      </main>
    )
  }

  // ── Attente ───────────────────────────────────────────────
  if (step === 'attente') {
    return (
      <main className="min-h-screen bg-[#1a0a2e] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4 animate-bounce">☂️</div>
        <h2 className="text-xl font-semibold mb-2 text-yellow-400">Bonjour {prenom} !</h2>
        <p className="text-white/50">En attente du lancement du quiz…</p>
      </main>
    )
  }

  // ── Jeu ───────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1a0a2e] flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-sm space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center px-1">
          <span className="text-yellow-400/70 text-sm">🛋️ {prenom}</span>
          <span className="text-white/30 text-xs">Quizz Friends</span>
        </div>

        {/* Pas de question active */}
        {(!gameState?.question_open || !currentQuestion) && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl animate-pulse">☂️</div>
            <p className="text-white/50">En attente de la prochaine question…</p>
          </div>
        )}

        {/* Question active */}
        {gameState?.question_open && currentQuestion && !answered && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2.5 py-1 rounded-full">
                Question {currentQuestion.id} / {FRIENDS_QUESTIONS.length}
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-base font-semibold leading-relaxed">{currentQuestion.question}</p>
            </div>

            <div className="space-y-3">
              {shuffledOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm transition-all active:scale-98 ${OPTION_COLORS[i]}`}
                >
                  <span className="text-white/40 font-bold mr-2">{OPTION_LABELS[i]}.</span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Réponse envoyée */}
        {gameState?.question_open && currentQuestion && answered && (
          <div className="text-center py-12 space-y-4">
            <div className="text-5xl">✅</div>
            <p className="text-xl font-bold text-yellow-400">Réponse envoyée !</p>
            <p className="text-white/40 text-sm">En attente des autres joueurs…</p>
          </div>
        )}

      </div>
    </main>
  )
}
