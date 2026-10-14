import type { BoxWebSocketServer } from "@shopper/adapters-box";

export type BoxBindings = Partial<BoxWebSocketServer> & {
  requestIP?: (request: Request) => { address: string } | null;
};
