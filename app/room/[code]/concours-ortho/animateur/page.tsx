'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';
import { defaultQuestions } from '@/lib/concours-ortho-data';

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

interface OrthoReponseWithPlayer {
  id: string;
  room_id: string;
  question_id: string;
  player_id: string;
  reponse: string;
  is_correct: boolean | null;
  created_at: string;
  players: { id: string; name: string } | null;
}

type Phase = 'loading' | 'locked' | 'questions' | 'correction' | 'done';

export default function AnimateurPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<OrthoQuestion[]>([]);
  const [reponses, setReponses] = useState<OrthoReponseWithPlayer[]>([]);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');

  // Load room
  useEffect(() => {
    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data }) => {
        if (!data) { setError('Salle introuvable.'); }
        else { setRoom(data as Room); }
        setPhase('locked');
      });
  }, [code]);

  // Load players
  useEffect(() => {
    if (!room) return;
    supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .then(({ data }) => setPlayers((data as Player[]) ?? []));
  }, [room]);

  const reloadQuestions = useCallback(async () => {
    if (!room) return;
    const { data } = await supabase
      .from('ortho_questions')
      .select('*')
      .eq('room_id', room.id)
      .order('ordre');
    setQuestions((data as OrthoQuestion[]) ?? []);
  }, [room]);

  const loadReponses = useCallback(async () => {
    if (!room) return;
    const { data } = await supabase
      .from('ortho_reponses')
      .select('*, players(id, name)')
      .eq('room_id', room.id);

    const reps = (data as OrthoReponseWithPlayer[]) ?? [];
    setReponses(reps);

    const counts: Record<string, number> = {};
    for (const rep of reps) {
      counts[rep.question_id] = (counts[rep.question_id] || 0) + 1;
    }
    setAnswerCounts(counts);
  }, [room]);

  // Initialize or load questions for this room, then enter animateur mode
  const handleEnterAnimateur = async () => {
    if (!room) return;
    setPhase('loading');
    setLoadError('');

    const { data: existing, error: fetchError } = await supabase
      .from('ortho_questions')
      .select('*')
      .eq('room_id', room.id)
      .order('ordre');

    if (fetchError) {
      setLoadError(`Impossible de charger les questions : ${fetchError.message}`);
      setPhase('locked');
      return;
    }

    if (existing && existing.length > 0) {
      setQuestions(existing as OrthoQuestion[]);
    } else {
      const toInsert = defaultQuestions.map((q) => ({
        room_id: room.id,
        ordre: q.ordre,
        type: q.type,
        question: q.question,
        propositions: q.propositions,
        bonne_reponse: q.bonne_reponse,
        status: 'pending',
      }));
      const { data: inserted, error: insertError } = await supabase
        .from('ortho_questions')
        .insert(toInsert)
        .select();

      if (insertError) {
        setLoadError(`Impossible de créer les questions : ${insertError.message}`);
        setPhase('locked');
        return;
      }
      setQuestions((inserted as OrthoQuestion[]) ?? []);
    }

    await loadReponses();
    setPhase('questions');
  };

  // Realtime subscriptions (active only in questions/correction phases)
  useEffect(() => {
    if (!room || phase === 'locked' || phase === 'loading' || phase === 'done') return;

    const channel = supabase
      .channel(`ortho-anim-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ortho_reponses', filter: `room_id=eq.${room.id}` },
        () => loadReponses()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ortho_questions', filter: `room_id=eq.${room.id}` },
        () => reloadQuestions()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, phase, loadReponses, reloadQuestions]);

  const launchQuestion = async (questionId: string) => {
    if (!room || saving) return;
    setSaving(true);
    try {
      await supabase
        .from('ortho_questions')
        .update({ status: 'closed' })
        .eq('room_id', room.id)
        .eq('status', 'active');
      await supabase
        .from('ortho_questions')
        .update({ status: 'active' })
        .eq('id', questionId);
      await reloadQuestions();
    } finally {
      setSaving(false);
    }
  };

  const closeQuestion = async (questionId: string) => {
    if (!room || saving) return;
    setSaving(true);
    try {
      await supabase
        .from('ortho_questions')
        .update({ status: 'closed' })
        .eq('id', questionId);
      await reloadQuestions();
    } finally {
      setSaving(false);
    }
  };

  const validateReponse = async (reponseId: string, isCorrect: boolean) => {
    await supabase
      .from('ortho_reponses')
      .update({ is_correct: isCorrect })
      .eq('id', reponseId);
    await loadReponses();
  };

  const handleCalculerScores = async () => {
    if (!room || saving) return;
    setSaving(true);

    // Reset all players to 0 first so stale scores from previous games don't bleed in
    for (const player of players) {
      await supabase.from('players').update({ score: 0 }).eq('id', player.id);
    }

    const scoreMap: Record<string, number> = {};
    for (const rep of reponses) {
      if (rep.is_correct === true) {
        scoreMap[rep.player_id] = (scoreMap[rep.player_id] || 0) + 1;
      }
    }
    for (const [playerId, score] of Object.entries(scoreMap)) {
      await supabase.from('players').update({ score }).eq('id', playerId);
    }

    await supabase
      .from('rooms')
      .update({ current_game: 'concours-ortho:classement:0', status: 'finished' })
      .eq('id', room.id);

    setSaving(false);
    setPhase('done');
    router.push(`/room/${code}/concours-ortho/classement?a=1`);
  };

  const allClosed =
    questions.length > 0 && questions.every((q) => q.status === 'closed');

  const libreQuestions = questions.filter((q) => q.type === 'libre');

  const allLibreValidated = reponses
    .filter((r) => questions.find((q) => q.id === r.question_id)?.type === 'libre')
    .every((r) => r.is_correct !== null);

  const bg = 'min-h-screen bg-gradient-to-br from-teal-900 via-cyan-950 to-teal-900 px-4 py-10';

  // ── Loading ─────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-white text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  // ── Locked (gate) ───────────────────────────────────────────
  if (phase === 'locked') {
    return (
      <div className={`${bg} flex flex-col items-center justify-center gap-6`}>
        <div className="text-center">
          <div className="text-6xl mb-4">🎙️</div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Concours Ortho</h1>
          <p className="text-teal-300">Interface animateur</p>
        </div>
        {loadError && (
          <div className="bg-red-500/20 border border-red-400/40 rounded-2xl px-5 py-3 max-w-sm text-center">
            <p className="text-red-300 text-sm">{loadError}</p>
            <p className="text-red-400/70 text-xs mt-1">
              Vérifiez que le schéma SQL a bien été exécuté dans Supabase.
            </p>
          </div>
        )}
        <button
          onClick={handleEnterAnimateur}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-xl hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg shadow-teal-900/40"
        >
          🎙️ Mode animateur
        </button>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-white text-lg animate-pulse">Redirection vers le classement…</p>
      </div>
    );
  }

  // ── Correction phase ─────────────────────────────────────────
  if (phase === 'correction') {
    return (
      <div className={`${bg} flex flex-col items-center`}>
        <div className="w-full max-w-lg flex flex-col gap-5">
          <div className="text-center">
            <div className="text-4xl mb-2">✍️</div>
            <h1 className="text-2xl font-extrabold text-white">Phase de correction</h1>
            <p className="text-teal-300 text-sm mt-1">Valide les réponses libres manuellement</p>
          </div>

          {libreQuestions.map((q) => {
            const qReponses = reponses.filter((r) => r.question_id === q.id);
            return (
              <div key={q.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-5">
                <p className="text-teal-300 text-xs font-bold mb-1">Question {q.ordre}</p>
                <p className="text-white font-semibold text-sm mb-1">{q.question}</p>
                <p className="text-teal-200/60 text-xs mb-4 italic">
                  Attendu : {q.bonne_reponse}
                </p>
                {qReponses.length === 0 ? (
                  <p className="text-white/30 text-sm">Aucune réponse reçue.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {qReponses.map((rep) => (
                      <div key={rep.id} className="bg-white/10 rounded-2xl px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-teal-200 text-xs font-bold truncate">
                            {rep.players?.name ?? '?'}
                          </p>
                          <p className="text-white text-sm mt-0.5 break-words">{rep.reponse}</p>
                        </div>
                        {rep.is_correct === null ? (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => validateReponse(rep.id, true)}
                              className="w-9 h-9 rounded-full bg-green-500/30 hover:bg-green-500/60 flex items-center justify-center text-lg transition-colors"
                              title="Valider"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => validateReponse(rep.id, false)}
                              className="w-9 h-9 rounded-full bg-red-500/30 hover:bg-red-500/60 flex items-center justify-center text-lg transition-colors"
                              title="Rejeter"
                            >
                              ❌
                            </button>
                          </div>
                        ) : (
                          <span className="text-2xl flex-shrink-0">
                            {rep.is_correct ? '✅' : '❌'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={handleCalculerScores}
            disabled={!allLibreValidated || saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-slate-900 font-black text-base disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
          >
            {saving ? '⏳ Calcul en cours…' : '🏆 Calculer les scores et lancer le classement'}
          </button>
        </div>
      </div>
    );
  }

  // ── Questions phase ──────────────────────────────────────────
  return (
    <div className={`${bg} flex flex-col items-center`}>
      <div className="w-full max-w-lg flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🎙️</div>
          <h1 className="text-2xl font-extrabold text-white">Animateur</h1>
          <p className="text-teal-300 text-sm">
            {players.length} joueur{players.length !== 1 ? 's' : ''} connecté{players.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Empty state */}
        {questions.length === 0 && (
          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 text-center">
            <p className="text-white/50 text-sm mb-3">Aucune question chargée.</p>
            <button
              onClick={handleEnterAnimateur}
              className="text-teal-300 hover:text-white text-sm underline transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Questions list */}
        <div className="flex flex-col gap-3">
          {questions.map((q) => {
            const count = answerCounts[q.id] ?? 0;
            const isActive = q.status === 'active';
            const isClosed = q.status === 'closed';

            return (
              <div
                key={q.id}
                className={`backdrop-blur-sm border rounded-2xl p-4 transition-all ${
                  isActive
                    ? 'bg-teal-500/20 border-teal-400/70'
                    : isClosed
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                {/* Meta row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-teal-400 animate-pulse' :
                      isClosed ? 'bg-white/20' : 'bg-white/20'
                    }`}
                  />
                  <span className="text-teal-300 text-xs font-bold">Q{q.ordre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    q.type === 'qcm'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}>
                    {q.type === 'qcm' ? 'QCM' : 'Libre'}
                  </span>
                  {isActive && (
                    <span className="text-xs bg-teal-400/20 text-teal-200 px-2 py-0.5 rounded-full font-semibold">
                      ⏱ {count} / {players.length} réponses
                    </span>
                  )}
                  {isClosed && (
                    <span className="text-xs text-white/30">
                      ✓ Fermée · {count} rép.
                    </span>
                  )}
                </div>

                {/* Question text */}
                <p className={`text-sm leading-snug mb-3 ${isClosed ? 'text-white/40' : 'text-white'}`}>
                  {q.question}
                </p>

                {/* Action button — full width, clearly visible */}
                {q.status === 'pending' && (
                  <button
                    onClick={() => launchQuestion(q.id)}
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ▶ Lancer cette question
                  </button>
                )}
                {isActive && (
                  <button
                    onClick={() => closeQuestion(q.id)}
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ⏹ Fermer la question
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Move to correction once all questions are closed */}
        {allClosed && (
          <button
            onClick={() => setPhase('correction')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black text-lg hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
          >
            ✍️ Passer à la correction
          </button>
        )}
      </div>
    </div>
  );
}
