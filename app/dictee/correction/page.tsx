'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const ROOM_CODE = 'dictee'
import { Player, Room } from '@/types';

interface DotFaute {
  x: number; // % de la largeur de l'image
  y: number; // % de la hauteur de l'image
}

interface DicteeCopy {
  id: string;
  session_id: string;
  player_id: string;
  image_url: string | null;
  fautes_finales: DotFaute[];
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
  const code = ROOM_CODE;
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<DicteeSession | null>(null);
  const [copies, setCopies] = useState<DicteeCopy[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dots, setDots] = useState<DotFaute[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const imgRef = useRef<HTMLDivElement>(null);

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
      .in('status', ['uploaded', 'analyzed', 'corrected']);

    setCopies((copiesData as DicteeCopy[]) ?? []);

    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id);

    setPlayers((playersData as Player[]) ?? []);
    setLoading(false);
  }, [room]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset dots quand on change de copie
  useEffect(() => {
    setDots([]);
  }, [currentIndex]);

  const currentCopy = copies[currentIndex];
  const currentPlayer = players.find(p => p.id === currentCopy?.player_id);
  const score = 20 - dots.length;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setDots(prev => [...prev, { x, y }]);
  };

  const handleUndo = () => {
    setDots(prev => prev.slice(0, -1));
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
    await supabase.from('rooms').update({ current_game: 'dictee:classement:0' }).eq('id', room.id);

    router.push(`/dictee/classement?a=1`);
  }, [room, session, code, router]);

  const handleValiderCopie = async () => {
    if (!currentCopy || saving) return;
    setSaving(true);

    const score = 20 - dots.length;

    await supabase.from('dictee_copies').update({
      fautes_finales: dots,
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

  const bg = 'min-h-screen bg-gradient-to-br from-blue-900 via-teal-950 to-green-900 px-4 py-6';

  if (loading) return (
    <div className={`${bg} flex items-center justify-center`}>
      <p className="text-white text-lg animate-pulse">Chargement des copies…</p>
    </div>
  );

  if (error) return (
    <div className={`${bg} flex items-center justify-center`}>
      <p className="text-red-400 text-lg text-center px-4">{error}</p>
    </div>
  );

  if (copies.length === 0) return (
    <div className={`${bg} flex flex-col items-center justify-center gap-4`}>
      <p className="text-white text-lg">Aucune copie à corriger.</p>
      <button
        onClick={() => router.push(`/dictee/classement?a=1`)}
        className="px-6 py-3 rounded-2xl bg-teal-500 text-white font-bold hover:scale-105 transition-all"
      >
        Aller au classement
      </button>
    </div>
  );

  return (
    <div className={`${bg} flex flex-col items-center`}>
      <div className="w-full max-w-lg flex flex-col gap-4 pb-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white">✍️ Correction</h1>
          <p className="text-teal-300 text-sm mt-1">
            Copie {currentIndex + 1} / {copies.length} — <span className="font-bold text-white">{currentPlayer?.name ?? '?'}</span>
          </p>
        </div>

        {/* Score */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-teal-300 text-xs font-bold uppercase tracking-wider">Score</p>
            <p className={`font-black text-4xl leading-none mt-1 ${score < 0 ? 'text-red-400' : 'text-white'}`}>
              {score}
              <span className="text-white/40 text-xl">/20</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-red-400 text-sm font-semibold">
              {dots.length} faute{dots.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={handleUndo}
              disabled={dots.length === 0}
              className="mt-1 text-xs text-white/40 hover:text-white/70 disabled:opacity-20 transition-colors underline"
            >
              ↩ Annuler le dernier
            </button>
          </div>
        </div>

        {/* Instruction */}
        <p className="text-center text-white/50 text-xs">
          👆 Tape sur la photo à l&apos;endroit de chaque faute
        </p>

        {/* Photo interactive */}
        {currentCopy?.image_url && (
          <div
            ref={imgRef}
            className="relative w-full rounded-2xl overflow-hidden cursor-crosshair select-none"
            style={{ touchAction: 'none' }}
            onClick={handleImageClick}
            onTouchStart={handleImageClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPublicImageUrl(currentCopy.image_url)}
              alt="Copie du joueur"
              className="w-full h-auto block pointer-events-none"
              draggable={false}
            />
            {/* Ronds rouges */}
            {dots.map((dot, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: `${dot.x}%`,
                  top: `${dot.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-4 h-4 rounded-full bg-red-500/40 border border-red-500 shadow-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Texte original */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <p className="text-teal-300 text-xs font-bold uppercase tracking-wider mb-2">Texte original</p>
          <p className="text-white/80 text-sm leading-relaxed italic">&ldquo;{session?.texte_original}&rdquo;</p>
        </div>

        {/* Valider */}
        <button
          onClick={handleValiderCopie}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
        >
          {saving
            ? '⏳…'
            : currentIndex < copies.length - 1
            ? `✅ Valider — copie suivante (${currentIndex + 2}/${copies.length})`
            : '🏆 Valider et lancer le classement'}
        </button>

      </div>
    </div>
  );
}
