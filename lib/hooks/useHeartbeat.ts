import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useHeartbeat() {
  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    if (!playerId) return;

    const beat = async () => {
      try {
        await supabase
          .from('players')
          .update({ last_seen: new Date().toISOString(), is_online: true })
          .eq('id', playerId);
      } catch {
        // ignore network errors
      }
    };

    beat();
    const interval = setInterval(beat, 5_000);

    return () => {
      clearInterval(interval);
      void supabase
        .from('players')
        .update({ is_online: false })
        .eq('id', playerId);
    };
  }, []);
}
