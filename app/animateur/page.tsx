'use client'
// app/animateur/page.tsx — Hub animateur

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const JEUX = [
  { num: 1, nom: 'Gros Bras',        emoji: '💪', code: 'jeu-bras',       href: '/jeu-bras/animateur' },
  { num: 2, nom: 'Concours Ortho',   emoji: '✍️', code: 'concours-ortho', href: '/concours-ortho/animateur' },
  { num: 3, nom: 'Dictée',           emoji: '📝', code: 'dictee',          href: '/dictee/animateur' },
  { num: 4, nom: 'Famille en or',    emoji: '🏆', code: 'famille-or',      href: '/famille-or/animateur' },
  { num: 8, nom: 'Citations Perdues',emoji: '💬', code: null,              href: '/citations-perdues' },
  { num: 9, nom: 'Quizz Friends',    emoji: '🛋️', code: 'quizz-friends',   href: '/quizz-friends/animateur' },
] as const

const JEUX_META: Record<string, { nom: string; emoji: string }> = {
  'quizz-friends':     { nom: 'Quizz Friends',    emoji: '📺' },
  'jeu-bras':          { nom: 'Jeu des bras',      emoji: '💪' },
  'dictee':            { nom: 'Dictée',            emoji: '✏️' },
  'citations-perdues': { nom: 'Citations Perdues', emoji: '🎭' },
  'concours-ortho':    { nom: 'Concours Ortho',    emoji: '📝' },
  'famille-or':        { nom: 'Famille en Or',     emoji: '🏆' },
}

interface JeuData {
  slug: string
  visible: boolean
  ordre: number
}

const ROOM_CODES = JEUX.flatMap(j => j.code ? [j.code] : [])

