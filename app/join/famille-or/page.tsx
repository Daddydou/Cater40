'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getActiveRoom } from '@/lib/supabase';

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9 -]/g, '').slice(0, 20);
}

export default function JoinFamilleOrPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getActiveRoom().then((room) => {
      if (room) {
        setRoomCode(room.code);
        setRoomId(room.id);
      }
      setFetching(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !roomId || loading) return;

    setLoading(true);
    setError('');

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ room_id: roomId, name: trimmed, is_birthday_person: false })
      .select()
      .single();

    if (playerError || !player) {
      setError('Erreur lors de la connexion. Réessaie !');
      setLoading(false);
      return;
    }

    localStorage.setItem('playerId', player.id);
    localStorage.setItem('playerName', player.name);
    router.push(`/room/${roomCode}/famille-or`);
  };

  const bgStyle = { background: 'linear-gradient(135deg, #1a237e 0%, #0d1a6e 50%, #1a237e 100%)' };

  if (fetching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={bgStyle}>
        <span className="text-6xl animate-bounce">🥇</span>
        <p className="text-yellow-300 animate-pulse">Recherche de la partie…</p>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={bgStyle}>
        <span className="text-6xl">🥇</span>
        <p className="text-white font-bold text-xl text-center">Aucune partie en cours</p>
        <p className="text-yellow-300 text-sm text-center">Demande à l&apos;animateur de créer une salle.</p>
        <Link href="/" className="text-yellow-400 hover:text-yellow-200 text-sm mt-2 transition-colors">
          ← Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={bgStyle}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-6xl">🥇</span>
          <h1 className="text-3xl font-extrabold text-yellow-400 mt-4"
            style={{ textShadow: '0 2px 20px rgba(234,179,8,0.4)' }}
          >
            Famille en Or
          </h1>
          <p className="text-blue-300 mt-2 text-sm">
            Entre ton prénom pour participer
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6 shadow-2xl"
          style={{
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-yellow-200 text-sm font-semibold mb-2">
                Ton prénom 🎈
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(sanitizeName(e.target.value))}
                placeholder="ex : Thomas"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(234,179,8,0.35)',
                }}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-950/40 rounded-xl py-2 px-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-4 rounded-2xl font-black text-lg text-blue-900 transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              style={{
                background: 'linear-gradient(135deg, #eab308, #f59e0b)',
                boxShadow: '0 8px 30px rgba(234,179,8,0.4)',
              }}
            >
              {loading ? '⏳ Connexion…' : '🎊 Rejoindre !'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-yellow-400 hover:text-yellow-200 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
