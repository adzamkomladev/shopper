import { randomBytes } from "node:crypto";
import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { outbox } from "@shopper/db-sqlite";
import { buildInfo } from "@shopper/config";
import { recordLocalSale, provisionTillReference, TillError } from "@shopper/core/till";
import { createPushWorker } from "@shopper/sync";
import {
  bridgeRequest,
  type BridgeMessage,
  type BridgeRequest,
  type HostStatus,
} from "@shopper/sync/bridge";
import { openTillDatabase } from "../database";
import { hostConfiguration } from "./config";
import { openHostTransport, error } from "./transport";

export async function startTillHost(raw: unknown, send: (message: unknown) => void) {
  const config = v.parse(hostConfiguration, raw);
  const database = openTillDatabase(config.sqlitePath);
  const identity = config.identity;
  const localConfig = { ...identity, appVersion: buildInfo.version };
  try {
    if (config.references && config.session)
      await provisionTillReference(
        database,
        {
          orgId: identity.orgId,
          deviceId: identity.deviceId,
          branchId: identity.branchId,
          actorId: config.session.userId,
          role: config.session.roleName,
          appVersion: buildInfo.version,
        },
        config.references,
      );
  } catch (caught) {
    await database.close();
    throw caught;
  }
  let closed = false;
  let lastKnownStatus: HostStatus | undefined;
  let transport: Awaited<ReturnType<typeof openHostTransport>> | undefined;
  const worker = createPushWorker({
    database,
    config: {
      orgId: identity.orgId,
      deviceId: identity.deviceId,
      appVersion: buildInfo.version,
      protocol: buildInfo.syncProtocol,
      upstream: config.upstream,
      deviceToken: config.deviceToken,
    },
    onStatus() {
      void publishStatus();
    },
  });
  async function status(): Promise<HostStatus> {
    const rows = await database.read((tx) =>
      tx
        .select({ blockedReason: outbox.blockedReason })
        .from(outbox)
        .where(and(eq(outbox.orgId, identity.orgId), eq(outbox.deviceId, identity.deviceId))),
    );
    lastKnownStatus = {
      ...worker.getStatus(),
      pendingCount: rows.filter((row) => !row.blockedReason).length,
      blockedCount: rows.filter((row) => row.blockedReason).length,
      identity,
      appVersion: buildInfo.version,
      protocol: buildInfo.syncProtocol,
    };
    return lastKnownStatus;
  }
  async function publishStatus() {
    if (closed) return;
    let current: HostStatus;
    try {
      current = await status();
    } catch {
      current = {
        ...(lastKnownStatus ?? {
          ...worker.getStatus(),
          identity,
          appVersion: buildInfo.version,
          protocol: buildInfo.syncProtocol,
        }),
        server: "offline",
        lastError: {
          code: "STORAGE_FAILED",
          message: "Register storage is unavailable. Reconnect and retry.",
        },
      };
    }
    if (closed) return;
    const message: BridgeMessage = { type: "status", status: current };
    send(message);
    transport?.broadcast(message);
  }
  async function dispatch(request: BridgeRequest, trusted: boolean): Promise<BridgeMessage> {
    try {
      if (request.type === "recordSale") {
        if (!trusted || !config.session)
          return error(
            request,
            "SESSION_REQUIRED",
            "Sign in on this register before recording sales",
          );
        const event = await recordLocalSale(database, localConfig, config.session, request.input);
        await publishStatus();
        void worker.trigger();
        return { id: request.id, type: "result", kind: "sale", event };
      }
      if (request.type === "retry") await worker.trigger();
      if (request.type === "shutdown") {
        if (!trusted)
          return error(request, "FORBIDDEN", "This action requires the private till connection");
        setImmediate(() => void close());
      }
      return { id: request.id, type: "result", kind: "status", status: await status() };
    } catch (caught) {
      return error(
        request,
        caught instanceof TillError ? "SALE_REJECTED" : "STORAGE_FAILED",
        caught instanceof TillError
          ? caught.message
          : "Register storage is unavailable. Reconnect and retry.",
      );
    }
  }
  const capability = randomBytes(32).toString("hex");
  try {
    transport = await openHostTransport({
      port: config.port,
      origins: config.origins,
      capability,
      protocol: buildInfo.syncProtocol,
      dispatch,
    });
  } catch (caught) {
    await database.close();
    throw caught;
  }
  async function close() {
    if (closed) return;
    closed = true;
    await worker.stop();
    await transport?.close();
    await database.close();
    if (process.connected) process.disconnect?.();
  }
  worker.start();
  send({
    type: "ready",
    port: transport.port,
    capability,
    appVersion: buildInfo.version,
    protocol: buildInfo.syncProtocol,
    identity,
  });
  return {
    async receive(value: unknown) {
      const parsed = v.safeParse(bridgeRequest, value);
      send(
        parsed.success
          ? await dispatch(parsed.output, true)
          : error(value, "INVALID_MESSAGE", "Invalid register request"),
      );
    },
    close,
  };
}
