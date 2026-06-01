'use client';

import { useEffect, useState } from 'react';

const COLORS = [
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

export function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: 45 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
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
