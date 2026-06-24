'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ROOM_CODE = 'dictee'

const TEXTE_DICTEE =
  "À vélo\n\nQu'un cyclone se lève ou qu'une canicule s'abatte, l'adepte du V.T.T. a une pêche d'enfer. Rien ne saurait l'arrêter. Le faciès comprimé sous un casque antichoc, il enfouche son vélo, et hop ! Le voilà dans les sous-bois. Il évite en zigzaguant des nids-de-poule, roule en cahotant sur des sentiers bosselés et s'éclate dans les clairières. Infatigable, il dévale des pentes verglacées, puis, son parcours du combattant achevé, il met pied à terre, flapi, crotté, courbatu, mais content."

type SessionStatus = 'waiting' | 'writing' | 'correcting' | 'scoring' | 'finished'
type Phase = 'loading' | 'ready' | 'writing' | 'correcting' | 'scoring' | 'finished'
type Player = { id: string; name: string; score: number }

const STATUS_TO_PHASE: Record<SessionStatus, Phase> = {
  waiting:    'ready',
  writing:    'writing',
  correcting: 'correcting',
  scoring:    'scoring',
  finished:   'finished',
}

export default function DicteeAnimateur() {
  const router = useRouter()
  const [phase, setPhase]     = useState<Phase>('loading')
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores]   = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const roomRef      = useRef<{ id: string } | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const loadPlayers = useCallback(async () => {
    if (!roomRef.current) return
    const { data } = await supabase
      .from('players')
      .select('id, name, score')
      .eq('room_id', roomRef.current.id)
      .order('created_at', { ascending: true })
    setPlayers((data ?? []) as Player[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', ROOM_CODE)
        .maybeSingle()
      if (!room) return
      roomRef.current = room

      const { data: existing } = await supabase
        .from('dictee_sessions')
        .select('id, status')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let session: { id: string; status: string } | null = existing

      if (!session) {
        const { data: created } = await supabase
          .from('dictee_sessions')
          .insert({ room_id: room.id, texte_original: TEXTE_DICTEE, status: 'waiting' })
          .select('id, status')
          .maybeSingle()
        session = created
      }

      if (!session) return
      sessionIdRef.current = session.id
      setPhase(STATUS_TO_PHASE[session.status as SessionStatus] ?? 'ready')
      await loadPlayers()
    }
    init()
  }, [loadPlayers])

  // Polling joueurs
  useEffect(() => {
    const interval = setInterval(loadPlayers, 2000)
    return () => clearInterval(interval)
  }, [loadPlayers])

  const updateStatus = async (status: SessionStatus) => {
    if (!sessionIdRef.current) return
    await supabase.from('dictee_sessions').update({ status }).eq('id', sessionIdRef.current)
  }

  const handleLancerDictee = async () => {
    if (saving) return
    setSaving(true)
    await updateStatus('writing')
    setPhase('writing')
    setSaving(false)
  }

  const handleLancerCorrection = async () => {
    if (saving) return
    setSaving(true)
    await updateStatus('correcting')
    setPhase('correcting')
    setSaving(false)
  }

  const handlePasserNotes = async () => {
    if (saving) return
    setSaving(true)
    await updateStatus('scoring')
    setPhase('scoring')
    setSaving(false)
  }

  const handleLancerClassement = async () => {
    if (saving) return
    setSaving(true)
    for (const player of players) {
      const val = parseInt(scores[player.id] ?? '0', 10)
      await supabase.from('players').update({ score: isNaN(val) ? 0 : val }).eq('id', player.id)
    }
    await updateStatus('finished')
    if (roomRef.current) {
      await supabase.from('rooms').update({ reveal_count: 0 }).eq('id', roomRef.current.id)
    }
    setSaving(false)
    router.push('/dictee/classement?a=1')
  }

  const handleReset = async () => {
    if (!confirm('Remettre à zéro ? Tous les joueurs seront supprimés.')) return
    if (sessionIdRef.current) {
      await supabase.from('dictee_sessions').delete().eq('id', sessionIdRef.current)
    }
    await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    window.location.reload()
  }

  const allScoresFilled =
    players.length > 0 &&
    players.every(p => scores[p.id] !== undefined && scores[p.id].trim() !== '')

  // ── Loading ────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  // ── Ready ──────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] text-white px-4 py-8">
        <div className="max-w-md mx-auto space-y-5">
          <Link href="/animateur" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold tracking-wide">← Hub</Link>
          <div className="text-center">
            <div className="text-5xl mb-2">📝</div>
            <h1 className="text-2xl font-bold">La dictée de Bernard Pivote ! — Animateur</h1>
            <p className="text-white/40 text-sm mt-1">
              {players.length} joueur{players.length !== 1 ? 's' : ''} inscrit{players.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[80px]">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-2">Joueurs inscrits</p>
            {players.length === 0
              ? <p className="text-white/20 text-sm text-center py-2">En attente des joueurs…</p>
              : players.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm py-0.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-white/80">{p.name}</span>
                </div>
              ))
            }
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-2">Texte à dicter</p>
            <p className="text-white/60 text-sm leading-relaxed italic">«{TEXTE_DICTEE}»</p>
          </div>

          <button
            onClick={handleLancerDictee}
            disabled={saving || players.length === 0}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl py-4 text-lg disabled:opacity-30 transition-all active:scale-95"
          >
            {saving ? '⏳…' : '▶️ Lancer la dictée'}
          </button>

          <button
            onClick={handleReset}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white/50 text-sm rounded-xl py-2 transition-all"
          >
            🗑️ Nouvelle partie
          </button>
        </div>
      </main>
    )
  }

  // ── Writing ────────────────────────────────────────────────────
  if (phase === 'writing') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] text-white px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <Link href="/animateur" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold tracking-wide">← Hub</Link>
          <div className="text-center">
            <div className="text-5xl mb-2">🎙️</div>
            <h1 className="text-2xl font-bold">Dictée en cours</h1>
            <p className="text-white/40 text-sm mt-1">Lisez le texte à voix haute</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
            <p className="text-amber-100 text-lg leading-relaxed font-medium">{TEXTE_DICTEE}</p>
          </div>

          <button
            onClick={handleLancerCorrection}
            disabled={saving}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl py-4 disabled:opacity-40 transition-all active:scale-95"
          >
            {saving ? '⏳…' : '✏️ Lancer la correction'}
          </button>

          <button
            onClick={handleReset}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white/50 text-sm rounded-xl py-2 transition-all"
          >
            🗑️ Nouvelle partie
          </button>
        </div>
      </main>
    )
  }

  // ── Correcting ─────────────────────────────────────────────────
  if (phase === 'correcting') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] text-white px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <Link href="/animateur" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold tracking-wide">← Hub</Link>
          <div className="text-center">
            <div className="text-5xl mb-2">✏️</div>
            <h1 className="text-2xl font-bold">Correction en cours</h1>
            <p className="text-white/40 text-sm mt-1">Les joueurs corrigent la copie de leur voisin</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-white/70">{p.name}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handlePasserNotes}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl py-4 text-lg disabled:opacity-30 transition-all active:scale-95"
          >
            {saving ? '⏳…' : '🔢 Passer aux notes'}
          </button>

          <button
            onClick={handleReset}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white/50 text-sm rounded-xl py-2 transition-all"
          >
            🗑️ Nouvelle partie
          </button>
        </div>
      </main>
    )
  }

  // ── Scoring ────────────────────────────────────────────────────
  if (phase === 'scoring') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] text-white px-4 py-8">
        <div className="max-w-md mx-auto space-y-5">
          <Link href="/animateur" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors font-bold tracking-wide">← Hub</Link>
          <div className="text-center">
            <div className="text-5xl mb-2">🔢</div>
            <h1 className="text-2xl font-bold">Saisie des notes</h1>
            <p className="text-white/40 text-sm mt-1">Entrez la note de chaque joueur</p>
          </div>

          <div className="space-y-3">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <span className="flex-1 font-medium">{p.name}</span>
                <input
                  type="number"
                  min={-99}
                  max={20}
                  value={scores[p.id] ?? ''}
                  onChange={e => setScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="—"
                  className="w-16 bg-white/10 border border-white/20 rounded-xl px-2 py-2 text-center text-white text-lg font-bold outline-none focus:border-amber-400 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-white/30 text-sm shrink-0">/20</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleLancerClassement}
            disabled={saving || !allScoresFilled}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl py-4 text-lg disabled:opacity-30 transition-all active:scale-95"
          >
            {saving ? '⏳ Enregistrement…' : '🏆 Lancer le classement'}
          </button>

          {!allScoresFilled && players.length > 0 && (
            <p className="text-white/30 text-xs text-center">
              Toutes les notes doivent être remplies
            </p>
          )}

          <button
            onClick={handleReset}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white/50 text-sm rounded-xl py-2 transition-all"
          >
            🗑️ Nouvelle partie
          </button>
        </div>
      </main>
    )
  }

  // ── Finished ───────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center text-white gap-4">
      <div className="text-5xl">🏁</div>
      <p className="text-xl font-bold">Partie terminée</p>
      <a href="/dictee/classement?a=1" className="text-amber-400 underline text-sm">
        Voir le classement →
      </a>
      <button
        onClick={handleReset}
        className="w-full max-w-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/30 hover:text-white/50 text-sm rounded-xl py-2 transition-all mt-2"
      >
        🗑️ Nouvelle partie
      </button>
    </main>
  )
}
