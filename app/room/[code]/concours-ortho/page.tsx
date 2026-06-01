'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { vibrate } from '@/lib/vibrate';

interface OrthoQuestion {
  id: string;
  room_id: string;
  ordre: number;
  type: 'qcm' | 'libre';
  question: string;
  propositions: string[] | null;
  bonne_reponse: string;
  status: 'pending' | 'active' | 'closed';
}

export default function ConcoursOrthoPage() {
  useWakeLock();
  useHeartbeat();
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<OrthoQuestion | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [freeAnswer, setFreeAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load room on mount
  useEffect(() => {
    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data }) => {
        if (!data) { setError('Salle introuvable.'); }
        else { setRoom(data as Room); }
        setLoading(false);
      });
  }, [code]);

  // Load current player from localStorage once room is known
  useEffect(() => {
    if (!room) return;
    const playerId = localStorage.getItem('playerId');
    if (!playerId) return;
    supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()
      .then(({ data }) => { if (data) setCurrentPlayer(data as Player); });
  }, [room]);

  // Fetch the currently active question + whether this player already answered
  const fetchActiveQuestion = useCallback(async () => {
    if (!room) return;

    const { data: qData } = await supabase
      .from('ortho_questions')
      .select('*')
      .eq('room_id', room.id)
      .eq('status', 'active')
      .maybeSingle();

    const q = qData as OrthoQuestion | null;
    setActiveQuestion(q);
    setSelectedAnswer('');
    setFreeAnswer('');

    if (q && currentPlayer) {
      const { data: existing } = await supabase
        .from('ortho_reponses')
        .select('id')
        .eq('question_id', q.id)
        .eq('player_id', currentPlayer.id)
        .maybeSingle();
      setHasAnswered(!!existing);
    } else {
      setHasAnswered(false);
    }
  }, [room, currentPlayer]);

  useEffect(() => { fetchActiveQuestion(); }, [fetchActiveQuestion]);

  // Realtime subscriptions
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`ortho-player-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ortho_questions', filter: `room_id=eq.${room.id}` },
        () => fetchActiveQuestion()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          if (updated.current_game?.startsWith('concours-ortho:classement')) {
            router.push(`/room/${code}/concours-ortho/classement`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, fetchActiveQuestion, code, router]);

  const handleSubmit = async (answer: string) => {
    if (!activeQuestion || !currentPlayer || !room || submitting || !answer.trim()) return;
    setSubmitting(true);

    const is_correct =
      activeQuestion.type === 'qcm'
        ? answer.trim().toLowerCase() === activeQuestion.bonne_reponse.trim().toLowerCase()
        : null;

    const { error: insertError } = await supabase.from('ortho_reponses').insert({
      room_id: room.id,
      question_id: activeQuestion.id,
      player_id: currentPlayer.id,
      reponse: answer,
      is_correct,
    });

    if (insertError) {
      setError("Erreur lors de l'envoi de ta réponse. Réessaie !");
    } else {
      setHasAnswered(true);
      if (is_correct === true) vibrate.success();
      else if (is_correct === false) vibrate.error();
    }
    setSubmitting(false);
  };

  const bg = 'min-h-screen flex flex-col items-center bg-gradient-to-br from-teal-900 via-cyan-950 to-teal-900 px-4 py-10';

  if (loading) {
    return (
      <div className={`${bg} justify-center`}>
        <p className="text-white text-lg animate-pulse">Connexion au concours…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${bg} justify-center`}>
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div className={bg}>
      <ConnectionBanner onReconnect={fetchActiveQuestion} />
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-2">💬</div>
          <h1 className="text-2xl font-extrabold text-white">Concours Ortho</h1>
          {currentPlayer && (
            <p className="text-teal-300 text-sm mt-1">{currentPlayer.name}</p>
          )}
        </div>

        {/* Waiting between questions */}
        {!activeQuestion && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-white font-semibold text-lg">
              En attente de la prochaine question…
            </p>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-teal-400 text-xs">En direct</span>
            </div>
          </div>
        )}

        {/* Already answered */}
        {activeQuestion && hasAnswered && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white font-semibold text-lg">Réponse envoyée !</p>
            <p className="text-teal-300 text-sm mt-2">En attente des autres joueurs…</p>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-teal-400 text-xs">En direct</span>
            </div>
          </div>
        )}

        {/* Active question */}
        {activeQuestion && !hasAnswered && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-5 flex flex-col gap-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-teal-500/30 text-teal-200 text-xs font-bold px-3 py-1 rounded-full">
                Question {activeQuestion.ordre}/10
              </span>
              <span className="bg-white/10 text-white/60 text-xs px-2 py-1 rounded-full">
                {activeQuestion.type === 'qcm' ? '📝 QCM' : '✍️ Réponse libre'}
              </span>
            </div>

            {/* Question text */}
            <p className="text-white font-semibold text-base leading-relaxed">
              {activeQuestion.question}
            </p>

            {/* QCM choices */}
            {activeQuestion.type === 'qcm' && activeQuestion.propositions && (
              <div className="flex flex-col gap-2">
                {activeQuestion.propositions.map((prop, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedAnswer(prop)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all duration-150 ${
                      selectedAnswer === prop
                        ? 'bg-teal-500/40 border-teal-400 text-white'
                        : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {prop}
                  </button>
                ))}
                <button
                  onClick={() => handleSubmit(selectedAnswer)}
                  disabled={!selectedAnswer || submitting}
                  className="mt-2 w-full py-3 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all duration-150"
                >
                  {submitting ? '⏳ Envoi…' : '✅ Valider'}
                </button>
              </div>
            )}

            {/* Free text answer */}
            {activeQuestion.type === 'libre' && (
              <div className="flex flex-col gap-3">
                <textarea
                  value={freeAnswer}
                  onChange={(e) => setFreeAnswer(e.target.value)}
                  placeholder="Votre réponse…"
                  rows={3}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 text-sm resize-none focus:outline-none focus:border-teal-400"
                />
                <button
                  onClick={() => handleSubmit(freeAnswer)}
                  disabled={!freeAnswer.trim() || submitting}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all duration-150"
                >
                  {submitting ? '⏳ Envoi…' : '✅ Valider'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
