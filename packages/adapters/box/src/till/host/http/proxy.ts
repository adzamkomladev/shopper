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
    const path = canonical(url.pathname);
    if (path === undefined) return c.json({ error: "Invalid path" }, 400);
    if (LOCAL_ONLY.test(path.toLowerCase())) return c.json({ error: "Record not found" }, 404);
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
      const target = new URL(config.upstream);
      target.pathname = path.slice(4) || "/";
      target.search = url.search;
      if (target.origin !== new URL(config.upstream).origin)
        return c.json({ error: "Invalid path" }, 400);
      const response = await fetch(target, {
        method: c.req.method,
        headers,
        body: read ? undefined : await c.req.arrayBuffer(),
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      const out = new Headers(response.headers);
      for (const name of DROPPED) out.delete(name);
      for (const name of [...out.keys()]) if (name.startsWith("access-control-")) out.delete(name);
      return new Response(response.body, { status: response.status, headers: out });
    } catch {
      return c.json(
        { error: "The server is unreachable. The back office needs a connection." },
        503,
      );
    }
  };
}

/**
 * The decoded path, or undefined when it is malformed or could address anything but a plain path below /api:
 * escapes are decoded until stable (so %61uth is auth), and doubled or back slashes and dot segments are refused.
 */
function canonical(pathname: string) {
  try {
    let path = pathname;
    for (let round = 0; round < 4; round++) {
      const decoded = decodeURIComponent(path);
      if (decoded === path) {
        const bad =
          path.includes("//") ||
          path.includes("\\") ||
          path.split("/").some((s) => s === "." || s === "..");
        return bad ? undefined : path;
      }
      path = decoded;
    }
  } catch {
    // A malformed escape fails closed.
  }
  return undefined;
}
