'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Room } from '@/types';
import { defaultQuestions } from '@/lib/famille-or-data';
import { Confetti } from '@/components/Confetti';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { vibrate } from '@/lib/vibrate';

interface FamilleOrSession {
  id: string;
  room_id: string;
  equipe1_nom: string;
  equipe2_nom: string;
  equipe1_score: number;
  equipe2_score: number;
  question_active_id: string | null;
  status: string;
}

interface FamilleOrQuestion {
  id: string;
  session_id: string;
  ordre: number;
  question: string;
  status: string;
  equipe_active: number;
  croix_equipe1: number;
  croix_equipe2: number;
  phase: string;
}

interface FamilleOrReponse {
  id: string;
  question_id: string;
  ordre: number;
  texte: string;
  points: number;
  revealed: boolean;
}

function playSound(type: 'ding' | 'buzz' | 'fanfare' | 'victory') {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    if (type === 'ding') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.7, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'buzz') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(g);
      g.connect(master);
      osc.frequency.value = 80;
      g.gain.setValueAtTime(0.8, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'fanfare') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(master);
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    } else {
      [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(master);
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.28;
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    }
  } catch {
    // AudioContext unavailable
  }
}

type AnimPhase = 'loading' | 'setup' | 'playing' | 'finished';

export default function FamilleOrAnimateurPage() {
  useWakeLock();
  const { code } = useParams<{ code: string }>();

  const [phase, setPhase] = useState<AnimPhase>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<FamilleOrSession | null>(null);
  const [questions, setQuestions] = useState<FamilleOrQuestion[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<FamilleOrQuestion | null>(null);
  const [reponses, setReponses] = useState<FamilleOrReponse[]>([]);
  const [equipe1Nom, setEquipe1Nom] = useState('Équipe 1');
  const [equipe2Nom, setEquipe2Nom] = useState('Équipe 2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [setupError, setSetupError] = useState('');

  const sessionRef = useRef<FamilleOrSession | null>(null);
  const activeQuestionRef = useRef<FamilleOrQuestion | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  // Load room
  useEffect(() => {
    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data, error }) => {
        console.log('Room:', data, 'error:', error);
        if (!data) {
          setError('Salle introuvable.');
          setPhase('setup');
          return;
        }
        setRoom(data as Room);
      });
  }, [code]);

  // Check for existing session
  useEffect(() => {
    if (!room) return;
    supabase
      .from('famille_or_sessions')
      .select('*')
      .eq('room_id', room.id)
      .single()
      .then(({ data, error }) => {
        console.log('Session:', data, 'error:', error);
        if (data) {
          const s = data as FamilleOrSession;
          setSession(s);
          setEquipe1Nom(s.equipe1_nom);
          setEquipe2Nom(s.equipe2_nom);
          setPhase(s.status === 'finished' ? 'finished' : 'playing');
        } else {
          setPhase('setup');
        }
      });
  }, [room]);

  const loadQuestions = useCallback(async (sessionId: string) => {
    const { data, error } = await supabase
      .from('famille_or_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('ordre');
    console.log('Questions chargées:', data, 'error:', error);
    const qs = (data as FamilleOrQuestion[]) ?? [];
    setQuestions(qs);
    return qs;
  }, []);

  const loadReponses = useCallback(async (questionId: string) => {
    const { data, error } = await supabase
      .from('famille_or_reponses')
      .select('*')
      .eq('question_id', questionId)
      .order('ordre');
    console.log('Réponses chargées:', data, 'error:', error);
    setReponses((data as FamilleOrReponse[]) ?? []);
  }, []);

  const refreshSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('famille_or_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (data) setSession(data as FamilleOrSession);
    return (data as FamilleOrSession) ?? null;
  }, []);

  // Load questions once session id is set
  useEffect(() => {
    if (!session?.id || phase !== 'playing') return;
    loadQuestions(session.id).then((qs) => {
      if (session.question_active_id) {
        const aq = qs.find((q) => q.id === session.question_active_id) ?? null;
        setActiveQuestion(aq);
        if (aq) loadReponses(aq.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, phase]);

  // When question_active_id changes, update active question from questions array
  useEffect(() => {
    if (!session?.question_active_id || !questions.length) return;
    const aq = questions.find((q) => q.id === session.question_active_id) ?? null;
    if (aq && aq.id !== activeQuestion?.id) {
      setActiveQuestion(aq);
      loadReponses(aq.id);
    }
  }, [session?.question_active_id, questions, activeQuestion?.id, loadReponses]);

  // Sync activeQuestion when questions array is refreshed
  useEffect(() => {
    if (!session?.question_active_id) return;
    const aq = questions.find((q) => q.id === session.question_active_id) ?? null;
    if (aq) setActiveQuestion(aq);
  }, [questions, session?.question_active_id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!room || !session?.id || phase !== 'playing') return;
    const sid = session.id;

    const channel = supabase
      .channel(`fo-anim-${sid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'famille_or_sessions',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as FamilleOrSession;
          setSession(updated);
          if (updated.status === 'finished') setPhase('finished');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'famille_or_questions',
          filter: `session_id=eq.${sid}`,
        },
        () => loadQuestions(sid)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'famille_or_reponses' },
        () => {
          const qId = activeQuestionRef.current?.id;
          if (qId) loadReponses(qId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, session?.id, phase, loadQuestions, loadReponses]);

  // ── Actions ───────────────────────────────────────────────────────

  const handleDemarrer = async () => {
    if (!room || saving) return;
    setSaving(true);
    setSetupError('');
    try {
      const { data: sessData, error: sessErr } = await supabase
        .from('famille_or_sessions')
        .insert({
          room_id: room.id,
          equipe1_nom: equipe1Nom.trim() || 'Équipe 1',
          equipe2_nom: equipe2Nom.trim() || 'Équipe 2',
          status: 'playing',
        })
        .select()
        .single();

      if (sessErr || !sessData) {
        setSetupError(`Erreur : ${sessErr?.message ?? 'inconnue'}`);
        return;
      }

      const sess = sessData as FamilleOrSession;
      let firstQuestionId: string | null = null;

      for (let idx = 0; idx < defaultQuestions.length; idx++) {
        const qData = defaultQuestions[idx];
        const { data: qIns, error: qErr } = await supabase
          .from('famille_or_questions')
          .insert({
            session_id: sess.id,
            ordre: idx + 1,
            question: qData.question,
            status: 'pending',
            equipe_active: idx % 2 === 0 ? 1 : 2,
            croix_equipe1: 0,
            croix_equipe2: 0,
            phase: 'normal',
          })
          .select()
          .single();

        if (qErr || !qIns) continue;
        const q = qIns as FamilleOrQuestion;
        if (!firstQuestionId) firstQuestionId = q.id;

        await supabase.from('famille_or_reponses').insert(
          qData.reponses.map((r) => ({
            question_id: q.id,
            ordre: r.ordre,
            texte: r.texte,
            points: r.points,
            revealed: false,
          }))
        );
      }

      if (firstQuestionId) {
        await supabase
          .from('famille_or_sessions')
          .update({ question_active_id: firstQuestionId })
          .eq('id', sess.id);
      }

      setSession({ ...sess, question_active_id: firstQuestionId });
      setPhase('playing');
    } finally {
      setSaving(false);
    }
  };

  const handleReveal = async (rep: FamilleOrReponse) => {
    const aq = activeQuestionRef.current;
    if (!aq || saving || rep.revealed) return;
    setSaving(true);
    try {
      await supabase
        .from('famille_or_reponses')
        .update({ revealed: true })
        .eq('id', rep.id);

      const fresh = await refreshSession(aq.session_id);
      if (fresh) {
        const scoreField = aq.equipe_active === 1 ? 'equipe1_score' : 'equipe2_score';
        const current = aq.equipe_active === 1 ? fresh.equipe1_score : fresh.equipe2_score;
        await supabase
          .from('famille_or_sessions')
          .update({ [scoreField]: current + rep.points })
          .eq('id', fresh.id);
        await refreshSession(fresh.id);
      }

      playSound('ding');
      await loadReponses(aq.id);
    } finally {
      setSaving(false);
    }
  };

  const handleCroix = async () => {
    const aq = activeQuestionRef.current;
    if (!aq || saving || aq.phase === 'vol') return;
    setSaving(true);
    try {
      const field = aq.equipe_active === 1 ? 'croix_equipe1' : 'croix_equipe2';
      const current = aq.equipe_active === 1 ? aq.croix_equipe1 : aq.croix_equipe2;
      const newCount = current + 1;
      const updates: Record<string, number | string> = { [field]: newCount };
      if (newCount >= 3) updates.phase = 'vol';
      await supabase.from('famille_or_questions').update(updates).eq('id', aq.id);
      playSound('buzz');
      vibrate.error();
      await loadQuestions(aq.session_id);
    } finally {
      setSaving(false);
    }
  };

  const handleVolReussi = async () => {
    const aq = activeQuestionRef.current;
    if (!aq || saving) return;
    setSaving(true);
    try {
      const unrevealed = reponses.filter((r) => !r.revealed);
      const total = unrevealed.reduce((s, r) => s + r.points, 0);

      for (const rep of unrevealed) {
        await supabase
          .from('famille_or_reponses')
          .update({ revealed: true })
          .eq('id', rep.id);
      }

      const fresh = await refreshSession(aq.session_id);
      if (fresh && total > 0) {
        const stealTeam = aq.equipe_active === 1 ? 2 : 1;
        const scoreField = stealTeam === 1 ? 'equipe1_score' : 'equipe2_score';
        const current = stealTeam === 1 ? fresh.equipe1_score : fresh.equipe2_score;
        await supabase
          .from('famille_or_sessions')
          .update({ [scoreField]: current + total })
          .eq('id', fresh.id);
        await refreshSession(fresh.id);
      }

      playSound('fanfare');
      vibrate.victory();
      await loadReponses(aq.id);
    } finally {
      setSaving(false);
    }
  };

  const handleVolRate = async () => {
    const aq = activeQuestionRef.current;
    if (!aq || saving) return;
    setSaving(true);
    try {
      const unrevealed = reponses.filter((r) => !r.revealed);
      const total = unrevealed.reduce((s, r) => s + r.points, 0);

      for (const rep of unrevealed) {
        await supabase
          .from('famille_or_reponses')
          .update({ revealed: true })
          .eq('id', rep.id);
      }

      const fresh = await refreshSession(aq.session_id);
      if (fresh && total > 0) {
        const scoreField = aq.equipe_active === 1 ? 'equipe1_score' : 'equipe2_score';
        const current = aq.equipe_active === 1 ? fresh.equipe1_score : fresh.equipe2_score;
        await supabase
          .from('famille_or_sessions')
          .update({ [scoreField]: current + total })
          .eq('id', fresh.id);
        await refreshSession(fresh.id);
      }

      await loadReponses(aq.id);
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionSuivante = async () => {
    const aq = activeQuestionRef.current;
    const sess = sessionRef.current;
    if (!aq || !sess || saving) return;
    const nextQ = questions.find((q) => q.ordre === aq.ordre + 1);
    if (!nextQ) return;
    setSaving(true);
    try {
      await supabase
        .from('famille_or_sessions')
        .update({ question_active_id: nextQ.id })
        .eq('id', sess.id);

      await refreshSession(sess.id);
      setActiveQuestion(nextQ);
      setReponses([]);
      await loadReponses(nextQ.id);
    } finally {
      setSaving(false);
    }
  };

  const handleTerminer = async () => {
    const sess = sessionRef.current;
    if (!sess || !room || saving) return;
    setSaving(true);
    try {
      await supabase
        .from('famille_or_sessions')
        .update({ status: 'finished' })
        .eq('id', sess.id);
      await supabase
        .from('rooms')
        .update({ status: 'finished', current_game: 'famille-or:finished' })
        .eq('id', room.id);
      playSound('victory');
      await refreshSession(sess.id);
      setPhase('finished');
    } finally {
      setSaving(false);
    }
  };

  const handleChangerEquipe = async () => {
    const aq = activeQuestionRef.current;
    if (!aq || saving || aq.phase === 'vol') return;
    const newEquipe = aq.equipe_active === 1 ? 2 : 1;
    await supabase
      .from('famille_or_questions')
      .update({ equipe_active: newEquipe })
      .eq('id', aq.id);
    await loadQuestions(aq.session_id);
  };

  // ── Derived ───────────────────────────────────────────────────────
  const allRevealed = reponses.length > 0 && reponses.every((r) => r.revealed);
  const isLastQuestion = activeQuestion?.ordre === questions.length;
  const activeCroix = activeQuestion
    ? activeQuestion.equipe_active === 1
      ? activeQuestion.croix_equipe1
      : activeQuestion.croix_equipe2
    : 0;
  const activeEquipeNom =
    session && activeQuestion
      ? activeQuestion.equipe_active === 1
        ? session.equipe1_nom
        : session.equipe2_nom
      : '';
  const stealEquipeNom =
    session && activeQuestion
      ? activeQuestion.equipe_active === 1
        ? session.equipe2_nom
        : session.equipe1_nom
      : '';

  const bg = 'min-h-screen bg-[#1a237e] px-4 py-6 flex flex-col gap-4';

  // ── Render ────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#1a237e] flex items-center justify-center">
        <p className="text-yellow-400 text-lg animate-pulse">Chargement…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a237e] flex items-center justify-center">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-center">
          <div className="text-6xl mb-3">🥇</div>
          <h1 className="text-yellow-400 text-3xl font-black">Famille en Or</h1>
          <p className="text-blue-300 text-sm mt-1">Interface animateur</p>
        </div>

        <div className="w-full max-w-sm bg-blue-900/60 border border-yellow-400/30 rounded-3xl p-6 flex flex-col gap-4">
          <div>
            <label className="text-yellow-300 text-sm font-bold mb-2 block">
              Nom de l&apos;Équipe 1
            </label>
            <input
              value={equipe1Nom}
              onChange={(e) => setEquipe1Nom(e.target.value)}
              className="w-full bg-blue-800 border border-yellow-400/40 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-yellow-400 transition-colors"
              placeholder="Équipe 1"
              maxLength={20}
            />
          </div>
          <div>
            <label className="text-yellow-300 text-sm font-bold mb-2 block">
              Nom de l&apos;Équipe 2
            </label>
            <input
              value={equipe2Nom}
              onChange={(e) => setEquipe2Nom(e.target.value)}
              className="w-full bg-blue-800 border border-yellow-400/40 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-yellow-400 transition-colors"
              placeholder="Équipe 2"
              maxLength={20}
            />
          </div>

          {setupError && (
            <p className="text-red-400 text-sm text-center">{setupError}</p>
          )}

          <button
            onClick={handleDemarrer}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-900 font-black text-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg shadow-yellow-900/30"
          >
            {saving ? '⏳ Démarrage…' : '🎮 Démarrer le jeu'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    const winner = session
      ? session.equipe1_score > session.equipe2_score
        ? session.equipe1_nom
        : session.equipe2_score > session.equipe1_score
        ? session.equipe2_nom
        : null
      : null;
    return (
      <div className="min-h-screen bg-[#1a237e] flex flex-col items-center justify-center px-4 gap-6 relative overflow-hidden">
        <Confetti />
        <div className="relative z-10 text-center flex flex-col items-center gap-4">
          <div className="text-8xl">🏆</div>
          <h1 className="text-yellow-400 text-4xl font-black drop-shadow-lg">
            {winner ? `${winner} gagne !` : 'Égalité !'}
          </h1>
          {session && (
            <div className="flex gap-10 mt-2">
              <div className="text-center">
                <p className="text-blue-300 text-sm">{session.equipe1_nom}</p>
                <p className="text-white text-4xl font-black">{session.equipe1_score}</p>
              </div>
              <div className="text-center">
                <p className="text-blue-300 text-sm">{session.equipe2_nom}</p>
                <p className="text-white text-4xl font-black">{session.equipe2_score}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Playing phase ──────────────────────────────────────────────────
  return (
    <div className={bg}>
      {/* Score panel */}
      <div className="flex gap-3">
        {[1, 2].map((eq) => (
          <div
            key={eq}
            className={`flex-1 rounded-2xl p-3 text-center border-4 bg-blue-900 transition-all ${
              activeQuestion?.equipe_active === eq
                ? 'border-yellow-400'
                : 'border-blue-700'
            }`}
          >
            <p className="text-yellow-300 font-black text-xs truncate">
              {eq === 1 ? session?.equipe1_nom : session?.equipe2_nom}
            </p>
            <p className="text-white text-4xl font-black leading-none mt-1">
              {eq === 1 ? session?.equipe1_score : session?.equipe2_score}
            </p>
          </div>
        ))}
      </div>

      {!activeQuestion ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-yellow-400 animate-pulse">Chargement de la question…</p>
        </div>
      ) : (
        <>
          {/* Question */}
          <div className="bg-blue-900/60 rounded-2xl px-4 py-3 border border-blue-700">
            <p className="text-yellow-300/70 text-xs font-bold tracking-widest">
              QUESTION {activeQuestion.ordre}/{questions.length}
            </p>
            <p className="text-white font-black text-lg leading-tight mt-1">
              {activeQuestion.question}
            </p>
          </div>

          {/* Équipe active toggle */}
          <div className="flex items-center justify-between bg-blue-800/40 rounded-2xl px-4 py-3 border border-blue-700">
            <div>
              <p className="text-blue-300 text-xs">Équipe active</p>
              <p className="text-yellow-300 font-black text-base">{activeEquipeNom}</p>
            </div>
            <button
              onClick={handleChangerEquipe}
              disabled={saving || activeQuestion.phase === 'vol'}
              className="text-xs text-yellow-400 border border-yellow-400/40 rounded-xl px-3 py-2 hover:bg-yellow-400/10 disabled:opacity-30 transition-colors"
            >
              Changer ↔
            </button>
          </div>

          {/* Answer list */}
          <div className="flex flex-col gap-2">
            {reponses.map((rep) => (
              <div
                key={rep.id}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${
                  rep.revealed
                    ? 'bg-yellow-400/20 border-yellow-400/60'
                    : 'bg-blue-900 border-blue-700'
                }`}
              >
                <span className="text-yellow-400 font-black w-6 text-center flex-shrink-0">
                  {rep.ordre}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-white font-bold">{rep.texte}</span>
                </div>
                {rep.revealed ? (
                  <span className="text-yellow-400 font-black text-lg flex-shrink-0">
                    {rep.points}
                  </span>
                ) : (
                  <button
                    onClick={() => handleReveal(rep)}
                    disabled={saving}
                    className="bg-yellow-400 text-blue-900 font-black text-sm px-4 py-2 rounded-xl hover:bg-yellow-300 disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
                  >
                    Révéler
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Croix / Normal phase */}
          {activeQuestion.phase === 'normal' && (
            <div className="bg-blue-900/60 rounded-2xl px-4 py-3 border border-blue-700 flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-xs mb-1">Mauvaises réponses</p>
                <div className="flex gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-2xl transition-all duration-200 ${
                        i < activeCroix ? 'opacity-100' : 'opacity-20'
                      }`}
                    >
                      ❌
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCroix}
                disabled={saving || activeCroix >= 3}
                className="bg-red-600 text-white font-black px-5 py-3 rounded-2xl text-base hover:bg-red-500 disabled:opacity-40 active:scale-95 transition-all"
              >
                ❌ Croix
              </button>
            </div>
          )}

          {/* Phase de vol */}
          {activeQuestion.phase === 'vol' && !allRevealed && (
            <div className="bg-orange-900/40 border-2 border-orange-400 rounded-2xl p-4">
              <p className="text-orange-300 font-black text-center text-lg mb-1 vol-blink">
                ⚡ Phase de vol — {stealEquipeNom} tente de voler !
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleVolReussi}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-black text-sm hover:bg-green-400 disabled:opacity-40 active:scale-95 transition-all"
                >
                  ✅ Vol réussi
                </button>
                <button
                  onClick={handleVolRate}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-sm hover:bg-red-500 disabled:opacity-40 active:scale-95 transition-all"
                >
                  ❌ Vol raté
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col gap-2">
            {!isLastQuestion && (
              <button
                onClick={handleQuestionSuivante}
                disabled={saving}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-900 font-black text-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shadow-lg"
              >
                {saving ? '⏳' : '➡️ Question suivante'}
              </button>
            )}
            <button
              onClick={handleTerminer}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-slate-900 font-black text-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shadow-lg"
            >
              {saving ? '⏳' : '🏁 Terminer le jeu'}
            </button>
          </div>

          {saving && (
            <p className="text-center text-yellow-400/50 text-xs animate-pulse">
              Mise à jour…
            </p>
          )}
        </>
      )}
    </div>
  );
}
