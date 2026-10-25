import type {
  AuthPrincipal,
  createDeviceService,
  createOnboarding,
  createInvitations,
} from "@shopper/auth";
import type { ShopperDatabase } from "@shopper/db-pg";
import type {
  Blobs,
  Lane,
  Queue,
  Realtime,
  Renderer,
  Sequencer,
  WorkflowLauncher,
} from "@shopper/ports";
import type { Cache } from "@shopper/ports";
import type { LiveUpgrade } from "./sync/live";

export type ApiPrincipal = AuthPrincipal;
export interface ApiAuthentication {
  resolvePrincipal(request: Request): Promise<ApiPrincipal | null>;
  hasPermission(principal: ApiPrincipal, code: string): Promise<boolean>;
  handler?: (request: Request) => Promise<Response>;
}
export type ApiEnvironment = { Variables: { principal: ApiPrincipal } };
/** What signs a customer's statement link and where the portal opens it. */
export interface StatementLinks {
  secret: string;
  baseUrl: string;
}

export interface ApiOptions {
  authentication?: ApiAuthentication;
  database?: ShopperDatabase;
  sequencer?: Sequencer;
  blobs?: Blobs;
  realtime?: Realtime;
  notifications?: Queue;
  /** Submits VAT documents to the SDC in order, per store; without it documents wait as pending. */
  lane?: Lane;
  /** Signs statement links and KYC codes; public statement reads, link creation and KYC need it. */
  linkSecret?: string;
  baseURL?: string;
  renderer?: Renderer;
  devices?: ReturnType<typeof createDeviceService>;
  // Populated by the authenticated session adapter; never derive this from request parameters.
  resolveOrgId?: (request: Request) => Promise<string | null>;
  momoPayment?: WorkflowLauncher;
  paystackSecret?: string;
  priceChange?: WorkflowLauncher;
  onboarding?: ReturnType<typeof createOnboarding>;
  invitations?: ReturnType<typeof createInvitations>;
  kyc?: WorkflowLauncher;
}

export interface RuntimeOptions {
  database: ShopperDatabase;
  sequencer?: Sequencer;
  blobs?: Blobs;
  live?: LiveUpgrade;
  realtime?: Realtime;
  notifications?: Queue;
  lane?: Lane;
  renderer?: Renderer;
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
  kyc?: WorkflowLauncher;
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
