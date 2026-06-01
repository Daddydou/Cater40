'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Room } from '@/types';

const CONFETTI_CHARS = [
  'A', 'B', 'C', 'E', 'O', 'R', 'T', 'H', 'P', 'L',
  '🍍', '💬', '🍍', '📖', '🔤', '🍍', 'F', 'G', 'I', 'N',
];

function LetterConfetti() {
  const pieces = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    char: CONFETTI_CHARS[Math.floor(Math.random() * CONFETTI_CHARS.length)],
    duration: 4 + Math.random() * 5,
    delay: Math.random() * 3,
    size: 0.9 + Math.random() * 0.9,
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="letter-confetti"
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            fontSize: `${p.size}rem`,
          }}
        >
          {p.char}
        </div>
      ))}
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function parseRevealCount(currentGame: string | null, total: number): number {
  if (!currentGame) return 0;
  if (currentGame.endsWith(':all')) return total;
  const m = currentGame.match(/concours-ortho:classement:(\d+)/);
  return m ? Math.min(parseInt(m[1]), total) : 0;
}

function ClassementContent() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const isAnimateur = searchParams.get('a') === '1';

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]); // sorted score ASC
  const [revealCount, setRevealCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);

  const loadData = useCallback(async () => {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (!roomData) { setLoading(false); return; }
    setRoom(roomData as Room);

    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomData.id)
      .order('score', { ascending: true });

    const sorted = (playersData as Player[]) ?? [];
    setPlayers(sorted);
    setRevealCount(parseRevealCount(roomData.current_game, sorted.length));
    setLoading(false);
  }, [code]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`ortho-classement-${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          setRevealCount((prev) => {
            const next = parseRevealCount(updated.current_game, players.length);
            return Math.max(prev, next);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, players.length]);

  const handleRevealNext = async () => {
    if (!room || revealing) return;
    setRevealing(true);
    const next = revealCount + 1;
    const newGame =
      next >= players.length
        ? 'concours-ortho:classement:all'
        : `concours-ortho:classement:${next}`;
    await supabase.from('rooms').update({ current_game: newGame }).eq('id', room.id);
    setRevealing(false);
  };

  const bg =
    'min-h-screen bg-gradient-to-br from-teal-900 via-cyan-950 to-teal-900 px-4 py-10';

  if (loading) {
    return (
      <div className={`${bg} flex items-center justify-center`}>
        <p className="text-white text-lg animate-pulse">Chargement du classement…</p>
      </div>
    );
  }

  // players sorted ASC → index 0 = lowest score
  // We reveal from lowest (first) to highest (last)
  // Display in DESC order (best at top) among revealed players
  const revealedPlayers = players.slice(0, revealCount);
  const allRevealed = revealCount >= players.length && players.length > 0;

  // Display list: reverse so best score appears at top
  const displayList = [...revealedPlayers].reverse();

  return (
    <div className={`${bg} overflow-hidden`}>
      {allRevealed && <LetterConfetti />}

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-3xl font-extrabold text-white">Classement</h1>
          <p className="text-teal-300 text-sm mt-1">Concours Ortho</p>
        </div>

        {/* Revealed players (best at top) */}
        <div className="flex flex-col gap-3">
          {displayList.map((player, displayIndex) => {
            const playerIndex = players.findIndex((p) => p.id === player.id);
            const rank = players.length - playerIndex; // rank 1 = best
            const medal = rank <= 3 ? MEDALS[rank - 1] : null;

            return (
              <div
                key={player.id}
                className="pop-in bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ animationDelay: `${displayIndex * 80}ms` }}
              >
                <div className="w-10 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-2xl">{medal}</span>
                  ) : (
                    <span className="text-white/40 text-sm font-bold">#{rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{player.name}</p>
                  <p className="text-teal-300 text-sm">
                    {player.score} point{player.score !== 1 ? 's' : ''}
                  </p>
                </div>
                {rank === 1 && revealCount >= players.length && (
                  <div className="text-2xl animate-bounce">👑</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still hidden count */}
        {!allRevealed && players.length > 0 && (
          <p className="text-center text-teal-400/50 text-sm">
            {players.length - revealCount} joueur{players.length - revealCount !== 1 ? 's' : ''} encore caché{players.length - revealCount !== 1 ? 's' : ''}…
          </p>
        )}

        {/* Final message */}
        {allRevealed && (
          <div className="pop-in bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-400/40 rounded-3xl p-6 text-center mt-2">
            <p className="text-white font-black text-xl leading-snug">
              Envie d&apos;engager une autre personne dans ton cabinet ?
            </p>
            <p className="text-teal-300 text-sm mt-3">Bravo à tous les participants ! 🍍</p>
          </div>
        )}

        {/* Animateur reveal control */}
        {isAnimateur && !allRevealed && (
          <button
            onClick={handleRevealNext}
            disabled={revealing}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-black text-base disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg"
          >
            {revealing
              ? '⏳…'
              : `▶ Révéler le joueur suivant (${revealCount + 1}/${players.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClassementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-900 via-cyan-950 to-teal-900">
          <p className="text-white text-lg animate-pulse">Chargement…</p>
        </div>
      }
    >
      <ClassementContent />
    </Suspense>
  );
}
