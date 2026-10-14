import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as v from "valibot";
import { negotiateProtocol } from "@shopper/sync/versions";
import { buildInfo } from "@shopper/config";
import { acceptSale, SaleError } from "@shopper/core/sales";
import { issueReceiptBlocks } from "@shopper/core/till";
import { managementId } from "@shopper/core/management";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs, Sequencer } from "@shopper/ports";
import type { createDeviceService } from "@shopper/auth/devices";
import { createLiveRoutes, type LiveUpgrade } from "./live";
import { createPullRoutes } from "./pull";
import { createSnapshotRoutes } from "./snapshot";

const maxBatch = 200;
const maxBytes = 1024 * 1024;
const protocolSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const receiptLastUsed = v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(0)), 0);
const handshake = v.strictObject({
  requestId: managementId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  protocol: protocolSchema,
  receiptLastUsed,
});
const envelope = v.strictObject({
  requestId: managementId,
  protocol: protocolSchema,
  receiptLastUsed,
  events: v.pipe(v.array(v.unknown()), v.maxLength(maxBatch)),
  proofs: v.pipe(
    v.array(
      v.strictObject({
        sessionId: managementId,
        proof: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
      }),
    ),
    v.maxLength(maxBatch),
  ),
});
const identity = v.object({ sale: v.object({ localId: managementId }) });
export function createSyncRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  sequencer: Sequencer;
  protocol?: number;
  live?: LiveUpgrade;
  blobs?: Blobs;
  now?: () => number;
}) {
  const protocol = options.protocol ?? buildInfo.syncProtocol;
  const app = new Hono();
  app.use(
    "/sync/*",
    bodyLimit({
      maxSize: maxBytes,
      onError: (c) => c.json({ error: "Upload exceeds byte limit" }, 413),
    }),
  );
  app.onError((error, c) => {
    if (v.isValiError(error) || error instanceof SyntaxError)
      return c.json({ error: "Malformed sync envelope" }, 400);
    return c.json({ error: "Sync service unavailable" }, 503);
  });
  app.route("/", createLiveRoutes(options));
  app.route("/", createPullRoutes({ ...options, protocol }));
  app.route("/", createSnapshotRoutes({ ...options, protocol }));
  app.post("/sync/handshake", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(handshake, await c.req.json());
    if (negotiateProtocol(protocol, data.protocol) === undefined)
      return c.json({ error: "Incompatible sync protocol" }, 409);
    if (data.protocol === 1)
      return c.json({
        requestId: data.requestId,
        appVersion: buildInfo.version,
        protocol: data.protocol,
      });
    return c.json({
      requestId: data.requestId,
      appVersion: buildInfo.version,
      protocol: data.protocol,
      serverTime: new Date((options.now ?? Date.now)()).toISOString(),
      receipts: await issueReceiptBlocks(
        options.database,
        principal,
        data.receiptLastUsed,
        data.appVersion,
      ),
    });
  });
  app.post("/sync/push", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(envelope, await c.req.json());
    if (negotiateProtocol(protocol, data.protocol) === undefined)
      return c.json({ error: "Incompatible sync protocol" }, 409);
    // Correlate the entire envelope before accepting any event.
    const ids = data.events.map((event) => v.parse(identity, event).sale.localId);
    const proofs = new Map<string, string>();
    for (const row of data.proofs) {
      if (proofs.has(row.sessionId)) return c.json({ error: "Duplicate session proof" }, 400);
      proofs.set(row.sessionId, row.proof);
    }
    const accepted: { localId: string; sequence: string; occurredAt: string }[] = [];
    const rejected: { localId: string; code: string; message: string }[] = [];
    for (const [index, raw] of data.events.entries()) {
      // The validated identity list has one entry for every event, in the same order.
      const localId = ids[index]!;
      const version = v.safeParse(v.object({ v: v.picklist([1, 2]) }), raw);
      if (!version.success) {
        rejected.push({
          localId,
          code: "UNSUPPORTED_EVENT_VERSION",
          message: "Unsupported sale event version",
        });
        continue;
      }
      let occurredAt: string;
      try {
        const session = v.parse(v.object({ sale: v.object({ sessionId: managementId }) }), raw);
        const result = await acceptSale(
          options.database,
          principal,
          raw,
          proofs.get(session.sale.sessionId) ?? "",
          options.now,
        );
        occurredAt = result.occurredAt;
      } catch (error) {
        const postgresError = error as { code?: string; cause?: { code?: string } };
        const failure =
          (postgresError?.code ?? postgresError?.cause?.code) === "23505"
            ? new SaleError("CONFLICT", "Sale or line identity already exists")
            : error;
        if (
          failure instanceof SaleError ||
          v.isValiError(failure) ||
          failure instanceof RangeError
        ) {
          rejected.push({
            localId,
            code: failure instanceof SaleError ? failure.code : "INVALID_EVENT",
            message: failure instanceof SaleError ? failure.message : "Invalid sale snapshot",
          });
          continue;
        }
        return c.json({ error: "Sale acceptance unavailable" }, 503);
      }
      try {
        const sequence = await options.sequencer.assignSale(
          principal.orgId,
          principal.storeId,
          principal.deviceId,
          localId,
        );
        if (sequence <= 0n) throw new Error("Invalid assigned sequence");
        accepted.push({ localId, sequence: sequence.toString(), occurredAt });
      } catch {
        return c.json({ error: "Sale sequencing unavailable" }, 503);
      }
    }
    if (data.protocol === 1)
      return c.json({
        requestId: data.requestId,
        accepted: accepted.map(({ localId, sequence }) => ({ localId, sequence })),
        rejected,
      });
    return c.json({
      requestId: data.requestId,
      accepted,
      rejected,
      receipts: await issueReceiptBlocks(
        options.database,
        principal,
        data.receiptLastUsed,
        buildInfo.version,
      ),
    });
  });
  return app;
}
