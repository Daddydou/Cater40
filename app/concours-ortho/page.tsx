'use client'
// app/concours-ortho/page.tsx

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { vibrate } from '@/lib/vibrate'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import { uploadAvatar } from '@/lib/hooks/useAvatarUpload'
import PauseOverlay from '@/components/PauseOverlay'

const ROOM_CODE = 'concours-ortho'
const LS_KEY = 'cater40_player_concours-ortho'

type Question = {
  id: string
  ordre: number
  type: 'qcm' | 'libre'
  question: string
  propositions: string[] | null
  bonne_reponse: string
  status: string
}

type FinPlayer = { id: string; name: string; score: number; avatar_url?: string | null }

function groupByScore(players: FinPlayer[]): FinPlayer[][] {
  if (players.length === 0) return []
  const groups: FinPlayer[][] = []
  let currentGroup: FinPlayer[] = []
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

export default function ConcursOrtho() {
  const [step, setStep]             = useState<'prenom' | 'attente' | 'jeu' | 'fin'>('prenom')
  const [prenom, setPrenom]         = useState('')
  const [playerId, setPlayerId]     = useState<string | null>(null)
  const [roomId, setRoomId]         = useState<string | null>(null)
  const [roomStatus, setRoomStatus] = useState<string>('waiting')
  const [question, setQuestion]     = useState<Question | null>(null)
  const [reponse, setReponse]       = useState('')
  const [answered, setAnswered]     = useState(false)
  const [selectedProp, setSelectedProp] = useState<string | null>(null)
  const [score, setScore]           = useState(0)
  const [isOnline, setIsOnline]     = useState(true)
  const [bonneReponse, setBonneReponse] = useState<string | null>(null)
  const [finPlayers, setFinPlayers] = useState<FinPlayer[]>([])
  const [revealCount, setRevealCount] = useState(0)
  const bonneReponseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // Charger la room fixe
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('rooms').select('id, status').eq('code', ROOM_CODE).single()
      if (data) {
        setRoomId(data.id); setRoomStatus(data.status)
        try {
          const saved = localStorage.getItem(LS_KEY)
          if (saved) {
            const { playerId: savedId, prenom: savedPrenom } = JSON.parse(saved)
            const { data: existing } = await supabase
              .from('players').select('id').eq('id', savedId).eq('room_id', data.id).maybeSingle()
            if (existing) {
              setPlayerId(existing.id)
              setPrenom(savedPrenom)
              setStep(data.status === 'playing' ? 'jeu' : data.status === 'finished' ? 'fin' : 'attente')
            } else {
              localStorage.removeItem(LS_KEY)
            }
          }
        } catch {}
      }
    }
    load()
  }, [])

  // Realtime — statut room + question active
  useEffect(() => {
    if (!roomId) return

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

    const qChannel = supabase
      .channel(`ortho-questions-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ortho_questions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.new.status === 'active') {
          setQuestion(payload.new as Question)
          setAnswered(false)
          setSelectedProp(null)
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

    const loadActiveQ = async () => {
      const { data } = await supabase
        .from('ortho_questions').select('*')
        .eq('room_id', roomId).eq('status', 'active').single()
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
    const onOnline  = () => setIsOnline(true)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  // Score en temps réel
  useEffect(() => {
    if (!playerId) return
    const channel = supabase
      .channel(`score-${playerId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'players',
        filter: `id=eq.${playerId}`,
      }, (payload) => { setScore(payload.new.score) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [playerId])

  // Phase fin : charger le classement + polling reveal_count
  useEffect(() => {
    if (step !== 'fin' || !roomId) return

    const fetchFin = async () => {
      const [playersRes, roomRes] = await Promise.all([
        supabase.from('players').select('id, name, score, avatar_url')
          .eq('room_id', roomId).order('score', { ascending: false }),
        supabase.from('rooms').select('reveal_count').eq('id', roomId).single(),
      ])
      if (playersRes.data) setFinPlayers(playersRes.data)
      if (roomRes.data?.reveal_count !== undefined) setRevealCount(roomRes.data.reveal_count)
    }
    fetchFin()

    const id = setInterval(async () => {
      const { data } = await supabase.from('rooms').select('reveal_count').eq('id', roomId).single()
      if (data?.reveal_count !== undefined) setRevealCount(data.reveal_count)
    }, 2000)
    return () => clearInterval(id)
  }, [step, roomId])

  // Inscription
  const handleJoin = async () => {
    if (!prenom.trim() || !roomId) return
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const { playerId: savedId } = JSON.parse(saved)
        const { data: existing } = await supabase
          .from('players').select('id').eq('id', savedId).eq('room_id', roomId).maybeSingle()
        if (existing) {
          setPlayerId(existing.id)
          setStep(roomStatus === 'playing' ? 'jeu' : 'attente')
          return
        } else {
          localStorage.removeItem(LS_KEY)
        }
      }
    } catch {}
    const { data } = await supabase
      .from('players').insert({ room_id: roomId, name: prenom.trim(), score: 0 })
      .select().single()
    if (data) {
      setPlayerId(data.id)
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ playerId: data.id, prenom: prenom.trim() }))
      } catch {}
      if (avatarFile) {
        const url = await uploadAvatar(avatarFile, roomId!, data.id)
        if (url) await supabase.from('players').update({ avatar_url: url }).eq('id', data.id)
      }
      setStep(roomStatus === 'playing' ? 'jeu' : 'attente')
    }
  }

  // Valider la réponse QCM sélectionnée
  const handleValidateQCM = async () => {
    if (answered || !playerId || !question || !selectedProp) return
    setAnswered(true)
    const correct = selectedProp === question.bonne_reponse
    if (correct) vibrate.success(); else vibrate.error()
    await supabase.from('ortho_reponses').insert({
      room_id: roomId,
      question_id: question.id,
      player_id: playerId,
      reponse: selectedProp,
      is_correct: correct,
    })
    if (correct) {
      await supabase.from('players').update({ score: score + 1 }).eq('id', playerId)
      setScore(s => s + 1)
    }
  }

  // Réponse libre
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

  const OfflineBanner = () => !isOnline ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-center text-sm py-2 font-semibold">
      ⚠️ Connexion perdue…
    </div>
  ) : null

  const renderContent = () => {
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

    // ── Fin — classement révélé progressivement ───────────────
    if (step === 'fin') {
      const groups = groupByScore(finPlayers)
      const totalGroups = groups.length
      const isGroupRevealed = (gi: number) => revealCount >= totalGroups - gi

      return (
        <main className="min-h-screen bg-[#0B3D3A] text-white p-5">
          <div className="w-full max-w-sm mx-auto space-y-4">
            <div className="text-center pt-4 pb-2">
              <h2 className="text-2xl font-bold">🏆 Classement</h2>
              <p className="text-white/40 text-sm mt-1">{prenom} — {score} pts</p>
            </div>

            {totalGroups === 0 ? (
              <div className="text-center py-12 text-white/40 text-sm animate-pulse">
                Chargement du classement…
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group, gi) => {
                  const rank  = gi + 1
                  const shown = isGroupRevealed(gi)
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`

                  if (!shown) {
                    return (
                      <div key={gi} className="h-14 bg-white/3 border border-white/5 rounded-2xl flex items-center justify-center">
                        <span className="text-white/20 text-sm">???</span>
                      </div>
                    )
                  }

                  return (
                    <div key={gi} className={`rounded-2xl p-4 border pop-in ${
                      rank === 1 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{medal}</span>
                          <div>
                            {group.map(p => (
                              <span key={p.id} className="font-semibold block">{p.name}</span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xl font-bold tabular-nums">{group[0].score} pts</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
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

          {/* Question active — pas encore répondu */}
          {question && !answered && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-full">
                  {question.type === 'qcm' ? '🔘 QCM' : '✏️ Réponse libre'}
                </span>
                <span className="text-white/30 text-xs">Q{question.ordre}</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-base font-medium leading-relaxed">{question.question}</p>
              </div>

              {/* QCM — sélection + bouton valider */}
              {question.type === 'qcm' && question.propositions && (
                <div className="space-y-2">
                  {question.propositions.map((prop, i) => {
                    const isSelected = selectedProp === prop
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedProp(prop)}
                        className={`w-full text-left border rounded-xl px-4 py-3 text-sm transition-all active:scale-98 ${
                          isSelected
                            ? 'bg-teal-500/20 border-teal-500/50 text-white'
                            : 'bg-white/5 border-white/10 hover:bg-teal-500/10 hover:border-teal-500/30'
                        }`}
                      >
                        <span className={`mr-2 font-bold ${isSelected ? 'text-teal-300' : 'text-white/40'}`}>
                          {['A', 'B', 'C', 'D', 'E'][i]}.
                        </span>
                        {prop}
                      </button>
                    )
                  })}
                  <button
                    onClick={handleValidateQCM}
                    disabled={!selectedProp}
                    className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl py-3 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Valider ma réponse ✓
                  </button>
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

  return (
    <>
      <PauseOverlay />
      {renderContent()}
    </>
  )
}
