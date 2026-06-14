'use client'
// app/famille-or/animateur/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { defaultQuestions } from '@/lib/famille-or-data'
import PlayerAvatar from '@/lib/components/PlayerAvatar'

const ROOM_CODE = 'famille-or'

type Player  = { id: string; name: string; equipe: number | null; avatar_url?: string | null }
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

function playSound(type: 'ding' | 'buzzer' | 'fanfare' | 'victoire' | 'buzz') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    if (type === 'ding')    { osc.frequency.value = 880; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3) }
    if (type === 'buzzer')  { osc.frequency.value = 120; osc.type = 'sawtooth'; gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4) }
    if (type === 'fanfare') { osc.frequency.value = 660; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6) }
    if (type === 'victoire'){ osc.frequency.value = 523; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1) }
    if (type === 'buzz')    { osc.frequency.value = 440; osc.type = 'square'; gain.gain.setValueAtTime(0.5, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2) }
    osc.start(); osc.stop(ctx.currentTime + 1)
  } catch {}
}

export default function FamilleOrAnimateur() {
  const [phase, setPhase] = useState<'inscription' | 'equipes' | 'jeu' | 'fin'>('inscription')
  const [roomId, setRoomId]           = useState<string | null>(null)
  const [session, setSession]         = useState<Session | null>(null)
  const [players, setPlayers]         = useState<Player[]>([])
  const [questions, setQuestions]     = useState<Question[]>([])
  const [question, setQuestion]       = useState<Question | null>(null)
  const [reponses, setReponses]       = useState<Reponse[]>([])
  const [eq1nom, setEq1nom]           = useState('Équipe 1')
  const [eq2nom, setEq2nom]           = useState('Équipe 2')
  const [loading, setLoading]         = useState(true)
  const [pendingRep1, setPendingRep1] = useState<string | null>(null)
  const [pendingRep2, setPendingRep2] = useState<string | null>(null)
  const [selectingQ, setSelectingQ]   = useState<Question | null>(null)
  const initialized   = useRef(false)
  const sessionIdRef  = useRef<string | null>(null)
  const roomIdRef     = useRef<string | null>(null)
  const prevBuzzerId  = useRef<string | null>(null)

  const fetchPlayers = useCallback(async (rid: string) => {
    try {
      const { data, error } = await supabase
        .from('players').select('id, name, score, avatar_url, equipe').eq('room_id', rid).order('created_at')
      if (error) { console.error('[fetchPlayers] error:', error); return }
      if (data) setPlayers(data.map(p => ({ ...p, equipe: (p as { equipe?: number | null }).equipe ?? null })))
    } catch(e) { console.error('[fetchPlayers] exception:', e) }
  }, [])

  const fetchActiveQuestion = useCallback(async (sessionId: string) => {
    const { data: q } = await supabase
      .from('famille_or_questions').select('*')
      .eq('session_id', sessionId).eq('status', 'active').maybeSingle()
    if (q && q.buzzer_winner_id && q.buzzer_winner_id !== prevBuzzerId.current) {
      prevBuzzerId.current = q.buzzer_winner_id
      playSound('buzz')
    }
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
      roomIdRef.current = room.id
      await fetchPlayers(room.id)

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
      }

      supabase.channel(`fo-anim-players-${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
          () => fetchPlayers(room.id))
        .subscribe()

      setLoading(false)
    }
    init()

    const interval = setInterval(async () => {
      if (roomIdRef.current) await fetchPlayers(roomIdRef.current)
      console.log('[polling] sessionIdRef:', sessionIdRef.current)
      if (sessionIdRef.current) {
        const q = await fetchActiveQuestion(sessionIdRef.current)
        console.log('[polling] question:', q?.id, 'buzzer:', q?.buzzer_winner_id, 'phase:', q?.phase)
        await fetchSession(sessionIdRef.current)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [fetchPlayers, fetchActiveQuestion, fetchQuestions, fetchSession])

  // ── Helpers ────────────────────────────────────────────────
  const getPlayerName = (id: string | null) => {
    if (!id) return '—'
    return players.find(p => p.id === id)?.name ?? '—'
  }

  // ── Étape 1 → 2 ───────────────────────────────────────────
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
  }

  const handleAssignerEquipe = async (playerId: string, equipe: number | null) => {
    await supabase.from('players').update({ equipe } as Record<string, unknown>).eq('id', playerId)
    setPlayers(ps => ps.map(p => p.id === playerId ? { ...p, equipe } : p))
  }

  const handleSauvegarderEquipes = async () => {
    if (!session) return
    await supabase.from('famille_or_sessions').update({
      equipe1_nom: eq1nom,
      equipe2_nom: eq2nom,
    }).eq('id', session.id)
    setSession(s => s ? { ...s, equipe1_nom: eq1nom, equipe2_nom: eq2nom } : s)
  }

  // ── Lancer le jeu ─────────────────────────────────────────
  const handleLancerJeu = async () => {
    if (!session || !roomId) return
    sessionIdRef.current = session.id
    await handleSauvegarderEquipes()
    for (const q of defaultQuestions) {
      const { data: newQ } = await supabase.from('famille_or_questions').insert({
        session_id: session.id,
        ordre: defaultQuestions.indexOf(q) + 1,
        question: q.question,
        status: 'pending',
        equipe_active: 1,
        croix_equipe1: 0,
        croix_equipe2: 0,
        phase: 'buzzer_ouvert',
        representant_eq1: null,
        representant_eq2: null,
        buzzer_winner_id: null,
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

  // ── Sélection représentants ────────────────────────────────
  const handleChoisirQuestion = (q: Question) => {
    setSelectingQ(q)
    setPendingRep1(null)
    setPendingRep2(null)
  }

  const handleLancerQuestion = async () => {
    if (!session || !selectingQ || !pendingRep1 || !pendingRep2) return
    await supabase.from('famille_or_questions').update({ status: 'closed' })
      .eq('session_id', session.id).eq('status', 'active')
    await supabase.from('famille_or_questions').update({
      status: 'active',
      equipe_active: 1,
      croix_equipe1: 0,
      croix_equipe2: 0,
      phase: 'buzzer_ouvert',
      representant_eq1: pendingRep1,
      representant_eq2: pendingRep2,
      buzzer_winner_id: null,
    }).eq('id', selectingQ.id)
    prevBuzzerId.current = null
    setSelectingQ(null)
    await fetchActiveQuestion(session.id)
    await fetchQuestions(session.id)
  }

  // ── Actions buzzer ─────────────────────────────────────────

  // Top réponse → équipe du buzzeur prend la main, tour de table classique
  const handleTopReponse = async () => {
    if (!question || !session) return
    const equipe = question.representant_eq1 === question.buzzer_winner_id ? 1 : 2
    await supabase.from('famille_or_questions').update({
      phase: 'normal',
      equipe_active: equipe,
    }).eq('id', question.id)
    await fetchActiveQuestion(session.id)
  }

  // Pas top → l'adverse peut proposer une meilleure réponse
  const handlePasTopReponse = async () => {
    if (!question || !session) return
    await supabase.from('famille_or_questions').update({ phase: 'buzzer_adverse' }).eq('id', question.id)
    await fetchActiveQuestion(session.id)
  }

  // Réponse adverse meilleure → son équipe prend la main
  const handleAdverseMeilleure = async () => {
    if (!question || !session) return
    const equipeAdverse = question.representant_eq1 === question.buzzer_winner_id ? 2 : 1
    await supabase.from('famille_or_questions').update({
      phase: 'normal',
      equipe_active: equipeAdverse,
    }).eq('id', question.id)
    await fetchActiveQuestion(session.id)
  }

  // Réponse adverse moins bonne → équipe du buzzeur prend la main
  const handleAdverseMoinsBonne = async () => {
    if (!question || !session) return
    const equipeWinner = question.representant_eq1 === question.buzzer_winner_id ? 1 : 2
    console.log('[adverseMoinsBonne] question.id:', question.id, 'equipeWinner:', equipeWinner)
    const { error } = await supabase.from('famille_or_questions').update({
      phase: 'normal',
      equipe_active: equipeWinner,
    }).eq('id', question.id)
    console.log('[adverseMoinsBonne] error:', error)
    await fetchActiveQuestion(session.id)
  }

  // ── Tour de table ──────────────────────────────────────────
  const handleReveler = async (r: Reponse) => {
    if (!question || !session) return
    await supabase.from('famille_or_reponses').update({ revealed: true }).eq('id', r.id)
    playSound('ding')
    const { data: reps } = await supabase
      .from('famille_or_reponses').select('*')
      .eq('question_id', question.id).order('ordre')
    if (reps) setReponses(reps)
  }

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

  const handleVolReussi = async () => {
    if (!question || !session) return
    playSound('fanfare')
    const nonReveleees = reponses.filter(r => !r.revealed)
    for (const r of nonReveleees) {
      await supabase.from('famille_or_reponses').update({ revealed: true }).eq('id', r.id)
    }
    const pointsRevelees = reponses.filter(r => r.revealed).reduce((sum, r) => sum + r.points, 0)
    const scoreField = question.equipe_active === 1 ? 'equipe1_score' : 'equipe2_score'
    const currentScore = question.equipe_active === 1 ? session.equipe1_score : session.equipe2_score
    await supabase.from('famille_or_sessions').update({ [scoreField]: currentScore + pointsRevelees }).eq('id', session.id)
    await supabase.from('famille_or_questions').update({ status: 'closed', phase: 'normal' }).eq('id', question.id)
    await fetchActiveQuestion(session.id)
    await fetchQuestions(session.id)
    await fetchSession(session.id)
  }

  const handleVolRate = async () => {
    if (!question || !session) return
    const nonReveleees = reponses.filter(r => !r.revealed)
    for (const r of nonReveleees) {
      await supabase.from('famille_or_reponses').update({ revealed: true }).eq('id', r.id)
    }
    const equipeAvecCroix = question.equipe_active === 1 ? 2 : 1
    const pointsRevelesParA = reponses.filter(r => r.revealed && !nonReveleees.find(n => n.id === r.id)).reduce((sum, r) => sum + r.points, 0)
    const scoreField = equipeAvecCroix === 1 ? 'equipe1_score' : 'equipe2_score'
    const currentScore = equipeAvecCroix === 1 ? session.equipe1_score : session.equipe2_score
    await supabase.from('famille_or_sessions').update({ [scoreField]: currentScore + pointsRevelesParA }).eq('id', session.id)
    await supabase.from('famille_or_questions').update({ status: 'closed', phase: 'normal' }).eq('id', question.id)
    await fetchActiveQuestion(session.id)
    await fetchQuestions(session.id)
    await fetchSession(session.id)
  }

  const handleValiderPoints = async () => {
    if (!question || !session) return
    const total = reponses.reduce((sum, r) => sum + r.points, 0)
    const scoreField = question.equipe_active === 1 ? 'equipe1_score' : 'equipe2_score'
    const currentScore = question.equipe_active === 1 ? session.equipe1_score : session.equipe2_score
    await supabase.from('famille_or_sessions').update({ [scoreField]: currentScore + total }).eq('id', session.id)
    await supabase.from('famille_or_questions').update({ status: 'closed' }).eq('id', question.id)
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
    setSelectingQ(null); setPendingRep1(null); setPendingRep2(null)
  }

  const pendingQuestions = questions.filter(q => q.status === 'pending')
  const croixActives = question
    ? (question.equipe_active === 1 ? question.croix_equipe1 : question.croix_equipe2)
    : 0
  const eq1Players = players.filter(p => p.equipe === 1)
  const eq2Players = players.filter(p => p.equipe === 2)
  const gameUrl = typeof window !== 'undefined' ? `${window.location.origin}/famille-or` : ''
  const buzzWinnerName   = question ? getPlayerName(question.buzzer_winner_id) : '—'
  const buzzWinnerEquipe = question?.buzzer_winner_id
    ? (question.representant_eq1 === question.buzzer_winner_id
        ? (session?.equipe1_nom ?? 'Équipe 1')
        : (session?.equipe2_nom ?? 'Équipe 2'))
    : '—'

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
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wide">Noms des équipes</p>
            <input value={eq1nom} onChange={e => setEq1nom(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 outline-none focus:border-yellow-400 text-sm"
              placeholder="Équipe 1" />
            <input value={eq2nom} onChange={e => setEq2nom(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 outline-none focus:border-yellow-400 text-sm"
              placeholder="Équipe 2" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wide">Joueurs inscrits ({players.length})</p>
            {players.length === 0
              ? <p className="text-white/25 text-sm text-center py-2">En attente des joueurs…</p>
              : players.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={32} />
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={eq1nom} onChange={e => setEq1nom(e.target.value)}
              className="bg-blue-800 border-2 border-yellow-400 rounded-xl px-3 py-2 text-center font-bold outline-none text-sm"
              placeholder="Équipe 1" />
            <input value={eq2nom} onChange={e => setEq2nom(e.target.value)}
              className="bg-blue-800 border-2 border-white/30 rounded-xl px-3 py-2 text-center font-bold outline-none text-sm"
              placeholder="Équipe 2" />
          </div>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleAssignerEquipe(p.id, 1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${p.equipe === 1 ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                    {eq1nom}
                  </button>
                  <button onClick={() => handleAssignerEquipe(p.id, 2)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${p.equipe === 2 ? 'bg-blue-400 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                    {eq2nom}
                  </button>
                  <button onClick={() => handleAssignerEquipe(p.id, null)}
                    className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition-all">✕</button>
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
  // PHASE FIN
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
  // PHASE JEU
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
              <p className="text-xs text-white/40">{eq1Players.map(p => p.name).join(', ')}</p>
            </div>
            <div className={`rounded-2xl p-3 text-center border-2 ${question?.equipe_active === 2 ? 'border-yellow-400 bg-blue-800' : 'border-white/20 bg-blue-900/50'}`}>
              <p className="text-xs text-white/60">{session.equipe2_nom}</p>
              <p className="text-3xl font-bold text-yellow-300">{session.equipe2_score}</p>
              <p className="text-xs text-white/40">{eq2Players.map(p => p.name).join(', ')}</p>
            </div>
          </div>
        )}

        {/* ── Sélection représentants ── */}
        {selectingQ && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
            <p className="text-sm font-bold text-yellow-300">Q{selectingQ.ordre} — {selectingQ.question}</p>
            <p className="text-white/40 text-xs uppercase tracking-wide">Désigner les représentants au buzzer</p>

            <div className="space-y-2">
              <p className="text-xs text-yellow-300 font-semibold">{session?.equipe1_nom}</p>
              <div className="flex flex-wrap gap-2">
                {eq1Players.map(p => (
                  <button key={p.id} onClick={() => setPendingRep1(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${pendingRep1 === p.id ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-blue-300 font-semibold">{session?.equipe2_nom}</p>
              <div className="flex flex-wrap gap-2">
                {eq2Players.map(p => (
                  <button key={p.id} onClick={() => setPendingRep2(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${pendingRep2 === p.id ? 'bg-blue-400 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleLancerQuestion} disabled={!pendingRep1 || !pendingRep2}
              className="w-full bg-[#ffd700] hover:bg-yellow-300 text-black font-bold rounded-xl py-3 disabled:opacity-30 transition-all active:scale-95">
              🎯 Ouvrir le buzzer !
            </button>
            <button onClick={() => setSelectingQ(null)}
              className="w-full text-white/30 text-sm py-2 hover:text-white/60 transition-colors">
              ← Annuler
            </button>
          </div>
        )}

        {/* ── Question active ── */}
        {question && !selectingQ && (
          <div className="space-y-3">

            {/* Question */}
            <div className="bg-blue-800/50 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Q{question.ordre}</p>
              <p className="text-base font-bold">{question.question}</p>
            </div>

            {/* Représentants */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-2 text-center">
                <p className="text-yellow-300/60">Rep. {session?.equipe1_nom}</p>
                <p className="text-yellow-300 font-bold">{getPlayerName(question.representant_eq1)}</p>
              </div>
              <div className="bg-blue-400/10 border border-blue-400/30 rounded-xl p-2 text-center">
                <p className="text-blue-300/60">Rep. {session?.equipe2_nom}</p>
                <p className="text-blue-300 font-bold">{getPlayerName(question.representant_eq2)}</p>
              </div>
            </div>

            {/* ── En attente du buzz ── */}
            {question.phase === 'buzzer_ouvert' && !question.buzzer_winner_id && (
              <div className="bg-white/5 border border-white/20 rounded-xl p-4 text-center">
                <p className="text-white/50 text-sm animate-pulse">⏳ En attente du buzz…</p>
              </div>
            )}

            {/* ── Quelqu'un a buzzé ── */}
            {question.phase === 'buzzer_ouvert' && question.buzzer_winner_id && (
              <div className="bg-red-500/20 border border-red-400 rounded-xl p-4 space-y-3">
                <p className="text-center font-bold text-xl">🔔 {buzzWinnerName} a buzzé !</p>
                <p className="text-center text-white/60 text-sm">({buzzWinnerEquipe})</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleTopReponse}
                    className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95">
                    ✅ Top réponse
                  </button>
                  <button onClick={handlePasTopReponse}
                    className="bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95">
                    ❌ Pas top
                  </button>
                </div>
              </div>
            )}

            {/* ── Adverse propose ── */}
            {question.phase === 'buzzer_adverse' && (
              <div className="bg-orange-500/20 border border-orange-400 rounded-xl p-4 space-y-3">
                <p className="text-center font-bold text-orange-300">
                  ⚡ {question.representant_eq1 === question.buzzer_winner_id
                    ? getPlayerName(question.representant_eq2)
                    : getPlayerName(question.representant_eq1)} propose une meilleure réponse…
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleAdverseMeilleure}
                    className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95">
                    ✅ Meilleure réponse
                  </button>
                  <button onClick={handleAdverseMoinsBonne}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl py-3 transition-all active:scale-95">
                    ❌ Moins bonne
                  </button>
                </div>
              </div>
            )}

            {/* ── Phase vol ── */}
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

            {/* ── Réponses — toutes visibles animateur ── */}
            {(question.phase === 'normal' || question.phase === 'vol') && (
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
            )}

            {/* Valider tous les points quand tout est révélé */}
            {question.phase === 'normal' && reponses.length > 0 && reponses.every(r => r.revealed) && (
              <button onClick={handleValiderPoints}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-3 transition-all active:scale-95">
                ✅ Valider les points ({reponses.reduce((s, r) => s + r.points, 0)} pts → {question.equipe_active === 1 ? session?.equipe1_nom : session?.equipe2_nom})
              </button>
            )}

            {/* Croix — seulement en phase normale */}
            {question.phase === 'normal' && (
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
        )}

        {/* ── Sélection question suivante ── */}
        {!question && !selectingQ && (
          <div className="space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wide">
              {pendingQuestions.length > 0 ? 'Choisir la prochaine question' : 'Toutes les questions jouées'}
            </p>
            {pendingQuestions.map(q => (
              <button key={q.id} onClick={() => handleChoisirQuestion(q)}
                className="w-full bg-white/5 border border-white/10 hover:border-yellow-400/50 rounded-xl p-3 text-left text-sm font-medium transition-all active:scale-95">
                Q{q.ordre} — {q.question}
              </button>
            ))}
            {pendingQuestions.length === 0 && (
              <button onClick={handleTerminer}
                className="w-full bg-[#ffd700] hover:bg-yellow-300 text-black font-bold rounded-xl py-4 transition-all active:scale-95">
                🏁 Terminer le jeu
              </button>
            )}
          </div>
        )}

        {/* Boutons bas de page */}
        <div className="space-y-2 pt-1">
          {pendingQuestions.length > 0 && !selectingQ && (
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
