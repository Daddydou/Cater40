'use client'
// app/photos-gens/page.tsx

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getResultLevel } from '@/lib/jeu-photos-gens-data'

const ROOM_CODE = 'photos-gens'

const PHOTOS: { id: number; file: string; nom: string }[] = [
  { id: 1, file: '1.jpg', nom: 'Cater' },
  { id: 2, file: '2.jpg', nom: 'Sophie' },
]

export default function PhotosGens() {
  const [step, setStep]         = useState<'prenom' | 'attente' | 'jeu' | 'fin'>('prenom')
  const [prenom, setPrenom]     = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomId, setRoomId]     = useState<string | null>(null)
  const [status, setStatus]     = useState<string>('waiting')
  const [current, setCurrent]   = useState(0)
  const [score, setScore]       = useState(0)

  // Charger la room fixe au montage
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('code', ROOM_CODE)
        .single()
      if (data) {
        setRoomId(data.id)
        setStatus(data.status)
      }
    }
    load()
  }, [])

  // Écouter les changements de statut
  useEffect(() => {
    if (!roomId) return
    const channel = supabase
      .channel(`photos-gens-status-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const s = payload.new.status
        setStatus(s)
        if (s === 'playing' && step === 'attente') setStep('jeu')
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, step])

  // Inscription
  const handleJoin = async () => {
    if (!prenom.trim() || !roomId) return
    const { data } = await supabase
      .from('players')
      .insert({ room_id: roomId, name: prenom.trim(), score: 0 })
      .select()
      .single()
    if (data) {
      setPlayerId(data.id)
      setStep(status === 'playing' ? 'jeu' : 'attente')
    }
  }

  // Réponse Bon / Caca
  const handleAnswer = async (correct: boolean) => {
    const newScore = correct ? score + 1 : score
    setScore(newScore)
    if (playerId) {
      await supabase.from('players').update({ score: newScore }).eq('id', playerId)
    }
    if (current + 1 >= PHOTOS.length) {
      setStep('fin')
    } else {
      setCurrent(c => c + 1)
    }
  }

  const pct    = PHOTOS.length > 0 ? Math.round((score / PHOTOS.length) * 100) : 0
  const photo  = PHOTOS.length > 0 ? PHOTOS[current] : null
  const result = getResultLevel(pct)

  // ── Saisie prénom ─────────────────────────────────────────
  if (step === 'prenom') {
    return (
      <main className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl">📸</div>
          <h1 className="text-2xl font-bold">Photos Gens</h1>
          <p className="text-white/50 text-sm">À qui appartient cette photo ?</p>
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-white/50 transition-colors"
            autoFocus
          />
          <button
            onClick={handleJoin}
            disabled={!prenom.trim()}
            className="w-full bg-white text-black font-bold rounded-xl py-3 text-lg disabled:opacity-30 hover:bg-white/90 transition-all active:scale-95"
          >
            Jouer →
          </button>
        </div>
      </main>
    )
  }

  // ── Attente lancement animateur ───────────────────────────
  if (step === 'attente') {
    return (
      <main className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-xl font-semibold mb-2">Bonjour {prenom} !</h2>
        <p className="text-white/50">En attente du lancement par Cater…</p>
      </main>
    )
  }

  // ── Jeu en cours ─────────────────────────────────────────
  if (step === 'jeu') {
    if (!photo) return null
    return (
      <main className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-sm space-y-4">
          {/* Progression */}
          <div className="flex justify-between text-sm text-white/50 px-1">
            <span>Photo {current + 1} / {PHOTOS.length}</span>
            <span>Score : {score}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div
              className="bg-white rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${(current / PHOTOS.length) * 100}%` }}
            />
          </div>

          {/* Photo */}
          <div className="rounded-2xl overflow-hidden border border-white/10 aspect-square bg-white/5">
            <img
              src={`https://picsum.photos/seed/${photo.id}/400/400`}
              alt="Photo mystère"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Prénom */}
          <div className="text-center space-y-1">
            <p className="text-white/50 text-sm">C&apos;est la photo de…</p>
            <p className="text-2xl font-bold">{photo.nom}</p>
          </div>

          {/* Boutons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleAnswer(true)}
              className="bg-green-500/20 hover:bg-green-500/40 border border-green-500/40 text-green-300 font-bold rounded-2xl py-5 text-3xl transition-all active:scale-95"
            >
              ✅
              <div className="text-sm font-semibold mt-1">Bon !</div>
            </button>
            <button
              onClick={() => handleAnswer(false)}
              className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 text-red-300 font-bold rounded-2xl py-5 text-3xl transition-all active:scale-95"
            >
              💩
              <div className="text-sm font-semibold mt-1">Caca</div>
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Résultat final ────────────────────────────────────────
  if (step === 'fin') {
    return (
      <main className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <h2 className="text-xl font-semibold">{prenom}</h2>
        <p className="text-white/50">Tu as reconnu</p>
        <p className="text-5xl font-bold">
          {score}
          <span className="text-white/30 text-2xl"> / {PHOTOS.length}</span>
        </p>
        <p className="text-white/40">({pct}%)</p>
        <p className="text-2xl">{result.titre}</p>
        <p className="text-white/50 text-sm">{result.texte}</p>
        <div className="rounded-2xl overflow-hidden border border-white/10 w-full max-w-xs aspect-square">
          <img src={result.image} alt="Résultat" className="w-full h-full object-cover" />
        </div>
        <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors underline underline-offset-2 pt-2">
          ← Retour à l&apos;accueil
        </a>
      </main>
    )
  }

  return null
}
