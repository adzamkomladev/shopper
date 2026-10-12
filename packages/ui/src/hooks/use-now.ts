import { useState, useSyncExternalStore } from "react";

/** The current time in ms, refreshed every `intervalMs`, so "in force now" stays true on a page left open. */
export function useNow(intervalMs: number) {
  const [clock] = useState(() => {
    let now = Date.now();
    return {
      subscribe: (notify: () => void) => {
        const timer = setInterval(() => {
          now = Date.now();
          notify();
        }, intervalMs);
        return () => clearInterval(timer);
      },
      read: () => now,
    };
  });
  return useSyncExternalStore(clock.subscribe, clock.read);
}
