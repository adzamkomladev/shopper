import type { BoxWebSocketServer } from "@shopper/adapters-box";

export type BoxBindings = Partial<BoxWebSocketServer> & {
  requestIP?: (request: Request) => { address: string } | null;
};

/** The files embedded in the sealed binary (see pack.ts). */
export type Pack = Awaited<ReturnType<typeof import("./pack").openPack>>;

/** Where the portal's files come from: a folder on disk, or the pack embedded in the sealed binary. */
export type PortalSource = (pathname: string) => Promise<Blob | undefined>;

/** Test seams, and what the sealed binary passes: the issuer is a build define; its embedded portal and wasm replace SHOPPER_PORTAL_DIR and node_modules. */
export type BoxOptions = {
  licenceIssuer?: string;
  fetch?: (request: Request) => Promise<Response>;
  portal?: PortalSource;
  wasm?: () => Promise<Uint8Array>;
};
