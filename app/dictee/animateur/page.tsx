'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';

const ROOM_CODE = 'dictee'

const TEXTE_DICTEE =
  "Les orthophonistes travaillent quotidiennement avec des patients qui présentent des troubles du langage. Ils évaluent, diagnostiquent et traitent ces difficultés avec patience et bienveillance. Chaque séance est une opportunité de progresser ensemble vers une meilleure communication.";

interface DicteeSession {
  id: string;
  room_id: string;
  texte_original: string;
  status: 'waiting' | 'writing' | 'uploading' | 'correcting' | 'finished';
}

interface DicteeCopy {
  id: string;
  session_id: string;
  player_id: string;
  image_url: string | null;
  status: 'pending' | 'uploaded' | 'analyzed' | 'corrected';
}

type Phase = 'loading' | 'locked' | 'ready' | 'done';

export default function DicteeAnimateurPage() {
  const code = ROOM_CODE;
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<DicteeSession | null>(null);
  const [copies, setCopies] = useState<DicteeCopy[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    supabase.from('rooms').select('*').eq('code', code).single().then(({ data }) => {
      if (!data) setError('Salle introuvable.');
      else setRoom(data as Room);
      setPhase('locked');
    });
  }, [code]);

  const loadPlayers = useCallback(async () => {
    if (!room) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id);
    setPlayers((data as Player[]) ?? []);
  }, [room]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`dictee-anim-players-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        () => loadPlayers()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [room, loadPlayers]);

  const loadCopies = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('dictee_copies')
      .select('*')
      .eq('session_id', session.id);
    setCopies((data as DicteeCopy[]) ?? []);
  }, [session]);

  useEffect(() => { loadCopies(); }, [loadCopies]);

  useEffect(() => {
    if (!room || !session) return;

    const channel = supabase
      .channel(`dictee-anim-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dictee_copies', filter: `session_id=eq.${session.id}` },
        () => loadCopies()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, session, loadCopies]);

  const handleEnterAnimateur = async () => {
    if (!room) return;
    setPhase('loading');

    const { data: existing, error: fetchErr } = await supabase
      .from('dictee_sessions')
      .select('*')
      .eq('room_id', room.id)
      .maybeSingle();

    if (fetchErr) {
      setError('Impossible de charger la session. Vérifiez le schéma SQL.');
      setPhase('locked');
      return;
    }

    let activeSession: DicteeSession;

    if (existing) {
      activeSession = existing as DicteeSession;
      setSession(activeSession);
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('dictee_sessions')
        .insert({ room_id: room.id, texte_original: TEXTE_DICTEE, status: 'waiting' })
        .select()
        .single();

      if (insertErr || !created) {
        setError('Impossible de créer la session. Vérifiez le schéma SQL.');
        setPhase('locked');
        return;
      }
      activeSession = created as DicteeSession;
      setSession(activeSession);
    }

    // Charger les copies directement avec la session qu'on vient d'obtenir,
    // sans attendre le cycle de render du useEffect.
    const { data: initialCopies } = await supabase
      .from('dictee_copies')
      .select('*')
      .eq('session_id', activeSession.id);
    setCopies((initialCopies as DicteeCopy[]) ?? []);

    setPhase('ready');
  };

  const updateSessionStatus = async (status: DicteeSession['status']): Promise<boolean> => {
    if (!session) return false;
    setStatusError('');
    const { error: updateErr } = await supabase
      .from('dictee_sessions')
      .update({ status })
      .eq('id', session.id);
    if (updateErr) {
      setStatusError(`Impossible de mettre à jour le statut : ${updateErr.message}`);
      return false;
    }
    setSession(prev => prev ? { ...prev, status } : prev);
    return true;
  };

  const handleLancerDictee = async () => {
    if (!session || saving) return;
    setSaving(true);
    await updateSessionStatus('writing');
    setSaving(false);
  };

  const handleLancerUpload = async () => {
    if (!session || saving) return;
    setSaving(true);
    await updateSessionStatus('uploading');
    setSaving(false);
  };

  const handleLancerCorrection = async () => {
    if (!session || saving) return;
    setSaving(true);
    await updateSessionStatus('correcting');
    setSaving(false);
    router.push(`/dictee/correction`);
  };

  const handleReset = async () => {
    if (!room) return;
    setResetting(true);
    setConfirmReset(false);

    if (session) {
      await supabase.from('dictee_copies').delete().eq('session_id', session.id);
      await supabase.from('dictee_sessions').delete().eq('id', session.id);
    }
    await supabase.from('players').delete().eq('room_id', room.id);
    await supabase.from('rooms').update({ current_game: null }).eq('id', room.id);

    setSession(null);
    setCopies([]);
    setPlayers([]);
    setResetting(false);
    setPhase('locked');
  };

  const uploadedCount = copies.filter(c => c.status !== 'pending').length;
  const sessionStatus = session?.status ?? 'waiting';

  const bg = 'min-h-screen bg-gradient-to-br from-blue-900 via-teal-950 to-green-900 px-4 py-10';

  if (phase === 'loading') {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-white text-lg animate-pulse">Chargement…</p>
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

  if (phase === 'locked') {
    return (
      <div className={`${bg} flex flex-col items-center justify-center gap-6`}>
        <div className="text-center">
          <div className="text-6xl mb-4">✍️</div>
          <h1 className="text-3xl font-extrabold text-white mb-2">La Dictée</h1>
          <p className="text-teal-300">Interface animateur</p>
        </div>
        <button
          onClick={handleEnterAnimateur}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-xl hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
        >
          ✍️ Mode animateur
        </button>
      </div>
    );
  }

  return (
    <div className={`${bg} flex flex-col items-center`}>
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">✍️</div>
          <h1 className="text-2xl font-extrabold text-white">Animateur — Dictée</h1>
          <p className="text-teal-300 text-sm">
            {players.length} joueur{players.length !== 1 ? 's' : ''} connecté{players.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Status */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-pulse flex-shrink-0" />
          <div>
            <p className="text-white font-semibold text-sm">Statut</p>
            <p className="text-teal-300 text-xs">
              {sessionStatus === 'waiting' && '⏳ En attente du lancement'}
              {sessionStatus === 'writing' && '📝 Dictée en cours'}
              {sessionStatus === 'uploading' && '📸 Remise des copies'}
              {sessionStatus === 'correcting' && '✍️ Correction en cours'}
              {sessionStatus === 'finished' && '✅ Terminé'}
            </p>
          </div>
        </div>

        {/* Texte de la dictée */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <p className="text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">
            Texte de la dictée
          </p>
          <p className="text-white/80 text-sm leading-relaxed italic">
            &ldquo;{session?.texte_original ?? TEXTE_DICTEE}&rdquo;
          </p>
        </div>

        {/* Copies counter */}
        {sessionStatus === 'uploading' && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-4 text-center">
            <p className="text-white font-semibold text-lg">
              📬 {uploadedCount} / {players.length} copies reçues
            </p>
            <div className="mt-2 w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${players.length ? (uploadedCount / players.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Inline status error */}
        {statusError && (
          <div className="bg-red-500/20 border border-red-400/40 rounded-2xl px-4 py-3 text-center">
            <p className="text-red-300 text-sm">{statusError}</p>
            <button
              onClick={() => setStatusError('')}
              className="text-red-400/70 hover:text-red-300 text-xs mt-1 underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Action buttons */}
        {sessionStatus === 'waiting' && (
          <button
            onClick={handleLancerDictee}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
          >
            {saving ? '⏳…' : '▶ Lancer la dictée'}
          </button>
        )}

        {sessionStatus === 'writing' && (
          <button
            onClick={handleLancerUpload}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
          >
            {saving ? '⏳…' : '📸 Passer à la remise des copies'}
          </button>
        )}

        {sessionStatus === 'uploading' && (
          <button
            onClick={handleLancerCorrection}
            disabled={saving || uploadedCount === 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black text-base disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
          >
            {saving ? '⏳…' : '✍️ Lancer la correction'}
          </button>
        )}

        {/* Nouvelle partie */}
        <div className="pt-4 border-t border-white/10">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={resetting}
              className="w-full py-3 rounded-2xl border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              🗑️ Nouvelle partie
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-center text-white/70 text-sm">Effacer tous les joueurs et recommencer ?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-black text-sm disabled:opacity-40 transition-colors"
                >
                  {resetting ? '⏳…' : '✅ Confirmer'}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
