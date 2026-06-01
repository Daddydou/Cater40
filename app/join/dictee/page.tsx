'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getActiveRoom } from '@/lib/supabase';

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9 -]/g, '').slice(0, 20);
}

export default function JoinDicteePage() {
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
    router.push(`/room/${roomCode}/dictee`);
  };

  const bgStyle = { background: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 50%, #0a1628 100%)' };

  if (fetching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={bgStyle}>
        <span className="text-6xl animate-bounce">✍️</span>
        <p className="text-blue-300 animate-pulse">Recherche de la partie…</p>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={bgStyle}>
        <span className="text-6xl">✍️</span>
        <p className="text-white font-bold text-xl text-center">Aucune partie en cours</p>
        <p className="text-blue-300 text-sm text-center">Demande à l&apos;animateur de créer une salle.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-200 text-sm mt-2 transition-colors">
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
          <span className="text-6xl">✍️</span>
          <h1 className="text-3xl font-extrabold text-white mt-4">
            La Dictée
          </h1>
          <p className="text-blue-300 mt-2 text-sm">
            Entre ton prénom pour participer
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6 shadow-2xl"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">
                Ton prénom 🎈
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(sanitizeName(e.target.value))}
                placeholder="ex : Marie"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(59,130,246,0.35)',
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
              className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                boxShadow: '0 8px 30px rgba(59,130,246,0.4)',
              }}
            >
              {loading ? '⏳ Connexion…' : '🎊 Rejoindre !'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-blue-400 hover:text-blue-200 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
