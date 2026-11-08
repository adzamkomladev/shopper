import { createBoxApp } from "./app";
import { egressFetch } from "./egress";
import type { Pack } from "./types";
import { portalPack } from "./portal";

/**
 * The box's app and its Bun server configuration. Only a running box limits its egress (SHOPPER_EGRESS=off turns it
 * off); Node tests that import the box keep their `fetch`. `websocket` is Bun's handler from `hono/bun`.
 */
export function boxServer(websocket: unknown, pack?: Pack) {
  if ("Bun" in globalThis && process.env.SHOPPER_EGRESS !== "off")
    globalThis.fetch = Object.assign(egressFetch(process.env), {
      preconnect: () => {},
    }) as typeof fetch;
  const app = createBoxApp(process.env, {
    portal: pack && portalPack(pack),
    wasm:
      pack && (async () => new Uint8Array(await pack.file("wasm/index_bg.wasm")!.arrayBuffer())),
  });
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
