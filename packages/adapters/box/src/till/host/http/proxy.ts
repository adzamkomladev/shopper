import type { Handler } from "hono";
import type { Host } from "../types";

// Answered by the host or not at all: never forwarded, whatever the back office asks.
const LOCAL_ONLY = /^\/api\/(auth|sync|cashiers|register)(\/|$)/;
// fetch has already decoded the body, and the cookie is the host's to set, never the server's.
const DROPPED = [
  "set-cookie",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
];

/** Forwards `/api/*` upstream as the device principal of the signed-in staff member. */
export function proxyUpstream({ config }: Pick<Host, "config">): Handler {
  return async (c) => {
    const url = new URL(c.req.url);
    if (LOCAL_ONLY.test(url.pathname)) return c.json({ error: "Record not found" }, 404);
    if (!config.session) return c.json({ error: "Sign in on this register first" }, 401);
    const headers = new Headers();
    for (const name of ["accept", "content-type"]) {
      const value = c.req.header(name);
      if (value) headers.set(name, value);
    }
    headers.set("authorization", `Bearer ${config.session.proof}`);
    headers.set("x-shopper-device", config.identity.deviceId);
    headers.set("x-shopper-device-token", config.deviceToken);
    headers.set("x-shopper-org", config.identity.orgId);
    try {
      const read = ["GET", "HEAD"].includes(c.req.method);
      const response = await fetch(new URL(url.pathname.slice(4) + url.search, config.upstream), {
        method: c.req.method,
        headers,
        body: read ? undefined : await c.req.arrayBuffer(),
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      const out = new Headers(response.headers);
      for (const name of DROPPED) out.delete(name);
      return new Response(response.body, { status: response.status, headers: out });
    } catch {
      return c.json(
        { error: "The server is unreachable. The back office needs a connection." },
        503,
      );
    }
  };
}
