'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { Confetti } from '@/components/Confetti'

const JEUX_META: Record<string, { nom: string; emoji: string }> = {
  'quizz-friends':     { nom: 'Quizz Friends',    emoji: '📺' },
  'jeu-bras':          { nom: 'Jeu des bras',      emoji: '💪' },
  'dictee':            { nom: 'Dictée',            emoji: '✏️' },
  'citations-perdues': { nom: 'Citations Perdues', emoji: '🎭' },
  'concours-ortho':    { nom: 'Concours Ortho',    emoji: '📝' },
  'famille-or':        { nom: 'Famille en Or',     emoji: '🏆' },
}

interface JeuVisible {
  slug: string
  ordre: number
}

export default function Home() {
  const [jeux, setJeux]         = useState<JeuVisible[]>([])
  const [newSlugs, setNewSlugs] = useState<Set<string>>(new Set())
  const prevSlugs   = useRef<Set<string>>(new Set())
  const isFirstFetch = useRef(true)
  const initialized  = useRef(false)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const [cloture, setCloture] = useState(false)

  const fetchJeux = async () => {
    const { data } = await supabase
      .from('jeux_visibles')
      .select('slug, ordre')
      .eq('visible', true)
      .order('ordre', { ascending: true })

    if (data) {
      const current = data as JeuVisible[]
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
    fetchJeux()
    fetchCloture()
    intervalRef.current = setInterval(() => {
      fetchJeux()
      fetchCloture()
    }, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <>
      {cloture && (
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-pink-950 via-purple-950 to-indigo-900 flex flex-col items-center justify-center">
          {/* Couche 1 : photo de fond */}
          <Image
            src="/cater-surprise.jpg"
            alt=""
            fill
            priority
            className="object-cover"
          />
          {/* Couche 2 : voile sombre */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Couche 3 : confettis */}
          <Confetti />
          {/* Couche 4 : texte */}
          <div className="relative z-[1] text-center px-8 space-y-6 pointer-events-none">
            <div className="text-8xl">🎂</div>
            <p className="text-white text-5xl font-black leading-tight drop-shadow-2xl">
              Joyeux anniversaire<br />ma Cat&apos; que j&apos;aime ❤️
            </p>
            <div className="text-5xl">✨🎉💖</div>
          </div>
        </div>
      )}
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

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 pt-6">
          <div className="text-5xl mb-3">🎂</div>
          <h1 className="text-3xl font-bold mb-1">Cater40</h1>
          <p className="text-white/50 text-sm">Les jeux des 40 ans de Cater</p>
        </div>

        {jeux.length === 0 ? (
          <div className="text-center text-white/30 text-sm mt-16">
            <div className="text-4xl mb-4">✨</div>
            <p>Les jeux arrivent bientôt…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {jeux.map((jeu) => {
              const meta = JEUX_META[jeu.slug]
              if (!meta) return null
              return (
                <a
                  key={jeu.slug}
                  href={`/${jeu.slug}`}
                  className={`flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-2xl p-4 transition-all group${newSlugs.has(jeu.slug) ? ' pop-in' : ''}`}
                >
                  <span className="text-3xl w-10 text-center">{meta.emoji}</span>
                  <div className="flex-1">
                    <span className="font-semibold group-hover:text-white transition-colors">{meta.nom}</span>
                  </div>
                  <span className="text-white/20 group-hover:text-white/60 transition-colors">→</span>
                </a>
              )
            })}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-6">
          <a href="/joueurs" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            👥 Portail joueurs
          </a>
          <a href="/animateur" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            🎛️ Hub animateur
          </a>
          <a href="/upload-photos" className="text-xs text-white/20 hover:text-white/50 transition-colors underline underline-offset-2">
            Upload photos
          </a>
        </div>
      </div>
    </main>
    </>
  )
}
