'use client'
// app/famille-or/page.tsx — Écran joueurs/spectateurs

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import { uploadAvatar } from '@/lib/hooks/useAvatarUpload'

const ROOM_CODE = 'famille-or'

type Session = {
  id: string
  equipe1_nom: string
  equipe2_nom: string
  equipe1_score: number
  equipe2_score: number
  status: string
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
}
type Reponse = {
  id: string
  ordre: number
  texte: string
  points: number
  revealed: boolean
}

export default function FamilleOrSpectateurs() {
  const [prenom, setPrenom]     = useState('')
  const [roomId, setRoomId]     = useState<string | null>(null)
  const [session, setSession]   = useState<Session | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [reponses, setReponses] = useState<Reponse[]>([])
  const [loading, setLoading]   = useState(true)
  const [joined, setJoined]     = useState(false)
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
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

      const { data: sess } = await supabase
        .from('famille_or_sessions').select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      if (sess) {
        setSession(sess)
        const { data: q } = await supabase
          .from('famille_or_questions').select('*')
          .eq('session_id', sess.id).eq('status', 'active').maybeSingle()
        setQuestion(q)
        if (q) {
          const { data: reps } = await supabase
            .from('famille_or_reponses').select('*')
            .eq('question_id', q.id).order('ordre')
          if (reps) setReponses(reps)
        } else {
          setReponses([])
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
    const { data } = await supabase
      .from('players').insert({ room_id: roomId, name: prenom.trim(), score: 0 })
      .select().single()
    if (data) {
      if (avatarFile) {
        const url = await uploadAvatar(avatarFile, roomId!, data.id)
        if (url) await supabase.from('players').update({ avatar_url: url }).eq('id', data.id)
      }
      setJoined(true)
    }
  }

  const croixEq1 = question?.croix_equipe1 ?? 0
  const croixEq2 = question?.croix_equipe2 ?? 0
  const croixActives = question
    ? (question.equipe_active === 1 ? croixEq1 : croixEq2)
    : 0

  if (loading) return (
    <main className="min-h-screen bg-[#1a237e] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  // ── Saisie prénom ─────────────────────────────────────────
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
          {/* Avatar optionnel */}
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

  // ── Fin ───────────────────────────────────────────────────
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

  // ── Attente lancement ─────────────────────────────────────
  if (!session || session.status === 'equipes') {
    return (
      <main className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-xl font-semibold mb-2">Bonjour {prenom} !</h2>
        <p className="text-white/50">En attente du lancement par l&apos;animateur…</p>
      </main>
    )
  }

  // ── Jeu en cours ─────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1a237e] text-white p-4 flex flex-col">
      <div className="max-w-lg mx-auto w-full space-y-4 flex-1">

        {/* Scores équipes */}
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

        {/* Réponses masquées/révélées */}
        {reponses.length > 0 && (
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

        {/* Croix */}
        {question && (
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
