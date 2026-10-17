import type { MiddlewareHandler } from "hono";

/** Refuses any request whose Host is not this loopback listener, which stops DNS rebinding. */
export function loopbackGuard(port: () => number): MiddlewareHandler {
  return async (c, next) => {
    const host = c.req.header("host");
    if (host !== `127.0.0.1:${port()}` && host !== `localhost:${port()}`)
      return c.text("Misdirected request", 421);
    await next();
  };
}
