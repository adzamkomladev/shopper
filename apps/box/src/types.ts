import type { BoxWebSocketServer } from "@shopper/adapters-box";

export type BoxBindings = Partial<BoxWebSocketServer> & {
  requestIP?: (request: Request) => { address: string } | null;
};

/** The files embedded in the sealed binary (see pack.ts). */
export type Pack = Awaited<ReturnType<typeof import("./pack").openPack>>;

/** Where the portal's files come from: a folder on disk, or the pack embedded in the sealed binary. */
export type PortalSource = (pathname: string) => Promise<Blob | undefined>;
