'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Nunito } from 'next/font/google'
import { supabase, getActiveRoom } from '@/lib/supabase'
import { getResultLevel } from '@/lib/jeu-bras-data'

const nunito = Nunito({ subsets: ['latin'] })

const BUCKET_URL =
  'https://ubnkuwyqclrjckogldlc.supabase.co/storage/v1/object/public/jeu-bras'

type UIState =
  | 'loading'
  | 'no-room'
  | 'waiting'
  | 'playing'
  | 'feedback-bon'
  | 'feedback-faux'
  | 'finished'

function extractPrenom(filename: string): string {
  const name = filename.replace(/^bras-/, '').replace(/\.(jpg|jpeg|png)$/i, '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function seedFromRoomId(roomId: string): number {
  return roomId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
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

export default function JeuBrasAnimateur() {
  const [room, setRoom] = useState<{ id: string; code: string; status: string } | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [uiState, setUiState] = useState<UIState>('loading')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const roomRef = useRef<{ id: string; code: string } | null>(null)
  const photosRef = useRef<string[]>([])
  const currentIndexRef = useRef(0)

  const applyGameState = useCallback((currentGame: string | null) => {
    const { uiState, index } = parseGameState(currentGame)
    setUiState(uiState)
    setCurrentIndex(index)
    currentIndexRef.current = index
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

  useEffect(() => {
    const init = async () => {
      const activeRoom = await getActiveRoom()
      if (!activeRoom) {
        setUiState('no-room')
        return
      }
      setRoom(activeRoom)
      roomRef.current = activeRoom

      const { data: files } = await supabase.storage.from('jeu-bras').list()
      const filtered = (files ?? [])
        .filter(f => /\.(jpg|jpeg|png)$/i.test(f.name))
        .map(f => f.name)
      const shuffled = shuffleWithSeed(filtered, seedFromRoomId(activeRoom.id))
      setPhotos(shuffled)
      photosRef.current = shuffled

      const { data: roomData } = await supabase
        .from('rooms')
        .select('current_game')
        .eq('id', activeRoom.id)
        .maybeSingle()
      if (roomData) applyGameState(roomData.current_game)
    }
    init()
  }, [applyGameState])

  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`jeu-bras-animateur-${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        payload => applyGameState(payload.new.current_game),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room, applyGameState])

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

  const handleLancer = async () => {
    if (!roomRef.current) return
    const roomId = roomRef.current.id

    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_birthday_person', true)
      .maybeSingle()

    if (!existing) {
      await supabase.from('players').insert({
        room_id: roomId,
        name: 'Cater',
        score: 0,
        is_birthday_person: true,
      })
    }

    await supabase.from('rooms').update({ current_game: 'jeu-bras:playing:0' }).eq('id', roomId)
  }

  const handleAnswer = async (correct: boolean) => {
    if (!roomRef.current || transitioning) return
    setTransitioning(true)

    const roomId = roomRef.current.id
    const index = currentIndexRef.current
    const total = photosRef.current.length
    const feedbackKey = correct ? 'bon' : 'faux'

    await supabase
      .from('rooms')
      .update({ current_game: `jeu-bras:${feedbackKey}:${index}` })
      .eq('id', roomId)

    if (correct) {
      const { data: player } = await supabase
        .from('players')
        .select('id, score')
        .eq('room_id', roomId)
        .eq('is_birthday_person', true)
        .maybeSingle()
      if (player) {
        await supabase
          .from('players')
          .update({ score: player.score + 1 })
          .eq('id', player.id)
      }
    }

    setTimeout(async () => {
      const nextIndex = index + 1
      const nextGame =
        nextIndex < total
          ? `jeu-bras:playing:${nextIndex}`
          : 'jeu-bras:finished'
      await supabase.from('rooms').update({ current_game: nextGame }).eq('id', roomId)
      setTransitioning(false)
    }, 1500)
  }

  const handleReset = async () => {
    if (!roomRef.current) return
    if (!confirm('Remettre à zéro ? Tous les joueurs et scores seront supprimés.')) return
    const { id: roomId, code } = roomRef.current
    await supabase.rpc('reset_room', { p_code: code })
    await supabase.from('rooms').update({ current_game: null }).eq('id', roomId)
    window.location.reload()
  }

  const currentPhoto = photos[currentIndex]
  const isFeedback = uiState === 'feedback-bon' || uiState === 'feedback-faux'
  const pct =
    photos.length > 0 && finalScore !== null
      ? Math.round((finalScore / photos.length) * 100)
      : 0
  const result = getResultLevel(pct)

  // ── No room ────────────────────────────────────────────────────
  if (uiState === 'no-room') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex items-center justify-center`}>
        <p className="text-white/40 text-lg">Aucune partie en cours</p>
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

  // ── Waiting ────────────────────────────────────────────────────
  if (uiState === 'waiting') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] px-4 py-8`}>
        <div className="w-full max-w-md mx-auto flex flex-col gap-6">
          <div className="text-center">
            <div className="text-5xl mb-2">💪</div>
            <h1 className="text-white text-2xl font-bold">Gros Bras — Animateur</h1>
            <p className="text-white/30 text-sm mt-1">Interface de contrôle</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-3">
              Photos dans le bucket ({photos.length})
            </p>
            {photos.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-3">
                Aucune photo dans le bucket &quot;jeu-bras&quot;
              </p>
            ) : (
              photos.map((f, i) => (
                <div key={f} className="flex items-center gap-3">
                  <span className="text-[#FFD700]/60 text-xs w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="text-white font-semibold text-sm">{extractPrenom(f)}</span>
                  <span className="text-white/20 text-xs truncate">{f}</span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleLancer}
            disabled={photos.length === 0}
            className="w-full bg-[#FFD700] hover:bg-yellow-300 text-black font-bold rounded-2xl py-5 text-xl transition-all active:scale-95 disabled:opacity-30"
          >
            ▶️ Lancer le jeu
          </button>
        </div>
      </main>
    )
  }

  // ── Playing + Feedback ─────────────────────────────────────────
  if (uiState === 'playing' || uiState === 'feedback-bon' || uiState === 'feedback-faux') {
    return (
      <main className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4`}>
        <div className="w-full max-w-md mx-auto flex flex-col gap-5">

          {/* Header */}
          <div className="text-center">
            <p className="text-[#FFD700] font-bold text-xl">
              Photo {currentIndex + 1} / {photos.length}
            </p>
            {currentPhoto && (
              <p className="text-white text-2xl font-bold mt-1">{extractPrenom(currentPhoto)}</p>
            )}
          </div>

          {/* Photo */}
          {currentPhoto && (
            <div className="rounded-3xl overflow-hidden aspect-square w-full bg-white/5 shadow-2xl">
              <img
                src={`${BUCKET_URL}/${currentPhoto}`}
                alt={extractPrenom(currentPhoto)}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Feedback badge */}
          {isFeedback && (
            <div
              className={`text-center py-3 rounded-2xl font-bold text-lg ${
                uiState === 'feedback-bon'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {uiState === 'feedback-bon' ? '✅ Bon enregistré' : '❌ Faux enregistré'}
            </div>
          )}

          {/* Boutons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleAnswer(false)}
              disabled={isFeedback || transitioning}
              className="bg-[#ef4444] hover:bg-red-400 text-white font-bold rounded-2xl py-6 px-10 text-2xl flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-40"
            >
              ❌
              <span className="text-base font-semibold">Faux</span>
            </button>
            <button
              onClick={() => handleAnswer(true)}
              disabled={isFeedback || transitioning}
              className="bg-[#22c55e] hover:bg-green-400 text-white font-bold rounded-2xl py-6 px-10 text-2xl flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-40"
            >
              ✅
              <span className="text-base font-semibold">Bon</span>
            </button>
          </div>

          {/* Reset discret */}
          <button
            onClick={handleReset}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 text-sm font-medium rounded-xl py-2 transition-all active:scale-95"
          >
            🔄 Nouvelle partie
          </button>
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-20px); }
            75% { transform: translateX(20px); }
          }
        `}</style>
      </main>
    )
  }

  // ── Finished ───────────────────────────────────────────────────
  if (uiState === 'finished') {
    return (
      <main
        className={`${nunito.className} min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 gap-5 text-center`}
      >
        <h2 className="text-white text-2xl font-bold">🏁 Partie terminée !</h2>
        <div>
          <p className="text-[#FFD700] text-8xl font-black leading-none">
            {finalScore ?? '?'}
            <span className="text-white/30 text-4xl"> / {photos.length}</span>
          </p>
          <p className="text-white/40 text-2xl mt-2">({pct}%)</p>
        </div>
        <p className="text-3xl font-bold">{result.titre}</p>
        <p className="text-white/50 text-base">{result.texte}</p>
        {result.image && (
          <div className="w-full max-w-xs aspect-square rounded-3xl overflow-hidden shadow-2xl">
            <img src={result.image} alt="Résultat" className="w-full h-full object-cover" />
          </div>
        )}
        <button
          onClick={handleReset}
          className="w-full max-w-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 text-sm font-medium rounded-xl py-3 transition-all active:scale-95"
        >
          🔄 Nouvelle partie
        </button>
      </main>
    )
  }

  return null
}
