import { v7 } from "uuid";
import { serveRuntime } from "@shopper/api/runtime";
import { boxSequencer } from "@shopper/adapters-box";
import { serveHono, type HttpClient } from "./http";
import {
  cache,
  context,
  databases,
  deviceId,
  deviceToken,
  devices,
  principal,
  routeFactory,
  syncProtocol,
  type SaleEvent,
} from "./server";

export function syncHeaders(org = context.orgId): Record<string, string> {
  return {
    authorization: `Bearer ${deviceToken}`,
    "X-Shopper-Device": deviceId,
    "X-Shopper-Org": org,
    "content-type": "application/json",
  };
}

export async function push(
  target: { request(path: string, init?: RequestInit): Promise<Response> },
  event: SaleEvent,
  proof: string,
  sessionId: string,
  org = context.orgId,
  requestId = v7(),
) {
  return target.request("/sync/push", {
    method: "POST",
    headers: syncHeaders(org),
    body: JSON.stringify({
      requestId,
      protocol: syncProtocol,
      events: [event],
      proofs: [{ sessionId, proof }],
    }),
  });
}

export async function pushEvents(
  target: { request(path: string, init?: RequestInit): Promise<Response> },
  events: unknown[],
  proofs: { sessionId: string; proof: string }[],
  org = context.orgId,
  requestId = v7(),
) {
  return target.request("/sync/push", {
    method: "POST",
    headers: syncHeaders(org),
    body: JSON.stringify({ requestId, protocol: syncProtocol, events, proofs }),
  });
}

export async function createSyncApi(
  protocol = syncProtocol,
  sequencing: ReturnType<typeof boxSequencer> = boxSequencer(databases().db),
): Promise<HttpClient> {
  return serveHono(
    routeFactory({ database: databases().db, devices, sequencer: sequencing, protocol }),
  );
}

export async function createRuntimeApi(): Promise<HttpClient> {
  const { db } = databases();
  const sequencing = boxSequencer(db);
  return serveHono({
    fetch: (request) =>
      serveRuntime(request, {
        database: db,
        cache: cache.cache,
        secret: "sync-runtime-integration-secret-with-32-bytes",
        baseURL: "http://127.0.0.1",
        orgId: context.orgId,
        sequencer: sequencing,
      }),
  });
}

export async function revokeDevice() {
  await devices.revoke(principal, { deviceId });
}

export function createFailOnceSequencer() {
  const base = boxSequencer(databases().db);
  let failed = false;
  return {
    ...base,
    async assignSale(orgId: string, storeId: string, sourceDeviceId: string, localId: string) {
      if (!failed) {
        failed = true;
        throw new Error("injected sequencing outage");
      }
      return base.assignSale(orgId, storeId, sourceDeviceId, localId);
    },
  };
}
