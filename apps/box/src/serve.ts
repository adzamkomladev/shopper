import { createBoxApp } from "./app";
import { egressFetch } from "./egress";
import type { PortalSource } from "./types";

/**
 * The box's app and its Bun server configuration. Only a running box limits its egress (SHOPPER_EGRESS=off turns it
 * off); Node tests that import the box keep their `fetch`. `websocket` is Bun's handler from `hono/bun`.
 */
export function boxServer(websocket: unknown, portal?: PortalSource) {
  if ("Bun" in globalThis && process.env.SHOPPER_EGRESS !== "off")
    globalThis.fetch = Object.assign(egressFetch(process.env), {
      preconnect: () => {},
    }) as typeof fetch;
  const app = createBoxApp(process.env, { portal });
  return {
    app,
    config: {
      port: Number(process.env.PORT ?? 3001),
      idleTimeout: 30,
      websocket,
      fetch: app.fetch,
    },
  };
}
