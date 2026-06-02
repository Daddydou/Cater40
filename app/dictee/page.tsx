'use client'
// app/dictee/page.tsx

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const ROOM_CODE = 'dictee'


export default function Dictee() {
  const [step, setStep]           = useState<'prenom' | 'attente' | 'ecriture' | 'upload' | 'correction' | 'fin'>('prenom')
  const [prenom, setPrenom]       = useState('')
  const [playerId, setPlayerId]   = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [roomId, setRoomId]       = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string>('waiting')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded]   = useState(false)
  const [isOnline, setIsOnline]   = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  // Charger la room et session
 useEffect(() => {
  const load = async () => {
    const { data: room } = await supabase
      .from('rooms').select('id, status').eq('code', ROOM_CODE)
      .maybeSingle()
    if (!room) return
    setRoomId(room.id)

    const { data: session } = await supabase
      .from('dictee_sessions').select('id, status')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (session) {
      setSessionId(session.id)
      setSessionStatus(session.status)
      syncStep(session.status)
    }
  }

  load()
  const interval = setInterval(load, 2000)
  return () => clearInterval(interval)
}, [])

  const syncStep = (status: string) => {
    if (status === 'waiting')    setStep('attente')
    if (status === 'writing')    setStep('ecriture')
    if (status === 'uploading')  setStep('upload')
    if (status === 'correcting') setStep('correction')
    if (status === 'finished')   setStep('fin')
  }

  // Offline/online
  useEffect(() => {
    window.addEventListener('offline', () => setIsOnline(false))
    window.addEventListener('online',  () => setIsOnline(true))
  }, [])

  // Inscription
  const handleJoin = async () => {
    if (!prenom.trim() || !roomId) return
    const { data: player } = await supabase
      .from('players').insert({ room_id: roomId, name: prenom.trim(), score: 20 })
      .select().single()
    if (!player) return
    setPlayerId(player.id)

    // Chercher ou créer la session
    let sid = sessionId
    if (!sid) {
      const { data: existing } = await supabase
        .from('dictee_sessions').select('id, status')
        .eq('room_id', roomId).order('created_at', { ascending: false }).limit(1).single()
      if (existing) {
        sid = existing.id
        setSessionId(existing.id)
        setSessionStatus(existing.status)
        syncStep(existing.status)
      }
    }
    setStep(sessionStatus === 'writing' ? 'ecriture' : sessionStatus === 'uploading' ? 'upload' : 'attente')
  }

  // Upload copie
 const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  console.log('Upload lancé — file:', file?.name, 'playerId:', playerId, 'sessionId:', sessionId)
  if (!file || !playerId || !sessionId) {
    console.log('BLOQUÉ — valeurs manquantes')
    return
  }
  setUploading(true)

    const ext      = file.name.split('.').pop()
    const filename = `${sessionId}/${playerId}.${ext}`

    const { error } = await supabase.storage
      .from('dictee-copies').upload(filename, file, { upsert: true })

    if (!error) {
      const { data: urlData } = supabase.storage.from('dictee-copies').getPublicUrl(filename)
      await supabase.from('dictee_copies').upsert({
        session_id: sessionId,
        player_id: playerId,
        image_url: urlData.publicUrl,
        status: 'uploaded',
      })
      setUploaded(true)
    }
    setUploading(false)
  }

  const OfflineBanner = () => !isOnline ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-center text-sm py-2 font-semibold">
      ⚠️ Connexion perdue…
    </div>
  ) : null

  // ── Saisie prénom ─────────────────────────────────────────
  if (step === 'prenom') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white">
        <OfflineBanner />
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl">📝</div>
          <h1 className="text-2xl font-bold">La Dictée</h1>
          <p className="text-white/50 text-sm">Dictée corrigée par l&apos;IA</p>
          <input
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Ton prénom"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-white/50 transition-colors"
            autoFocus
          />
          <button onClick={handleJoin} disabled={!prenom.trim()}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3 text-lg disabled:opacity-30 transition-all active:scale-95">
            Participer →
          </button>
        </div>
      </main>
    )
  }

  // ── Attente ───────────────────────────────────────────────
  if (step === 'attente') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
        <OfflineBanner />
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-xl font-semibold mb-2">Bonjour {prenom} !</h2>
        <p className="text-white/50">En attente du lancement de la dictée…</p>
        <p className="text-white/30 text-sm mt-3">Prépare ton papier et ton stylo ✍️</p>
      </main>
    )
  }

  // ── Écriture ──────────────────────────────────────────────
  if (step === 'ecriture') {
  return (
    <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
      <OfflineBanner />
      <div className="w-full max-w-sm space-y-5">
        <div className="text-5xl">✍️</div>
        <h2 className="text-xl font-bold">Dictée en cours</h2>
        <p className="text-white/50">Écoute et écris sur ton papier…</p>
        <p className="text-white/30 text-sm">L&apos;animateur lit le texte à voix haute</p>
      </div>
    </main>
  )
}

  // ── Upload copie ──────────────────────────────────────────
  if (step === 'upload') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
        <OfflineBanner />
        <div className="w-full max-w-sm space-y-5">
          <div className="text-5xl">📸</div>
          <h2 className="text-xl font-bold">Prends ta copie en photo</h2>
          <p className="text-white/50 text-sm">Assure-toi que le texte est bien lisible</p>

          {!uploaded ? (
            <>
              <button onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-4 text-lg disabled:opacity-50 transition-all active:scale-95">
                {uploading ? '⏳ Envoi en cours…' : '📷 Prendre en photo'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-5xl">✅</div>
              <p className="text-green-400 font-semibold">Photo envoyée !</p>
              <p className="text-white/40 text-sm">Correction en cours par l&apos;animateur…</p>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── Correction en cours ───────────────────────────────────
  if (step === 'correction') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center">
        <OfflineBanner />
        <div className="text-5xl mb-4 animate-pulse">🔍</div>
        <h2 className="text-xl font-semibold mb-2">Correction en cours…</h2>
        <p className="text-white/50">L&apos;IA analyse les copies</p>
      </main>
    )
  }

  // ── Fin ───────────────────────────────────────────────────
  if (step === 'fin') {
    return (
      <main className="min-h-screen bg-[#1a1a0f] flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">{prenom}</h2>
        <p className="text-white/50">Résultats affichés sur l&apos;écran principal</p>
        <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors underline underline-offset-2 pt-4">
          ← Retour à l&apos;accueil
        </a>
      </main>
    )
  }

  return null
}
