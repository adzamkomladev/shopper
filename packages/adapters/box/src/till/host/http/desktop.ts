import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Host } from "../types";
import { localRoutes } from "./local";
import { proxyUpstream } from "./proxy";

const COOKIE = "shopper_desktop";
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The back-office surface of the host. The UI trades the bridge capability for an HttpOnly cookie
 * (`/desktop/unlock`); `/api/*` needs that cookie, a same-origin Origin on writes, and the loopback Host
 * the transport already checks. Local routes answer first; everything else goes upstream.
 */
export function mountDesktop(
  app: Hono,
  options: { host: Host; capability: string; port: () => number },
) {
  const token = randomBytes(32).toString("hex");
  const origins = () => [
    `http://127.0.0.1:${options.port()}`,
    `http://localhost:${options.port()}`,
  ];
  app.post("/desktop/unlock", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { capability?: unknown } | null;
    const origin = c.req.header("origin");
    if (origin && !origins().includes(origin))
      return c.json({ error: "Cross-origin request refused" }, 403);
    if (typeof body?.capability !== "string" || !same(body.capability, options.capability))
      return c.json({ error: "Connect to the register again" }, 401);
    setCookie(c, COOKIE, token, { httpOnly: true, sameSite: "Strict", path: "/" });
    return c.body(null, 204);
  });
  app.use("/api/*", async (c, next) => {
    const cookie = getCookie(c, COOKIE);
    if (!cookie || !same(cookie, token)) return c.json({ error: "Unlock the register first" }, 401);
    if (
      !["GET", "HEAD"].includes(c.req.method) &&
      !origins().includes(c.req.header("origin") ?? "")
    )
      return c.json({ error: "Cross-origin request refused" }, 403);
    await next();
  });
  app.route("/api", localRoutes(options.host));
  app.all("/api/*", proxyUpstream(options.host));
}
