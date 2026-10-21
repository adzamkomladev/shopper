import type {
  AuthPrincipal,
  createDeviceService,
  createOnboarding,
  createInvitations,
} from "@shopper/auth";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs, Queue, Realtime, Sequencer, WorkflowLauncher } from "@shopper/ports";
import type { Cache } from "@shopper/ports";
import type { LiveUpgrade } from "./sync/live";

export type ApiPrincipal = AuthPrincipal;
export interface ApiAuthentication {
  resolvePrincipal(request: Request): Promise<ApiPrincipal | null>;
  hasPermission(principal: ApiPrincipal, code: string): Promise<boolean>;
  handler?: (request: Request) => Promise<Response>;
}
export type ApiEnvironment = { Variables: { principal: ApiPrincipal } };

export interface ApiOptions {
  authentication?: ApiAuthentication;
  database?: ShopperDatabase;
  sequencer?: Sequencer;
  blobs?: Blobs;
  realtime?: Realtime;
  notifications?: Queue;
  devices?: ReturnType<typeof createDeviceService>;
  // Populated by the authenticated session adapter; never derive this from request parameters.
  resolveOrgId?: (request: Request) => Promise<string | null>;
  momoPayment?: WorkflowLauncher;
  paystackSecret?: string;
  priceChange?: WorkflowLauncher;
  onboarding?: ReturnType<typeof createOnboarding>;
  invitations?: ReturnType<typeof createInvitations>;
}

export interface RuntimeOptions {
  database: ShopperDatabase;
  sequencer?: Sequencer;
  blobs?: Blobs;
  live?: LiveUpgrade;
  realtime?: Realtime;
  notifications?: Queue;
  cache: Cache;
  secret: string;
  baseURL: string;
  orgId?: string;
  bootstrapToken?: string;
  clientIP?: string;
  momoPayment?: WorkflowLauncher;
  paystackSecret?: string;
  priceChange?: WorkflowLauncher;
  authFlows?: WorkflowLauncher;
  linkSecret?: string;
  publicOnboarding?: boolean;
}

export interface PortalHost {
  version: string;
  environment: string;
  publicOnboarding: boolean;
}
export interface PortalHealth {
  database: "ok" | "error";
  cache: "ok" | "error";
  blobs: "ok" | "error";
}
/** What a host injects into the portal's server entry: the API plus the host-only server functions. */
export interface PortalContext {
  portalRuntime: (request: Request) => Promise<Response>;
  portalHost: () => PortalHost;
  portalHealth: () => Promise<PortalHealth>;
}
