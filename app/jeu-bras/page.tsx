'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Nunito } from 'next/font/google'
import { supabase, getActiveRoom } from '@/lib/supabase'
import { getResultLevel } from '@/lib/jeu-bras-data'

const nunito = Nunito({ subsets: ['latin'] })

const BUCKET_URL =
  'https://ubnkuwyqclrjckogldlc.supabase.co/storage/v1/object/public/jeu-bras'

type UIState =
  | 'prenom'
  | 'loading'
  | 'no-room'
  | 'waiting'
  | 'playing'
  | 'feedback-bon'
  | 'feedback-faux'
  | 'finished'

function seedFromRoomId(roomId: string): number {
  // FNV-1a hash — produit un ordre nettement différent de l'ordre alphabétique
  let h = 2166136261
  for (let i = 0; i < roomId.length; i++) {
    h = Math.imul(h ^ roomId.charCodeAt(i), 16777619) >>> 0
  }
  return h || 1
}

function extractPrenom(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '').replace(/^bras-/i, '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function lcgRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  const rand = lcgRandom(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function parseGameState(currentGame: string | null): { uiState: UIState; index: number } {
  if (!currentGame) return { uiState: 'waiting', index: 0 }
  if (currentGame === 'jeu-bras:finished') return { uiState: 'finished', index: 0 }
  const match = currentGame.match(/^jeu-bras:(playing|bon|faux):(\d+)$/)
  if (match) {
    const index = parseInt(match[2])
    if (match[1] === 'bon') return { uiState: 'feedback-bon', index }
    if (match[1] === 'faux') return { uiState: 'feedback-faux', index }
    return { uiState: 'playing', index }
  }
  return { uiState: 'waiting', index: 0 }
}

const ACTIVE_STATES: UIState[] = ['playing', 'feedback-bon', 'feedback-faux', 'finished']

