import { useEffect } from 'react';

export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // unsupported or denied — ignore silently
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, []);
}
