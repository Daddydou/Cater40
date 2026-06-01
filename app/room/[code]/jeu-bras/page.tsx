'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { ConnectionBanner } from '@/components/ConnectionBanner';

type GamePhase = 'ecrire' | 'deviner' | 'fin';

function parsePhase(currentGame: string | null): GamePhase {
  if (currentGame === 'jeu-bras:deviner') return 'deviner';
  return 'ecrire';
}

const PHASE_INSTRUCTIONS: Record<GamePhase, { emoji: string; titre: string; consigne: string }> = {
  ecrire: {
    emoji: '✍️',
    titre: 'Écris sur ton bras !',
    consigne:
      "Retrousse ta manche et écris un mot ou dessine quelque chose en rapport avec ton métier d'orthophoniste. Personne ne doit voir ce que tu écris !",
  },
  deviner: {
    emoji: '🕵️',
    titre: 'À qui appartient ce bras ?',
    consigne:
      "L'animateur va montrer les bras un à un. Essayez de deviner à qui chaque bras appartient — et ce que ça veut dire !",
  },
  fin: {
    emoji: '🎉',
    titre: 'Bravo !',
    consigne: 'Le jeu est terminé. Retour au lobby…',
  },
};

export default function JeuBrasPage() {
  useWakeLock();
  useHeartbeat();
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    setCurrentPlayerId(localStorage.getItem('playerId'));
  }, []);

  const loadData = useCallback(async () => {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (!roomData) {
      setError('Salle introuvable.');
      setLoading(false);
      return;
    }
    setRoom(roomData as Room);

    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomData.id)
      .order('created_at', { ascending: true });

    setPlayers((playersData as Player[]) ?? []);
    setLoading(false);
  }, [code]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime : mettre à jour la phase, rediriger en fin de jeu
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`jeu-bras-${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          if (updated.status === 'waiting') {
            router.push(`/room/${code}/lobby`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, code, router]);

  const advanceTo = async (nextGame: string | null) => {
    if (!room || advancing) return;
    setAdvancing(true);

    const updates: Partial<Room> = { current_game: nextGame };
    if (nextGame === null) updates.status = 'waiting' as Room['status'];

    await supabase.from('rooms').update(updates).eq('id', room.id);

    if (nextGame === null) {
      router.push(`/room/${code}/lobby`);
    } else {
      setRoom(prev => prev ? { ...prev, current_game: nextGame } : prev);
      setAdvancing(false);
    }
  };

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isAnimateur = currentPlayer?.is_birthday_person ?? false;
  const phase = room ? parsePhase(room.current_game) : 'ecrire';
  const info = PHASE_INSTRUCTIONS[phase];

  const bg = 'min-h-screen flex flex-col items-center bg-gradient-to-br from-pink-900 via-rose-950 to-slate-900 px-4 py-10';

  if (loading) {
    return (
      <div className={`${bg} justify-center`}>
        <p className="text-white text-lg animate-pulse">Chargement du jeu…</p>
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

  return (
    <div className={bg}>
      <ConnectionBanner onReconnect={loadData} />
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-2">🦾</div>
          <h1 className="text-2xl font-extrabold text-white">À qui appartient ce bras ?</h1>
          {currentPlayer && (
            <p className="text-pink-300 text-sm mt-1">{currentPlayer.name}</p>
          )}
        </div>

        {/* Phase card */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
          <div className="text-4xl">{info.emoji}</div>
          <p className="text-white font-bold text-lg">{info.titre}</p>
          <p className="text-pink-200/80 text-sm leading-relaxed">{info.consigne}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
            <span className="text-pink-400 text-xs">En direct</span>
          </div>
        </div>

        {/* Players list */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-4">
          <p className="text-pink-300 text-xs font-bold uppercase tracking-wider mb-3">
            Joueurs ({players.length})
          </p>
          <ul className="flex flex-col gap-2">
            {players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 bg-white/10 rounded-2xl px-3 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white font-semibold text-sm flex-1 truncate">
                  {player.name}
                  {player.id === currentPlayerId && (
                    <span className="text-pink-300 font-normal text-xs ml-1">(toi)</span>
                  )}
                </span>
                {player.is_birthday_person && (
                  <span className="text-lg">🎂</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Animateur controls */}
        {isAnimateur && (
          <div className="flex flex-col gap-3">
            {phase === 'ecrire' && (
              <button
                onClick={() => advanceTo('jeu-bras:deviner')}
                disabled={advancing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
              >
                {advancing ? '⏳…' : '🕵️ Passer à la phase devinement'}
              </button>
            )}
            {phase === 'deviner' && (
              <button
                onClick={() => advanceTo(null)}
                disabled={advancing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
              >
                {advancing ? '⏳…' : '✅ Terminer le jeu'}
              </button>
            )}
          </div>
        )}

        {/* Non-animateur : message d'attente si phase de transition */}
        {!isAnimateur && phase === 'ecrire' && (
          <p className="text-center text-pink-300/70 text-sm">
            Écris sur ton bras, puis attends le signal de l'animateur 🎂
          </p>
        )}
      </div>
    </div>
  );
}
