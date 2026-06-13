'use client'
// app/animateur/page.tsx — Hub animateur

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const JEUX = [
  { num: 1, nom: 'Gros Bras',        emoji: '💪', code: 'jeu-bras',       href: '/jeu-bras/animateur' },
  { num: 2, nom: 'Concours Ortho',   emoji: '✍️', code: 'concours-ortho', href: '/concours-ortho/animateur' },
  { num: 3, nom: 'Dictée',           emoji: '📝', code: 'dictee',          href: '/dictee/animateur' },
  { num: 4, nom: 'Famille en or',    emoji: '🏆', code: 'famille-or',      href: '/famille-or/animateur' },
  { num: 6, nom: 'Une Cater en or',  emoji: '🎯', code: 'cater-en-or',     href: '/cater-en-or/animateur' },
  { num: 7, nom: 'Photos Gens',      emoji: '📸', code: 'photos-gens',     href: '/photos-gens/animateur' },
  { num: 8, nom: 'Citations Perdues',emoji: '💬', code: null,              href: '/citations-perdues' },
  { num: 9, nom: 'Quizz Friends',   emoji: '🛋️', code: 'quizz-friends',   href: '/quizz-friends/animateur' },
] as const

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
  const initialized = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('code, status')
      .in('code', ROOM_CODES)
    if (data) {
      const map: Record<string, string> = {}
      for (const row of data) map[row.code] = row.status
      setStatuses(map)
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetchStatuses()
    intervalRef.current = setInterval(fetchStatuses, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleResetAll = async () => {
    if (!confirm('Réinitialiser TOUS les jeux ? Tous les joueurs et scores seront supprimés.')) return

    const codes = ['jeu-bras', 'concours-ortho', 'dictee', 'famille-or', 'cater-en-or', 'photos-gens', 'citations-perdues', 'quizz-friends']
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

    await fetchStatuses()
  }

  const handleReset = async (code: string, nom: string) => {
    if (!confirm(`Réinitialiser ${nom} ? Tous les joueurs et scores seront supprimés.`)) return
    setResetting(code)
    await supabase.rpc('reset_room', { p_code: code })
    await fetchStatuses()
    setResetting(null)
  }

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-lg mx-auto">

        <div className="pt-4 pb-6">
          <h1 className="text-2xl font-bold">🎛️ Hub Animateur</h1>
          <p className="text-white/40 text-sm mt-1">Vue d&apos;ensemble et accès rapide</p>
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

              {/* En-tête de la card */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl w-9 text-center">{jeu.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40 font-mono">#{jeu.num}</span>
                    <span className="font-semibold">{jeu.nom}</span>
                  </div>
                </div>
                <StatusBadge status={jeu.code ? statuses[jeu.code] : undefined} />
              </div>

              {/* Actions */}
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
              </div>

            </div>
          ))}
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
