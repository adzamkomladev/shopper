import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { findOrgBySlug } from "@shopper/core/orgs";
import { SESSION_TTL_MS, ShopError } from "@shopper/core/shop";
import { SHOP_COOKIE, tokenOf } from "./session";
import type { ShopOptions } from "../../types";

const verifyStatus = { wrong: 400, locked: 423, expired: 410 } as const;

/**
 * A shopper's way in at one shop: the code names the shop, a phone gets a texted code, the right code sets the
 * session cookie. The cookie belongs to the shop's own origin, which forwards these routes to the API.
 */
export function shopSignInRoutes(options: ShopOptions) {
  const app = new Hono();
  app.onError((error, c) => {
    if (error instanceof ShopError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  const shopOf = async (c: Context) => {
    const found = await findOrgBySlug(options.database, c.req.param("code") ?? "");
    // A box serves one shop; any other code is unknown there.
    if (!found || (options.orgId && found.id !== options.orgId.toLowerCase()))
      throw new ShopError("We could not find that shop", 404);
    return found;
  };
  const body = (c: Context): Promise<Record<string, unknown>> => c.req.json().catch(() => ({}));

  app.get("/shop/:code", async (c) => {
    const found = await shopOf(c);
    return c.json({ name: found.name, code: c.req.param("code").trim().toLowerCase() });
  });
  app.post("/shop/:code/signin", async (c) => {
    const found = await shopOf(c);
    const input = await body(c);
    if (
      options.turnstile &&
      !(await options.turnstile(
        typeof input.turnstile === "string" ? input.turnstile : "",
        options.clientIP,
      ))
    )
      return c.json({ error: "Please confirm you are not a robot and try again" }, 403);
    const started = await options.access.start(found.id, input.phone);
    return c.json({ loginId: started.loginId }, 202);
  });
  app.post("/shop/:code/signin/:loginId/resend", async (c) => {
    const found = await shopOf(c);
    return c.json(await options.access.resend(found.id, c.req.param("loginId")));
  });
  app.post("/shop/:code/signin/:loginId/verify", async (c) => {
    const found = await shopOf(c);
    const result = await options.access.verify(
      found.id,
      c.req.param("loginId"),
      (await body(c)).code,
    );
    if (result.outcome === "wrong")
      return c.json(
        { error: "That code is not right", attemptsLeft: result.attemptsLeft },
        verifyStatus.wrong,
      );
    if (result.outcome === "locked")
      return c.json({ error: "Too many wrong codes. Ask for a new one." }, verifyStatus.locked);
    if (result.outcome === "expired")
      return c.json({ error: "That code has expired. Ask for a new one." }, verifyStatus.expired);
    setCookie(c, SHOP_COOKIE, result.token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return c.json({ accountId: result.accountId });
  });
  app.post("/shop/signout", async (c) => {
    const token = tokenOf(c);
    if (token) await options.access.signOut(token);
    deleteCookie(c, SHOP_COOKIE, { path: "/" });
    return c.body(null, 204);
  });
  return app;
}
