'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PASSWORD_KEY = 'home_auth';
const CORRECT_PASSWORD = 'cater40';
const IS_DEV = process.env.NODE_ENV === 'development';

const CONFETTI_COLORS = [
  '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899',
];

interface Piece {
  id: number;
  x: number;
  color: string;
  duration: number;
  delay: number;
  width: number;
  height: number;
  isCircle: boolean;
}

function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        duration: 4 + Math.random() * 5,
        delay: Math.random() * 6,
        width: 6 + Math.random() * 8,
        height: 8 + Math.random() * 6,
        isCircle: Math.random() > 0.6,
      }))
    );
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ── Page d'accueil normale ────────────────────────────────────────────────────

function HomeContent() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleCreer = async () => {
    if (creating) return;
    setCreating(true);

    let code = 'TEST';
    const { data: existing } = await supabase
      .from('rooms')
      .select('id')
      .eq('code', 'TEST')
      .maybeSingle();

    if (existing) code = generateCode();

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ code, status: 'waiting' })
      .select()
      .single();

    if (error || !room) { setCreating(false); return; }

    localStorage.setItem('animateurRoomCode', code);
    router.push(`/room/${code}/lobby`);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(135deg, #0f0a1a 0%, #1e0b3a 50%, #0f0a1a 100%)' }}
    >
      <Confetti />

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(236,72,153,0.12) 0%, transparent 70%)' }} />

      <div className="relative z-10 flex flex-col items-center gap-8 text-center w-full max-w-sm">

        <div className="flex flex-col items-center gap-3">
          <span className="text-8xl drop-shadow-xl select-none" role="img" aria-label="gâteau">🎂</span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight"
            style={{ color: '#ffffff', textShadow: '0 2px 20px rgba(168,85,247,0.5)' }}>
            Jeu d&apos;Anniversaire
          </h1>
          <p style={{ color: '#c084fc' }} className="text-base font-medium">Bienvenue ! 🎉</p>
        </div>

        <div className="flex gap-3 text-2xl select-none" aria-hidden>
          <span>✨</span><span>🎉</span><span>🎊</span><span>🥳</span><span>✨</span>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={handleCreer}
            disabled={creating}
            className="w-full py-4 px-6 rounded-2xl font-black text-lg text-center text-white transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', boxShadow: '0 8px 30px rgba(244,63,94,0.35)' }}
          >
            {creating ? '⏳ Création…' : '🎉 Créer une partie'}
          </button>
          <Link
            href="/join"
            className="w-full py-4 px-6 rounded-2xl font-black text-lg text-center transition-all duration-150 hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#1c1917', boxShadow: '0 8px 30px rgba(245,158,11,0.35)' }}
          >
            🚀 Rejoindre une partie
          </Link>
        </div>

        {IS_DEV && (
          <div className="w-full rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.12)' }}>
            <p className="text-white/30 text-xs text-center uppercase tracking-widest mb-1">Liens rapides (dev)</p>
            {[
              { href: '/join/cater', label: '🎂 Lien Cater' },
              { href: '/join/concours-ortho', label: '📝 Lien Concours Ortho' },
              { href: '/join/dictee', label: '📖 Lien Dictée' },
              { href: '/join/famille-or', label: '🥇 Lien Famille en Or' },
              { href: '/games/cater-en-or/animateur', label: '🎯 Une Cater en or' },
              { href: '/games/photos-gens', label: '📸 Photos Gens' },
              { href: '/games/jeu-bras', label: '🦾 Gros Bras' },
              { href: '/upload-photos', label: '📤 Upload Photos' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="w-full py-2 px-4 rounded-xl text-center text-white/60 hover:text-white text-sm font-medium transition-colors hover:bg-white/10">
                {label}
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Page principale avec garde mot de passe ───────────────────────────────────

export default function HomePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [showField, setShowField] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem(PASSWORD_KEY) === CORRECT_PASSWORD) {
      setUnlocked(true);
    }
  }, []);

  const handleDoubleClick = () => {
    setShowField(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (pwInput === CORRECT_PASSWORD) {
      localStorage.setItem(PASSWORD_KEY, CORRECT_PASSWORD);
      setUnlocked(true);
    } else {
      setPwInput('');
      setShowField(false);
    }
  };

  if (unlocked) return <HomeContent />;

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-white cursor-default select-none"
      onDoubleClick={handleDoubleClick}
    >
      <p className="text-gray-300 text-lg">Sois patient</p>
      {showField && (
        <input
          ref={inputRef}
          type="password"
          value={pwInput}
          onChange={e => setPwInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{ position: 'fixed', opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