function StatusBadge({ status }: { status?: string }) {
  if (!status) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-white/30">
        —
      </span>
    )
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
      status === 'waiting'  ? 'bg-yellow-500/20 text-yellow-300' :
      status === 'playing'  ? 'bg-green-500/20  text-green-300'  :
                              'bg-white/10 text-white/50'
    }`}>
      {status === 'waiting' ? '⏳ Attente' : status === 'playing' ? '▶️ En cours' : '✅ Terminé'}
    </span>
  )
}

export default function HubAnimateur() {
  const [statuses, setStatuses]   = useState<Record<string, string>>({})
  const [resetting, setResetting] = useState<string | null>(null)
  const [jeuxData, setJeuxData]   = useState<JeuData[]>([])
  const [revealing, setRevealing] = useState<string | null>(null)
  const [paused, setPaused]       = useState(false)
  const [cloture, setCloture]     = useState(false)
  const initialized  = useRef(false)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const roomIdsRef   = useRef<Record<string, string>>({})

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, code, status')
      .in('code', ROOM_CODES)
    if (data) {
      const statusMap: Record<string, string> = {}
      const idMap: Record<string, string> = {}
      for (const row of data) {
        statusMap[row.code] = row.status
        idMap[row.code] = row.id
      }
      setStatuses(statusMap)
      roomIdsRef.current = idMap
    }
  }

  const fetchJeuxVisibles = async () => {
    const { data } = await supabase
      .from('jeux_visibles')
      .select('slug, visible, ordre')
      .order('ordre', { ascending: true })
    if (data) setJeuxData(data as JeuData[])
  }

  const fetchPause = async () => {
    const { data } = await supabase
      .from('app_state')
      .select('pause_globale')
      .eq('id', 1)
      .maybeSingle()
    if (data !== null) setPaused(data.pause_globale)
  }

  const fetchCloture = async () => {
    const { data } = await supabase
      .from('app_state')
      .select('cloture_cater')
      .eq('id', 1)
      .maybeSingle()
    if (data !== null) setCloture(data.cloture_cater)
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetchStatuses()
    fetchJeuxVisibles()
    fetchPause()
    fetchCloture()
    intervalRef.current = setInterval(() => {
      fetchStatuses()
      fetchJeuxVisibles()
      fetchPause()
      fetchCloture()
    }, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleReveler = async (slug: string) => {
    setRevealing(slug)
    await supabase.from('jeux_visibles').update({ visible: true }).eq('slug', slug)
    await fetchJeuxVisibles()
    setRevealing(null)
  }

  const handleMove = async (slug: string, direction: 'up' | 'down') => {
    const sorted = [...jeuxData].sort((a, b) => a.ordre - b.ordre)
    const idx = sorted.findIndex(j => j.slug === slug)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return

    const a = sorted[idx]
    const b = sorted[targetIdx]

    // Optimistic update
    setJeuxData(prev =>
      prev.map(j => {
        if (j.slug === a.slug) return { ...j, ordre: b.ordre }
        if (j.slug === b.slug) return { ...j, ordre: a.ordre }
        return j
      })
    )

    await Promise.all([
      supabase.from('jeux_visibles').update({ ordre: b.ordre }).eq('slug', a.slug),
      supabase.from('jeux_visibles').update({ ordre: a.ordre }).eq('slug', b.slug),
    ])
  }

  const handleResetAll = async () => {
    if (!confirm('Réinitialiser TOUS les jeux ? Tous les joueurs et scores seront supprimés.')) return

    const codes = ['jeu-bras', 'concours-ortho', 'dictee', 'famille-or', 'citations-perdues', 'quizz-friends']
    await Promise.all(codes.map(code => supabase.rpc('reset_room', { p_code: code })))

    await supabase.from('citations_game').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('ortho_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('ortho_reponses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('dictee_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('dictee_copies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('famille_or_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('famille_or_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('famille_or_reponses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('cater_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('friends_game').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('friends_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const { error: chatErr } = await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (chatErr) console.error('Erreur vidage chat:', chatErr)
    await supabase.from('jeux_visibles').update({ visible: false }).neq('slug', '')

    await fetchStatuses()
  }

  const handleReset = async (code: string, nom: string) => {
    if (!confirm(`Réinitialiser ${nom} ? Tous les joueurs et scores seront supprimés.`)) return
    setResetting(code)
    await supabase.rpc('reset_room', { p_code: code })
    await fetchStatuses()
    setResetting(null)
  }

  const handleResetCitations = async () => {
    if (!confirm('Réinitialiser Citations Perdues ? La partie en cours sera supprimée.')) return
    setResetting('citations-perdues')
    await supabase.from('citations_game').update({
      points: 0,
      phrases_validees: Array(14).fill(false),
      lettres_achetees: [],
      lettres_colorees_revelees: [],
      phase2_debloquee: false,
      hint_index: 0,
    }).neq('id', '00000000-0000-0000-0000-000000000000')
    setResetting(null)
  }

  const handleTriggerCloture = async () => {
    setCloture(true)
    await supabase.from('app_state').update({ cloture_cater: true }).eq('id', 1)
  }

  const handleResetCloture = async () => {
    setCloture(false)
    await supabase.from('app_state').update({ cloture_cater: false }).eq('id', 1)
  }

  const handleTogglePause = async () => {
    const next = !paused
    setPaused(next)
    await supabase.from('app_state').update({ pause_globale: next }).eq('id', 1)
  }

  const sortedJeux = [...jeuxData].sort((a, b) => a.ordre - b.ordre)

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-lg mx-auto">

        <div className="pt-4 pb-6">
          <h1 className="text-2xl font-bold">🎛️ Hub Animateur</h1>
          <p className="text-white/40 text-sm mt-1">Vue d&apos;ensemble et accès rapide</p>
        </div>

        {/* Mode Panique */}
      <button
        onClick={handleTogglePause}
        className={`w-full font-black text-xl rounded-2xl py-5 mb-6 transition-all active:scale-95 border-2 ${
          paused
            ? 'bg-green-500/20 hover:bg-green-500/30 border-green-400 text-green-300'
            : 'bg-orange-500 hover:bg-orange-400 border-orange-400 text-white'
        }`}
      >
        {paused ? '▶️ REPRENDRE' : '⏸️ PAUSE — Mode panique'}
      </button>

      {/* Révélation progressive des jeux */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <h2 className="text-sm font-bold text-white/70 mb-3">🎉 Révéler les jeux</h2>
          <div className="space-y-2">
            {sortedJeux.map((jeu, idx) => {
              const meta = JEUX_META[jeu.slug]
              if (!meta) return null
              return (
                <div key={jeu.slug} className="flex items-center gap-2">
                  {/* Boutons ↑↓ */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(jeu.slug, 'up')}
                      disabled={idx === 0}
                      className="text-[10px] leading-none px-1 py-0.5 rounded text-white/30 hover:text-white/70 disabled:opacity-0 transition-colors"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(jeu.slug, 'down')}
                      disabled={idx === sortedJeux.length - 1}
                      className="text-[10px] leading-none px-1 py-0.5 rounded text-white/30 hover:text-white/70 disabled:opacity-0 transition-colors"
                    >
                      ↓
                    </button>
                  </div>
                  <span className="text-xl w-7 text-center">{meta.emoji}</span>
                  <span className="flex-1 text-sm font-medium">{meta.nom}</span>
                  {jeu.visible ? (
                    <span className="text-xs text-white/30 font-semibold">✅ Révélé</span>
                  ) : (
                    <button
                      onClick={() => handleReveler(jeu.slug)}
                      disabled={revealing === jeu.slug}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-all active:scale-95 disabled:opacity-40"
                    >
                      {revealing === jeu.slug ? '…' : 'Révéler 🎉'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleResetAll}
          className="w-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 text-red-300 font-bold rounded-xl py-4 transition-all active:scale-95 mb-6"
        >
          🔄 Tout réinitialiser avant la soirée
        </button>

        <div className="space-y-3">
          {JEUX.map(jeu => (
            <div key={jeu.num} className="bg-white/5 border border-white/10 rounded-2xl p-4">

              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl w-9 text-center">{jeu.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40 font-mono">#{jeu.num}</span>
                    <span className="font-semibold">{jeu.nom}</span>
                  </div>
                </div>
                <StatusBadge status={jeu.code ? statuses[jeu.code] : undefined} />
              </div>

              <div className="flex gap-2">
                <a
                  href={jeu.href}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-center text-sm font-semibold rounded-xl py-2 transition-all active:scale-95"
                >
                  Ouvrir l&apos;interface →
                </a>
                {jeu.code && (
                  <button
                    onClick={() => handleReset(jeu.code!, jeu.nom)}
                    disabled={resetting === jeu.code}
                    title={`Réinitialiser ${jeu.nom}`}
                    className="px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-all active:scale-95 disabled:opacity-40"
                  >
                    {resetting === jeu.code ? '…' : '↺'}
                  </button>
                )}
                {jeu.num === 8 && (
                  <button
                    onClick={handleResetCitations}
                    disabled={resetting === 'citations-perdues'}
                    title="Réinitialiser Citations Perdues"
                    className="px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-all active:scale-95 disabled:opacity-40"
                  >
                    {resetting === 'citations-perdues' ? '…' : '↺'}
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>

        {/* Surprise Cater */}
        <div className="mt-6 bg-gradient-to-r from-pink-900/40 via-purple-900/40 to-rose-900/40 border border-pink-500/30 rounded-2xl p-4">
          <p className="text-xs text-pink-300/60 font-semibold mb-3 text-center uppercase tracking-wider">🔒 Surprise privée</p>
          <button
            onClick={handleTriggerCloture}
            disabled={cloture}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 disabled:opacity-50 text-white font-black text-lg rounded-xl py-4 transition-all active:scale-95 mb-2"
          >
            🎂 Déclencher la surprise pour Cater
          </button>
          <button
            onClick={handleResetCloture}
            disabled={!cloture}
            className="w-full text-xs text-pink-300/50 hover:text-pink-300 disabled:opacity-30 transition-colors py-1"
          >
            ↺ Réinitialiser la surprise
          </button>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </a>
        </div>

      </div>
    </main>
  )
}
