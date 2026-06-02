'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Confetti } from '@/components/Confetti'
import { useWakeLock } from '@/lib/hooks/useWakeLock'

const ROOM_CODE = 'cater-en-or'

type SessionStatus = 'lobby' | 'playing' | 'finished'
type TeamSide = 'A' | 'B'

interface CaterSession {
  id: string
  room_id: string
  status: SessionStatus
  current_question_index: number
  team_a_name: string | null
  team_b_name: string | null
  team_a_score: number
  team_b_score: number
  active_team: TeamSide | null
  created_at: string
}

interface CaterPlayer {
  id: string
  session_id: string
  name: string
  team: TeamSide | null
}

interface CaterQuestion {
  id: string
  session_id: string
  question_text: string
  order_index: number
}

const DEFAULT_QUESTIONS = [
  'Prénoms féminins commençant par la lettre M',
  'Marques de voiture françaises',
  'Capitales européennes',
  'Plats italiens',
  "Sports olympiques d'été",
  "Pays d'Afrique subsaharienne",
  'Instruments de musique à cordes',
  'Films avec Leonardo DiCaprio',
  'Légumes verts',
  'Chanteurs français des années 80',
]

export default function CaterEnOrAnimateurPage() {
  useWakeLock()

  const [roomId, setRoomId] = useState<string | null>(null)
  const [session, setSession] = useState<CaterSession | null>(null)
  const [players, setPlayers] = useState<CaterPlayer[]>([])
  const [questions, setQuestions] = useState<CaterQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [teamAInput, setTeamAInput] = useState('Les Tigres')
  const [teamBInput, setTeamBInput] = useState('Les Lions')

  const fetchPlayers = useCallback(async (sessionId: string) => {
    const { data } = await supabase.from('cater_players').select('*').eq('session_id', sessionId)
    if (data) setPlayers(data as CaterPlayer[])
  }, [])

  const fetchQuestions = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('cater_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index')
    if (data) setQuestions(data as CaterQuestion[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: room } = await supabase.from('rooms').select('id').eq('code', ROOM_CODE).single()
      if (!room) { setLoading(false); return }
      setRoomId(room.id)

      const { data: sess } = await supabase
        .from('cater_sessions')
        .select('*')
        .eq('room_id', room.id)
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sess) {
        const s = sess as CaterSession
        setSession(s)
        if (s.team_a_name) setTeamAInput(s.team_a_name)
        if (s.team_b_name) setTeamBInput(s.team_b_name)
        await Promise.all([fetchPlayers(s.id), fetchQuestions(s.id)])
      }
      setLoading(false)
    }
    init()
  }, [fetchPlayers, fetchQuestions])

  useEffect(() => {
    if (!session) return
    const sid = session.id

    const channel = supabase
      .channel(`cater-anim-${sid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cater_sessions', filter: `id=eq.${sid}` }, (payload) => {
        setSession(payload.new as CaterSession)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cater_players', filter: `session_id=eq.${sid}` }, () => {
        fetchPlayers(sid)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cater_questions', filter: `session_id=eq.${sid}` }, () => {
        fetchQuestions(sid)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.id, fetchPlayers, fetchQuestions])

  const createSession = async () => {
    if (!roomId) return
    const { data } = await supabase
      .from('cater_sessions')
      .insert({ status: 'lobby', room_id: roomId })
      .select()
      .single()
    if (data) {
      setSession(data as CaterSession)
      setPlayers([])
      setQuestions([])
    }
  }

  const resetSession = async () => {
    if (!roomId) return
    if (session) {
      await supabase.from('cater_sessions').update({ status: 'finished' }).eq('id', session.id)
    }
    const { data } = await supabase
      .from('cater_sessions')
      .insert({ status: 'lobby', room_id: roomId })
      .select()
      .single()
    if (data) {
      setSession(data as CaterSession)
      setPlayers([])
      setQuestions([])
    }
  }

  const assignPlayer = async (playerId: string, team: TeamSide | null) => {
    await supabase.from('cater_players').update({ team }).eq('id', playerId)
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team } : p))
  }

  const launchGame = async () => {
    if (!session) return
    await supabase
      .from('cater_sessions')
      .update({ team_a_name: teamAInput.trim(), team_b_name: teamBInput.trim(), status: 'playing', current_question_index: 0 })
      .eq('id', session.id)
    await supabase
      .from('cater_questions')
      .insert(DEFAULT_QUESTIONS.map((q, i) => ({ session_id: session.id, question_text: q, order_index: i })))
  }

  const setActiveTeam = async (team: TeamSide) => {
    if (!session) return
    const opponent: TeamSide = team === 'A' ? 'B' : 'A'
    await supabase.from('cater_sessions').update({ active_team: opponent }).eq('id', session.id)
  }

  const awardPoint = async (team: TeamSide) => {
    if (!session || !roomId) return
    const nextIdx = session.current_question_index + 1
    const isLast = nextIdx >= questions.length
    await supabase
      .from('cater_sessions')
      .update({
        team_a_score: team === 'A' ? session.team_a_score + 1 : session.team_a_score,
        team_b_score: team === 'B' ? session.team_b_score + 1 : session.team_b_score,
        current_question_index: isLast ? session.current_question_index : nextIdx,
        active_team: null,
        status: isLast ? 'finished' : 'playing',
      })
      .eq('id', session.id)

    if (isLast) {
      await supabase
        .from('rooms')
        .update({ status: 'finished', current_game: 'cater-en-or:finished' })
        .eq('id', roomId)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-white text-xl animate-pulse">Chargement…</p>
      </div>
    )
  }

  if (!session || session.status === 'finished') {
    const nameA = session?.team_a_name || 'Équipe A'
    const nameB = session?.team_b_name || 'Équipe B'
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 relative">
        {session?.status === 'finished' && <Confetti />}
        <div className="text-center space-y-6 relative z-10">
          <div>
            <div className="text-6xl mb-4">🎯</div>
            <h1 className="text-4xl font-bold text-yellow-400">Une Cater en or</h1>
            <p className="text-gray-400 text-sm mt-1">Interface animateur</p>
          </div>
          {session?.status === 'finished' && (
            <div className="bg-gray-800 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-4">Partie terminée</p>
              <div className="flex gap-6 justify-center">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">{nameA}</p>
                  <p className="text-5xl font-bold text-white">{session.team_a_score}</p>
                </div>
                <div className="text-4xl font-bold text-gray-600 self-center">—</div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm">{nameB}</p>
                  <p className="text-5xl font-bold text-white">{session.team_b_score}</p>
                </div>
              </div>
              {session.team_a_score !== session.team_b_score && (
                <p className="text-yellow-400 font-bold text-lg mt-4">
                  🏆 {session.team_a_score > session.team_b_score ? nameA : nameB} gagne !
                </p>
              )}
              {session.team_a_score === session.team_b_score && (
                <p className="text-yellow-400 font-bold text-lg mt-4">Égalité !</p>
              )}
            </div>
          )}
          <button
            onClick={createSession}
            className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-10 py-4 rounded-2xl text-xl transition-colors"
          >
            {session?.status === 'finished' ? 'Nouvelle partie' : 'Créer une session'}
          </button>
        </div>
      </div>
    )
  }

  if (session.status === 'lobby') {
    const unassigned = players.filter(p => !p.team)
    const teamA = players.filter(p => p.team === 'A')
    const teamB = players.filter(p => p.team === 'B')
    const canLaunch = teamAInput.trim() && teamBInput.trim() && teamA.length > 0 && teamB.length > 0

    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-yellow-400">🎯 Une Cater en or — Lobby</h1>
            <button
              onClick={resetSession}
              className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Réinitialiser la session
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Nom Équipe A</label>
              <input
                value={teamAInput}
                onChange={e => setTeamAInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 text-lg font-semibold"
                placeholder="Les Tigres"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Nom Équipe B</label>
              <input
                value={teamBInput}
                onChange={e => setTeamBInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400 text-lg font-semibold"
                placeholder="Les Lions"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900 rounded-2xl p-4 border border-blue-800">
              <h2 className="font-bold text-blue-400 mb-3 text-sm uppercase tracking-wide">
                {teamAInput || 'Équipe A'} ({teamA.length})
              </h2>
              {teamA.length === 0 && <p className="text-gray-600 text-sm">Aucun joueur</p>}
              {teamA.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-2 mb-2">
                  <span className="font-medium">{p.name}</span>
                  <button onClick={() => assignPlayer(p.id, null)} className="text-gray-500 hover:text-white text-xs ml-2">✕</button>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-700">
              <h2 className="font-bold text-gray-400 mb-3 text-sm uppercase tracking-wide">
                En attente ({unassigned.length}) — total {players.length}
              </h2>
              {players.length === 0 && <p className="text-gray-600 text-sm">En attente de joueurs…</p>}
              {unassigned.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-lg px-3 py-2 mb-2">
                  <p className="font-medium mb-1.5">{p.name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => assignPlayer(p.id, 'A')}
                      className="flex-1 bg-blue-700 hover:bg-blue-600 rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
                    >
                      → {teamAInput || 'Éq. A'}
                    </button>
                    <button
                      onClick={() => assignPlayer(p.id, 'B')}
                      className="flex-1 bg-green-700 hover:bg-green-600 rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
                    >
                      → {teamBInput || 'Éq. B'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 border border-green-800">
              <h2 className="font-bold text-green-400 mb-3 text-sm uppercase tracking-wide">
                {teamBInput || 'Équipe B'} ({teamB.length})
              </h2>
              {teamB.length === 0 && <p className="text-gray-600 text-sm">Aucun joueur</p>}
              {teamB.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-green-900/30 border border-green-800/50 rounded-lg px-3 py-2 mb-2">
                  <span className="font-medium">{p.name}</span>
                  <button onClick={() => assignPlayer(p.id, null)} className="text-gray-500 hover:text-white text-xs ml-2">✕</button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={launchGame}
            disabled={!canLaunch}
            className="w-full bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-yellow-300 text-gray-900 font-bold py-4 rounded-2xl text-xl transition-colors"
          >
            🚀 Lancer le jeu
          </button>
          {!canLaunch && (
            <p className="text-center text-gray-500 text-sm mt-2">
              Nommez les deux équipes et assignez au moins un joueur par équipe
            </p>
          )}
        </div>
      </div>
    )
  }

  // Playing phase
  const currentQ = questions[session.current_question_index]
  const nameA = session.team_a_name || 'Équipe A'
  const nameB = session.team_b_name || 'Équipe B'
  const activeA = session.active_team === 'A'
  const activeB = session.active_team === 'B'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-yellow-400 font-bold text-lg">
            Question {session.current_question_index + 1} / {questions.length || '…'}
          </h1>
          <button
            onClick={resetSession}
            className="bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            Réinitialiser
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`rounded-2xl p-5 text-center transition-all duration-300 ${activeA ? 'bg-yellow-400 text-gray-900 scale-105 shadow-lg shadow-yellow-400/30' : 'bg-gray-800'}`}>
            <p className={`font-bold text-lg ${activeA ? 'text-gray-900' : 'text-gray-300'}`}>{nameA}</p>
            <p className="text-5xl font-bold mt-1">{session.team_a_score}</p>
            {activeA && <p className="text-xs font-bold mt-1 text-gray-800">EN JEU ✓</p>}
          </div>
          <div className={`rounded-2xl p-5 text-center transition-all duration-300 ${activeB ? 'bg-yellow-400 text-gray-900 scale-105 shadow-lg shadow-yellow-400/30' : 'bg-gray-800'}`}>
            <p className={`font-bold text-lg ${activeB ? 'text-gray-900' : 'text-gray-300'}`}>{nameB}</p>
            <p className="text-5xl font-bold mt-1">{session.team_b_score}</p>
            {activeB && <p className="text-xs font-bold mt-1 text-gray-800">EN JEU ✓</p>}
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 mb-6 text-center min-h-[100px] flex items-center justify-center">
          <p className="text-2xl font-bold leading-snug">
            {currentQ?.question_text || 'Chargement…'}
          </p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 text-center">Bonne réponse de :</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTeam('A')}
              className={`py-3 rounded-xl font-bold text-sm transition-all ${activeA ? 'bg-yellow-400 text-gray-900' : 'bg-blue-700 hover:bg-blue-600 text-white'}`}
            >
              ✅ {nameA}
            </button>
            <button
              onClick={() => setActiveTeam('B')}
              className={`py-3 rounded-xl font-bold text-sm transition-all ${activeB ? 'bg-yellow-400 text-gray-900' : 'bg-green-700 hover:bg-green-600 text-white'}`}
            >
              ✅ {nameB}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 text-center">L&apos;adversaire n&apos;a pas su — point à :</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => awardPoint('A')}
              className="bg-blue-900 hover:bg-blue-800 border border-blue-700 text-white py-3 rounded-xl font-bold text-sm transition-all"
            >
              🏆 Point {nameA}
            </button>
            <button
              onClick={() => awardPoint('B')}
              className="bg-green-900 hover:bg-green-800 border border-green-700 text-white py-3 rounded-xl font-bold text-sm transition-all"
            >
              🏆 Point {nameB}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
