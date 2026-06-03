'use client'
// app/concours-ortho/page.tsx

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { vibrate } from '@/lib/vibrate'

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

export default function ConcursOrtho() {
  const [step, setStep]             = useState<'prenom' | 'attente' | 'jeu' | 'fin'>('prenom')
  const [prenom, setPrenom]         = useState('')
  const [playerId, setPlayerId]     = useState<string | null>(null)
  const [roomId, setRoomId]         = useState<string | null>(null)
  const [roomStatus, setRoomStatus] = useState<string>('waiting')
  const [question, setQuestion]     = useState<Question | null>(null)
  const [reponse, setReponse]       = useState('')
  const [answered, setAnswered]     = useState(false)
  const [score, setScore]           = useState(0)
  const [isOnline, setIsOnline]     = useState(true)
  const [bonneReponse, setBonneReponse] = useState<string | null>(null)
  const bonneReponseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger la room fixe
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('code', ROOM_CODE)
        .single()
      if (data) { setRoomId(data.id); setRoomStatus(data.status) }
    }
    load()
  }, [])

  // Realtime — statut room + question active
  useEffect(() => {
    if (!roomId) return

    // Écouter changements room
    const roomChannel = supabase
      .channel(`ortho-room-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        setRoomStatus(payload.new.status)
        if (payload.new.status === 'playing' && step === 'attente') setStep('jeu')
        if (payload.new.status === 'finished') setStep('fin')
      })
      .subscribe()

    // Écouter questions actives
    const qChannel = supabase
      .channel(`ortho-questions-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ortho_questions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.new.status === 'active') {
          setQuestion(payload.new as Question)
          setAnswered(false)
          setReponse('')
        } else if (payload.new.status === 'closed') {
          if (question?.id === payload.new.id) setQuestion(null)
          const br = payload.new.bonne_reponse as string
          if (br) {
            setBonneReponse(br)
            if (bonneReponseTimer.current) clearTimeout(bonneReponseTimer.current)
            bonneReponseTimer.current = setTimeout(() => setBonneReponse(null), 4000)
          }
        }
      })
      .subscribe()

    // Charger question active au montage
    const loadActiveQ = async () => {
      const { data } = await supabase
        .from('ortho_questions')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'active')
        .single()
      if (data) { setQuestion(data); setAnswered(false) }
    }
    loadActiveQ()

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(qChannel)
    }
  }, [roomId, step])

  // Détection offline/online
  useEffect(() => {
    const onOffline = () => setIsOnline(false)
    const onOnline  = () => { setIsOnline(true) }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

   // Synchroniser le score depuis la DB en temps réel
useEffect(() => {
  if (!playerId) return
  const channel = supabase
    .channel(`score-${playerId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'players',
      filter: `id=eq.${playerId}`,
    }, (payload) => {
      setScore(payload.new.score)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [playerId])

  // Inscription
  const handleJoin = async () => {
    if (!prenom.trim() || !roomId) return
    const { data } = await supabase
      .from('players')
      .insert({ room_id: roomId, name: prenom.trim(), score: 0 })
      .select()
      .single()
    if (data) {
      setPlayerId(data.id)
      setStep(roomStatus === 'playing' ? 'jeu' : 'attente')
    }
  }

  // Répondre à une question QCM
  const handleQCM = async (proposition: string) => {
  if (answered || !playerId || !question) return
  setAnswered(true)
  const correct = proposition === question.bonne_reponse
  if (correct) { vibrate.success() } else { vibrate.error() }

  await supabase.from('ortho_reponses').insert({
    room_id: roomId,
    question_id: question.id,
    player_id: playerId,
    reponse: proposition,
    is_correct: correct,
  })

  if (correct) {
    await supabase.from('players').update({ score: score + 1 }).eq('id', playerId)
    setScore(s => s + 1)
  }
}

  // Répondre à une question libre
  const handleLibre = async () => {
  if (answered || !playerId || !question || !reponse.trim()) return
  setAnswered(true)
  await supabase.from('ortho_reponses').insert({
    room_id: roomId,
    question_id: question.id,
    player_id: playerId,
    reponse: reponse.trim(),
    is_correct: null,
  })
}

  // ── Bandeau offline ───────────────────────────────────────
  const OfflineBanner = () => !isOnline ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-center text-sm py-2 font-semibold">
      ⚠️ Connexion perdue…
    </div>
  ) : null

  // ── Saisie prénom ─────────────────────────────────────────
  if (step === 'prenom') {
    return (
      <main className="min-h-screen bg-[#0B3D3A] flex flex-col items-center justify-center p-6 text-white">
        <OfflineBanner />
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl">✍️</div>
          <h1 className="text-2xl font-bold">Concours Ortho</h1>
          <p className="text-white/50 text-sm">Questions de langage & orthophonie</p>
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-white/50 transition-colors"
            autoFocus
          />
          <button
            onClick={handleJoin}
            disabled={!prenom.trim()}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl py-3 text-lg disabled:opacity-30 transition-all active:scale-95"
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
      <main className="min-h-screen bg-[#0B3D3A] flex flex-col items-center justify-center p-6 text-white text-center">
        <OfflineBanner />
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-xl font-semibold mb-2">Bonjour {prenom} !</h2>
        <p className="text-white/50">En attente du lancement…</p>
      </main>
    )
  }

  // ── Fin ───────────────────────────────────────────────────
  if (step === 'fin') {
    return (
      <main className="min-h-screen bg-[#0B3D3A] flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">{prenom}</h2>
        <p className="text-white/60">Score final</p>
        <p className="text-5xl font-bold">{score} pts</p>
        <p className="text-white/40 text-sm mt-4">Résultats affichés sur l&apos;écran principal</p>
      </main>
    )
  }

  // ── Jeu en cours ─────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0B3D3A] flex flex-col items-center justify-center p-4 text-white">
      <OfflineBanner />

      {/* Overlay bonne réponse */}
      {bonneReponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60">
          <div className="w-full max-w-sm bg-green-900 border-2 border-green-400 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
            <div className="text-5xl">✅</div>
            <p className="text-green-300 text-xs font-bold uppercase tracking-widest">Bonne réponse :</p>
            <p className="text-white text-2xl font-bold leading-snug">{bonneReponse}</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-sm space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center px-1">
          <span className="text-white/50 text-sm">✍️ {prenom}</span>
          <span className="text-white/50 text-sm tabular-nums">{score} pts</span>
        </div>

        {/* Pas de question active */}
        {!question && (
          <div className="text-center py-12 space-y-3">
            <div className="text-4xl animate-pulse">💬</div>
            <p className="text-white/50">En attente de la prochaine question…</p>
          </div>
        )}

        {/* Question active */}
        {question && !answered && (
          <div className="space-y-4">
            {/* Badge type */}
            <div className="flex items-center gap-2">
              <span className="text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-full">
                {question.type === 'qcm' ? '🔘 QCM' : '✏️ Réponse libre'}
              </span>
              <span className="text-white/30 text-xs">Q{question.ordre}</span>
            </div>

            {/* Énoncé */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-base font-medium leading-relaxed">{question.question}</p>
            </div>

            {/* QCM */}
            {question.type === 'qcm' && question.propositions && (
              <div className="space-y-2">
                {question.propositions.map((prop, i) => (
                  <button
                    key={i}
                    onClick={() => handleQCM(prop)}
                    className="w-full text-left bg-white/5 hover:bg-teal-500/20 border border-white/10 hover:border-teal-500/40 rounded-xl px-4 py-3 text-sm transition-all active:scale-98"
                  >
                    <span className="text-white/40 mr-2">{['A', 'B', 'C', 'D'][i]}.</span>
                    {prop}
                  </button>
                ))}
              </div>
            )}

            {/* Réponse libre */}
            {question.type === 'libre' && (
              <div className="space-y-3">
                <textarea
                  value={reponse}
                  onChange={e => setReponse(e.target.value)}
                  placeholder="Ta réponse…"
                  rows={3}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-teal-500/50 transition-colors resize-none"
                />
                <button
                  onClick={handleLibre}
                  disabled={!reponse.trim()}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl py-3 disabled:opacity-30 transition-all active:scale-95"
                >
                  Valider ✓
                </button>
              </div>
            )}
          </div>
        )}

        {/* Réponse envoyée */}
        {question && answered && (
          <div className="text-center py-10 space-y-3">
            <div className="text-4xl">✅</div>
            <p className="font-semibold">Réponse envoyée !</p>
            <p className="text-white/40 text-sm">En attente des autres joueurs…</p>
          </div>
        )}

      </div>
    </main>
  )
}
