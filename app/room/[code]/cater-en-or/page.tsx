'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Room } from '@/types';
import { Confetti } from '@/components/Confetti';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { ConnectionBanner } from '@/components/ConnectionBanner';

type SessionStatus = 'lobby' | 'playing' | 'finished';
type TeamSide = 'A' | 'B';

interface CaterSession {
  id: string;
  room_id: string;
  status: SessionStatus;
  current_question_index: number;
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_score: number;
  team_b_score: number;
  active_team: TeamSide | null;
  created_at: string;
}

interface CaterPlayer {
  id: string;
  session_id: string;
  name: string;
  team: TeamSide | null;
}

interface CaterQuestion {
  id: string;
  session_id: string;
  question_text: string;
  order_index: number;
}

const STORAGE_PLAYER = 'cater_player_id';
const STORAGE_SESSION = 'cater_session_id';

export default function CaterEnOrPage() {
  useWakeLock();
  useHeartbeat();
  const { code } = useParams<{ code: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<CaterSession | null>(null);
  const [player, setPlayer] = useState<CaterPlayer | null>(null);
  const [questions, setQuestions] = useState<CaterQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchQuestions = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('cater_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index');
    if (data) setQuestions(data as CaterQuestion[]);
  }, []);

  const fetchPlayer = useCallback(async (playerId: string) => {
    const { data } = await supabase.from('cater_players').select('*').eq('id', playerId).maybeSingle();
    return data as CaterPlayer | null;
  }, []);

  const loadSession = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('cater_sessions')
      .select('*')
      .eq('room_id', roomId)
      .neq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setSession(data as CaterSession);
    return data as CaterSession | null;
  }, []);

  useEffect(() => {
    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data }) => {
        if (data) setRoom(data as Room);
        else setLoading(false);
      });
  }, [code]);

  useEffect(() => {
    if (!room) return;

    const init = async () => {
      const sess = await loadSession(room.id);

      if (!sess) {
        setLoading(false);
        return;
      }

      const savedPlayerId = localStorage.getItem(STORAGE_PLAYER);
      const savedSessionId = localStorage.getItem(STORAGE_SESSION);

      if (savedPlayerId && savedSessionId === sess.id) {
        const p = await fetchPlayer(savedPlayerId);
        if (p) setPlayer(p);
      }

      if (sess.status === 'playing') {
        await fetchQuestions(sess.id);
      }

      setLoading(false);
    };

    init();
  }, [room, fetchPlayer, fetchQuestions, loadSession]);

  useEffect(() => {
    if (!session) return;
    const sid = session.id;

    const channel = supabase
      .channel(`cater-joueur-${sid}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cater_sessions', filter: `id=eq.${sid}` }, async (payload) => {
        const updated = payload.new as CaterSession;
        setSession(updated);
        if (updated.status === 'playing' && questions.length === 0) {
          await fetchQuestions(sid);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cater_players', filter: `session_id=eq.${sid}` }, (payload) => {
        const updated = payload.new as CaterPlayer;
        setPlayer(prev => prev && updated.id === prev.id ? updated : prev);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cater_questions', filter: `session_id=eq.${sid}` }, () => {
        fetchQuestions(sid);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.id, questions.length, fetchQuestions]);

  const joinGame = async () => {
    if (!session || !nameInput.trim()) return;
    setJoining(true);
    const { data } = await supabase
      .from('cater_players')
      .insert({ session_id: session.id, name: nameInput.trim() })
      .select()
      .single();
    if (data) {
      const p = data as CaterPlayer;
      setPlayer(p);
      localStorage.setItem(STORAGE_PLAYER, p.id);
      localStorage.setItem(STORAGE_SESSION, session.id);
    }
    setJoining(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-white text-xl animate-pulse">Chargement…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold text-yellow-400 mb-3">Une Cater en or</h1>
          <p className="text-gray-400">
            Aucune session en cours.<br />Demande à l&apos;animateur de créer une session.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === 'finished') {
    const nameA = session.team_a_name || 'Équipe A';
    const nameB = session.team_b_name || 'Équipe B';
    const winnerA = session.team_a_score > session.team_b_score;
    const winnerB = session.team_b_score > session.team_a_score;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6 relative">
        <Confetti />
        <div className="text-center w-full max-w-sm relative z-10">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="text-2xl font-bold text-yellow-400 mb-6">Fin de la partie !</h1>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`rounded-2xl p-5 ${winnerA ? 'bg-yellow-400' : 'bg-gray-800'}`}>
              <p className={`font-bold text-sm ${winnerA ? 'text-gray-900' : 'text-gray-400'}`}>{nameA}</p>
              <p className={`text-5xl font-bold ${winnerA ? 'text-gray-900' : 'text-white'}`}>{session.team_a_score}</p>
              {winnerA && <p className="text-xs font-bold text-gray-800 mt-1">GAGNANT 🥇</p>}
            </div>
            <div className={`rounded-2xl p-5 ${winnerB ? 'bg-yellow-400' : 'bg-gray-800'}`}>
              <p className={`font-bold text-sm ${winnerB ? 'text-gray-900' : 'text-gray-400'}`}>{nameB}</p>
              <p className={`text-5xl font-bold ${winnerB ? 'text-gray-900' : 'text-white'}`}>{session.team_b_score}</p>
              {winnerB && <p className="text-xs font-bold text-gray-800 mt-1">GAGNANT 🥇</p>}
            </div>
          </div>
          {!winnerA && !winnerB && <p className="text-yellow-400 font-bold text-xl">Égalité !</p>}
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
        <div className="w-full max-w-xs text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold text-yellow-400 mb-2">Une Cater en or</h1>
          {session.status === 'lobby' ? (
            <>
              <p className="text-gray-400 mb-6 text-sm">Entre ton prénom pour rejoindre</p>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white text-center text-xl focus:outline-none focus:border-yellow-400 mb-4"
                placeholder="Ton prénom"
                autoFocus
              />
              <button
                onClick={joinGame}
                disabled={!nameInput.trim() || joining}
                className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-900 font-bold py-4 rounded-2xl text-lg transition-colors"
              >
                {joining ? 'Connexion…' : 'Rejoindre'}
              </button>
            </>
          ) : (
            <p className="text-gray-400 mt-4">La partie est déjà en cours.<br />Tu peux regarder en tant que spectateur.</p>
          )}
        </div>
      </div>
    );
  }

  if (session.status === 'lobby') {
    const nameA = session.team_a_name;
    const nameB = session.team_b_name;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
        <ConnectionBanner onReconnect={() => { if (room) loadSession(room.id); }} />
        <div className="text-center w-full max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-white mb-2">Salut {player.name} !</h1>
          <p className="text-gray-400 mb-8">En attente du début du jeu…</p>

          {player.team ? (
            <div className={`rounded-2xl p-6 ${player.team === 'A' ? 'bg-blue-800/60 border border-blue-600' : 'bg-green-800/60 border border-green-600'}`}>
              <p className="text-gray-300 text-sm mb-1">Tu es dans l&apos;équipe</p>
              <p className={`text-3xl font-bold ${player.team === 'A' ? 'text-blue-300' : 'text-green-300'}`}>
                {player.team === 'A' ? (nameA || 'Équipe A') : (nameB || 'Équipe B')}
              </p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <p className="text-gray-400 text-sm">L&apos;animateur va t&apos;assigner à une équipe…</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playing phase
  const currentQ = questions[session.current_question_index];
  const nameA = session.team_a_name || 'Équipe A';
  const nameB = session.team_b_name || 'Équipe B';
  const activeA = session.active_team === 'A';
  const activeB = session.active_team === 'B';
  const myTeamActive = (player.team === 'A' && activeA) || (player.team === 'B' && activeB);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col px-4 py-6">
      <ConnectionBanner onReconnect={() => { if (room) loadSession(room.id); }} />
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
        <p className="text-gray-500 text-xs text-center mb-4 uppercase tracking-wide">
          Question {session.current_question_index + 1} / {questions.length || '…'}
        </p>

        {myTeamActive && (
          <div className="bg-yellow-400 text-gray-900 rounded-2xl px-4 py-3 text-center font-bold text-sm mb-4 animate-pulse">
            C&apos;est à ton équipe de jouer !
          </div>
        )}

        <div className="bg-gray-800 rounded-3xl p-6 mb-6 flex items-center justify-center min-h-[140px] text-center">
          <p className="text-2xl font-bold leading-snug">
            {currentQ?.question_text || '…'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-auto">
          <div className={`rounded-2xl p-4 text-center transition-all duration-300 ${activeA ? 'bg-yellow-400 text-gray-900 scale-105 shadow-lg shadow-yellow-400/30' : 'bg-gray-800'}`}>
            <p className={`font-bold text-sm truncate ${activeA ? 'text-gray-900' : 'text-gray-300'}`}>{nameA}</p>
            <p className="text-4xl font-bold mt-1">{session.team_a_score}</p>
            {activeA && <p className="text-[10px] font-bold mt-1 text-gray-800 uppercase">En jeu ✓</p>}
          </div>
          <div className={`rounded-2xl p-4 text-center transition-all duration-300 ${activeB ? 'bg-yellow-400 text-gray-900 scale-105 shadow-lg shadow-yellow-400/30' : 'bg-gray-800'}`}>
            <p className={`font-bold text-sm truncate ${activeB ? 'text-gray-900' : 'text-gray-300'}`}>{nameB}</p>
            <p className="text-4xl font-bold mt-1">{session.team_b_score}</p>
            {activeB && <p className="text-[10px] font-bold mt-1 text-gray-800 uppercase">En jeu ✓</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
