'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';

interface Faute {
  mot_incorrect: string;
  mot_correct: string;
  certitude: 'rouge' | 'jaune';
}

interface FauteUI extends Faute {
  confirmed: boolean;
}

interface DicteeCopy {
  id: string;
  session_id: string;
  player_id: string;
  image_url: string | null;
  texte_ocr: string | null;
  fautes_ia: Faute[];
  fautes_finales: Faute[];
  score: number;
  status: string;
}

interface DicteeSession {
  id: string;
  room_id: string;
  texte_original: string;
  status: string;
}

function getPublicImageUrl(storedUrl: string): string {
  const marker = '/storage/v1/object/public/dictee-copies/';
  const idx = storedUrl.indexOf(marker);
  if (idx === -1) return storedUrl;
  const path = storedUrl.slice(idx + marker.length);
  const { data } = supabase.storage.from('dictee-copies').getPublicUrl(path);
  return data.publicUrl;
}

export default function CorrectionPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<DicteeSession | null>(null);
  const [copies, setCopies] = useState<DicteeCopy[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fautes, setFautes] = useState<FauteUI[]>([]);
  const [newFaute, setNewFaute] = useState({ mot_incorrect: '', mot_correct: '' });
  const [showAddFaute, setShowAddFaute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('rooms').select('*').eq('code', code).single().then(({ data }) => {
      if (data) setRoom(data as Room);
      else setError('Salle introuvable.');
    });
  }, [code]);

  const loadData = useCallback(async () => {
    if (!room) return;

    const { data: sessionData } = await supabase
      .from('dictee_sessions')
      .select('*')
      .eq('room_id', room.id)
      .maybeSingle();

    if (!sessionData) { setLoading(false); return; }
    setSession(sessionData as DicteeSession);

    const { data: copiesData } = await supabase
      .from('dictee_copies')
      .select('*')
      .eq('session_id', sessionData.id)
      .in('status', ['analyzed', 'corrected']);

    setCopies((copiesData as DicteeCopy[]) ?? []);

    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id);

    setPlayers((playersData as Player[]) ?? []);
    setLoading(false);
  }, [room]);

  useEffect(() => { loadData(); }, [loadData]);

  // Init fautes when copy changes
  useEffect(() => {
    if (copies.length === 0) return;
    const copy = copies[currentIndex];
    if (!copy) return;
    const fautesIa = (copy.fautes_ia ?? []) as Faute[];
    setFautes(fautesIa.map(f => ({ ...f, confirmed: true })));
    setShowAddFaute(false);
    setNewFaute({ mot_incorrect: '', mot_correct: '' });
  }, [copies, currentIndex]);

  const currentCopy = copies[currentIndex];
  const currentPlayer = players.find(p => p.id === currentCopy?.player_id);
  const confirmedCount = fautes.filter(f => f.confirmed).length;
  const currentScore = Math.max(0, 20 - confirmedCount);

  const setFauteConfirmed = (index: number, value: boolean) => {
    setFautes(prev => prev.map((f, i) => i === index ? { ...f, confirmed: value } : f));
  };

  const handleAddFaute = () => {
    if (!newFaute.mot_incorrect.trim() || !newFaute.mot_correct.trim()) return;
    setFautes(prev => [
      ...prev,
      {
        mot_incorrect: newFaute.mot_incorrect.trim(),
        mot_correct: newFaute.mot_correct.trim(),
        certitude: 'rouge',
        confirmed: true,
      },
    ]);
    setNewFaute({ mot_incorrect: '', mot_correct: '' });
    setShowAddFaute(false);
  };

  const handleLancerClassement = useCallback(async () => {
    if (!room || !session) return;

    const { data: finalCopies } = await supabase
      .from('dictee_copies')
      .select('*')
      .eq('session_id', session.id)
      .eq('status', 'corrected');

    for (const copy of (finalCopies as DicteeCopy[]) ?? []) {
      await supabase.from('players').update({ score: copy.score }).eq('id', copy.player_id);
    }

    await supabase.from('dictee_sessions').update({ status: 'finished' }).eq('id', session.id);
    await supabase
      .from('rooms')
      .update({ current_game: 'dictee:classement:0' })
      .eq('id', room.id);

    router.push(`/room/${code}/dictee/classement?a=1`);
  }, [room, session, code, router]);

  const handleValiderCopie = async () => {
    if (!currentCopy || saving) return;
    setSaving(true);

    const fautesConfirmees = fautes
      .filter(f => f.confirmed)
      .map(({ mot_incorrect, mot_correct, certitude }) => ({ mot_incorrect, mot_correct, certitude }));
    const score = Math.max(0, 20 - fautesConfirmees.length);

    await supabase.from('dictee_copies').update({
      fautes_finales: fautesConfirmees,
      score,
      status: 'corrected',
    }).eq('id', currentCopy.id);

    if (currentIndex < copies.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSaving(false);
    } else {
      await handleLancerClassement();
      setSaving(false);
    }
  };

  const bg = 'min-h-screen bg-gradient-to-br from-blue-900 via-teal-950 to-green-900 px-4 py-10';

  if (loading) {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-white text-lg animate-pulse">Chargement des copies…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-red-400 text-lg text-center px-4">{error}</p>
      </div>
    );
  }

  if (copies.length === 0) {
    return (
      <div className={`${bg} flex flex-col items-center justify-center gap-4`}>
        <p className="text-white text-lg">Aucune copie à corriger.</p>
        <button
          onClick={() => router.push(`/room/${code}/dictee/classement?a=1`)}
          className="px-6 py-3 rounded-2xl bg-teal-500 text-white font-bold hover:scale-105 transition-all"
        >
          Aller au classement
        </button>
      </div>
    );
  }

  return (
    <div className={`${bg} flex flex-col items-center`}>
      <div className="w-full max-w-lg flex flex-col gap-5 pb-8">

        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🔍</div>
          <h1 className="text-2xl font-extrabold text-white">Correction</h1>
          <p className="text-teal-300 text-sm">
            Copie {currentIndex + 1} / {copies.length} — {currentPlayer?.name ?? '?'}
          </p>
        </div>

        {/* Score en temps réel */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-teal-300 text-xs font-bold uppercase tracking-wider">Score</p>
            <p className="text-white font-black text-4xl leading-none mt-1">
              {currentScore}
              <span className="text-white/40 text-xl">/20</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-red-400 text-sm font-semibold">
              {confirmedCount} faute{confirmedCount !== 1 ? 's' : ''}
            </p>
            <p className="text-white/40 text-xs">confirmée{confirmedCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Photo de la copie */}
        {currentCopy?.image_url && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden">
            <p className="text-teal-300 text-xs font-bold uppercase tracking-wider p-3 pb-2">
              Copie du joueur
            </p>
            <div className="relative w-full h-72">
              <Image
                src={getPublicImageUrl(currentCopy.image_url)}
                alt="Copie du joueur"
                fill
                sizes="(max-width: 512px) 100vw, 512px"
                className="object-contain"
              />
            </div>
          </div>
        )}

        {/* Texte original */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <p className="text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
            Texte original
          </p>
          <p className="text-white/80 text-sm leading-relaxed italic">
            &ldquo;{session?.texte_original}&rdquo;
          </p>
        </div>

        {/* Texte OCR */}
        {currentCopy?.texte_ocr && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
            <p className="text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
              Texte transcrit (IA)
            </p>
            <p className="text-white/70 text-sm leading-relaxed">{currentCopy.texte_ocr}</p>
          </div>
        )}

        {/* Fautes */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-teal-300 text-xs font-bold uppercase tracking-wider">
              Fautes détectées
            </p>
            <span className="bg-white/10 text-white/50 text-xs px-2 py-0.5 rounded-full">
              {fautes.length} faute{fautes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {fautes.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-3">
              Aucune faute détectée 🎉
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {fautes.map((faute, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                    faute.confirmed
                      ? faute.certitude === 'rouge'
                        ? 'bg-red-500/20 border-red-400/40'
                        : 'bg-yellow-500/20 border-yellow-400/40'
                      : 'bg-white/5 border-white/10 opacity-40'
                  }`}
                >
                  <span className="text-base flex-shrink-0">
                    {faute.confirmed
                      ? faute.certitude === 'rouge' ? '🔴' : '🟡'
                      : '⚪'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="line-through text-red-300">{faute.mot_incorrect}</span>
                      <span className="text-white/30 mx-1.5">→</span>
                      <span className="text-green-300 font-medium">{faute.mot_correct}</span>
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setFauteConfirmed(i, true)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                        faute.confirmed
                          ? 'bg-green-500/50 ring-2 ring-green-400'
                          : 'bg-white/10 hover:bg-green-500/30'
                      }`}
                      title="Confirmer la faute"
                    >✅</button>
                    <button
                      onClick={() => setFauteConfirmed(i, false)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                        !faute.confirmed
                          ? 'bg-red-500/50 ring-2 ring-red-400'
                          : 'bg-white/10 hover:bg-red-500/30'
                      }`}
                      title="Annuler la faute"
                    >❌</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add manual faute */}
          {!showAddFaute ? (
            <button
              onClick={() => setShowAddFaute(true)}
              className="mt-3 w-full py-2 rounded-xl border border-dashed border-white/30 text-white/40 hover:text-white/70 hover:border-white/50 text-sm transition-colors"
            >
              ➕ Ajouter une faute manuellement
            </button>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="text"
                value={newFaute.mot_incorrect}
                onChange={e => setNewFaute(prev => ({ ...prev, mot_incorrect: e.target.value }))}
                placeholder="Mot incorrect…"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-400"
              />
              <input
                type="text"
                value={newFaute.mot_correct}
                onChange={e => setNewFaute(prev => ({ ...prev, mot_correct: e.target.value }))}
                placeholder="Correction…"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddFaute}
                  className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm transition-colors"
                >
                  Ajouter
                </button>
                <button
                  onClick={() => {
                    setShowAddFaute(false);
                    setNewFaute({ mot_incorrect: '', mot_correct: '' });
                  }}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 text-sm transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Valider button */}
        <button
          onClick={handleValiderCopie}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
        >
          {saving
            ? '⏳…'
            : currentIndex < copies.length - 1
            ? `✅ Valider et copie suivante (${currentIndex + 2}/${copies.length})`
            : '🏆 Valider et lancer le classement'}
        </button>

      </div>
    </div>
  );
}
