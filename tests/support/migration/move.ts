import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { boxArchiveImport, boxCache, boxCloudMove, boxSequencer } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { createDeviceService } from "@shopper/auth/devices";
import { buildInfo } from "@shopper/config";
import { generateKey, issueLicence, signedRequest } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import { requestCloudMove } from "@shopper/export";
import { sha256 } from "@shopper/utils";
import { exportFixture } from "../export/org";
import { diskBlobs, emptyDatabase } from "./archive";

/** The cloud's API origin, as a box names it and its registers reach it. */
export const CLOUD = "https://cloud.shopper.test";

type Send = (
  url: string,
  init: { method: string; body?: string | Uint8Array },
) => Promise<Response>;

/**
 * A licensed box with a trading shop and two enrolled registers, and an empty cloud, both in-process: `move()` runs
 * the owner's "Move to cloud" to the end on both engines. `intercept` sits on the box's line to the cloud.
 */
export async function boxAndCloud(
  intercept?: (url: string, init: Parameters<Send>[1], send: Send) => Promise<Response>,
) {
  const f = await exportFixture();
  const storage = await diskBlobs();
  const b = await emptyDatabase();
  const issuer = await generateKey();
  const key = await generateKey();
  const identity = {
    key: key.privateKey,
    licence: await issueLicence(issuer.privateKey, {
      id: v7(),
      org: f.ctx.orgId,
      site: "Accra Mall",
      machine: "a".repeat(64),
      key: key.publicKey,
      terminals: 5,
      issuedAt: new Date().toISOString(),
      maintenanceUntil: "2027-11-14",
    }),
  };
  const caches = [boxCache(":memory:"), boxCache(":memory:")];
  const imports = boxArchiveImport({ database: b.db, blobs: b.blobs });
  const cloud = createApi({
    database: b.db,
    blobs: b.blobs,
    licenceSigningKey: issuer.privateKey,
    archiveImports: imports.launcher,
    devices: createDeviceService(b.db, caches[0]!.cache, f.ctx.appVersion),
    sequencer: boxSequencer(b.db),
  });
  const send: Send = async (url, init) => cloud.fetch(await signedRequest(identity, url, init));
  const move = boxCloudMove({
    database: f.db,
    blobs: storage.blobs,
    cloud: (url, init) => (intercept ? intercept(url, init, send) : send(url, init)),
  });
  const box = createApi({
    database: f.db,
    devices: createDeviceService(f.db, caches[1]!.cache, f.ctx.appVersion),
    sequencer: boxSequencer(f.db),
    cloudMoves: move.launcher,
  });
  const [first] = await f.db
    .select()
    .from(schema.device)
    .where(eq(schema.device.id, f.sale.deviceId));
  const [second] = await f.db
    .insert(schema.device)
    .values({ orgId: f.ctx.orgId, branchId: first!.branchId, name: "Till 2" })
    .returning();
  const registers = await Promise.all(
    [first!, second!].map(async (register, index) => {
      const token = String(index + 1).repeat(64);
      await f.db
        .insert(schema.deviceCredential)
        .values({ orgId: f.ctx.orgId, deviceId: register.id, tokenHash: await sha256(token) })
        .onConflictDoUpdate({
          target: [schema.deviceCredential.orgId, schema.deviceCredential.deviceId],
          set: { tokenHash: await sha256(token), revokedAt: null },
        });
      return { ...register, token };
    }),
  );
  return {
    f,
    b,
    issuer,
    box,
    cloud,
    registers,
    /** The owner presses "Move to cloud": the box is read-only from here, and the move runs in the background. */
    start: () =>
      requestCloudMove(f.db, { ...f.ctx, actorId: f.userId }, move.launcher, {
        cloudUrl: `${CLOUD}/`,
      }),
    /** Both engines run to the end: the box's move, then the cloud's import. */
    settle: async () => {
      await move.launcher.idle?.();
      await imports.launcher.idle?.();
    },
    close: async () => {
      for (const cache of caches) cache.close();
      await f.close();
      await storage.remove();
      await b.close();
    },
  };
}

/** A register's sync call to a server, as its push worker makes it. */
export function tillCall(
  server: { request(path: string, init?: RequestInit): Response | Promise<Response> },
  register: { id: string },
  token: string,
) {
  return async (path: string, body: unknown) =>
    server.request(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "x-shopper-device": register.id,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
}

/** The handshake a register opens every connection with. */
export async function handshake(call: ReturnType<typeof tillCall>, receiptLastUsed: number) {
  const response = await call("/sync/handshake", {
    requestId: v7(),
    appVersion: buildInfo.version,
    protocol: buildInfo.syncProtocol,
    receiptLastUsed,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
