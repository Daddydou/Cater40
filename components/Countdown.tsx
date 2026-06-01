'use client';

import { useEffect, useState } from 'react';

const STEPS = ['3', '2', '1', "C'est parti ! 🎉"] as const;

interface CountdownProps {
  onComplete: () => void;
}

export function Countdown({ onComplete }: CountdownProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1000);
    return () => clearTimeout(t);
  }, [step, onComplete]);

  if (step >= STEPS.length) return null;

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <span
        key={step}
        className={isLast ? 'countdown-go' : 'countdown-num'}
        style={{
          fontSize: isLast ? '2.5rem' : '9rem',
          fontWeight: 900,
          color: isLast ? '#facc15' : '#ffffff',
          textShadow: isLast
            ? '0 0 40px rgba(250,204,21,0.6)'
            : '0 0 60px rgba(255,255,255,0.3)',
          lineHeight: 1,
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        {STEPS[step]}
      </span>
    </div>
  );
}
