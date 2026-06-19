'use client'
// app/joueurs/page.tsx — Portail joueurs

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const JEUX_META: Record<string, { nom: string; emoji: string }> = {
  'quizz-friends':  { nom: 'Quizz Friends',  emoji: '📺' },
  'dictee':         { nom: 'Dictée',          emoji: '✏️' },
  'concours-ortho': { nom: 'Concours Ortho',  emoji: '📝' },
  'famille-or':     { nom: 'Famille en Or',   emoji: '🏆' },
}

interface JeuVisible {
  slug: string
  ordre: number
}

export default function PortailJoueurs() {
  const [jeux, setJeux]         = useState<JeuVisible[]>([])
  const [newSlugs, setNewSlugs] = useState<Set<string>>(new Set())
  const prevSlugs    = useRef<Set<string>>(new Set())
  const isFirstFetch = useRef(true)
  const initialized  = useRef(false)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJeux = async () => {
    const { data } = await supabase
      .from('jeux_visibles')
      .select('slug, ordre')
      .eq('visible', true)
      .order('ordre', { ascending: true })

    if (data) {
      const current = (data as JeuVisible[]).filter(j => j.slug in JEUX_META)
      const currentSlugs = new Set(current.map(j => j.slug))

      if (!isFirstFetch.current) {
        const addedArr = current.map(j => j.slug).filter(s => !prevSlugs.current.has(s))
        if (addedArr.length > 0) {
          setNewSlugs(prev => new Set([...Array.from(prev), ...addedArr]))
          setTimeout(() => {
            setNewSlugs(prev => {
              const next = new Set(Array.from(prev))
              addedArr.forEach(s => next.delete(s))
              return next
            })
          }, 700)
        }
      }

      isFirstFetch.current = false
      prevSlugs.current = currentSlugs
      setJeux(current)
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetchJeux()
    intervalRef.current = setInterval(fetchJeux, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <style>{`
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.5) translateY(30px); }
          70%  { transform: scale(1.08) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .pop-in {
          animation: popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10 pt-6">
          <div className="text-5xl mb-3">🎂</div>
          <h1 className="text-2xl font-bold mb-1">Bienvenue ! Choisis ton jeu</h1>
          <p className="text-white/50 text-sm">Les jeux de l&apos;anniversaire de Cater 🎂</p>
        </div>

        {jeux.length === 0 ? (
          <div className="text-center text-white/30 text-sm mt-16">
            <div className="text-4xl mb-4">✨</div>
            <p>Les jeux arrivent bientôt…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jeux.map(jeu => {
              const meta = JEUX_META[jeu.slug]
              if (!meta) return null
              return (
                <a
                  key={jeu.slug}
                  href={`/${jeu.slug}`}
                  className={`flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-2xl p-5 transition-all group active:scale-[0.98]${newSlugs.has(jeu.slug) ? ' pop-in' : ''}`}
                >
                  <span className="text-4xl w-12 text-center">{meta.emoji}</span>
                  <div className="flex-1">
                    <span className="font-bold text-lg group-hover:text-white transition-colors">{meta.nom}</span>
                  </div>
                  <span className="text-white/20 group-hover:text-white/60 text-xl transition-colors">→</span>
                </a>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </a>
        </div>
      </div>
    </main>
  )
}
