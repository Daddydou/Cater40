'use client'
// app/famille-or/animateur/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { defaultQuestions } from '@/lib/famille-or-data'

const ROOM_CODE = 'famille-or'

type Player  = { id: string; name: string; equipe: number | null }
type Session = {
  id: string
  equipe1_nom: string
  equipe2_nom: string
  equipe1_score: number
  equipe2_score: number
  status: string
  question_active_id: string | null
}
type Question = {
  id: string
  ordre: number
  question: string
  status: string
  equipe_active: number
  croix_equipe1: number
  croix_equipe2: number
  phase: string // 'normal' | 'vol'
}
type Reponse = {
  id: string
  ordre: number
  texte: string
  points: number
  revealed: boolean
}

function playSound(type: 'ding' | 'buzzer' | 'fanfare' | 'victoire') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    if (type === 'ding')    { osc.frequency.value = 880; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3) }
    if (type === 'buzzer')  { osc.frequency.value = 120; osc.type = 'sawtooth'; gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4) }
    if (type === 'fanfare') { osc.frequency.value = 660; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6) }
    if (type === 'victoire'){ osc.frequency.value = 523; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1) }
    osc.start(); osc.stop(ctx.currentTime + 1)
  } catch {}
}

export default function FamilleOrAnimateur() {
  const [phase, setPhase] = useState<'inscription' | 'equipes' | 'jeu' | 'fin'>('inscription')
  const [roomId, setRoomId]       = useState<string | null>(null)
  const [session, setSession]     = useState<Session | null>(null)
  const [players, setPlayers]     = useState<Player[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [question, setQuestion]   = useState<Question | null>(null)
  const [reponses, setReponses]   = useState<Reponse[]>([])
  const [eq1nom, setEq1nom]       = useState('Équipe 1')
  const [eq2nom, setEq2nom]       = useState('Équipe 2')
  const [loading, setLoading]     = useState(true)
  const initialized = useRef(false)
  const sessionIdRef = useRef<string | null>(null)

  const fetchPlayers = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('players').select('id, name, score').eq('room_id', rid).order('created_at')
    if (data) setPlayers(data.map(p => ({ ...p, equipe: (p as any).equipe ?? null })))
  }, [])

  const fetchActiveQuestion = useCallback(async (sessionId: string) => {
    const { data: q } = await supabase
      .from('famille_or_questions').select('*')
      .eq('session_id', sessionId).eq('status', 'active').maybeSingle()
    setQuestion(q)
    if (q) {
      const { data: reps } = await supabase
        .from('famille_or_reponses').select('*')
        .eq('question_id', q.id).order('ordre')
      if (reps) setReponses(reps)
    } else {
      setReponses([])
    }
    return q
  }, [])

  const fetchQuestions = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('famille_or_questions').select('*')
      .eq('session_id', sessionId).order('ordre')
    if (data) setQuestions(data)
  }, [])

  const fetchSession = useCallback(async (sid: string) => {
    const { data } = await supabase.from('famille_or_sessions').select('*').eq('id', sid).single()
    if (data) setSession(data)
    return data
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) return
      setRoomId(room.id)
      await fetchPlayers(room.id)

      // Vérifier si une session existe déjà
      const { data: sess } = await supabase
        .from('famille_or_sessions').select('*')
        .eq('room_id', room.id).order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (sess) {
        setSession(sess)
        sessionIdRef.current = sess.id
        setEq1nom(sess.equipe1_nom)
        setEq2nom(sess.equipe2_nom)
        if (sess.status === 'equipes') setPhase('equipes')
        else if (sess.status === 'playing') {
          setPhase('jeu')
          await fetchQuestions(sess.id)
          await fetchActiveQuestion(sess.id)
        } else if (sess.status === 'finished') {
          setPhase('fin')
        }

        supabase.channel(`fo-anim-${sess.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'famille_or_sessions', filter: `id=eq.${sess.id}` },
            () => fetchSession(sess.id))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'famille_or_questions', filter: `session_id=eq.${sess.id}` },
            () => { fetchQuestions(sess.id); fetchActiveQuestion(sess.id) })
          .subscribe()
      }

      // Realtime joueurs
      supabase.channel(`fo-anim-players-${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
          () => fetchPlayers(room.id))
        .subscribe()

      setLoading(false)
    }
    init()

    const interval = setInterval(async () => {
      if (sessionIdRef.current) {
        await fetchActiveQuestion(sessionIdRef.current)
        await fetchSession(sessionIdRef.current)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [fetchPlayers, fetchActiveQuestion, fetchQuestions, fetchSession])

  // ── Étape 1 → 2 : Passer à l'assignation des équipes ─────
  const handlePasserEquipes = async () => {
    if (!roomId) return
    const { data: sess } = await supabase.from('famille_or_sessions').insert({
      room_id: roomId,
      equipe1_nom: eq1nom,
      equipe2_nom: eq2nom,
      equipe1_score: 0,
      equipe2_score: 0,
      status: 'equipes',
    }).select().single()
    if (!sess) return
    setSession(sess)
    sessionIdRef.current = sess.id
    setPhase('equipes')

    supabase.channel(`fo-anim-${sess.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'famille_or_sessions', filter: `id=eq.${sess.id}` },
        () => fetchSession(sess.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'famille_or_questions', filter: `session_id=eq.${sess.id}` },
        () => { fetchQuestions(sess.id); fetchActiveQuestion(sess.id) })
      .subscribe()
  }

  // Assigner un joueur à une équipe
  const handleAssignerEquipe = async (playerId: string, equipe: number | null) => {
    await supabase.from('players').update({ equipe } as any).eq('id', playerId)
    setPlayers(ps => ps.map(p => p.id === playerId ? { ...p, equipe } : p))
  }

  // Mettre à jour les noms d'équipes
  const handleSauvegarderEquipes = async () => {
    if (!session) return
    await supabase.from('famille_or_sessions').update({
      equipe1_nom: eq1nom,
      equipe2_nom: eq2nom,
    }).eq('id', session.id)
    setSession(s => s ? { ...s, equipe1_nom: eq1nom, equipe2_nom: eq2nom } : s)
  }

  // ── Étape 2 → 3 : Lancer le jeu ──────────────────────────
  const handleLancerJeu = async () => {
    if (!session || !roomId) return
    await handleSauvegarderEquipes()

    // Insérer les questions
    for (const q of defaultQuestions) {
      const { data: newQ } = await supabase.from('famille_or_questions').insert({
        session_id: session.id,
        ordre: defaultQuestions.indexOf(q) + 1,
        question: q.question,
        status: 'pending',
        equipe_active: 1,
        croix_equipe1: 0,
        croix_equipe2: 0,
        phase: 'normal',
      }).select().single()
      if (newQ) {
        await supabase.from('famille_or_reponses').insert(
          q.reponses.map(r => ({ question_id: newQ.id, ordre: r.ordre, texte: r.texte, points: r.points, revealed: false }))
        )
      }
    }

    await supabase.from('famille_or_sessions').update({ status: 'playing' }).eq('id', session.id)
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
    await fetchQuestions(session.id)
    setPhase('jeu')
  }

  // Lancer une question avec choix de l'équipe qui commence
  const handleLancerQuestion = async (q: Question, equipeActive: number) => {
    if (!session) return
    await supabase.from('famille_or_questions').update({ status: 'closed' })
      .eq('session_id', session.id).eq('status', 'active')
    await supabase.from('famille_or_questions').update({
      status: 'active',
      equipe_active: equipeActive,
      croix_equipe1: 0,
      croix_equipe2: 0,
      phase: 'normal',
    }).eq('id', q.id)
    await fetchActiveQuestion(session.id)
    await fetchQuestions(session.id)
  }

  // Révéler une réponse → points à l'équipe active
const handleReveler = async (r: Reponse) => {
  if (!question || !session) return
  await supabase.from('famille_or_reponses').update({ revealed: true }).eq('id', r.id)
  playSound('ding')
  const { data: reps } = await supabase
    .from('famille_or_reponses').select('*')
    .eq('question_id', question.id).order('ordre')
  if (reps) setReponses(reps)
}

  // Ajouter une croix
  const handleCroix = async () => {
    if (!question || !session) return
    const croixField = question.equipe_active === 1 ? 'croix_equipe1' : 'croix_equipe2'
    const currentCroix = question.equipe_active === 1 ? question.croix_equipe1 : question.croix_equipe2
    const newCroix = currentCroix + 1
    playSound('buzzer')

    if (newCroix >= 3) {
      const autreEquipe = question.equipe_active === 1 ? 2 : 1
      await supabase.from('famille_or_questions').update({
        [croixField]: newCroix,
        phase: 'vol',
        equipe_active: autreEquipe,
      }).eq('id', question.id)
    } else {
      await supabase.from('famille_or_questions').update({ [croixField]: newCroix }).eq('id', question.id)
    }
    await fetchActiveQuestion(session.id)
  }

  // Vol réussi → l'équipe voleuse prend tous les points restants
  const handleVolReussi = async () => {
  if (!question || !session) return
  playSound('fanfare')
  const nonReveleees = reponses.filter(r => !r.revealed)
  for (const r of nonReveleees) {
    await supabase.from('famille_or_reponses').update({ revealed: true }).eq('id', r.id)
  }
  // L'équipe voleuse prend TOUS les points du tableau
  const totalPoints = reponses.reduce((sum, r) => sum + r.points, 0)
  const scoreField = question.equipe_active === 1 ? 'equipe1_score' : 'equipe2_score'
  const currentScore = question.equipe_active === 1 ? session.equipe1_score : session.equipe2_score
  await supabase.from('famille_or_sessions').update({ [scoreField]: currentScore + totalPoints }).eq('id', session.id)
  await supabase.from('famille_or_questions').update({ status: 'closed', phase: 'normal' }).eq('id', question.id)
  await fetchActiveQuestion(session.id)
  await fetchQuestions(session.id)
  await fetchSession(session.id)
}

  // Vol raté → la première équipe récupère les points des réponses trouvées
 const handleVolRate = async () => {
  if (!question || !session) return
  const nonReveleees = reponses.filter(r => !r.revealed)
  for (const r of nonReveleees) {
    await supabase.from('famille_or_reponses').update({ revealed: true }).eq('id', r.id)
  }
  // L'équipe avec 3 croix garde ses points trouvés — l'autre (voleuse) n'a rien
  const equipeAvecCroix = question.equipe_active === 1 ? 2 : 1
  const pointsTrouves = reponses.filter(r => r.revealed).reduce((sum, r) => sum + r.points, 0)
  const scoreField = equipeAvecCroix === 1 ? 'equipe1_score' : 'equipe2_score'
  const currentScore = equipeAvecCroix === 1 ? session.equipe1_score : session.equipe2_score
  await supabase.from('famille_or_sessions').update({ [scoreField]: currentScore + pointsTrouves }).eq('id', session.id)
  await supabase.from('famille_or_questions').update({ status: 'closed', phase: 'normal' }).eq('id', question.id)
  await fetchActiveQuestion(session.id)
  await fetchQuestions(session.id)
  await fetchSession(session.id)
}

  const handleTerminer = async () => {
    if (!session || !roomId) return
    playSound('victoire')
    await supabase.from('famille_or_sessions').update({ status: 'finished' }).eq('id', session.id)
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    setPhase('fin')
  }

  const handleReset = async () => {
    if (!confirm('Remettre à zéro ?')) return
    if (session) {
      const qIds = questions.map(q => q.id)
      if (qIds.length > 0) await supabase.from('famille_or_reponses').delete().in('question_id', qIds)
      await supabase.from('famille_or_questions').delete().eq('session_id', session.id)
      await supabase.from('famille_or_sessions').delete().eq('id', session.id)
    }
    if (roomId) await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    setSession(null); setQuestions([]); setQuestion(null); setReponses([])
    setPlayers([]); setPhase('inscription'); setEq1nom('Équipe 1'); setEq2nom('Équipe 2')
  }

  const pendingQuestions = questions.filter(q => q.status === 'pending')
  const croixActives = question
    ? (question.equipe_active === 1 ? question.croix_equipe1 : question.croix_equipe2)
    : 0
  const gameUrl = typeof window !== 'undefined' ? `${window.location.origin}/famille-or` : ''

  if (loading) return (
    <main className="min-h-screen bg-[#1a237e] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  // ══════════════════════════════════════════════════════════
  // PHASE 1 — Inscription
  // ══════════════════════════════════════════════════════════
  if (phase === 'inscription') {
    return (
      <main className="min-h-screen bg-[#1a237e] text-white p-5">
        <div className="max-w-lg mx-auto space-y-5">
          <div className="pt-2">
            <h1 className="text-xl font-bold">🏆 Famille en Or</h1>
            <p className="text-white/40 text-sm">Interface animateur</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white/40">
            <p>Joueurs → <span className="text-blue-300 font-mono">{gameUrl}</span></p>
          </div>

          {/* Noms équipes */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wide">Noms des équipes</p>
            <input value={eq1nom} onChange={e => setEq1nom(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 outline-none focus:border-yellow-400 text-sm"
              placeholder="Équipe 1" />
            <input value={eq2nom} onChange={e => setEq2nom(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 outline-none focus:border-yellow-400 text-sm"
              placeholder="Équipe 2" />
          </div>

          {/* Joueurs inscrits */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wide">Joueurs inscrits ({players.length})</p>
            {players.length === 0
              ? <p className="text-white/25 text-sm text-center py-2">En attente des joueurs…</p>
              : players.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                </div>
              ))
            }
          </div>

          <button onClick={handlePasserEquipes} disabled={players.length === 0}
            className="w-full bg-[#ffd700] hover:bg-yellow-300 text-black font-bold rounded-xl py-4 disabled:opacity-30 transition-all active:scale-95">
            Assigner les équipes →
          </button>

          <button onClick={handleReset}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl py-3 transition-all active:scale-95">
            🔄 Reset
          </button>
        </div>
      </main>
    )
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 2 — Assignation équipes
  // ══════════════════════════════════════════════════════════
  if (phase === 'equipes') {
    return (
      <main className="min-h-screen bg-[#1a237e] text-white p-5">
        <div className="max-w-lg mx-auto space-y-5">
          <div className="pt-2">
            <h1 className="text-xl font-bold">🏆 Assignation des équipes</h1>
            <p className="text-white/40 text-sm">Glisse chaque joueur dans son équipe</p>
          </div>

          {/* Noms équipes modifiables */}
          <div className="grid grid-cols-2 gap-3">
            <input value={eq1nom} onChange={e => setEq1nom(e.target.value)}
              className="bg-blue-800 border-2 border-yellow-400 rounded-xl px-3 py-2 text-center font-bold outline-none text-sm"
              placeholder="Équipe 1" />
            <input value={eq2nom} onChange={e => setEq2nom(e.target.value)}
              className="bg-blue-800 border-2 border-white/30 rounded-xl px-3 py-2 text-center font-bold outline-none text-sm"
              placeholder="Équipe 2" />
          </div>

          {/* Joueurs à assigner */}
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAssignerEquipe(p.id, 1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      p.equipe === 1 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}>
                    {eq1nom}
                  </button>
                  <button
                    onClick={() => handleAssignerEquipe(p.id, 2)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      p.equipe === 2 ? 'bg-blue-400 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}>
                    {eq2nom}
                  </button>
                  <button
                    onClick={() => handleAssignerEquipe(p.id, null)}
                    className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition-all">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleLancerJeu}
            className="w-full bg-[#ffd700] hover:bg-yellow-300 text-black font-bold rounded-xl py-4 transition-all active:scale-95">
            ▶️ Lancer le jeu !
          </button>

          <button onClick={handleReset}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl py-3 transition-all active:scale-95">
            🔄 Reset
          </button>
        </div>
      </main>
    )
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 3 — Fin
  // ══════════════════════════════════════════════════════════
  if (phase === 'fin') {
    return (
      <main className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center p-6 text-white text-center space-y-5">
        <div className="text-6xl">🏆</div>
        <h2 className="text-2xl font-bold">Partie terminée !</h2>
        <div className="flex gap-8">
          <div className="text-center">
            <div className="font-bold text-4xl text-yellow-300">{session?.equipe1_score}</div>
            <div className="text-sm text-white/60">{session?.equipe1_nom}</div>
          </div>
          <div className="text-white/30 self-center text-2xl">vs</div>
          <div className="text-center">
            <div className="font-bold text-4xl text-yellow-300">{session?.equipe2_score}</div>
            <div className="text-sm text-white/60">{session?.equipe2_nom}</div>
          </div>
        </div>
        <button onClick={handleReset}
          className="mt-4 bg-red-500/20 border border-red-500/30 text-red-300 font-semibold rounded-xl px-6 py-3 transition-all active:scale-95">
          🔄 Nouvelle partie
        </button>
      </main>
    )
  }

  // ══════════════════════════════════════════════════════════
  // PHASE 3 — Jeu en cours
  // ══════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen bg-[#1a237e] text-white p-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Scores */}
        {session && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`rounded-2xl p-3 text-center border-2 ${question?.equipe_active === 1 ? 'border-yellow-400 bg-blue-800' : 'border-white/20 bg-blue-900/50'}`}>
              <p className="text-xs text-white/60">{session.equipe1_nom}</p>
              <p className="text-3xl font-bold text-yellow-300">{session.equipe1_score}</p>
              <p className="text-xs text-white/40">{players.filter(p => p.equipe === 1).map(p => p.name).join(', ')}</p>
            </div>
            <div className={`rounded-2xl p-3 text-center border-2 ${question?.equipe_active === 2 ? 'border-yellow-400 bg-blue-800' : 'border-white/20 bg-blue-900/50'}`}>
              <p className="text-xs text-white/60">{session.equipe2_nom}</p>
              <p className="text-3xl font-bold text-yellow-300">{session.equipe2_score}</p>
              <p className="text-xs text-white/40">{players.filter(p => p.equipe === 2).map(p => p.name).join(', ')}</p>
            </div>
          </div>
        )}

        {/* Question active */}
        {question ? (
          <div className="space-y-3">

            {/* Phase vol */}
            {question.phase === 'vol' && session && (
              <div className="bg-orange-500/20 border border-orange-400 rounded-xl p-3 text-center space-y-2">
                <p className="text-orange-300 font-bold">
                  ⚡ {question.equipe_active === 1 ? session.equipe1_nom : session.equipe2_nom} tente le vol !
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleVolReussi}
                    className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95">
                    ✅ Vol réussi
                  </button>
                  <button onClick={handleVolRate}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl py-3 transition-all active:scale-95">
                    ❌ Vol raté
                  </button>
                </div>
              </div>
            )}

            {/* Question */}
            <div className="bg-blue-800/50 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Q{question.ordre}</p>
              <p className="text-base font-bold">{question.question}</p>
            </div>

            {/* Réponses — toutes visibles animateur */}
            <div className="space-y-2">
              {reponses.map(r => (
                <div key={r.id} className={`flex items-center justify-between rounded-xl p-3 border ${
                  r.revealed ? 'bg-green-500/10 border-green-500/30' : 'bg-[#ffd700]/10 border-[#ffd700]/30'
                }`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-[#ffd700] font-bold w-5 flex-shrink-0">{r.ordre}</span>
                    <span className="font-medium text-sm truncate">{r.texte}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-white/50 text-sm">{r.points}</span>
                    {!r.revealed ? (
                      <button onClick={() => handleReveler(r)}
                        className="bg-[#ffd700] hover:bg-yellow-300 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95">
                        Révéler
                      </button>
                    ) : (
                      <span className="text-green-400 text-xs">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

{/* Toutes les réponses révélées → valider les points */}
{reponses.length > 0 && reponses.every(r => r.revealed) && question.phase !== 'vol' && (
  <button onClick={async () => {
    if (!question || !session) return
    const total = reponses.reduce((sum, r) => sum + r.points, 0)
    const scoreField = question.equipe_active === 1 ? 'equipe1_score' : 'equipe2_score'
    const currentScore = question.equipe_active === 1 ? session.equipe1_score : session.equipe2_score
    await supabase.from('famille_or_sessions').update({ [scoreField]: currentScore + total }).eq('id', session.id)
    await supabase.from('famille_or_questions').update({ status: 'closed' }).eq('id', question.id)
    await fetchActiveQuestion(session.id)
    await fetchQuestions(session.id)
    await fetchSession(session.id)
  }}
    className="w-full bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95">
    ✅ Valider les points ({reponses.reduce((s, r) => s + r.points, 0)} pts → {question.equipe_active === 1 ? session?.equipe1_nom : session?.equipe2_nom})
  </button>
)}

            {/* Croix — seulement en phase normale */}
            {question.phase !== 'vol' && (
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex gap-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <span key={i} className={`text-2xl transition-all ${i < croixActives ? 'opacity-100' : 'opacity-20'}`}>❌</span>
                  ))}
                </div>
                <button onClick={handleCroix} disabled={croixActives >= 3}
                  className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 font-semibold px-4 py-2 rounded-xl disabled:opacity-30 transition-all active:scale-95">
                  + Croix
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Sélection question suivante */
          <div className="space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wide">
              {pendingQuestions.length > 0 ? 'Choisir la prochaine question' : 'Toutes les questions jouées'}
            </p>

            {pendingQuestions.map(q => (
              <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                <p className="text-sm font-medium">Q{q.ordre} — {q.question}</p>
                {session && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleLancerQuestion(q, 1)}
                      className="bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/30 text-yellow-300 text-xs font-bold py-2 rounded-lg transition-all active:scale-95">
                      {session.equipe1_nom} commence
                    </button>
                    <button onClick={() => handleLancerQuestion(q, 2)}
                      className="bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 text-blue-300 text-xs font-bold py-2 rounded-lg transition-all active:scale-95">
                      {session.equipe2_nom} commence
                    </button>
                  </div>
                )}
              </div>
            ))}

            {pendingQuestions.length === 0 && (
              <button onClick={handleTerminer}
                className="w-full bg-[#ffd700] hover:bg-yellow-300 text-black font-bold rounded-xl py-4 transition-all active:scale-95">
                🏁 Terminer le jeu
              </button>
            )}
          </div>
        )}

        {/* Bouton terminer + reset */}
        <div className="space-y-2 pt-1">
          {pendingQuestions.length > 0 && (
            <button onClick={handleTerminer}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl py-3 transition-all active:scale-95">
              🏁 Terminer le jeu maintenant
            </button>
          )}
          <button onClick={handleReset}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl py-3 transition-all active:scale-95">
            🔄 Nouvelle partie (reset)
          </button>
        </div>

      </div>
    </main>
  )
}
