import { ratePolicies, type RateLimiter } from "@shopper/ports";

const MAX_KEYS = 50_000;

/**
 * Fixed windows counted in this process: the box serves every request from one Bun process, so the count is
 * exact. ponytail: the Rivet RateLimiter actor replaces it on day 36 with the other coordination twins.
 */
export function boxRateLimiter(now = () => Date.now()): RateLimiter {
  const windows = new Map<string, { endsAt: number; count: number }>();
  return {
    async limit(policy, key) {
      const at = now();
      const id = `${policy}:${key}`;
      const current = windows.get(id);
      if (current && current.endsAt > at) {
        if (current.count >= ratePolicies[policy].limit) return false;
        current.count += 1;
        return true;
      }
      if (windows.size >= MAX_KEYS)
        for (const [stale, window] of windows) if (window.endsAt <= at) windows.delete(stale);
      // Still full of live windows: refuse new keys rather than grow without bound under a spray of IPs.
      if (!current && windows.size >= MAX_KEYS) return false;
      windows.set(id, { endsAt: at + ratePolicies[policy].period * 1000, count: 1 });
      return true;
    },
  };
}
