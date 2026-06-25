'use client'
// app/famille-or/page.tsx — Écran joueurs/spectateurs avec buzzer

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import { uploadAvatar } from '@/lib/hooks/useAvatarUpload'
import PauseOverlay from '@/components/PauseOverlay'

const ROOM_CODE = 'famille-or'
const LS_KEY = 'cater40_player_famille-or'

type Session = {
  id: string
  equipe1_nom: string
  equipe2_nom: string
  equipe1_score: number
  equipe2_score: number
  status: string
  finale_rep_eq1: string | null
  finale_rep_eq2: string | null
  finale_rep1_valide: boolean
  finale_rep2_valide: boolean
  finale_correction_ordre: number
}
type FinaleQuestion = {
  id: string; ordre: number; question: string
  reponse_eq1: string | null; reponse_eq2: string | null
  points: number; status: string
  points_eq1: number; points_eq2: number
}
type Question = {
  id: string
  ordre: number
  question: string
  status: string
  equipe_active: number
  croix_equipe1: number
  croix_equipe2: number
  phase: string
  representant_eq1: string | null
  representant_eq2: string | null
  buzzer_winner_id: string | null
}
type Reponse = {
  id: string
  ordre: number
  texte: string
  points: number
  revealed: boolean
}
type Player = {
  id: string
  name: string
  equipe: number | null
  avatar_url?: string | null
}

