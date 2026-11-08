import { boxServer } from "./serve";

// Node integration tests import this entry; Hono’s Bun adapter requires the Bun runtime. The sealed binary
// starts from main.ts instead: bytecode cannot hold this top-level await.
const websocket = "Bun" in globalThis ? (await import("hono/bun")).websocket : undefined;
const server = boxServer(websocket);

export const app = server.app;
// Bun starts this configuration when running the entry point.
export default server.config;