export default function JeuBrasCater() {
  const [prenom, setPrenom] = useState('')
  const [room, setRoom] = useState<{ id: string; code: string; status: string } | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [uiState, setUiState] = useState<UIState>('prenom')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const roomRef = useRef<{ id: string } | null>(null)
  const uiStateRef = useRef<UIState>('prenom')

  const applyGameState = useCallback((currentGame: string | null) => {
    const { uiState: newState, index } = parseGameState(currentGame)
    if (newState === 'waiting' && ACTIVE_STATES.includes(uiStateRef.current)) {
      window.location.reload()
      return
    }
    uiStateRef.current = newState
    setUiState(newState)
    setCurrentIndex(index)
  }, [])

  const pollRoom = useCallback(async () => {
    if (!roomRef.current) return
    const { data } = await supabase
      .from('rooms')
      .select('current_game')
      .eq('id', roomRef.current.id)
      .maybeSingle()
    if (data) applyGameState(data.current_game)
  }, [applyGameState])

  // Realtime — démarre seulement quand room est défini (après handleJoin)
  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`jeu-bras-cater-${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        payload => applyGameState(payload.new.current_game),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room, applyGameState])

  // Polling fallback — démarre seulement quand room est défini (après handleJoin)
  useEffect(() => {
    if (!room) return
    const interval = setInterval(pollRoom, 2000)
    return () => clearInterval(interval)
  }, [room, pollRoom])

  useEffect(() => {
    if (uiState !== 'finished' || !roomRef.current) return
    const fetchScore = async () => {
      const { data } = await supabase
        .from('players')
        .select('score')
        .eq('room_id', roomRef.current!.id)
        .eq('is_birthday_person', true)
        .maybeSingle()
      if (data) setFinalScore(data.score)
    }
    fetchScore()
  }, [uiState])

  const handleJoin = async () => {
    if (!prenom.trim()) return
    setUiState('loading')

    const activeRoom = await getActiveRoom()
    if (!activeRoom) {
      setUiState('no-room')
      return
    }

    roomRef.current = activeRoom

    const { data: files } = await supabase.storage.from('jeu-bras').list()
    const filtered = (files ?? [])
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f.name))
      .map(f => f.name)
    const shuffled = shuffleWithSeed(filtered, seedFromRoomId(activeRoom.id))
    setPhotos(shuffled)

    const { data: roomData } = await supabase
      .from('rooms')
      .select('current_game')
      .eq('id', activeRoom.id)
      .maybeSingle()

    // Déclenche realtime + polling
    setRoom(activeRoom)

    if (roomData) applyGameState(roomData.current_game)
  }

  const currentPhoto = photos[currentIndex]
  const pct =
    photos.length > 0 && finalScore !== null
      ? Math.round((finalScore / photos.length) * 100)
      : 0
  const result = getResultLevel(pct)

  // ── Saisie prénom ──────────────────────────────────────────────
  if (uiState === 'prenom') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-6`}>
        <div className="text-7xl">💪</div>
        <h1 className="text-white text-3xl font-bold text-center">Gros Bras</h1>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-lg outline-none focus:border-[#FFD700]/60 transition-colors placeholder:text-white/30"
          />
          <button
            onClick={handleJoin}
            disabled={!prenom.trim()}
            className="w-full bg-[#FFD700] hover:bg-yellow-300 text-black font-bold rounded-2xl py-4 text-xl transition-all active:scale-95 disabled:opacity-30"
          >
            Rejoindre →
          </button>
        </div>
      </main>
    )
  }

  // ── Loading ────────────────────────────────────────────────────
  if (uiState === 'loading') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex items-center justify-center`}>
        <div className="w-10 h-10 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  // ── No room ────────────────────────────────────────────────────
  if (uiState === 'no-room') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4`}>
        <p className="text-white/40 text-lg">Aucune partie en cours</p>
        <button
          onClick={() => setUiState('prenom')}
          className="text-white/20 hover:text-white/50 text-sm underline underline-offset-4 transition-colors"
        >
          ← Réessayer
        </button>
      </main>
    )
  }

  // ── Waiting ────────────────────────────────────────────────────
  if (uiState === 'waiting') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-6 px-6`}>
        <div className="text-7xl">💪</div>
        <h1 className="text-white text-3xl font-bold text-center">Gros Bras</h1>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm text-center">
            Bonjour {prenom} — En attente du lancement…
          </p>
        </div>
      </main>
    )
  }

  // ── Feedback overlays ──────────────────────────────────────────
  if (uiState === 'feedback-bon' || uiState === 'feedback-faux') {
    const isBon = uiState === 'feedback-bon'
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] relative overflow-hidden`}>
        {currentPhoto && (
          <img
            src={`${BUCKET_URL}/${currentPhoto}`}
            alt=""
            className="absolute inset-0 w-full h-full object-contain opacity-20"
          />
        )}
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-black/60">
          <span
            className="text-9xl select-none"
            style={{
              animation: isBon
                ? 'bonPulse 0.5s ease-in-out infinite'
                : 'shake 0.4s ease-in-out infinite',
            }}
          >
            {isBon ? '❤️' : '💩'}
          </span>
          {currentPhoto && (
            <p className="text-white text-2xl font-bold">
              C&apos;était {extractPrenom(currentPhoto)} !
            </p>
          )}
        </div>
        <style>{`
          @keyframes bonPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.25); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-20px); }
            75% { transform: translateX(20px); }
          }
        `}</style>
      </main>
    )
  }

  // ── Playing ────────────────────────────────────────────────────
  if (uiState === 'playing') {
    return (
      <main className={`${nunito.className} h-screen bg-[#0a0a0a] flex flex-col px-4 py-4`}>
        <div className="w-full max-w-md mx-auto flex flex-col flex-1 gap-4">
          <p className="text-[#FFD700] text-center font-bold text-xl shrink-0">
            Photo {currentIndex + 1} / {photos.length}
          </p>
          {currentPhoto && (
            <div className="flex-1 w-full bg-black rounded-3xl overflow-hidden">
              <img
                src={`${BUCKET_URL}/${currentPhoto}`}
                alt={`Bras ${currentIndex + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <p className="text-white/30 text-center text-sm tracking-wide shrink-0">
            À qui appartient ce bras ?
          </p>
        </div>
      </main>
    )
  }

  // ── Finished ───────────────────────────────────────────────────
  if (uiState === 'finished') {
    return (
      <main
        className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 gap-5 text-center`}
      >
        <h2 className="text-white text-2xl font-bold">Résultat final 🏁</h2>
        <p className="text-[#FFD700] text-8xl font-black leading-none">
          {finalScore ?? '?'}
          <span className="text-white/30 text-4xl"> / {photos.length}</span>
        </p>
        <p className="text-white/40 text-2xl">({pct}%)</p>
        <p className="text-3xl font-bold">{result.titre}</p>
        <p className="text-white/50 text-base">{result.texte}</p>
        {result.image && (
          <div className="w-full max-w-xs aspect-square rounded-3xl overflow-hidden shadow-2xl">
            <img src={result.image} alt="Résultat" className="w-full h-full object-cover" />
          </div>
        )}
        <a
          href="/"
          className="text-white/20 hover:text-white/50 text-sm transition-colors underline underline-offset-4 mt-2"
        >
          ← Retour à l&apos;accueil
        </a>
      </main>
    )
  }

  return null
}
