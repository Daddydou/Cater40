'use client'
// app/dictee/correction/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ROOM_CODE = 'dictee'

const TEXTE_ORIGINAL = `Les orthophonistes travaillent quotidiennement avec des patients qui présentent des troubles du langage. Ils évaluent, diagnostiquent et traitent ces difficultés avec patience et bienveillance. Chaque séance est une opportunité de progresser ensemble vers une meilleure communication.`

type Faute = { mot_incorrect: string; mot_correct: string; certitude: 'rouge' | 'jaune' }

type CopyData = {
  id: string
  player_id: string
  image_url: string
  fautes_ia: Faute[]
  fautes_finales: Faute[]
  score: number
  status: string
  players: { name: string }
}

export default function DicteeCorrection() {
  const [sessionId, setSessionId]   = useState<string | null>(null)
  const [copies, setCopies]         = useState<CopyData[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [analyzing, setAnalyzing]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const initialized = useRef(false)

  const fetchCopies = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('dictee_copies')
      .select('id, player_id, image_url, fautes_ia, fautes_finales, score, status, players(name)')
      .eq('session_id', sid)
      .order('created_at')
    if (data) setCopies(data as unknown as CopyData[])
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      const { data: room } = await supabase
        .from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) return

      const { data: session } = await supabase
        .from('dictee_sessions').select('id')
        .eq('room_id', room.id).order('created_at', { ascending: false }).limit(1).single()
      if (!session) return

      setSessionId(session.id)
      await fetchCopies(session.id)
      setLoading(false)
    }
    init()
  }, [fetchCopies])

  // Analyser une copie avec Claude Vision
  const analyzeWithAI = async (copy: CopyData) => {
    if (analyzing) return
    setAnalyzing(copy.id)
    try {
      const res = await fetch('/api/dictee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: copy.image_url, texteOriginal: TEXTE_ORIGINAL }),
      })
      const result = await res.json()
      const fautes: Faute[] = result.fautes ?? []

      await supabase.from('dictee_copies').update({
        fautes_ia: fautes,
        fautes_finales: fautes,
        score: Math.max(0, 20 - fautes.filter(f => f.certitude === 'rouge').length),
        status: 'analyzed',
      }).eq('id', copy.id)

      if (sessionId) await fetchCopies(sessionId)
    } catch (e) {
      console.error('Erreur analyse IA:', e)
    }
    setAnalyzing(null)
  }

  // Confirmer / annuler une faute
  const toggleFaute = async (copy: CopyData, faute: Faute, keep: boolean) => {
    const newFautes = keep
      ? [...copy.fautes_finales, faute]
      : copy.fautes_finales.filter(f => f.mot_incorrect !== faute.mot_incorrect)
    const newScore = Math.max(0, 20 - newFautes.filter(f => f.certitude === 'rouge').length - newFautes.filter(f => f.certitude === 'jaune').length)

    await supabase.from('dictee_copies').update({
      fautes_finales: newFautes,
      score: newScore,
    }).eq('id', copy.id)

    await supabase.from('players').update({ score: newScore }).eq('id', copy.player_id)
    if (sessionId) await fetchCopies(sessionId)
  }


  // Valider une copie
  const validateCopy = async (copy: CopyData) => {
    await supabase.from('dictee_copies').update({ status: 'corrected' }).eq('id', copy.id)
    await supabase.from('players').update({ score: copy.score }).eq('id', copy.player_id)
    if (sessionId) await fetchCopies(sessionId)
    if (currentIdx < copies.length - 1) setCurrentIdx(i => i + 1)
  }

  // Lancer le classement
  const handleClassement = async () => {
    const { data: room } = await supabase.from('rooms').select('id').eq('code', ROOM_CODE).single()
    if (sessionId) await supabase.from('dictee_sessions').update({ status: 'finished' }).eq('id', sessionId)
    if (room) await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
    window.location.href = '/dictee/classement'
  }

  if (loading) return (
    <main className="min-h-screen bg-[#1a1a0f] flex items-center justify-center text-white">
      <p className="text-white/40">Chargement…</p>
    </main>
  )

  const copy = copies[currentIdx]
  const allCorrected = copies.length > 0 && copies.every(c => c.status === 'corrected')

  return (
    <main className="min-h-screen bg-[#1a1a0f] text-white p-5">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">🔍 Correction</h1>
            <p className="text-white/40 text-sm">
              Copie {currentIdx + 1} / {copies.length}
            </p>
          </div>
          {allCorrected && (
            <button onClick={handleClassement}
              className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95">
              🏆 Classement
            </button>
          )}
        </div>

        {/* Navigation copies */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {copies.map((c, i) => (
            <button key={c.id} onClick={() => setCurrentIdx(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                i === currentIdx ? 'bg-amber-500 text-black' :
                c.status === 'corrected' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50'
              }`}>
              {(c.players as { name?: string })?.name ?? `Copie ${i + 1}`}
              {c.status === 'corrected' && ' ✓'}
            </button>
          ))}
        </div>

        {copy && (
          <div className="space-y-4">
            {/* Photo de la copie */}
            <div className="rounded-2xl overflow-hidden border border-white/10">
              <img src={copy.image_url} alt="Copie" className="w-full object-contain max-h-64" />
            </div>

            {/* Texte original */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-1 uppercase tracking-wide">Texte original</p>
              <p className="text-sm text-white/70 leading-relaxed">{TEXTE_ORIGINAL}</p>
            </div>

            {/* Bouton analyser */}
            {copy.status === 'uploaded' && (
              <button onClick={() => analyzeWithAI(copy)}
                disabled={!!analyzing}
                className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl py-3 disabled:opacity-50 transition-all active:scale-95">
                {analyzing === copy.id ? '⏳ Analyse en cours…' : '🤖 Analyser avec l\'IA'}
              </button>
            )}

            {/* Fautes détectées */}
            {(copy.status === 'analyzed' || copy.status === 'corrected') && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-white/40 text-xs uppercase tracking-wide">
                    Fautes ({copy.fautes_finales.length}) — Score : {copy.score}/20
                  </p>
                </div>

                {copy.fautes_ia.length === 0 && (
                  <p className="text-green-400 text-sm text-center py-2">🎉 Aucune faute détectée !</p>
                )}

                {copy.fautes_ia.map((faute, i) => {
                  const isKept = copy.fautes_finales.some(f => f.mot_incorrect === faute.mot_incorrect)
                  return (
                    <div key={i} className={`border rounded-xl p-3 flex items-center justify-between gap-3 ${
                      isKept
                        ? faute.certitude === 'rouge' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-white/3 border-white/5 opacity-50'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <span className="mr-2">{faute.certitude === 'rouge' ? '🔴' : '🟡'}</span>
                        <span className="line-through text-red-300 text-sm">{faute.mot_incorrect}</span>
                        <span className="text-white/40 mx-2">→</span>
                        <span className="text-green-300 text-sm">{faute.mot_correct}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => toggleFaute(copy, faute, true)}
                          className={`text-xs px-2 py-1 rounded-lg transition-all ${isKept ? 'bg-red-500/40 text-red-200' : 'bg-white/10 text-white/50'}`}>
                          ✓
                        </button>
                        <button onClick={() => toggleFaute(copy, faute, false)}
                          className={`text-xs px-2 py-1 rounded-lg transition-all ${!isKept ? 'bg-green-500/40 text-green-200' : 'bg-white/10 text-white/50'}`}>
                          ✗
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Valider */}
                {copy.status !== 'corrected' && (
                  <button onClick={() => validateCopy(copy)}
                    className="w-full bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl py-3 mt-2 transition-all active:scale-95">
                    ✅ Valider cette copie (score : {copy.score}/20)
                  </button>
                )}
                {copy.status === 'corrected' && (
                  <div className="text-center text-green-400 text-sm py-2">✅ Copie validée — {copy.score}/20</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lancer classement */}
        {allCorrected && (
          <button onClick={handleClassement}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-4 transition-all active:scale-95">
            🏆 Lancer le classement final
          </button>
        )}

      </div>
    </main>
  )
}
