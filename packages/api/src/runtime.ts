import type { WorkflowLauncher } from "@shopper/ports";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { createDeviceService } from "@shopper/auth/devices";
import type { Cache } from "@shopper/ports";
import { createAuth } from "@shopper/auth";
import { managementId } from "@shopper/core/management";
import type { ShopperDatabase } from "@shopper/db-pg";
import { createApi } from "./app";
import { orgRoutes } from "./routes/orgs";

export interface RuntimeOptions {
  database: ShopperDatabase;
  cache: Cache;
  secret: string;
  baseURL: string;
  orgId?: string;
  bootstrapToken?: string;
  clientIP?: string;
  priceChange?: WorkflowLauncher;
}
export const publicApi = createApi();
export function isPublicRequest(request: Request) {
  const path = new URL(request.url).pathname;
  return !/^\/(?:api\/auth(?:\/|$)|stores(?:\/|$)|branches(?:\/|$)|tax-rules$|devices(?:\/|$)|cashiers(?:\/|$)|(?:orgs|products|categories|suppliers|prices|barcodes|catalogue)(?:\/|$))/.test(
    path,
  );
}
export function runtimeUnavailable() {
  return Response.json({ error: "Authentication service unavailable" }, { status: 503 });
}
export async function serveRuntime(request: Request, options: RuntimeOptions): Promise<Response> {
  if (isPublicRequest(request)) return publicApi.fetch(request);
  // The shop code lookup is how a browser finds its tenant, so it runs before the tenant checks.
  if (/^\/orgs(?:\/|$)/.test(new URL(request.url).pathname))
    return orgRoutes(options).fetch(request);
  const headers = new Headers(request.headers);
  headers.delete("X-Shopper-Client-IP");
  if (options.clientIP) headers.set("X-Shopper-Client-IP", options.clientIP);
  request = new Request(request, { headers });
  const origin = request.headers.get("Origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    origin &&
    origin !== new URL(options.baseURL).origin
  ) {
    return Response.json({ error: "Origin is not allowed" }, { status: 403 });
  }
  const selected = request.headers.get("X-Shopper-Org");
  const orgId = options.orgId ?? selected;
  const parsed = v.safeParse(managementId, orgId);
  if (
    !parsed.success ||
    (options.orgId && selected && selected.toLowerCase() !== options.orgId.toLowerCase())
  ) {
    return Response.json({ error: "A valid tenant selector is required" }, { status: 400 });
  }
  // Selecting a tenant scopes session lookup; it never grants an identity or permission.
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
  }).fetch(request);
}
