import type { UpdatesResponse } from "@shopper/core/release";
import type { createHubtel } from "@shopper/core/payments/hubtel";
import type { createPaystack } from "@shopper/core/payments/paystack";
import type {
  AuthPrincipal,
  createDeviceService,
  createOnboarding,
  createInvitations,
} from "@shopper/auth";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { LicenceStatus } from "@shopper/core/licence";
import type { ShopAccess, ShopSession } from "@shopper/core/shop";
import type {
  Blobs,
  Lane,
  Queue,
  Realtime,
  Renderer,
  Sequencer,
  StockHolds,
  WorkflowLauncher,
} from "@shopper/ports";
import type { Cache, RateLimiter } from "@shopper/ports";
import type { LiveUpgrade } from "./sync/live";

export type ApiPrincipal = AuthPrincipal;
export interface ApiAuthentication {
  resolvePrincipal(request: Request): Promise<ApiPrincipal | null>;
  hasPermission(principal: ApiPrincipal, code: string): Promise<boolean>;
  handler?: (request: Request) => Promise<Response>;
}
export type ApiEnvironment = { Variables: { principal: ApiPrincipal } };
export type ShopEnvironment = { Variables: { shopper: ShopSession } };
/** Answers whether a Turnstile token from the shop's sign-in form is a person's, for this client address. */
export type Turnstile = (token: string, clientIP?: string) => Promise<boolean>;
/** The shopper-facing routes: phone sign-in at one shop and the signed-in account. */
export interface ShopOptions {
  database: ShopperDatabase;
  access: ShopAccess;
  /** Stamped on every shopper command's audit row. */
  appVersion: string;
  blobs?: Blobs;
  turnstile?: Turnstile;
  clientIP?: string;
  /** The box serves one shop; any other shop code is unknown there. */
  orgId?: string;
  /** Starts each placed order's workflow; without it the shop takes no orders. */
  orderFlows?: WorkflowLauncher;
  /** Arms the expiry of the stock a checkout holds. */
  stockHolds?: StockHolds;
  /** Starts each payment attempt's workflow; without it placed orders cannot be paid. */
  orderPayments?: WorkflowLauncher;
  /** Starts each handed-over order's review workflow and wakes it with the shopper's review or a moderator's call. */
  orderReviews?: WorkflowLauncher;
  /** Opens Paystack's hosted checkout for card payments; without it only mobile money can be paid. */
  paystack?: Pick<ReturnType<typeof createPaystack>, "initialize">;
  /** Checks the signed review links texted to shoppers. */
  linkSecret: string;
}
/** What signs a customer's statement link and where the portal opens it. */
export interface StatementLinks {
  secret: string;
  baseUrl: string;
}

export interface ApiOptions {
  authentication?: ApiAuthentication;
  shop?: Omit<ShopOptions, "database">;
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
  /** Wakes an online order's workflow (`payment.settled`) when a webhook confirms its payment. */
  orderFlows?: WorkflowLauncher;
  /** Wakes an order payment attempt's workflow when its webhook arrives. */
  orderPayments?: WorkflowLauncher;
  /** Starts each handed-over order's review workflow and wakes it with the shopper's review or a moderator's call. */
  orderReviews?: WorkflowLauncher;
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
  /** Runs a full copy of the business (the Shopper Archive); without it the Export screen offers spreadsheets only. */
  archiveExports?: WorkflowLauncher;
  /** Cloud only: imports an archive a licensed box moves in (with `licenceSigningKey` and `blobs`). */
  archiveImports?: WorkflowLauncher;
  /** Box only: moves the shop into the cloud; once started the box takes no more changes. */
  cloudMoves?: WorkflowLauncher;
  /** Starts a store's day; a new store's chain starts today rather than at the night's watchdog. */
  storeDays?: WorkflowLauncher;
  /** Business verification for payouts, cloud only: the Paystack banks a payout can settle to. */
  kyb?: { banks(): Promise<{ name: string; code: string; type: string }[]> };
  /** The admin app's API, cloud only: the org whose members are Shopper staff, by its code. */
  platform?: { orgSlug: string };
  /** SHOPPER_MIN_TILL_VERSION: the handshake tells tills below it to update before their next shift. */
  minTillVersion?: string;
  /** Box only: where its registers find till updates, a path on the box's own origin (the running slot's till/). */
  tillFeed?: string;
  /** The box's licence, box only: a locked one turns the back office read-only (tills never lock). */
  licence?: BoxLicence;
  /** The box's update bundles, box only. */
  updates?: BoxUpdates;
  /** The issuer's Ed25519 private JWK, cloud only: it confirms box check-ins. */
  licenceSigningKey?: string;
}

