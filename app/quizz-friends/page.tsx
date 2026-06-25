'use client'
// app/quizz-friends/page.tsx — écran joueur

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import { uploadAvatar } from '@/lib/hooks/useAvatarUpload'
import { FRIENDS_QUESTIONS, seededShuffle } from '@/lib/friends-quiz-data'
import PauseOverlay from '@/components/PauseOverlay'

const ROOM_CODE = 'quizz-friends'
const LS_KEY = 'cater40_player_quizz-friends'

type GameState = {
  id: string
  room_id: string
  status: 'waiting' | 'playing' | 'finished'
  current_question_id: number | null
  question_open: boolean
}

type MyAnswer = {
  chosen_index: number | null
  is_correct: boolean | null
  free_text: string | null
  validated: boolean
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const OPTION_COLORS = [
  'hover:bg-yellow-500/20 hover:border-yellow-500/50',
  'hover:bg-red-500/20 hover:border-red-500/50',
  'hover:bg-blue-500/20 hover:border-blue-500/50',
  'hover:bg-purple-500/20 hover:border-purple-500/50',
  'hover:bg-orange-500/20 hover:border-orange-500/50',
  'hover:bg-cyan-500/20 hover:border-cyan-500/50',
]

export default function QuizzFriends() {
  const router = useRouter()
  const [step, setStep]                     = useState<'prenom' | 'attente' | 'jeu'>('prenom')
  const [prenom, setPrenom]                 = useState('')
  const [playerId, setPlayerId]             = useState<string | null>(null)
  const [roomId, setRoomId]                 = useState<string | null>(null)
  const [gameState, setGameState]           = useState<GameState | null>(null)
  const [answered, setAnswered]             = useState(false)
  const [myAnswer, setMyAnswer]             = useState<MyAnswer | null>(null)
  const [selectedIndex, setSelectedIndex]   = useState<number | null>(null)
  const [freeText, setFreeText]             = useState('')
  const [avatarFile, setAvatarFile]         = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null)
  const avatarRef        = useRef<HTMLInputElement>(null)
  const lastQuestionId   = useRef<number | null>(null)
  const stepRef          = useRef(step)
  stepRef.current        = step
  const playerIdRef      = useRef<string | null>(null)
  playerIdRef.current    = playerId
  const roomIdRef        = useRef<string | null>(null)
  const answeredRef      = useRef(false)
  const initialized      = useRef(false)

  const setAnsweredSync = (val: boolean) => {
    setAnswered(val)
    answeredRef.current = val
  }

  // Charger la room
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (data) {
        setRoomId(data.id)
        roomIdRef.current = data.id
        try {
          const saved = sessionStorage.getItem(LS_KEY)
          if (saved) {
            const { playerId: savedId, prenom: savedPrenom } = JSON.parse(saved)
            const { data: existing } = await supabase
              .from('players').select('id').eq('id', savedId).eq('room_id', data.id).maybeSingle()
            if (existing) {
              setPlayerId(savedId)
              playerIdRef.current = savedId
              setPrenom(savedPrenom)
              const { data: gs } = await supabase
                .from('friends_game').select('status').eq('room_id', data.id).maybeSingle()
              setStep(gs?.status === 'playing' ? 'jeu' : 'attente')
            } else {
              sessionStorage.removeItem(LS_KEY)
            }
          }
        } catch {}
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

      const pid = playerIdRef.current

      if (data.current_question_id !== lastQuestionId.current) {
        // Nouvelle question détectée
        lastQuestionId.current = data.current_question_id
        if (stepRef.current === 'jeu' && pid && data.current_question_id) {
          const { data: existing } = await supabase
            .from('friends_answers')
            .select('chosen_index, is_correct, free_text, validated')
            .eq('room_id', roomId)
            .eq('player_id', pid)
            .eq('question_id', data.current_question_id)
            .maybeSingle()
          if (existing) {
            setAnsweredSync(true)
            setMyAnswer(existing as MyAnswer)
          } else {
            setAnsweredSync(false)
            setMyAnswer(null)
            setSelectedIndex(null)
            setFreeText('')
          }
        } else {
          setAnsweredSync(false)
          setMyAnswer(null)
          setSelectedIndex(null)
          setFreeText('')
        }
      } else if (answeredRef.current && pid && data.current_question_id) {
        // Question inchangée, déjà répondu → refetch pour validated (questions libres)
        const { data: existing } = await supabase
          .from('friends_answers')
          .select('chosen_index, is_correct, free_text, validated')
          .eq('room_id', roomId)
          .eq('player_id', pid)
          .eq('question_id', data.current_question_id)
          .maybeSingle()
        if (existing) setMyAnswer(existing as MyAnswer)
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
    try {
      const saved = sessionStorage.getItem(LS_KEY)
      if (saved) {
        const { playerId: savedId } = JSON.parse(saved)
        const { data: existing } = await supabase
          .from('players').select('id').eq('id', savedId).eq('room_id', roomId).maybeSingle()
        if (existing) {
          setPlayerId(existing.id)
          playerIdRef.current = existing.id
          const { data: gs } = await supabase
            .from('friends_game').select('status').eq('room_id', roomId).maybeSingle()
          setStep(gs?.status === 'playing' ? 'jeu' : 'attente')
          return
        } else {
          sessionStorage.removeItem(LS_KEY)
        }
      }
    } catch {}
    const { data } = await supabase
      .from('players')
      .insert({ room_id: roomId, name: prenom.trim(), score: 0 })
      .select().single()
    if (!data) return
    setPlayerId(data.id)
    playerIdRef.current = data.id
    try {
      sessionStorage.setItem(LS_KEY, JSON.stringify({ playerId: data.id, prenom: prenom.trim() }))
    } catch {}
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

  const handleValidateQCM = async () => {
    if (answered || selectedIndex === null || !playerId || !gameState?.current_question_id || !gameState.question_open) return
    const question = FRIENDS_QUESTIONS.find(q => q.id === gameState.current_question_id)
    if (!question || question.type !== 'qcm') return
    const shuffled = seededShuffle(question.options, question.id)
    const correctText = question.options[question.correctIndex]
    const is_correct = shuffled[selectedIndex] === correctText
    const ans: MyAnswer = { chosen_index: selectedIndex, is_correct, free_text: null, validated: false }
    setAnsweredSync(true)
    setMyAnswer(ans)
    await supabase.from('friends_answers').upsert(
      {
        room_id: roomId,
        player_id: playerId,
        player_name: prenom,
        question_id: question.id,
        chosen_index: selectedIndex,
        is_correct,
        free_text: null,
        validated: false,
      },
      { onConflict: 'room_id,player_id,question_id' }
    )
  }

  const handleFreeAnswer = async () => {
    if (answered || !playerId || !gameState?.current_question_id || !gameState.question_open) return
    if (!freeText.trim()) return
    const ans: MyAnswer = { chosen_index: null, is_correct: null, free_text: freeText.trim(), validated: false }
    setAnsweredSync(true)
    setMyAnswer(ans)
    await supabase.from('friends_answers').upsert(
      {
        room_id: roomId,
        player_id: playerId,
        player_name: prenom,
        question_id: gameState.current_question_id,
        chosen_index: null,
        is_correct: null,
        free_text: freeText.trim(),
        validated: false,
      },
      { onConflict: 'room_id,player_id,question_id' }
    )
  }

  const currentQuestion = gameState?.current_question_id
    ? FRIENDS_QUESTIONS.find(q => q.id === gameState.current_question_id) ?? null
    : null

  const shuffledOptions = currentQuestion?.type === 'qcm'
    ? seededShuffle(currentQuestion.options, currentQuestion.id)
    : []

  const renderContent = () => {
    // ── Saisie prénom ─────────────────────────────────────────
    if (step === 'prenom') {
      return (
        <main className="min-h-screen bg-[#1a0a2e] flex flex-col items-center justify-center p-6 text-white">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="text-6xl">🛋️</div>
            <h1 className="text-3xl font-bold text-yellow-400">We are your Friends</h1>
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
    const isOpen = gameState?.question_open ?? false

    const header = (
      <div className="flex justify-between items-center px-1">
        <span className="text-yellow-400/70 text-sm">🛋️ {prenom}</span>
        {currentQuestion && (
          <span className="text-white/30 text-xs">
            Q{currentQuestion.id} / {FRIENDS_QUESTIONS.length}
          </span>
        )}
      </div>
    )

    const questionCard = currentQuestion && (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-base font-semibold leading-relaxed">{currentQuestion.question}</p>
      </div>
    )

    const wrap = (children: React.ReactNode) => (
      <main className="min-h-screen bg-[#1a0a2e] flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-sm space-y-5">
          {header}
          {children}
        </div>
      </main>
    )

    // Pas de question active
    if (!currentQuestion) {
      return wrap(
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl animate-pulse">☂️</div>
          <p className="text-white/50">En attente de la prochaine question…</p>
        </div>
      )
    }

    // ── Question fermée + répondu → révélation ───────────────
    if (!isOpen && answered) {
      if (currentQuestion.type === 'qcm') {
        const correctText = currentQuestion.options[currentQuestion.correctIndex]
        const correctShuffledIndex = shuffledOptions.indexOf(correctText)
        const myChosenIndex = myAnswer?.chosen_index ?? -1
        const playerWasCorrect = myAnswer?.is_correct ?? false

        return wrap(
          <>
            {questionCard}
            <div className="space-y-2">
              {shuffledOptions.map((opt, i) => {
                const isCorrect = i === correctShuffledIndex
                const isMyChoice = i === myChosenIndex
                let cls = 'bg-white/5 border-white/10 text-white/40'
                if (isCorrect) cls = 'bg-green-900/40 border-green-500/60 text-white'
                else if (isMyChoice && !isCorrect) cls = 'bg-red-900/40 border-red-500/60 text-white'
                return (
                  <div key={i} className={`w-full border rounded-xl px-4 py-3 text-sm ${cls}`}>
                    <span className="font-bold mr-2 opacity-60">{OPTION_LABELS[i]}.</span>
                    {opt}
                    {isCorrect && <span className="ml-2 text-green-400 text-xs font-semibold">✓ Bonne réponse</span>}
                    {isMyChoice && !isCorrect && <span className="ml-2 text-red-400 text-xs font-semibold">✗ Mauvaise réponse</span>}
                  </div>
                )
              })}
            </div>
            <div className={`text-center py-3 rounded-xl text-sm font-semibold ${playerWasCorrect ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
              {playerWasCorrect ? '✅ Bonne réponse !' : '❌ Mauvaise réponse'}
            </div>
          </>
        )
      } else {
        // Libre révélé
        const isValidated = myAnswer?.validated ?? false
        return wrap(
          <>
            {questionCard}
            {myAnswer?.free_text && (
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 italic">
                Ta réponse : « {myAnswer.free_text} »
              </div>
            )}
            <div className={`text-center py-4 rounded-2xl text-base font-bold ${isValidated ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
              {isValidated ? '✅ Réponse validée (+1 point)' : '❌ Réponse non validée'}
            </div>
          </>
        )
      }
    }

    // ── Question fermée sans réponse → attente ───────────────
    if (!isOpen) {
      return wrap(
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl animate-pulse">☂️</div>
          <p className="text-white/50">En attente de la prochaine question…</p>
        </div>
      )
    }

    // ── Question ouverte + déjà répondu ──────────────────────
    if (answered) {
      if (currentQuestion.type === 'libre') {
        return wrap(
          <>
            {questionCard}
            <div className="text-center py-12 space-y-4">
              <div className="text-5xl">⏳</div>
              <p className="text-xl font-bold text-yellow-400">Réponse envoyée !</p>
              <p className="text-white/40 text-sm">En cours de validation…</p>
              {myAnswer?.free_text && (
                <p className="text-white/30 text-xs italic">« {myAnswer.free_text} »</p>
              )}
            </div>
          </>
        )
      }
      // QCM verrouillé : afficher les options avec la sélection mise en évidence
      const myChosenIndex = myAnswer?.chosen_index ?? -1
      return wrap(
        <>
          {questionCard}
          <div className="space-y-2">
            {shuffledOptions.map((opt, i) => {
              const isMyChoice = i === myChosenIndex
              return (
                <div key={i} className={`w-full border rounded-xl px-4 py-3 text-sm ${
                  isMyChoice
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/30'
                }`}>
                  <span className={`font-bold mr-2 ${isMyChoice ? 'text-yellow-400' : 'text-white/20'}`}>
                    {OPTION_LABELS[i]}.
                  </span>
                  {opt}
                  {isMyChoice && <span className="ml-2 text-yellow-400/70 text-xs">← ta réponse</span>}
                </div>
              )
            })}
          </div>
          <div className="text-center py-3 rounded-xl bg-yellow-500/10 text-yellow-300 text-sm font-semibold">
            ✅ Réponse envoyée ! En attente des autres joueurs…
          </div>
        </>
      )
    }

    // ── Question ouverte, QCM ─────────────────────────────────
    if (currentQuestion.type === 'qcm') {
      return wrap(
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2.5 py-1 rounded-full">
              Question {currentQuestion.id} / {FRIENDS_QUESTIONS.length}
            </span>
          </div>
          {questionCard}
          <div className="space-y-3">
            {shuffledOptions.map((opt, i) => {
              const isSelected = i === selectedIndex
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full text-left border rounded-xl px-4 py-4 text-sm transition-all active:scale-98 ${
                    isSelected
                      ? 'bg-yellow-500/20 border-yellow-500/60 text-white'
                      : `bg-white/5 border-white/10 ${OPTION_COLORS[i]}`
                  }`}
                >
                  <span className={`font-bold mr-2 ${isSelected ? 'text-yellow-400' : 'text-white/40'}`}>
                    {OPTION_LABELS[i]}.
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
          <button
            onClick={handleValidateQCM}
            disabled={selectedIndex === null}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-3 text-sm disabled:opacity-30 transition-all active:scale-95"
          >
            Valider ma réponse →
          </button>
        </div>
      )
    }

    // ── Question ouverte, LIBRE ───────────────────────────────
    return wrap(
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full">
            Question {currentQuestion.id} / {FRIENDS_QUESTIONS.length} — Réponse libre
          </span>
        </div>
        {questionCard}
        <div className="space-y-3">
          <input
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFreeAnswer()}
            placeholder="Ta réponse…"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 transition-colors"
            autoFocus
          />
          <button
            onClick={handleFreeAnswer}
            disabled={!freeText.trim()}
            className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl py-3 text-sm disabled:opacity-30 transition-all active:scale-95"
          >
            Valider ma réponse →
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PauseOverlay />
      {renderContent()}
    </>
  )
}
