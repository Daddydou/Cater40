'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Room } from '@/types';
import { Countdown } from '@/components/Countdown';
import { usePlayerPresence } from '@/lib/hooks/usePlayerPresence';

const AVATAR_PALETTE = [
  ['#f43f5e', '#e11d48'],
  ['#f97316', '#ea580c'],
  ['#eab308', '#ca8a04'],
  ['#22c55e', '#16a34a'],
  ['#06b6d4', '#0891b2'],
  ['#3b82f6', '#2563eb'],
  ['#8b5cf6', '#7c3aed'],
  ['#ec4899', '#db2777'],
  ['#14b8a6', '#0d9488'],
  ['#f59e0b', '#d97706'],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getAvatarColors(name: string): [string, string] {
  return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length] as [string, string];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const players = usePlayerPresence(room?.id ?? null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [isAnimateur, setIsAnimateur] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [error, setError] = useState('');
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Fetch room + players
  const fetchData = useCallback(async () => {
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
    setLoading(false);
  }, [code]);

  // Read identity from localStorage (client-only)
  useEffect(() => {
    setCurrentPlayerId(localStorage.getItem('playerId'));
    setIsAnimateur(localStorage.getItem('animateurRoomCode') === code);
  }, [code]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription on players
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`lobby-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          if (updated.status === 'playing') {
            if (updated.current_game === 'jeu-bras') {
              setPendingRedirect(`/room/${code}/jeu-bras`);
            } else if (updated.current_game === 'concours-ortho') {
              setPendingRedirect(`/room/${code}/concours-ortho`);
            } else if (updated.current_game === 'dictee') {
              setPendingRedirect(`/room/${code}/dictee`);
            } else if (updated.current_game === 'famille-or') {
              setPendingRedirect(`/room/${code}/famille-or`);
            } else if (updated.current_game === 'cater-en-or') {
              setPendingRedirect(`/room/${code}/cater-en-or`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, fetchData, code, router]);

  const handleSelectGame = async (game: 'jeu-bras' | 'concours-ortho' | 'dictee' | 'famille-or' | 'cater-en-or') => {
    if (!room) return;
    setStarting(true);
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ status: 'playing', current_game: game })
      .eq('id', room.id);
    if (updateError) {
      setError('Impossible de lancer le jeu. Réessaie !');
      setStarting(false);
      return;
    }
    if (game === 'jeu-bras') {
      setPendingRedirect(`/room/${code}/jeu-bras`);
    } else if (game === 'dictee') {
      setPendingRedirect(`/room/${code}/dictee/animateur`);
    } else if (game === 'famille-or') {
      setPendingRedirect(`/room/${code}/famille-or/animateur`);
    } else if (game === 'cater-en-or') {
      setPendingRedirect(`/room/${code}/cater-en-or/animateur`);
    } else {
      setPendingRedirect(`/room/${code}/concours-ortho/animateur`);
    }
  };

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
        <p className="text-white text-lg animate-pulse">Connexion à la salle…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-purple-300 hover:text-white transition-colors"
          >
            ← Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  // ─── Lobby UI ──────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4 py-10">
      {pendingRedirect && (
        <Countdown onComplete={() => router.push(pendingRedirect)} />
      )}
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Room code */}
        <div className="text-center">
          <p className="text-purple-300 text-sm font-semibold uppercase tracking-widest mb-2">
            Code de la salle
          </p>
          <div className="glow-pulse inline-block bg-white/10 border border-purple-500/60 rounded-2xl px-8 py-4">
            <span className="text-5xl font-black text-white tracking-[0.3em]">
              {code}
            </span>
          </div>
          <p className="text-purple-400 text-xs mt-3">
            Partage ce code pour inviter des amis 🎉
          </p>
        </div>

        {/* Player list */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">Joueurs connectés</h2>
            <span className="bg-purple-500/30 text-purple-200 text-sm font-bold px-3 py-1 rounded-full">
              {players.length}
            </span>
          </div>

          {players.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-4">
              En attente de joueurs…
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((player, i) => {
                const [from, to] = getAvatarColors(player.name);
                const isOnline = player.is_online !== false;
                return (
                  <li
                    key={player.id}
                    className="pop-in flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3"
                    style={{
                      animationDelay: `${i * 70}ms`,
                      opacity: isOnline ? 1 : 0.45,
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm select-none"
                        style={{
                          background: isOnline
                            ? `linear-gradient(135deg, ${from}, ${to})`
                            : 'linear-gradient(135deg, #6b7280, #4b5563)',
                          boxShadow: isOnline ? `0 3px 10px ${from}66` : 'none',
                          filter: isOnline ? 'none' : 'grayscale(1)',
                        }}
                      >
                        {getInitials(player.name)}
                        {player.is_birthday_person && (
                          <span
                            className="absolute -top-1 -right-1 text-base leading-none"
                            title="Personne fêtée"
                          >
                            🎂
                          </span>
                        )}
                      </div>
                      {/* Online/offline dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${isOnline ? 'bg-green-400' : 'bg-red-500'}`}
                      />
                    </div>

                    {/* Name + offline badge */}
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-semibold truncate block">
                        {player.name}
                        {player.id === currentPlayerId && (
                          <span className="text-purple-300 font-normal text-xs ml-1">(toi)</span>
                        )}
                      </span>
                      {!isOnline && (
                        <span className="text-red-400 text-xs">hors ligne</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Live indicator */}
          <div className="flex items-center gap-2 mt-4 justify-center">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs">En direct</span>
          </div>
        </div>

        {/* Status message — joueurs en attente */}
        {!isAnimateur && !showGameMenu && (
          <p className="text-center text-purple-300 text-sm">
            En attente du lancement de la partie… 🎈
          </p>
        )}

        {/* Start button — animateur uniquement */}
        {isAnimateur && !showGameMenu && (
          <button
            onClick={() => setShowGameMenu(true)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-slate-900 font-black text-xl shadow-lg shadow-green-900/40 hover:from-green-300 hover:to-emerald-400 hover:scale-105 active:scale-95 transition-all duration-150"
          >
            🎮 Lancer un jeu
          </button>
        )}

        {/* Game selection menu */}
        {isAnimateur && showGameMenu && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-5 flex flex-col gap-4">
            <h2 className="text-white font-bold text-center text-lg">
              Quel jeu voulez-vous jouer ?
            </h2>

            <button
              onClick={() => handleSelectGame('jeu-bras')}
              disabled={starting}
              className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-r from-pink-500/30 to-rose-500/30 border border-pink-400/30 hover:from-pink-500/50 hover:to-rose-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-2xl">🦾</span>
              <span className="ml-3 text-white font-bold text-base">
                À qui appartient ce bras ?
              </span>
            </button>

            <button
              onClick={() => handleSelectGame('concours-ortho')}
              disabled={starting}
              className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-r from-teal-500/30 to-cyan-500/30 border border-teal-400/30 hover:from-teal-500/50 hover:to-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-2xl">📝</span>
              <span className="ml-3 text-white font-bold text-base">
                Concours Ortho
              </span>
            </button>

            <button
              onClick={() => handleSelectGame('dictee')}
              disabled={starting}
              className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-r from-blue-500/30 to-teal-500/30 border border-blue-400/30 hover:from-blue-500/50 hover:to-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-2xl">✍️</span>
              <span className="ml-3 text-white font-bold text-base">
                La Dictée
              </span>
            </button>

            <button
              onClick={() => handleSelectGame('famille-or')}
              disabled={starting}
              className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400/30 hover:from-yellow-500/50 hover:to-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-2xl">🥇</span>
              <span className="ml-3 text-white font-bold text-base">
                Famille en Or
              </span>
            </button>

            <button
              onClick={() => handleSelectGame('cater-en-or')}
              disabled={starting}
              className="w-full text-left px-5 py-4 rounded-2xl bg-gradient-to-r from-orange-500/30 to-yellow-500/30 border border-orange-400/30 hover:from-orange-500/50 hover:to-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-2xl">🎯</span>
              <span className="ml-3 text-white font-bold text-base">
                Une Cater en or
              </span>
            </button>

            <button
              onClick={() => setShowGameMenu(false)}
              className="text-purple-300 hover:text-white text-sm text-center transition-colors"
            >
              ← Annuler
            </button>
          </div>
        )}

        {starting && (
          <p className="text-center text-purple-300 text-sm animate-pulse">
            ⏳ Lancement…
          </p>
        )}
      </div>
    </div>
  );
}
