'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { ConnectionBanner } from '@/components/ConnectionBanner';

const TEXTE_PHRASES = [
  'Les orthophonistes travaillent quotidiennement avec des patients qui présentent des troubles du langage.',
  'Ils évaluent, diagnostiquent et traitent ces difficultés avec patience et bienveillance.',
  'Chaque séance est une opportunité de progresser ensemble vers une meilleure communication.',
];

interface DicteeSession {
  id: string;
  room_id: string;
  texte_original: string;
  status: 'waiting' | 'writing' | 'uploading' | 'correcting' | 'finished';
}

export default function DicteePage() {
  useWakeLock();
  useHeartbeat();
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<DicteeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('rooms').select('*').eq('code', code).single().then(({ data }) => {
      if (data) setRoom(data as Room);
      else setError('Salle introuvable.');
      setLoading(false);
    });
  }, [code]);

  useEffect(() => {
    if (!room) return;
    const playerId = localStorage.getItem('playerId');
    if (!playerId) return;
    supabase.from('players').select('*').eq('id', playerId).single().then(({ data }) => {
      if (data) setCurrentPlayer(data as Player);
    });
  }, [room]);

  const loadSession = useCallback(async () => {
    if (!room) return;
    const { data } = await supabase
      .from('dictee_sessions')
      .select('*')
      .eq('room_id', room.id)
      .maybeSingle();
    if (data) setSession(data as DicteeSession);
  }, [room]);

  useEffect(() => { loadSession(); }, [loadSession]);

  useEffect(() => {
    if (!session || !currentPlayer) return;
    supabase
      .from('dictee_copies')
      .select('id, status')
      .eq('session_id', session.id)
      .eq('player_id', currentPlayer.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.status !== 'pending') setUploaded(true);
      });
  }, [session, currentPlayer]);

  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`dictee-player-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dictee_sessions', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as DicteeSession;
          setSession(updated);
          if (updated.status === 'finished') {
            router.push(`/room/${code}/dictee/classement`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room;
          if (updated.current_game?.startsWith('dictee:classement')) {
            router.push(`/room/${code}/dictee/classement`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, code, router]);

  const handleUpload = async (file: File) => {
    if (!session || !currentPlayer || uploading) return;
    setUploading(true);
    setUploadError('');

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${session.id}/${currentPlayer.id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('dictee-copies')
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('dictee-copies').getPublicUrl(path);

      const { data: existing } = await supabase
        .from('dictee_copies')
        .select('id')
        .eq('session_id', session.id)
        .eq('player_id', currentPlayer.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('dictee_copies').update({
          image_url: urlData.publicUrl,
          status: 'uploaded',
        }).eq('id', existing.id);
      } else {
        await supabase.from('dictee_copies').insert({
          session_id: session.id,
          player_id: currentPlayer.id,
          image_url: urlData.publicUrl,
          status: 'uploaded',
        });
      }

      setUploaded(true);
    } catch {
      setUploadError("Erreur lors de l'envoi. Réessaye.");
    } finally {
      setUploading(false);
    }
  };

  const bg = 'min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-900 via-teal-950 to-green-900 px-4 py-10';

  if (loading) {
    return (
      <div className={`${bg} justify-center`}>
        <p className="text-white text-lg animate-pulse">Connexion à la dictée…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${bg} justify-center`}>
        <p className="text-red-400 text-lg text-center px-4">{error}</p>
      </div>
    );
  }

  const status = session?.status ?? 'waiting';
  const phrases = session?.texte_original
    ? session.texte_original.split(/(?<=\.)\s+/)
    : TEXTE_PHRASES;

  return (
    <div className={bg}>
      <ConnectionBanner onReconnect={loadSession} />
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-2">✍️</div>
          <h1 className="text-2xl font-extrabold text-white">La Dictée</h1>
          {currentPlayer && (
            <p className="text-teal-300 text-sm mt-1">{currentPlayer.name}</p>
          )}
        </div>

        {/* Waiting */}
        {status === 'waiting' && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-white font-semibold text-lg">
              En attente du lancement de la dictée…
            </p>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-teal-400 text-xs">En direct</span>
            </div>
          </div>
        )}

        {/* Writing — show text phrase by phrase */}
        {status === 'writing' && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 flex flex-col gap-4">
            <p className="text-teal-300 text-xs font-bold uppercase tracking-wider text-center">
              Texte à recopier sur papier
            </p>
            <div className="flex flex-col gap-3">
              {phrases.map((phrase, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-teal-400 font-bold text-sm flex-shrink-0 mt-0.5">
                    {i + 1}.
                  </span>
                  <p className="text-white text-sm leading-relaxed">{phrase}</p>
                </div>
              ))}
            </div>
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-3 text-center mt-2">
              <p className="text-yellow-300 text-sm">
                📝 Recopie ce texte sur papier
              </p>
              <p className="text-yellow-300/70 text-xs mt-1">
                L&apos;animateur te demandera de prendre une photo ensuite
              </p>
            </div>
          </div>
        )}

        {/* Uploading — take photo */}
        {status === 'uploading' && !uploaded && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 flex flex-col gap-4">
            <div className="text-center">
              <div className="text-4xl mb-2">📸</div>
              <p className="text-white font-bold text-lg">Envoie ta copie !</p>
              <p className="text-teal-300 text-sm mt-1">
                Prends une photo de ton texte manuscrit
              </p>
            </div>
            {uploadError && (
              <p className="text-red-400 text-sm text-center">{uploadError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
            >
              {uploading ? '⏳ Envoi en cours…' : '📷 Prendre / choisir une photo'}
            </button>
          </div>
        )}

        {/* Uploading — already sent */}
        {status === 'uploading' && uploaded && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white font-bold text-lg">Photo envoyée !</p>
            <p className="text-teal-300 text-sm mt-2">En attente des autres joueurs…</p>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-teal-400 text-xs">En direct</span>
            </div>
          </div>
        )}

        {/* Correcting */}
        {status === 'correcting' && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-white font-bold text-lg">Correction en cours…</p>
            <p className="text-teal-300 text-sm mt-2">L&apos;IA analyse vos copies ⏳</p>
            <div className="flex items-center gap-2 mt-4 justify-center">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-teal-400 text-xs">En direct</span>
            </div>
          </div>
        )}

        {/* Finished */}
        {status === 'finished' && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-white font-bold text-lg">Dictée terminée !</p>
            <p className="text-teal-300 text-sm mt-2">Redirection vers le classement…</p>
          </div>
        )}

      </div>
    </div>
  );
}
