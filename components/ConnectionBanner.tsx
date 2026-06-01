'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  onReconnect?: () => void | Promise<void>;
}

export function ConnectionBanner({ onReconnect }: Props) {
  const [isOnline, setIsOnline] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const cbRef     = useRef(onReconnect);

  useEffect(() => { cbRef.current = onReconnect; }, [onReconnect]);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
      setIsOnline(true);

      const playerId = localStorage.getItem('playerId');
      if (playerId) {
        try {
          await supabase
            .from('players')
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq('id', playerId);
        } catch { /* ignore */ }
      }

      try { await cbRef.current?.(); } catch { /* ignore */ }

      if (toastRef.current) clearTimeout(toastRef.current);
      setShowToast(true);
      toastRef.current = setTimeout(() => setShowToast(false), 3_000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (retryRef.current) clearInterval(retryRef.current);
      retryRef.current = setInterval(() => {
        if (navigator.onLine) handleOnline();
      }, 3_000);
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (retryRef.current) clearInterval(retryRef.current);
      if (toastRef.current)  clearTimeout(toastRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Offline banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-3 px-4 text-white text-sm font-bold"
        style={{
          background: '#dc2626',
          transform: isOnline ? 'translateY(-110%)' : 'translateY(0)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <span className="animate-pulse">⚠️</span>
        Connexion perdue… tentative de reconnexion
      </div>

      {/* Reconnect toast */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-3 px-4 text-white text-sm font-bold"
        style={{
          background: '#16a34a',
          transform: isOnline && showToast ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        ✅ Reconnexion réussie
      </div>
    </>
  );
}
