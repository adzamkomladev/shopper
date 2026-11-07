import { createBoxApp } from "./app";
import { egressFetch } from "./egress";

// Node integration tests import this entry; Hono’s Bun adapter requires the Bun runtime.
const websocket = "Bun" in globalThis ? (await import("hono/bun")).websocket : undefined;
// Only the running box limits its egress (SHOPPER_EGRESS=off turns it off); Node tests that import it keep fetch.
if ("Bun" in globalThis && process.env.SHOPPER_EGRESS !== "off")
  globalThis.fetch = Object.assign(egressFetch(process.env), {
    preconnect: () => {},
  }) as typeof fetch;

export const app = createBoxApp();
// Bun starts this configuration when running the entry point or compiled binary.
export default {
  port: Number(process.env.PORT ?? 3001),
  idleTimeout: 30,
  websocket,
  fetch: app.fetch,
};
