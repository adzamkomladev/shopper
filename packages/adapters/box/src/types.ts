import type { BunWebSocketData } from "hono/bun";

export type BoxWebSocketServer = {
  upgrade(request: Request, options: { data: BunWebSocketData }): boolean;
};
