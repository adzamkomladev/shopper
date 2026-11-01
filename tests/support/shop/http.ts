// The shared runtime as the shop Worker reaches it: requests at the shop's origin, a cookie the shop keeps.
//   shopHttp(world, over?)        -> { request, signIn, options }
//   request(path, init?)          -> Response from serveRuntime (cookie, IP and Origin optional)
//   signIn(org, phone)            -> the `shopper_shop=` cookie of a fresh session at that shop
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime, type RuntimeOptions } from "@shopper/api/runtime";
import { loginCode } from "@shopper/core/shop";
import type { shopWorld } from "./world";
import { linkSecret } from "./world";

export const shopOrigin = "https://shop.test";
let ips = 0;
export const freshIp = () => `203.0.113.${(++ips % 250) + 1}`;

type World = Awaited<ReturnType<typeof shopWorld>>;
type Init = {
  method?: string;
  body?: unknown;
  cookie?: string;
  ip?: string;
  origin?: string | null;
};

export function shopHttp(world: World, over: Partial<RuntimeOptions> = {}) {
  const cache = boxCache(":memory:");
  const options: RuntimeOptions = {
    database: world.db,
    cache: cache.cache,
    rateLimiter: boxRateLimiter(),
    secret: "shop runtime secret that is longer than thirty two bytes",
    linkSecret,
    baseURL: "https://portal.test",
    notifications: world.queue,
    ...over,
  };
  const request = (path: string, init: Init = {}) => {
    const headers = new Headers();
    if (init.origin !== null) headers.set("Origin", init.origin ?? shopOrigin);
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.body !== undefined) headers.set("content-type", "application/json");
    return serveRuntime(
      new Request(`${shopOrigin}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      { ...options, clientIP: init.ip ?? freshIp() },
    );
  };
  async function signIn(shop: { slug: string }, phone: string) {
    const started = await request(`/shop/${shop.slug}/signin`, { body: { phone } });
    if (started.status !== 202) throw new Error(`sign-in start ${started.status}`);
    const { loginId } = (await started.json()) as { loginId: string };
    const verified = await request(`/shop/${shop.slug}/signin/${loginId}/verify`, {
      body: { code: await loginCode(linkSecret, loginId, 1) },
    });
    if (verified.status !== 200) throw new Error(`sign-in verify ${verified.status}`);
    return cookieOf(verified);
  }
  return { request, signIn, options, close: () => cache.close() };
}

export function cookieOf(response: Response) {
  const match = (response.headers.get("set-cookie") ?? "").match(/shopper_shop=[^;]*/);
  if (!match) throw new Error("no shopper_shop cookie");
  return match[0];
}
