'use client'
// app/joueurs/page.tsx — Portail joueurs

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PauseOverlay from '@/components/PauseOverlay'

const JEUX_META: Record<string, { nom: string; emoji: string }> = {
  'quizz-friends':  { nom: 'We are your Friends',           emoji: '📺' },
  'dictee':         { nom: 'La dictée de Bernard Pivote !', emoji: '✏️' },
  'concours-ortho': { nom: 'Concours Ortho',                emoji: '📝' },
  'famille-or':     { nom: 'Une famille en or',             emoji: '🏆' },
}

interface JeuVisible {
  slug: string
  ordre: number
}

interface ChatMessage {
  id: string
  auteur: string
  contenu: string
  created_at: string
}

export default function PortailJoueurs() {
  // ── Jeux ──────────────────────────────────────────────────
  const [jeux, setJeux]         = useState<JeuVisible[]>([])
  const [newSlugs, setNewSlugs] = useState<Set<string>>(new Set())
  const prevSlugs    = useRef<Set<string>>(new Set())
  const isFirstFetch = useRef(true)
  const initialized  = useRef(false)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Chat ──────────────────────────────────────────────────
  const [prenom, setPrenom]         = useState('')
  const [prenomReady, setPrenomReady] = useState(false)
  const [prenomInput, setPrenomInput] = useState('')
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [msgInput, setMsgInput]     = useState('')
  const chatInitialized = useRef(false)
  const chatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatBottomRef   = useRef<HTMLDivElement>(null)

  // ── Fetch jeux ────────────────────────────────────────────
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

  // ── Fetch messages ────────────────────────────────────────
  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, auteur, contenu, created_at')
      .order('created_at', { ascending: true })
      .limit(50)
    if (data) setMessages(data as ChatMessage[])
  }

  // ── Polling jeux (3s) ─────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    fetchJeux()
    intervalRef.current = setInterval(fetchJeux, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Lire le prénom en sessionStorage (côté client) ────────
  useEffect(() => {
    const saved = sessionStorage.getItem('cater40_prenom') ?? ''
    setPrenom(saved)
    setPrenomReady(true)
  }, [])

  // ── Polling chat (2s) — démarre une seule fois dès que prenom est connu ──
  useEffect(() => {
    if (!prenom || chatInitialized.current) return
    chatInitialized.current = true
    fetchMessages()
    chatIntervalRef.current = setInterval(fetchMessages, 2000)
    return () => {
      if (chatIntervalRef.current) clearInterval(chatIntervalRef.current)
    }
  }, [prenom])

  // ── Auto-scroll vers le bas à chaque nouveau message ──────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Handlers chat ─────────────────────────────────────────
  const handleSavePrenom = () => {
    const p = prenomInput.trim()
    if (!p) return
    sessionStorage.setItem('cater40_prenom', p)
    setPrenom(p)
  }

  const handleSendMessage = async () => {
    const contenu = msgInput.trim()
    if (!contenu || !prenom) return
    setMsgInput('')
    await supabase.from('chat_messages').insert({ auteur: prenom, contenu })
    await fetchMessages()
  }

  return (
    <>
      <PauseOverlay />
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
          <p className="text-white/50 text-sm">Cater Olympiques 2026</p>
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


        {/* ── Pourboire ────────────────────────────────────── */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-xs text-white/50 mb-3">
            ☕ Les jeux sont 100% gratuits 😄 mais si le cœur vous en dit, vous pouvez soutenir les créateurs 🍻
          </p>
          <a
            href="https://www.paypal.com/paypalme/daddyducul"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-xs font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
          >
            Soutenir ☕
          </a>
        </div>

        {/* ── Chat ─────────────────────────────────────────── */}
        {prenomReady && (
          <div className="mt-8 pb-6">
            {!prenom ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-sm text-white/60 mb-3">💬 Chat — entre ton prénom pour participer :</p>
                <div className="flex gap-2">
                  <input
                    value={prenomInput}
                    onChange={e => setPrenomInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSavePrenom()}
                    placeholder="Ton prénom"
                    maxLength={30}
                    autoFocus
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-white/40 transition-colors placeholder:text-white/30"
                  />
                  <button
                    onClick={handleSavePrenom}
                    disabled={!prenomInput.trim()}
                    className="bg-white/20 hover:bg-white/30 disabled:opacity-30 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  >
                    OK
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                  <span className="text-xs text-white/40">💬 Chat</span>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="text-xs font-bold text-purple-300">{prenom}</span>
                </div>

                <div className="h-52 overflow-y-auto px-4 py-3 space-y-2">
                  {messages.length === 0 && (
                    <p className="text-white/25 text-xs text-center pt-6">Aucun message pour l&apos;instant…</p>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className="text-sm leading-snug">
                      <span className="font-bold text-purple-300">{msg.auteur}</span>
                      <span className="text-white/30 mx-1">:</span>
                      <span className="text-white/85">{msg.contenu}</span>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                <div className="px-4 py-3 border-t border-white/10 flex gap-2">
                  <input
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value.slice(0, 200))}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ton message…"
                    maxLength={200}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500/50 transition-colors placeholder:text-white/30"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!msgInput.trim()}
                    className="bg-purple-500 hover:bg-purple-400 disabled:opacity-30 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
    </>
  )
}
