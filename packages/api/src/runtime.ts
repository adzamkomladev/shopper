import { invitationTokenInput } from "./schemas/runtime";
import type { RuntimeOptions } from "./types";
export type { RuntimeOptions } from "./types";

import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { AuthLinkError, createAuth, createOnboarding, createInvitations } from "@shopper/auth";
import { createDeviceService } from "@shopper/auth/devices";
import { managementId } from "@shopper/core/management";

import { createSyncRoutes } from "./sync/routes";
import { createApi } from "./app";
import { orgRoutes } from "./routes/orgs";
import { refuseCrossSite, secureHeaders } from "./middleware/hardening";
import { enforceRateLimit } from "./middleware/public/limits";

export const publicApi = createApi();
export function isPublicRequest(request: Request) {
  const path = new URL(request.url).pathname;
  return !/^\/(?:payments(?:\/|$)|webhooks\/(?:paystack|hubtel)$|api\/auth(?:\/|$)|sync(?:\/|$)|stores(?:\/|$)|branches(?:\/|$)|tax-rules$|tax(?:\/|$)|devices(?:\/|$)|shifts(?:\/|$)|audit(?:\/|$)|stock(?:\/|$)|reports(?:\/|$)|customers(?:\/|$)|kyc(?:\/|$)|loyalty(?:\/|$)|settings(?:\/|$)|transactions(?:\/|$)|reconciliation(?:\/|$)|approvals(?:\/|$)|billing(?:\/|$)|kyb(?:\/|$)|platform(?:\/|$)|setup(?:\/|$)|public\/statements(?:\/|$)|cashiers(?:\/|$)|(?:orgs|products|categories|suppliers|prices|barcodes|catalogue|users|roles|permissions|session|onboarding|invitations)(?:\/|$))/.test(
    path,
  );
}
export function runtimeUnavailable() {
  return Response.json({ error: "Authentication service unavailable" }, { status: 503 });
}
export async function serveRuntime(request: Request, options: RuntimeOptions): Promise<Response> {
  return secureHeaders(request, await route(request, options), options.baseURL);
}

