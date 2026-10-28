/**
 * Network faults the chaos suites inject between a till host and the API. A cut path loses its
 * connection before the server sees the request; a dropped response is applied by the server, then the
 * connection dies before the reply; while duplication is on, every push reaches the server three times
 * (two at once, then one more) and the host only sees the last reply.
 */
export function createFaults() {
  const cuts = new Set<string>();
  const drops = new Set<string>();
  let duplicating = false;
  return {
    /** Every request whose path starts with `prefix` loses its connection; "/" cuts the whole network. */
    cut: (prefix = "/") => void cuts.add(prefix),
    /** Restores one cut prefix, or the whole network when none is given. */
    restore: (prefix?: string) => void (prefix === undefined ? cuts.clear() : cuts.delete(prefix)),
    isCut: (pathname: string) => [...cuts].some((prefix) => pathname.startsWith(prefix)),
    dropNextResponse: (pathname: string) => void drops.add(pathname),
    takeDrop: (pathname: string) => drops.delete(pathname),
    duplicatePushes: (on = true) => void (duplicating = on),
    isDuplicating: () => duplicating,
  };
}

export type Faults = ReturnType<typeof createFaults>;
