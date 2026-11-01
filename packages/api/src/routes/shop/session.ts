import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { ShopAccess } from "@shopper/core/shop";
import type { ShopEnvironment } from "../../types";

export const SHOP_COOKIE = "shopper_shop";

export const tokenOf = (c: Context) => getCookie(c, SHOP_COOKIE);

/**
 * Resolves the shopper's cookie to a live session; the shop and account come from the session row alone, so no
 * header, path or body can point a session at another shop.
 */
export function requireShopper(access: ShopAccess): MiddlewareHandler<ShopEnvironment> {
  return async (c, next) => {
    const token = tokenOf(c);
    const session = token ? await access.session(token) : null;
    if (!session) return c.json({ error: "Sign in to continue" }, 401);
    c.set("shopper", session);
    await next();
    c.header("Cache-Control", "no-store");
  };
}
