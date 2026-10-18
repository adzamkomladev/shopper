import { createHostFixture } from "./fixture";
import { ama, kofi, startStaffUpstream, type Staff } from "./staff/upstream";

export { ama, kofi, startStaffUpstream, type Staff };

/** A real till host that signs staff in against the stub upstream, plus its browser-facing HTTP surface. */
export async function startStaffHost(staff: Staff[] = [ama, kofi], origins?: string[]) {
  const upstream = await startStaffUpstream(staff);
  const fixture = await createHostFixture({ freshSession: true, upstream: upstream.url, origins });
  const host = await fixture.start();
  const base = `http://127.0.0.1:${host.ready.port}`;
  let closed = false;
  let cookie: string | undefined;
  const self = {
    upstream,
    fixture,
    host,
    base,
    signIn: (email: string, password: string) =>
      host.request({ type: "session.signIn", email, password }),
    signOut: () => host.request({ type: "session.signOut" }),
    status: async () => (await host.request({ type: "status" })).status as Record<string, any>,
    /** Unlocks the desktop the way the UI does after hello; returns the cookie pair. */
    async unlock() {
      const response = await fetch(`${base}/desktop/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ capability: host.ready.capability }),
      });
      cookie = response.headers.getSetCookie()[0]?.split(";")[0];
      return { response, cookie };
    },
    /** A request to the host's own HTTP surface, as the unlocked back office makes it. */
    async call(path: string, init: RequestInit & { origin?: string } = {}) {
      if (!cookie) await self.unlock();
      const { origin, ...rest } = init;
      const headers = new Headers(rest.headers);
      headers.set("cookie", cookie!);
      if (rest.method && rest.method !== "GET") headers.set("origin", origin ?? base);
      return fetch(`${base}${path}`, { ...rest, headers });
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await fixture.close();
      } finally {
        await upstream.close().catch(() => undefined);
      }
    },
  };
  return self;
}
export type StaffHost = Awaited<ReturnType<typeof startStaffHost>>;
