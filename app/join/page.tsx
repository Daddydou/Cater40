'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9 -]/g, '').slice(0, 20);
}

const IS_DEV = process.env.NODE_ENV === 'development';

export default function JoinPage() {
  const [code, setCode] = useState(IS_DEV ? 'TEST' : '');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!code || code.length !== 4 || !trimmedName) return;

    setLoading(true);
    setError('');

    // 1. Vérifier que la room existe et est en attente
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (roomError || !room) {
      setError(`Aucune salle trouvée avec le code "${code}". Vérifie et réessaie !`);
      setLoading(false);
      return;
    }

    if (room.status === 'finished') {
      setError('Cette partie est déjà terminée.');
      setLoading(false);
      return;
    }

    // 2. Créer le joueur
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: trimmedName, is_birthday_person: false })
      .select()
      .single();

    if (playerError || !player) {
      setError('Erreur lors de la création du joueur. Réessaie !');
      setLoading(false);
      return;
    }

    // 3. Sauvegarder l'identité
    localStorage.setItem('playerId', player.id);
    localStorage.setItem('playerName', player.name);

    router.push(`/room/${code}/lobby`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">🚀</span>
          <h1 className="text-3xl font-extrabold text-white mt-3">
            Rejoindre une partie
          </h1>
          <p className="text-purple-300 mt-2 text-sm">
            Entre le code de la salle et ton prénom
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Code field */}
            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Code de la salle 🔑
              </label>
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="ex : MARIO"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/30 text-white placeholder-white/40 text-2xl font-bold text-center tracking-[0.5em] uppercase focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
              <p className="text-white/30 text-xs text-center mt-1">4 lettres</p>
            </div>

            {/* Name field */}
            <div>
              <label className="block text-purple-200 text-sm font-semibold mb-2">
                Ton prénom 🎈
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(sanitizeName(e.target.value))}
                placeholder="ex : Lucas"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/30 text-white placeholder-white/40 text-base focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-950/40 rounded-xl py-2 px-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 4 || !name.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold text-lg shadow-lg shadow-amber-900/40 hover:from-amber-300 hover:to-orange-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all duration-150"
            >
              {loading ? '⏳ Connexion...' : '🎊 Rejoindre !'}
            </button>
          </form>
        </div>

        {/* Back */}
        <div className="text-center mt-6">
          <Link href="/" className="text-purple-400 hover:text-purple-200 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