async function route(request: Request, options: RuntimeOptions): Promise<Response> {
  if (isPublicRequest(request)) return publicApi.fetch(request);
  // A short key makes every session and emailed link forgeable; refuse to sign anything with it.
  if (weak(options.secret) || (options.linkSecret !== undefined && weak(options.linkSecret)))
    return runtimeUnavailable();
  const refused = await enforceRateLimit(
    request,
    options.rateLimiter,
    options.clientIP,
    options.orgId,
  );
  if (refused) return refused;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/public/statements/")) {
    if (!options.linkSecret) return runtimeUnavailable();
    return createApi({
      database: options.database,
      linkSecret: options.linkSecret,
      renderer: options.renderer,
    }).fetch(request);
  }
  if (/^\/orgs(?:\/|$)/.test(url.pathname)) return orgRoutes(options).fetch(request);
  // The admin sign-in names the platform org before there is a session or a shop to select.
  if (url.pathname === "/platform/org")
    return createApi({ database: options.database, platform: options.platform }).fetch(request);
  const headers = new Headers(request.headers);
  headers.delete("X-Shopper-Client-IP");
  if (options.clientIP) headers.set("X-Shopper-Client-IP", options.clientIP);
  // Bun upgrades require the original request carrying the server connection.
  if (url.pathname !== "/sync/live") request = new Request(request, { headers });
  const crossSite = refuseCrossSite(request, options.baseURL);
  if (crossSite) return crossSite;
  if (/^\/sync(?:\/|$)/.test(url.pathname)) {
    if (!options.sequencer) return runtimeUnavailable();
    return createSyncRoutes({
      database: options.database,
      devices: createDeviceService(
        options.database,
        options.cache,
        buildInfo.version,
        options.orgId,
      ),
      sequencer: options.sequencer,
      blobs: options.blobs,
      live: options.live,
      notifications: options.notifications,
      lane: options.lane,
      minTillVersion: options.minTillVersion,
    }).fetch(request);
  }
  const linkOptions =
    options.authFlows && options.linkSecret
      ? {
          database: options.database,
          linkSecret: options.linkSecret,
          baseURL: options.baseURL,
          launcher: options.authFlows,
        }
      : undefined;
  if (/^\/onboarding(?:\/|$)/.test(url.pathname)) {
    if (!options.publicOnboarding || options.orgId)
      return Response.json({ error: "Public registration is closed" }, { status: 403 });
    if (!linkOptions) return runtimeUnavailable();
    return createApi({
      onboarding: createOnboarding({ ...linkOptions, onboarding: options.onboarding }),
    }).fetch(request);
  }
  const invitations = linkOptions ? createInvitations(linkOptions) : undefined;
  const invite = url.pathname.match(/^\/invitations\/([^/]+)\/(preview|accept)$/);
  let invitationOrg: string | undefined;
  if (invite) {
    if (!invitations) return runtimeUnavailable();
    let token: unknown = url.searchParams.get("token");
    if (request.method === "POST") {
      try {
        const body: unknown = await request.clone().json();
        token = v.parse(invitationTokenInput, body).token;
      } catch {
        return Response.json({ error: "Invalid request data" }, { status: 400 });
      }
    }
    try {
      invitationOrg = (
        await invitations.preview(invite[1]!, typeof token === "string" ? token : "")
      ).orgId;
    } catch (error) {
      if (error instanceof AuthLinkError)
        return Response.json({ error: error.message }, { status: error.status });
      if (v.isValiError(error))
        return Response.json({ error: "Invalid request data" }, { status: 400 });
      throw error;
    }
    if (options.orgId && invitationOrg !== options.orgId.toLowerCase())
      return Response.json({ error: "This invitation belongs to another shop" }, { status: 403 });
  }
  if (url.pathname === "/webhooks/paystack" || url.pathname === "/webhooks/hubtel")
    return createApi({
      database: options.database,
      momoPayment: options.momoPayment,
      momoRefund: options.momoRefund,
      paystackSecret: options.paystackSecret,
      hubtel: options.hubtel,
      realtime: options.realtime,
      billing: options.billing,
    }).fetch(request);
  const selected = request.headers.get("X-Shopper-Org");
  const parsed = v.safeParse(managementId, invitationOrg ?? options.orgId ?? selected);
  if (!parsed.success || (selected && selected.toLowerCase() !== parsed.output.toLowerCase()))
    return Response.json({ error: "A valid tenant selector is required" }, { status: 400 });
  const authentication = createAuth({
    database: options.database,
    orgId: parsed.output,
    secret: options.secret,
    baseURL: options.baseURL,
    bootstrapToken: options.bootstrapToken,
  });
  const devices = createDeviceService(
    options.database,
    options.cache,
    buildInfo.version,
    parsed.output,
  );
  const resolvePrincipal = async (request: Request) => {
    const device = await devices.resolveDevicePrincipal(request);
    // An offline session reaches only MoMo and approvals, whose checks honour its own permissions; commands
    // elsewhere authorise by role alone.
    if (device)
      return device.orgId.toLowerCase() === parsed.output.toLowerCase() &&
        !device.sessionPermissions
        ? device
        : null;
    return authentication.resolvePrincipal(request);
  };
  return createApi({
    database: options.database,
    authentication: { ...authentication, resolvePrincipal },
    devices,
    priceChange: options.priceChange,
    momoPayment: options.momoPayment,
    momoRefund: options.momoRefund,
    paystackSecret: options.paystackSecret,
    hubtel: options.hubtel,
    settlements: options.settlements,
    approvals: options.approvals,
    billing: options.billing,
    realtime: options.realtime,
    invitations,
    blobs: options.blobs,
    notifications: options.notifications,
    lane: options.lane,
    linkSecret: options.linkSecret,
    baseURL: options.baseURL,
    kyc: options.kyc,
    storeDays: options.storeDays,
    kyb: options.kyb,
    platform: options.platform,
  }).fetch(request);
}

const weak = (secret: string) => new TextEncoder().encode(secret).length < 32;
