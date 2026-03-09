'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs a callback at a fixed interval while enabled.
 * Cleans up on unmount or when disabled.
 */
export function usePolling(
  callback: () => Promise<void>,
  interval: number,
  enabled: boolean,
) {
  const savedCallback = useRef(callback);

  // Always keep the latest callback reference
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        await savedCallback.current();
      } catch {
        // Silently ignore polling errors
      }
    };

    // Run immediately on enable, then at interval
    tick();
    const id = setInterval(tick, interval);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [interval, enabled]);
}
