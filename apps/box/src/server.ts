import { createBoxApp } from "./app";

// Node integration tests import this entry; Hono’s Bun adapter requires the Bun runtime.
const websocket = "Bun" in globalThis ? (await import("hono/bun")).websocket : undefined;

export const app = createBoxApp();
// Bun starts this configuration when running the entry point or compiled binary.
export default {
  port: Number(process.env.PORT ?? 3001),
  idleTimeout: 30,
  websocket,
  fetch: app.fetch,
};
