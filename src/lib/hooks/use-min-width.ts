'use client';

import { useSyncExternalStore } from 'react';

/**
 * Subscribes to `window.matchMedia(query)`. Server snapshot is always `false`.
 */
export function useMinWidth(mediaQuery: string): boolean {
  return useSyncExternalStore(
    onStoreChange => {
      const mq = window.matchMedia(mediaQuery);
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(mediaQuery).matches,
    () => false,
  );
}
