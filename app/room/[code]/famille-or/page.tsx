'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Room } from '@/types';
import { Confetti } from '@/components/Confetti';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { ConnectionBanner } from '@/components/ConnectionBanner';

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

export default function FamilleOrPage() {
  useWakeLock();
  useHeartbeat();
  const { code } = useParams<{ code: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<FamilleOrSession | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<FamilleOrQuestion | null>(null);
  const [reponses, setReponses] = useState<FamilleOrReponse[]>([]);
  const [loading, setLoading] = useState(true);

  const activeQuestionIdRef = useRef<string | null>(null);

  const loadReponses = useCallback(async (questionId: string) => {
    const { data } = await supabase
      .from('famille_or_reponses')
      .select('*')
      .eq('question_id', questionId)
      .order('ordre');
    setReponses((data as FamilleOrReponse[]) ?? []);
  }, []);

  const loadActiveQuestion = useCallback(
    async (questionId: string) => {
      const { data } = await supabase
        .from('famille_or_questions')
        .select('*')
        .eq('id', questionId)
        .single();
      if (data) {
        const q = data as FamilleOrQuestion;
        setActiveQuestion(q);
        activeQuestionIdRef.current = q.id;
        await loadReponses(q.id);
      }
    },
    [loadReponses]
  );

  const loadSession = useCallback(
    async (roomId: string) => {
      const { data } = await supabase
        .from('famille_or_sessions')
        .select('*')
        .eq('room_id', roomId)
        .single();
      if (data) {
        const s = data as FamilleOrSession;
        setSession(s);
        if (s.question_active_id) {
          await loadActiveQuestion(s.question_active_id);
        }
      }
    },
    [loadActiveQuestion]
  );

  // Initial room load
  useEffect(() => {
    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data }) => {
        if (data) setRoom(data as Room);
        setLoading(false);
      });
  }, [code]);

  useEffect(() => {
    if (!room) return;
    loadSession(room.id);
  }, [room, loadSession]);

  // When session.question_active_id changes, reload active question
  useEffect(() => {
    if (!session?.question_active_id) return;
    if (session.question_active_id !== activeQuestionIdRef.current) {
      setReponses([]);
      loadActiveQuestion(session.question_active_id);
    }
  }, [session?.question_active_id, loadActiveQuestion]);

  // Realtime subscriptions
  useEffect(() => {
    if (!room || !session) return;

    const channel = supabase
      .channel(`fo-spectator-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'famille_or_sessions',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          setSession(payload.new as FamilleOrSession);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'famille_or_questions',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as FamilleOrQuestion;
          if (updated.id === activeQuestionIdRef.current) {
            setActiveQuestion(updated);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'famille_or_reponses' },
        () => {
          const qId = activeQuestionIdRef.current;
          if (qId) loadReponses(qId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, session, loadReponses]);

  const bg = 'min-h-screen bg-[#1a237e] px-4 py-6 flex flex-col';

  if (loading) {
    return (
      <div className={`${bg} items-center justify-center`}>
        <p className="text-yellow-400 text-lg animate-pulse">Connexion…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`${bg} items-center justify-center`}>
        <div className="text-center">
          <div className="text-6xl mb-4">🥇</div>
          <p className="text-white text-xl font-bold">Famille en Or</p>
          <p className="text-yellow-400 text-sm mt-2 animate-pulse">
            En attente du démarrage…
          </p>
        </div>
      </div>
    );
  }

  const isFinished = session.status === 'finished';
  const winner =
    session.equipe1_score > session.equipe2_score
      ? session.equipe1_nom
      : session.equipe2_score > session.equipe1_score
      ? session.equipe2_nom
      : null;

  const activeCroix = activeQuestion
    ? activeQuestion.equipe_active === 1
      ? activeQuestion.croix_equipe1
      : activeQuestion.croix_equipe2
    : 0;

  return (
    <div className={bg}>
      <ConnectionBanner onReconnect={() => { if (room) loadSession(room.id); }} />
      {isFinished && <Confetti />}

      {/* Scores */}
      <div className="flex gap-3 mb-5">
        {[1, 2].map((eq) => (
          <div
            key={eq}
            className={`flex-1 rounded-2xl p-4 text-center border-4 bg-blue-900 transition-all duration-500 ${
              !isFinished && activeQuestion?.equipe_active === eq
                ? 'border-yellow-400 shadow-lg shadow-yellow-400/20'
                : 'border-blue-700'
            }`}
          >
            <p className="text-yellow-300 font-black text-sm truncate">
              {eq === 1 ? session.equipe1_nom : session.equipe2_nom}
            </p>
            <p className="text-white text-5xl font-black leading-none mt-1">
              {eq === 1 ? session.equipe1_score : session.equipe2_score}
            </p>
          </div>
        ))}
      </div>

      {/* Finished screen */}
      {isFinished ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 relative z-10">
          <div className="text-8xl">🏆</div>
          <h1 className="text-yellow-400 text-4xl font-black text-center drop-shadow-lg">
            {winner ? `${winner} gagne !` : 'Égalité !'}
          </h1>
          <div className="flex gap-10">
            <div className="text-center">
              <p className="text-blue-300 text-sm">{session.equipe1_nom}</p>
              <p className="text-white text-4xl font-black">{session.equipe1_score}</p>
            </div>
            <div className="text-center">
              <p className="text-blue-300 text-sm">{session.equipe2_nom}</p>
              <p className="text-white text-4xl font-black">{session.equipe2_score}</p>
            </div>
          </div>
        </div>
      ) : !activeQuestion ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-yellow-400 text-xl animate-pulse text-center">
            En attente de la prochaine question…
          </p>
        </div>
      ) : (
        <>
          {/* VOL banner */}
          {activeQuestion.phase === 'vol' && (
            <div className="vol-blink bg-red-600 rounded-2xl py-3 mb-4 text-center border-4 border-red-400">
              <p className="text-white text-3xl font-black tracking-widest">⚡ TENTATIVE DE VOL !</p>
            </div>
          )}

          {/* Question */}
          <div className="bg-blue-800 rounded-2xl p-4 mb-4 border-2 border-yellow-400/50">
            <p className="text-yellow-400/70 text-xs font-bold mb-1 tracking-widest">QUESTION</p>
            <p className="text-white text-xl font-black leading-tight">
              {activeQuestion.question}
            </p>
          </div>

          {/* Answer cards with flip animation */}
          <div className="flex flex-col gap-3 mb-4">
            {Array.from({ length: reponses.length || 6 }).map((_, i) => {
              const rep = reponses.find((r) => r.ordre === i + 1);
              const revealed = rep?.revealed ?? false;
              return (
                <div key={i} className="h-14 fo-card-wrap">
                  <div className={`fo-card-inner ${revealed ? 'revealed' : ''}`}>
                    {/* Front: hidden */}
                    <div className="fo-card-front bg-[#0d1a6e] border-2 border-yellow-500/60 rounded-xl flex items-center px-4 gap-3">
                      <span className="text-yellow-500 text-lg font-black w-5">{i + 1}</span>
                      <span className="text-yellow-500/40 text-xl tracking-[0.3em] flex-1">
                        █ █ █ █ █ █
                      </span>
                    </div>
                    {/* Back: revealed */}
                    <div className="fo-card-back bg-yellow-400 border-2 border-yellow-600 rounded-xl flex items-center justify-between px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-900 text-lg font-black w-5">{i + 1}</span>
                        <span className="text-blue-900 font-black text-base">{rep?.texte ?? ''}</span>
                      </div>
                      <span className="text-blue-900 font-black text-2xl">{rep?.points ?? ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Crosses */}
          <div className="flex justify-center gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`text-4xl transition-all duration-300 ${
                  i < activeCroix ? 'opacity-100 scale-110' : 'opacity-15'
                }`}
              >
                ❌
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