/** The box's update bundles (box only): see apps/box/src/updates. */
export interface BoxUpdates {
  overview(): Promise<UpdatesResponse>;
  /**
   * Backs up, stages and hands over now; the box restarts into the new slot a moment later. A tax rule pack is applied
   * at once instead, and says how many rules it changed.
   */
  install(
    file: string,
    who: { orgId: string; actorId?: string },
  ): Promise<{ kind: "update" } | { kind: "taxpack"; applied: number }>;
  /** The same, at `at` (an ISO time, "after closing"). */
  schedule(file: string, at: string, who: { orgId: string; actorId?: string }): Promise<void>;
  /** Cancels the scheduled update, if any, and records who did. */
  cancel(who: { orgId: string; actorId?: string }): Promise<void>;
}

/** An update the box refuses, with the sentence the owner reads. */
export class BoxUpdateError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

export interface BoxLicence {
  /** Where the licence stands, with the request code Shopper issues a licence from. */
  status(): Promise<LicenceStatus & { request: string }>;
  /** A licence-signed check-in to the cloud; the confirmation it returns resets the 60-day ladder. */
  checkIn(): Promise<LicenceStatus & { request: string; error?: string }>;
  /** A request to the cloud signed with this box's licence (moving to the cloud). */
  send(url: string, init: { method: string; body?: string | Uint8Array }): Promise<Response>;
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
  /** Budgets every unauthenticated entry point: sign-in, enrolment, cashier sign-in, public links. */
  rateLimiter: RateLimiter;
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
  archiveExports?: WorkflowLauncher;
  /** Cloud only: imports an archive a licensed box moves in (with `licenceSigningKey` and `blobs`). */
  archiveImports?: WorkflowLauncher;
  /** Box only: moves the shop into the cloud; once started the box takes no more changes. */
  cloudMoves?: WorkflowLauncher;
  storeDays?: WorkflowLauncher;
  kyb?: ApiOptions["kyb"];
  platform?: ApiOptions["platform"];
  minTillVersion?: string;
  tillFeed?: string;
  linkSecret?: string;
  publicOnboarding?: boolean;
  /** Verifies the shop sign-in form's Turnstile token; without it (the box, development) no check runs. */
  turnstile?: Turnstile;
  orderFlows?: WorkflowLauncher;
  stockHolds?: StockHolds;
  /** Starts each online payment attempt's workflow. */
  orderPayments?: WorkflowLauncher;
  /** Starts each handed-over order's review workflow and wakes it with the shopper's review or a moderator's call. */
  orderReviews?: WorkflowLauncher;
  /** Paystack's client: opens the hosted checkout for card payments. */
  paystack?: ShopOptions["paystack"];
  licence?: BoxLicence;
  updates?: BoxUpdates;
  licenceSigningKey?: string;
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
/** What the shop Worker hands TanStack Start: the shopper API at `/api/shop/*`, wherever it runs. */
export interface ShopContext {
  shopApi: (request: Request) => Promise<Response>;
}

export interface PortalContext {
  portalRuntime: (request: Request) => Promise<Response>;
  portalHost: () => PortalHost;
  portalHealth: () => Promise<PortalHealth>;
}
