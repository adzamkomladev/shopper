const attempts = new Map<string, { startedAt: number; count: number }>();

// shortcut: isolate-local budget, replace with the distributed RateLimiter when its platform shells ship.
export function allowPublicAuth(
  clientIP: string | undefined,
  operation: string,
  now = Date.now(),
  limit = 3,
) {
  if (!clientIP) return false;
  const key = `${clientIP}:${operation}`;
  let current = attempts.get(key);
  if (!current || now - current.startedAt >= 10_000) {
    if (attempts.size >= 10_000) {
      for (const [ip, window] of attempts)
        if (now - window.startedAt >= 10_000) attempts.delete(ip);
      if (!attempts.has(key) && attempts.size >= 10_000) return false;
    }
    current = { startedAt: now, count: 0 };
    attempts.set(key, current);
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
