'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getActiveRoom } from '@/lib/supabase';

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9 -]/g, '').slice(0, 20);
}

export default function JoinCaterPage() {
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
      .insert({ room_id: roomId, name: trimmed, is_birthday_person: true })
      .select()
      .single();

    if (playerError || !player) {
      setError('Erreur lors de la connexion. Réessaie !');
      setLoading(false);
      return;
    }

    localStorage.setItem('playerId', player.id);
    localStorage.setItem('playerName', player.name);
    router.push(`/room/${roomCode}/lobby`);
  };

  const bg = 'min-h-screen flex flex-col items-center justify-center px-4';
  const bgStyle = { background: 'linear-gradient(135deg, #1a0a2e 0%, #3b0764 50%, #1a0a2e 100%)' };

  if (fetching) {
    return (
      <div className={`${bg} gap-4`} style={bgStyle}>
        <span className="text-6xl animate-bounce">🎂</span>
        <p className="text-pink-300 animate-pulse">Recherche de la partie…</p>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className={`${bg} gap-4`} style={bgStyle}>
        <span className="text-6xl">🎂</span>
        <p className="text-white font-bold text-xl text-center">Aucune partie en cours</p>
        <p className="text-pink-300 text-sm text-center">Demande à l&apos;animateur de créer une salle.</p>
        <Link href="/" className="text-pink-400 hover:text-pink-200 text-sm mt-2 transition-colors">
          ← Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className={bg} style={bgStyle}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-7xl drop-shadow-xl">🎂</span>
          <h1
            className="text-3xl font-extrabold mt-4 leading-tight"
            style={{ color: '#fce7f3', textShadow: '0 2px 20px rgba(236,72,153,0.6)' }}
          >
            Bienvenue la fêtée 🎂
          </h1>
          <p className="text-pink-300 mt-2 text-sm">
            Entre ton prénom pour rejoindre la fête !
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6 shadow-2xl"
          style={{
            background: 'rgba(236,72,153,0.12)',
            border: '1px solid rgba(236,72,153,0.35)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-pink-200 text-sm font-semibold mb-2">
                Ton prénom 🎈
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(sanitizeName(e.target.value))}
                placeholder="ex : Cater"
                maxLength={20}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/40 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(236,72,153,0.4)',
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
              className="w-full py-4 rounded-2xl font-black text-lg transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                color: '#fff',
                boxShadow: '0 8px 30px rgba(236,72,153,0.4)',
              }}
            >
              {loading ? '⏳ Connexion…' : '🎉 Rejoindre !'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-pink-400 hover:text-pink-200 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