export default function FamilleOrJoueurs() {
  const [prenom, setPrenom]         = useState('')
  const [myPlayer, setMyPlayer]     = useState<Player | null>(null)
  const [roomId, setRoomId]         = useState<string | null>(null)
  const [session, setSession]       = useState<Session | null>(null)
  const [question, setQuestion]     = useState<Question | null>(null)
  const [reponses, setReponses]     = useState<Reponse[]>([])
  const [loading, setLoading]       = useState(true)
  const [joined, setJoined]         = useState(false)
  const [buzzed, setBuzzed]         = useState(false)
  const [finaleQuestions, setFinaleQuestions] = useState<FinaleQuestion[]>([])
  const [finaleQ, setFinaleQ]       = useState<FinaleQuestion | null>(null)
  const [finaleReponses, setFinaleReponses] = useState<Record<string, string>>({})
  const [finaleValide, setFinaleValide] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // Polling toutes les 2 secondes
  useEffect(() => {
    const load = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) { setLoading(false); return }
      setRoomId(room.id)

      if (!joined) {
        try {
          const saved = localStorage.getItem(LS_KEY)
          if (saved) {
            const { playerId: savedId } = JSON.parse(saved)
            const { data: existing } = await supabase
              .from('players').select('id, name, equipe, avatar_url')
              .eq('id', savedId).eq('room_id', room.id).maybeSingle()
            if (existing) {
              setMyPlayer({ id: existing.id, name: existing.name, equipe: existing.equipe, avatar_url: existing.avatar_url })
              setJoined(true)
            } else {
              localStorage.removeItem(LS_KEY)
            }
          }
        } catch {}
      }

      const { data: sess } = await supabase
        .from('famille_or_sessions').select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      if (sess) {
        setSession(sess)
        if (sess.status === 'finale') {
          const { data: fqs } = await supabase
            .from('famille_or_finale').select('*')
            .eq('session_id', sess.id).order('ordre')
          if (fqs) {
            setFinaleQuestions(fqs)
            setFinaleQ(fqs.find(q => q.status === 'active') ?? null)
          }
          setLoading(false)
          return
        }
        const { data: q } = await supabase
          .from('famille_or_questions').select('*')
          .eq('session_id', sess.id).eq('status', 'active').maybeSingle()
        setQuestion(q)
        if (q) {
          const { data: reps } = await supabase
            .from('famille_or_reponses').select('*')
            .eq('question_id', q.id).order('ordre')
          if (reps) setReponses(reps)
          // Reset buzzed si nouvelle question sans buzz
          if (!q.buzzer_winner_id) setBuzzed(false)
        } else {
          setReponses([])
          setBuzzed(false)
        }
      }
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleJoin = async () => {
    if (!prenom.trim() || !roomId) return
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const { playerId: savedId } = JSON.parse(saved)
        const { data: existing } = await supabase
          .from('players').select('id, name, equipe, avatar_url')
          .eq('id', savedId).eq('room_id', roomId).maybeSingle()
        if (existing) {
          setMyPlayer({ id: existing.id, name: existing.name, equipe: existing.equipe, avatar_url: existing.avatar_url })
          setJoined(true)
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
      if (avatarFile) {
        const url = await uploadAvatar(avatarFile, roomId!, data.id)
        if (url) await supabase.from('players').update({ avatar_url: url }).eq('id', data.id)
      }
      setMyPlayer({ id: data.id, name: prenom.trim(), equipe: null })
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ playerId: data.id, prenom: prenom.trim() }))
      } catch {}
      setJoined(true)
    }
  }

  const handleValiderToutesReponsesFinale = async () => {
    if (!session || !myPlayer || finaleValide) return
    const isEq1 = myPlayer.id === session.finale_rep_eq1
    for (const [questionId, reponse] of Object.entries(finaleReponses)) {
      const field = isEq1 ? 'reponse_eq1' : 'reponse_eq2'
      await supabase.from('famille_or_finale').update({ [field]: reponse }).eq('id', questionId)
    }
    const valideField = isEq1 ? 'finale_rep1_valide' : 'finale_rep2_valide'
    await supabase.from('famille_or_sessions').update({ [valideField]: true }).eq('id', session.id)
    setFinaleValide(true)
  }

  const handleBuzz = async () => {
    if (!question || !myPlayer || buzzed) return
    if (question.buzzer_winner_id) return
    setBuzzed(true)
    await supabase.from('famille_or_questions')
      .update({ buzzer_winner_id: myPlayer.id })
      .eq('id', question.id)
  }

  const isRepresentant = myPlayer && question && (
    question.representant_eq1 === myPlayer.id ||
    question.representant_eq2 === myPlayer.id
  )

  const isBuzzWinner = myPlayer && question?.buzzer_winner_id === myPlayer.id

  const isAdverse = myPlayer && question &&
    question.phase === 'buzzer_adverse' &&
    question.buzzer_winner_id &&
    question.buzzer_winner_id !== myPlayer.id &&
    (question.representant_eq1 === myPlayer.id || question.representant_eq2 === myPlayer.id)

  const croixActives = question
    ? (question.equipe_active === 1 ? question.croix_equipe1 : question.croix_equipe2)
    : 0

  const renderContent = () => {
  if (loading) return (
    <main className="min-h-screen bg-[#1a237e] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  // ── Saisie prénom ──────────────────────────────────────────
  if (!joined) {
    return (
      <main className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl">🏆</div>
          <h1 className="text-2xl font-bold">Famille en Or</h1>
          <p className="text-white/50 text-sm">Rejoins la partie !</p>
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-yellow-400 transition-colors"
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
          <button onClick={handleJoin} disabled={!prenom.trim()}
            className="w-full bg-[#ffd700] hover:bg-yellow-300 text-black font-bold rounded-xl py-3 text-lg disabled:opacity-30 transition-all active:scale-95">
            Rejoindre →
          </button>
        </div>
      </main>
    )
  }

  // ── Finale ────────────────────────────────────────────────
  if (session?.status === 'finale') {
    const isRep = myPlayer && (
      session.finale_rep_eq1 === myPlayer.id ||
      session.finale_rep_eq2 === myPlayer.id
    )
    const isEq1 = myPlayer && session.finale_rep_eq1 === myPlayer.id
    const myValide = isEq1 ? session.finale_rep1_valide : session.finale_rep2_valide

    // Phase saisie — avant que les 2 aient validé
    if (!session.finale_rep1_valide || !session.finale_rep2_valide) {
      return (
        <main className="min-h-screen bg-[#1a237e] text-white p-6">
          <div className="max-w-sm mx-auto space-y-5">
            <div className="text-center pt-2">
              <div className="text-4xl mb-1">🏆</div>
              <p className="text-purple-300 font-bold text-lg">FINALE</p>
            </div>
            {isRep ? (
              myValide ? (
                <div className="text-center space-y-3 pt-8">
                  <div className="text-5xl">✅</div>
                  <p className="text-green-300 font-bold text-xl">Réponses envoyées !</p>
                  <p className="text-white/40 text-sm">En attente de l&apos;autre équipe…</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {finaleQuestions.map(fq => (
                    <div key={fq.id} className="bg-blue-800/50 border border-white/10 rounded-2xl p-4 space-y-3">
                      <p className="text-xs text-purple-300/60">Q{fq.ordre}</p>
                      <p className="font-bold text-base leading-snug">{fq.question}</p>
                      <input
                        value={finaleReponses[fq.id] ?? ''}
                        onChange={e => setFinaleReponses(prev => ({ ...prev, [fq.id]: e.target.value }))}
                        placeholder="Ta réponse…"
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm outline-none focus:border-purple-400 transition-colors"
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleValiderToutesReponsesFinale}
                    disabled={finaleQuestions.some(fq => !finaleReponses[fq.id]?.trim())}
                    className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl py-4 disabled:opacity-30 transition-all active:scale-95">
                    ✅ Valider mes réponses
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-white/40 pt-8">
                <p className="text-4xl mb-3">👀</p>
                <p>Tu es spectateur pour la finale</p>
                <p className="text-xs mt-2">
                  {session.finale_rep1_valide ? '✅' : '⏳'} {session.equipe1_nom} ·
                  {session.finale_rep2_valide ? ' ✅' : ' ⏳'} {session.equipe2_nom}
                </p>
              </div>
            )}
          </div>
        </main>
      )
    }

    // Phase correction / récap — affichage des questions corrigées
    const closedQuestions = finaleQuestions.filter(q => q.status === 'closed')
    const activeQ = finaleQuestions.find(q => q.status === 'active')
    return (
      <main className="min-h-screen bg-[#1a237e] text-white p-6">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="text-center pt-2">
            <div className="text-4xl mb-1">🏆</div>
            <p className="text-purple-300 font-bold text-lg">FINALE — Correction</p>
          </div>
          {closedQuestions.map(fq => (
            <div key={fq.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <p className="font-bold text-sm">{fq.question}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-2">
                  <p className="text-yellow-300/60 mb-1">{session.equipe1_nom}</p>
                  <p className="font-medium">{fq.reponse_eq1 ?? '—'}</p>
                  <p className="text-yellow-300 font-bold mt-1">{fq.points_eq1 > 0 ? `+${fq.points_eq1} pts` : '0 pt'}</p>
                </div>
                <div className="bg-blue-400/10 border border-blue-400/20 rounded-xl p-2">
                  <p className="text-blue-300/60 mb-1">{session.equipe2_nom}</p>
                  <p className="font-medium">{fq.reponse_eq2 ?? '—'}</p>
                  <p className="text-blue-300 font-bold mt-1">{fq.points_eq2 > 0 ? `+${fq.points_eq2} pts` : '0 pt'}</p>
                </div>
              </div>
            </div>
          ))}
          {activeQ && (
            <div className="bg-blue-800/30 border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-white/30 text-sm">⏳ Correction en cours…</p>
              <p className="text-white/50 text-xs mt-1">{activeQ.question}</p>
            </div>
          )}
          {finaleQuestions.length > 0 && finaleQuestions.every(q => q.status === 'closed') && (
            <div className="bg-purple-500/20 border border-purple-400 rounded-2xl p-4 text-center space-y-2">
              <p className="text-purple-300 font-bold">🏆 Finale terminée !</p>
              <p className="text-white/40 text-xs">En attente du classement final…</p>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── Fin ────────────────────────────────────────────────────
  if (session?.status === 'finished') {
    const eq1Wins = (session.equipe1_score ?? 0) > (session.equipe2_score ?? 0)
    const eq2Wins = (session.equipe2_score ?? 0) > (session.equipe1_score ?? 0)
    return (
      <main className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center p-6 text-white text-center space-y-5">
        <div className="text-6xl">🏆</div>
        <h2 className="text-2xl font-bold">
          {eq1Wins ? session.equipe1_nom : eq2Wins ? session.equipe2_nom : 'Égalité !'} gagne !
        </h2>
        <div className="flex gap-8 text-xl">
          <div className={`text-center ${eq1Wins ? 'text-yellow-300' : 'text-white/50'}`}>
            <div className="font-bold text-4xl">{session.equipe1_score}</div>
            <div className="text-sm">{session.equipe1_nom}</div>
          </div>
          <div className="text-white/30 self-center">vs</div>
          <div className={`text-center ${eq2Wins ? 'text-yellow-300' : 'text-white/50'}`}>
            <div className="font-bold text-4xl">{session.equipe2_score}</div>
            <div className="text-sm">{session.equipe2_nom}</div>
          </div>
        </div>
      </main>
    )
  }

  // ── Attente lancement ──────────────────────────────────────
  if (!session || session.status === 'equipes') {
    return (
      <main className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-xl font-semibold mb-2">Bonjour {prenom} !</h2>
        <p className="text-white/50">En attente du lancement par l&apos;animateur…</p>
      </main>
    )
  }

  // ── Jeu en cours ───────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1a237e] text-white p-4 flex flex-col">
      <div className="max-w-lg mx-auto w-full space-y-4 flex-1">

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className={`rounded-2xl p-3 text-center border-2 ${
            question?.equipe_active === 1 ? 'border-yellow-400 bg-blue-800' : 'border-white/20 bg-blue-900/50'
          }`}>
            <p className="text-xs text-white/60 mb-1">{session.equipe1_nom}</p>
            <p className="text-3xl font-bold text-yellow-300">{session.equipe1_score}</p>
            {question?.equipe_active === 1 && <p className="text-xs text-yellow-300 mt-1">▶ À vous !</p>}
          </div>
          <div className={`rounded-2xl p-3 text-center border-2 ${
            question?.equipe_active === 2 ? 'border-yellow-400 bg-blue-800' : 'border-white/20 bg-blue-900/50'
          }`}>
            <p className="text-xs text-white/60 mb-1">{session.equipe2_nom}</p>
            <p className="text-3xl font-bold text-yellow-300">{session.equipe2_score}</p>
            {question?.equipe_active === 2 && <p className="text-xs text-yellow-300 mt-1">▶ À vous !</p>}
          </div>
        </div>

        {/* Phase vol */}
        {question?.phase === 'vol' && (
          <div className="vol-blink bg-red-500/20 border border-red-500 rounded-xl p-3 text-center">
            <p className="text-red-300 font-bold text-lg">⚡ TENTATIVE DE VOL !</p>
          </div>
        )}

        {/* Question */}
        <div className="bg-blue-800/50 border border-white/10 rounded-2xl p-4 text-center">
          {question
            ? <p className="text-lg font-bold leading-snug">{question.question}</p>
            : <p className="text-white/40">En attente de la prochaine question…</p>
          }
        </div>

        {/* ── Phase buzzer ouvert ── */}
        {question?.phase === 'buzzer_ouvert' && (
          <div className="flex flex-col items-center gap-3">
            {isRepresentant ? (
              <>
                {!question.buzzer_winner_id ? (
                  <button
                    onClick={handleBuzz}
                    disabled={!!buzzed}
                    className="w-48 h-48 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 text-white font-black text-4xl shadow-2xl transition-all border-8 border-red-400"
                  >
                    BUZZ !
                  </button>
                ) : isBuzzWinner ? (
                  <div className="text-center space-y-2">
                    <div className="text-5xl">🎯</div>
                    <p className="text-yellow-300 font-bold text-xl">Tu as buzzé !</p>
                    <p className="text-white/60 text-sm">Donne ta réponse à voix haute</p>
                  </div>
                ) : (
                  <div className="text-center text-white/40 py-4">
                    <p>L&apos;autre représentant a buzzé en premier</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center space-y-2 py-4">
                <div className="w-32 h-32 rounded-full bg-white/5 border-4 border-white/10 flex items-center justify-center mx-auto">
                  <span className="text-white/20 font-bold text-xl">BUZZ</span>
                </div>
                <p className="text-white/30 text-sm">Les représentants buzzent…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Phase adverse ── */}
        {isAdverse && (
          <div className="bg-orange-500/20 border border-orange-400 rounded-xl p-4 text-center space-y-2">
            <p className="text-orange-300 font-bold text-lg">⚡ À toi de proposer !</p>
            <p className="text-white/60 text-sm">Donne ta réponse à voix haute</p>
          </div>
        )}

        {/* Réponses révélées — phase normale, vol, ou fin_manche */}
        {reponses.length > 0 && (question?.phase === 'normal' || question?.phase === 'vol' || question?.phase === 'fin_manche') && (
          <div className="space-y-2">
            {reponses.map(r => (
              <div key={r.id} className="fo-card-wrap h-14">
                <div className={`fo-card-inner ${r.revealed ? 'revealed' : ''}`}>
                  <div className="fo-card-front bg-[#ffd700] rounded-xl flex items-center justify-between px-4">
                    <span className="text-black font-bold text-lg w-6">{r.ordre}</span>
                    <span className="text-black/30 text-xl tracking-widest flex-1 text-center">██████</span>
                    <span className="text-black/20 text-sm w-8 text-right">pts</span>
                  </div>
                  <div className="fo-card-back bg-[#ffd700] rounded-xl flex items-center justify-between px-4">
                    <span className="text-black font-bold text-lg w-6">{r.ordre}</span>
                    <span className="text-black font-semibold text-base flex-1 text-center">{r.texte}</span>
                    <span className="text-black font-bold text-lg w-8 text-right">{r.points}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Croix — seulement en phase normale ou vol */}
        {question && (question.phase === 'normal' || question.phase === 'vol') && (
          <div className="flex justify-center gap-4 pt-1">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`text-3xl transition-all ${i < croixActives ? 'opacity-100 scale-110' : 'opacity-15'}`}>
                ❌
              </span>
            ))}
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
