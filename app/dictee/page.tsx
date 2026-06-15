'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerAvatar from '@/lib/components/PlayerAvatar'
import { uploadAvatar } from '@/lib/hooks/useAvatarUpload'

const ROOM_CODE = 'dictee'

type Step = 'prenom' | 'attente' | 'ecriture' | 'correction' | 'fin'

export default function Dictee() {
  const [step, setStep]             = useState<Step>('prenom')
  const [prenom, setPrenom]         = useState('')
  const [myScore, setMyScore]       = useState<number | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarRef    = useRef<HTMLInputElement>(null)
  const playerIdRef  = useRef<string | null>(null)
  const roomIdRef    = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const stepRef      = useRef<Step>('prenom')

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const applyStatus = (status: string) => {
    if (!playerIdRef.current) return
    const map: Record<string, Step> = {
      waiting:    'attente',
      writing:    'ecriture',
      correcting: 'correction',
      finished:   'fin',
    }
    const next = map[status]
    if (next && next !== stepRef.current) {
      stepRef.current = next
      setStep(next)
    }
  }

  // Polling — démarre après inscription (roomIdRef set)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!roomIdRef.current || !playerIdRef.current) return

      if (!sessionIdRef.current) {
        // Attendre la création de la session par l'animateur
        const { data } = await supabase
          .from('dictee_sessions')
          .select('id, status')
          .eq('room_id', roomIdRef.current)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data) {
          sessionIdRef.current = data.id
          applyStatus(data.status)
        }
      } else {
        const { data } = await supabase
          .from('dictee_sessions')
          .select('status')
          .eq('id', sessionIdRef.current)
          .maybeSingle()
        if (data) applyStatus(data.status)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Fetch score quand session finished
  useEffect(() => {
    if (step !== 'fin' || !playerIdRef.current) return
    const fetch = async () => {
      const { data } = await supabase
        .from('players')
        .select('score')
        .eq('id', playerIdRef.current!)
        .maybeSingle()
      if (data !== null) setMyScore(data.score)
    }
    fetch()
  }, [step])

  const handleJoin = async () => {
    if (!prenom.trim()) return

    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', ROOM_CODE)
      .maybeSingle()
    if (!room) return
    roomIdRef.current = room.id

    const { data: player } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: prenom.trim(), score: 0 })
      .select()
      .maybeSingle()
    if (!player) return
    playerIdRef.current = player.id

    if (avatarFile) {
      const url = await uploadAvatar(avatarFile, room.id, player.id)
      if (url) await supabase.from('players').update({ avatar_url: url }).eq('id', player.id)
    }

    // Session existante ?
    const { data: session } = await supabase
      .from('dictee_sessions')
      .select('id, status')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (session) {
      sessionIdRef.current = session.id
      applyStatus(session.status)
    } else {
      stepRef.current = 'attente'
      setStep('attente')
    }
  }

  // ── Saisie prénom ──────────────────────────────────────────────
  if (step === 'prenom') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl">📝</div>
          <h1 className="text-2xl font-bold">La Dictée</h1>
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-amber-400/60 transition-colors placeholder:text-white/30"
            autoFocus
          />
          <div className="flex flex-col items-center gap-3">
            <div onClick={() => avatarRef.current?.click()} className="cursor-pointer">
              <PlayerAvatar name={prenom || '?'} avatarUrl={avatarPreview} size={72} />
            </div>
            <button type="button" onClick={() => avatarRef.current?.click()}
              className="text-xs text-white/40 hover:text-white/70 transition-colors">
              {avatarPreview ? '📷 Changer la photo' : '📷 Ajouter une photo (optionnel)'}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <button onClick={handleJoin} disabled={!prenom.trim()}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3 text-lg disabled:opacity-30 transition-all active:scale-95">
            Participer →
          </button>
        </div>
      </main>
    )
  }

  // ── Attente ────────────────────────────────────────────────────
  if (step === 'attente') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-xl font-semibold mb-2">Bonjour {prenom} !</h2>
        <p className="text-white/50">La dictée va commencer, écoutez bien !</p>
        <p className="text-white/30 text-sm mt-3">Prépare ton papier et ton stylo ✍️</p>
      </main>
    )
  }

  // ── Écriture ───────────────────────────────────────────────────
  if (step === 'ecriture') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4">✍️</div>
        <h2 className="text-xl font-bold mb-2">Dictée en cours</h2>
        <p className="text-white/50">Dictée en cours… écoutez et écrivez !</p>
      </main>
    )
  }

  // ── Correction ─────────────────────────────────────────────────
  if (step === 'correction') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-5xl mb-4">✏️</div>
        <h2 className="text-xl font-bold mb-2">Corrigez la copie de votre voisin ✏️</h2>
        <p className="text-white/40 text-sm">L&apos;animateur vous donnera les instructions</p>
      </main>
    )
  }

  // ── Fin ────────────────────────────────────────────────────────
  if (step === 'fin') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <div className="text-6xl">{myScore !== null ? '🎉' : '⏳'}</div>
        <h2 className="text-2xl font-bold">{prenom}</h2>
        {myScore !== null ? (
          <>
            <p className="text-white/40 text-sm">Ton score</p>
            <p className="text-7xl font-black text-amber-400 leading-none">
              {myScore}
              <span className="text-white/30 text-3xl">/20</span>
            </p>
          </>
        ) : (
          <p className="text-white/50">En attente du classement…</p>
        )}
      </main>
    )
  }

  return null
}
