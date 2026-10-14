import type { Blobs, Cache, Sequencer, WorkflowLauncher } from "@shopper/ports";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { AuthLinkError, createAuth, createOnboarding, createInvitations } from "@shopper/auth";
import { createDeviceService } from "@shopper/auth/devices";
import { managementId } from "@shopper/core/management";
import type { ShopperDatabase } from "@shopper/db-pg";
import { createSyncRoutes } from "./sync/routes";
import { createApi } from "./app";
import { orgRoutes } from "./routes/orgs";
import { allowPublicAuth } from "./middleware/public-auth";

export interface RuntimeOptions {
  database: ShopperDatabase;
  sequencer?: Sequencer;
  blobs?: Blobs;
  cache: Cache;
  secret: string;
  baseURL: string;
  orgId?: string;
  bootstrapToken?: string;
  clientIP?: string;
  priceChange?: WorkflowLauncher;
  authFlows?: WorkflowLauncher;
  linkSecret?: string;
  publicOnboarding?: boolean;
}
export const publicApi = createApi();
export function isPublicRequest(request: Request) {
  const path = new URL(request.url).pathname;
  return !/^\/(?:api\/auth(?:\/|$)|sync(?:\/|$)|stores(?:\/|$)|branches(?:\/|$)|tax-rules$|devices(?:\/|$)|cashiers(?:\/|$)|(?:orgs|products|categories|suppliers|prices|barcodes|catalogue|users|roles|permissions|session|onboarding|invitations)(?:\/|$))/.test(
    path,
  );
}
export function runtimeUnavailable() {
  return Response.json({ error: "Authentication service unavailable" }, { status: 503 });
}
export async function serveRuntime(request: Request, options: RuntimeOptions): Promise<Response> {
  if (isPublicRequest(request)) return publicApi.fetch(request);
  const url = new URL(request.url);
  if (/^\/orgs(?:\/|$)/.test(url.pathname)) return orgRoutes(options).fetch(request);
  const headers = new Headers(request.headers);
  headers.delete("X-Shopper-Client-IP");
  if (options.clientIP) headers.set("X-Shopper-Client-IP", options.clientIP);
  request = new Request(request, { headers });
  const origin = request.headers.get("Origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    origin &&
    origin !== new URL(options.baseURL).origin
  )
    return Response.json({ error: "Origin is not allowed" }, { status: 403 });
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
    if (
      request.method === "POST" &&
      !allowPublicAuth(options.clientIP, url.pathname.split("/").at(-1) ?? "auth")
    )
      return Response.json({ error: "Too many requests" }, { status: 429 });
    return createApi({ onboarding: createOnboarding(linkOptions) }).fetch(request);
  }
  const invitations = linkOptions ? createInvitations(linkOptions) : undefined;
  const invite = url.pathname.match(/^\/invitations\/([^/]+)\/(preview|accept)$/);
  let invitationOrg: string | undefined;
  if (invite) {
    if (!invitations) return runtimeUnavailable();
    if (
      request.method === "POST" &&
      !allowPublicAuth(options.clientIP, url.pathname.split("/").at(-1) ?? "auth")
    )
      return Response.json({ error: "Too many requests" }, { status: 429 });
    let token: unknown = url.searchParams.get("token");
    if (request.method === "POST") {
      try {
        const body: unknown = await request.clone().json();
        token = v.parse(v.object({ token: v.string() }), body).token;
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
    if (device) return device.orgId.toLowerCase() === parsed.output.toLowerCase() ? device : null;
    return authentication.resolvePrincipal(request);
  };
  return createApi({
    database: options.database,
    authentication: { ...authentication, resolvePrincipal },
    devices,
    priceChange: options.priceChange,
    invitations,
  }).fetch(request);
}
