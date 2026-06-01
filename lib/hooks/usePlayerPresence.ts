import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/types';

export function usePlayerPresence(roomId: string | null): Player[] {
  const [players, setPlayers] = useState<Player[]>([]);

  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (data) setPlayers(data as Player[]);
  }, [roomId]);

  const markStale = useCallback(async () => {
    if (!roomId) return;
    const cutoff = new Date(Date.now() - 10_000).toISOString();
    void supabase
      .from('players')
      .update({ is_online: false })
      .eq('room_id', roomId)
      .eq('is_online', true)
      .lt('last_seen', cutoff);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    fetchPlayers();
    const timer = setInterval(async () => {
      await markStale();
      fetchPlayers();
    }, 10_000);
    return () => clearInterval(timer);
  }, [roomId, fetchPlayers, markStale]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`presence-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        fetchPlayers
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchPlayers]);

  return players;
}
