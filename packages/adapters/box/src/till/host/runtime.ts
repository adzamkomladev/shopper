import { randomBytes } from "node:crypto";
import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { outbox } from "@shopper/db-sqlite";
import { buildInfo } from "@shopper/config";
import {
  defaultRegisterSettings,
  provisionTillReference,
  readRegisterSettings,
} from "@shopper/core/till";
import { createHostSync } from "./sync";
import { bridgeRequest, type BridgeMessage, type HostStatus } from "@shopper/sync/bridge";
import type { Renderer } from "@shopper/ports";
import { openTillDatabase } from "../database";
import { hostConfiguration } from "./config";
import { createHostPayments } from "./payments";
import { createDevices } from "./devices";
import { createDispatch } from "./dispatch";
import { createHostReceipts } from "./receipts";
import { createPeripherals } from "./peripherals";
import { openHostTransport, error } from "./transport";

export async function startTillHost(
  raw: unknown,
  send: (message: unknown) => void,
  renderer?: Renderer,
) {
  const config = v.parse(hostConfiguration, raw);
  const database = openTillDatabase(config.sqlitePath, config.databaseKey);
  const identity = config.identity;
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
  const payments = createHostPayments(database, config, (message) => {
    if (closed) return;
    send(message);
    transport?.broadcast(message);
  });
  const worker = createHostSync(
    database,
    config,
    () => {
      void publishStatus();
    },
    payments,
  );
  const receipts = createHostReceipts({
    database,
    config,
    publishStatus,
    renderer,
    onPdfStored: () => void worker.uploadReceipts(),
  });
  const peripherals = createPeripherals({
    database,
    config,
    broadcast: (message) => transport?.broadcast(message),
  });
  const permissions = config.session?.permissions ?? [];
  const registerCode = config.receiptCodes
    ? `${config.receiptCodes.branchCode}-${config.receiptCodes.deviceCode}`
    : "";
  async function status(): Promise<HostStatus> {
    const rows = await database.read((tx) =>
      tx
        .select({ blockedReason: outbox.blockedReason })
        .from(outbox)
        .where(and(eq(outbox.orgId, identity.orgId), eq(outbox.deviceId, identity.deviceId))),
    );
    const settings = await readRegisterSettings(database, identity);
    lastKnownStatus = {
      ...(await worker.status()),
      pendingCount: rows.filter((row) => !row.blockedReason).length,
      blockedCount: rows.filter((row) => row.blockedReason).length,
      identity,
      permissions,
      settings: { ...settings, canEdit: permissions.includes("register.settings") },
      printer: receipts.printer(settings.value.printer !== null),
      registerCode,
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
          server: "offline" as const,
          pendingCount: 0,
          blockedCount: 0,
          lastSuccessfulPushAt: null,
          mode: "offline" as const,
          cursor: null,
          head: null,
          lastPullAt: null,
          receiptsLeft: 0,
          overflow: false,
          syncing: false,
          identity,
          settings: {
            revision: 0,
            value: defaultRegisterSettings(identity),
            canEdit: false,
          },
          printer: receipts.printer(false),
          registerCode,
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
  const dispatch = createDispatch({
    database,
    config,
    payments,
    receipts,
    devices: createDevices({ database, config, receipts, peripherals, status }),
    peripherals,
    status,
    publishStatus,
    sync: () => worker.trigger(),
    close: () => void close(),
  });
  const capability = randomBytes(32).toString("hex");
  try {
    transport = await openHostTransport({
      port: config.port,
      origins: config.origins,
      ui: config.ui,
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
    await peripherals.close();
    await transport?.close();
    await database.close();
    if (process.connected) process.disconnect?.();
  }
  worker.start();
  void peripherals.reload();
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
