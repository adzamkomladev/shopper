import { v7 } from "uuid";
import { startUpstream } from "../upstream";
import { createHostFixture } from "./fixture";

type Staff = {
  userId: string;
  name: string;
  email: string;
  password: string;
  permissions: string[];
};
const hex = (seed: string) => seed.repeat(64).slice(0, 64);
export const ama: Staff = {
  userId: v7(),
  name: "Ama Mensah",
  email: "ama@shop.test",
  password: "correct horse battery",
  permissions: ["sale.create", "report.read", "stock.read", "stock.write", "product.read"],
};
export const kofi: Staff = {
  userId: v7(),
  name: "Kofi Boateng",
  email: "kofi@shop.test",
  password: "kofi password 1",
  permissions: ["sale.create"],
};

/** An upstream that signs staff in. `mode` makes the login 503 (unreachable), 429 (locked) or normal. */
export async function startStaffUpstream(staff: Staff[]) {
  const users = new Map(staff.map((user) => [user.email, { ...user }]));
  const state = {
    mode: "ok" as "ok" | "down" | "locked" | "garbage" | "forbidden",
    issued: [] as { id: string; token: string }[],
  };
  const upstream = await startUpstream(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/cashiers/login") {
      if (state.mode === "down") return Response.json({ error: "Unavailable" }, { status: 503 });
      if (state.mode === "garbage") return Response.json({ nonsense: true });
      if (state.mode === "forbidden") return Response.json({ error: "Nope" }, { status: 403 });
      if (state.mode === "locked")
        return Response.json({ error: "Sign-in temporarily locked" }, { status: 429 });
      const body = (await request.json()) as { email: string; password: string };
      const user = users.get(body.email.toLowerCase());
      if (!user || user.password !== body.password)
        return Response.json({ error: "Invalid email or password" }, { status: 401 });
      const session = { id: v7(), token: hex(String(state.issued.length + 1)) };
      state.issued.push(session);
      return Response.json({
        ...session,
        issuedAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
        permissions: user.permissions,
        roleName: "Manager",
        userId: user.userId,
        userName: user.name,
      });
    }
    if (path === "/products")
      return Response.json([], {
        headers: {
          "set-cookie": "upstream=1; Path=/; HttpOnly",
          "access-control-allow-origin": "*",
        },
      });
    if (path === "/sync/stock") {
      const { requestId } = (await request.json()) as { requestId: string };
      return Response.json({ requestId, accepted: { lines: [] } });
    }
    return new Response(null, { status: 404 });
  });
  return { ...upstream, state, users };
}

/** A real till host that signs staff in against the stub upstream, plus its browser-facing HTTP surface. */
export async function startStaffHost(staff: Staff[] = [ama, kofi]) {
  const upstream = await startStaffUpstream(staff);
  const fixture = await createHostFixture({ freshSession: true, upstream: upstream.url });
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
