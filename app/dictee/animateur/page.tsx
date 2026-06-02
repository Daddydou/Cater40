'use client'
// app/dictee/animateur/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ROOM_CODE = 'dictee'

const TEXTE_DICTEE = `Les orthophonistes travaillent quotidiennement avec des patients qui présentent des troubles du langage. Ils évaluent, diagnostiquent et traitent ces difficultés avec patience et bienveillance. Chaque séance est une opportunité de progresser ensemble vers une meilleure communication.`

type Player = { id: string; name: string; score: number }
type Copy   = { id: string; player_id: string; image_url: string; status: string; players: { name: string } }

export default function DicteeAnimateur() {
  const [roomId, setRoomId]               = useState<string | null>(null)
  const [sessionId, setSessionId]         = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [players, setPlayers]             = useState<Player[]>([])
  const [copies, setCopies]               = useState<Copy[]>([])
  const [loading, setLoading]             = useState(true)
  const initialized = useRef(false)

  const fetchPlayers = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('players').select('id, name, score')
      .eq('room_id', rid).order('created_at')
    if (data) setPlayers(data)
  }, [])

  const fetchCopies = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('dictee_copies').select('id, player_id, image_url, status, players(name)')
      .eq('session_id', sid)
    if (data) setCopies(data as unknown as Copy[])
  }, [])

  const fetchSession = useCallback(async (rid: string) => {
    const { data } = await supabase
      .from('dictee_sessions').select('id, status')
      .eq('room_id', rid).order('created_at', { ascending: false }).limit(1).single()
    if (data) {
      setSessionId(data.id)
      setSessionStatus(data.status)
      fetchCopies(data.id)
    } else {
      setSessionId(null)
      setSessionStatus(null)
      setCopies([])
    }
  }, [fetchCopies])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) return
      setRoomId(room.id)
      await fetchPlayers(room.id)
      await fetchSession(room.id)
      setLoading(false)

      supabase.channel(`anim-dictee-players-${room.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'players',
          filter: `room_id=eq.${room.id}`,
        }, () => fetchPlayers(room.id))
        .subscribe()
    }
    init()
  }, [fetchPlayers, fetchSession])

  // Écouter les copies quand sessionId change
  useEffect(() => {
    if (!sessionId) return
    const ch = supabase.channel(`anim-dictee-copies-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dictee_copies',
        filter: `session_id=eq.${sessionId}`,
      }, () => fetchCopies(sessionId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, fetchCopies])

  // Lancer la dictée — crée la session si elle n'existe pas
  const handleLancer = async () => {
    if (!roomId) return

    let sid = sessionId

    if (!sid) {
      const { data: newSession } = await supabase
        .from('dictee_sessions').insert({
          room_id: roomId,
          texte_original: TEXTE_DICTEE,
          status: 'writing',
        }).select().single()
      if (!newSession) return
      sid = newSession.id
      setSessionId(sid)
      setSessionStatus('writing')
    } else {
      await supabase.from('dictee_sessions').update({ status: 'writing' }).eq('id', sid)
      setSessionStatus('writing')
    }

    await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
    if (sid) await fetchCopies(sid)
  }

  const handleSetStatus = async (status: string) => {
    if (!sessionId) return
    await supabase.from('dictee_sessions').update({ status }).eq('id', sessionId)
    setSessionStatus(status)
    if (status === 'correcting') window.location.href = '/dictee/correction'
    if (status === 'finished' && roomId) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    }
  }

  const handleReset = async () => {
    if (!confirm('Remettre à zéro ? Tous les joueurs et la session seront supprimés.')) return
    if (sessionId) {
      await supabase.from('dictee_copies').delete().eq('session_id', sessionId)
      await supabase.from('dictee_sessions').delete().eq('id', sessionId)
    }
    if (roomId) {
      await supabase.rpc('reset_room', { p_code: ROOM_CODE })
    }
    setPlayers([]); setCopies([])
    setSessionId(null); setSessionStatus(null)
  }

  const copiesRecues = copies.filter(c => c.image_url)
  const gameUrl       = typeof window !== 'undefined' ? `${window.location.origin}/dictee` : ''
  const correctionUrl = typeof window !== 'undefined' ? `${window.location.origin}/dictee/correction` : ''
  const classementUrl = typeof window !== 'undefined' ? `${window.location.origin}/dictee/classement` : ''

  if (loading) return (
    <main className="min-h-screen bg-[#1a1a0f] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#1a1a0f] text-white p-5">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">📝 La Dictée</h1>
            <p className="text-white/40 text-sm">Interface animateur</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            !sessionStatus             ? 'bg-white/10 text-white/40' :
            sessionStatus === 'waiting'    ? 'bg-yellow-500/20 text-yellow-300' :
            sessionStatus === 'writing'    ? 'bg-green-500/20 text-green-300' :
            sessionStatus === 'uploading'  ? 'bg-blue-500/20 text-blue-300' :
            sessionStatus === 'correcting' ? 'bg-purple-500/20 text-purple-300' :
                                             'bg-white/10 text-white/50'
          }`}>
            {!sessionStatus             ? '⏳ Prêt' :
             sessionStatus === 'waiting'    ? '⏳ Attente' :
             sessionStatus === 'writing'    ? '✍️ Écriture' :
             sessionStatus === 'uploading'  ? '📸 Upload' :
             sessionStatus === 'correcting' ? '🔍 Correction' : '✅ Terminé'}
          </span>
        </div>

        {/* URLs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1 text-xs text-white/40">
          <p>Joueurs → <span className="text-blue-300 font-mono">{gameUrl}</span></p>
          <p>Correction → <span className="text-blue-300 font-mono">{correctionUrl}</span></p>
          <p>Classement → <span className="text-blue-300 font-mono">{classementUrl}</span></p>
        </div>

	{/* Texte de la dictée à lire */}
{sessionStatus === 'writing' && (
  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
    <p className="text-amber-300 text-xs uppercase tracking-wide font-semibold">📢 Texte à lire à voix haute</p>
    <p className="text-base leading-relaxed text-white">{TEXTE_DICTEE}</p>
  </div>
)}

        {/* Joueurs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-white/40 text-xs uppercase tracking-wide">Joueurs ({players.length})</p>
            {sessionStatus === 'uploading' && (
              <p className="text-white/40 text-xs">Copies : {copiesRecues.length}/{players.length}</p>
            )}
          </div>
          {players.length === 0
            ? <p className="text-white/25 text-sm text-center py-2">Aucun joueur</p>
            : players.map(p => {
              const hasCopy = copies.some(c => c.player_id === p.id && c.image_url)
              return (
                <div key={p.id} className="flex justify-between items-center">
                  <span>{p.name}</span>
                  {sessionStatus === 'uploading' && (
                    <span className={`text-xs ${hasCopy ? 'text-green-400' : 'text-white/30'}`}>
                      {hasCopy ? '📸 Reçue' : '⏳ En attente'}
                    </span>
                  )}
                </div>
              )
            })
          }
        </div>

        {/* Actions */}
        <div className="space-y-3">

          {/* Pas encore lancé */}
          {!sessionStatus && (
            <button onClick={handleLancer} disabled={players.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-4 disabled:opacity-30 transition-all active:scale-95">
              ▶️ Lancer la dictée
            </button>
          )}

          {/* En écriture */}
          {sessionStatus === 'writing' && (
            <button onClick={() => handleSetStatus('uploading')}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl py-4 transition-all active:scale-95">
              📸 Demander l&apos;upload des copies
            </button>
          )}

          {/* Upload */}
          {sessionStatus === 'uploading' && (
            <button onClick={() => handleSetStatus('correcting')}
              className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl py-4 transition-all active:scale-95">
              🔍 Lancer la correction IA ({copiesRecues.length}/{players.length} copies)
            </button>
          )}

          {/* Correction */}
          {sessionStatus === 'correcting' && (
            <a href="/dictee/correction"
              className="block w-full bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl py-4 text-center transition-all active:scale-95">
              🔍 Ouvrir la correction
            </a>
          )}

          {/* Terminé */}
          {sessionStatus === 'finished' && (
            <a href="/dictee/classement"
              className="block w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 text-center transition-all active:scale-95">
              🏆 Voir le classement
            </a>
          )}

          <button onClick={handleReset}
            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl py-3 transition-all active:scale-95">
            🔄 Nouvelle partie (reset)
          </button>
        </div>

      </div>
    </main>
  )
}
