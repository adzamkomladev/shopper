import type { createHubtel } from "@shopper/core/payments/hubtel";
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
  /** Wakes the MoMo refund workflow when Paystack reports a refund's outcome. */
  momoRefund?: WorkflowLauncher;
  paystackSecret?: string;
  /** Confirms Hubtel callbacks through its status API; without it Hubtel callbacks are refused. */
  hubtel?: ReturnType<typeof createHubtel>;
  /** Fetches a day's Paystack settlements; without it a refresh is unavailable. */
  settlements?: WorkflowLauncher;
  /** Runs remote manager approvals; without it a register cannot ask. */
  approvals?: WorkflowLauncher;
  /** Runs each billing period's dunning; a paid invoice wakes it to stop. */
  billing?: WorkflowLauncher;
  priceChange?: WorkflowLauncher;
  onboarding?: ReturnType<typeof createOnboarding>;
  invitations?: ReturnType<typeof createInvitations>;
  kyc?: WorkflowLauncher;
  /** Starts a store's day; a new store's chain starts today rather than at the night's watchdog. */
  storeDays?: WorkflowLauncher;
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
  momoRefund?: WorkflowLauncher;
  paystackSecret?: string;
  hubtel?: ReturnType<typeof createHubtel>;
  settlements?: WorkflowLauncher;
  approvals?: WorkflowLauncher;
  billing?: WorkflowLauncher;
  priceChange?: WorkflowLauncher;
  authFlows?: WorkflowLauncher;
  /** A cloud shop's way from signup to its first sale; the box opens no signup and has none. */
  onboarding?: WorkflowLauncher;
  kyc?: WorkflowLauncher;
  storeDays?: WorkflowLauncher;
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
