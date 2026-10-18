import type { createHostPayments } from "./payments";
import WebSocket from "ws";
import {
  createLiveWorker,
  createPullWorker,
  createPushWorker,
  createReceiptUploadWorker,
  createStockUploadWorker,
  refreshApprovers,
} from "@shopper/sync";
import type { TillDatabase } from "@shopper/db-sqlite";
import { readReceiptStatus } from "@shopper/core/till";
import { buildInfo } from "@shopper/config";
import type { HostStatus } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";

export function createHostSync(
  database: TillDatabase,
  config: HostConfiguration,
  notify: () => void,
  payments?: Pick<ReturnType<typeof createHostPayments>, "receive" | "recover">,
) {
  const identity = config.identity;
  const options = {
    database,
    config: {
      orgId: identity.orgId,
      storeId: identity.storeId,
      deviceId: identity.deviceId,
      appVersion: buildInfo.version,
      protocol: buildInfo.syncProtocol,
      upstream: config.upstream,
      deviceToken: config.deviceToken,
    },
  };
  const pull = createPullWorker({ ...options, retry: false, onStatus: notify });
  // Best effort: a failed refresh keeps the previous list and its 7-day clock.
  const approvers = () => refreshApprovers(options).catch(() => false);
  const pullAndRefresh = async () => {
    await pull.trigger();
    await approvers();
  };
  const live = createLiveWorker({
    config: options.config,
    cursor: () => pull.getStatus().cursor ?? "0",
    async trigger() {
      await pullAndRefresh();
      if (pull.getStatus().state === "offline") throw new Error("Pull unavailable");
    },
    connect: (url, headers) => new WebSocket(url, { headers }),
    onMode: notify,
    onPayment: payments?.receive,
    onConnected: payments?.recover,
  });
  const uploads = createReceiptUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    onChange: notify,
  });
  const stock = createStockUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    onChange: notify,
  });
  const push = createPushWorker({
    ...options,
    onStatus: notify,
    onAcknowledgment: () => {
      void pullAndRefresh();
      void uploads.trigger();
      void stock.trigger();
    },
  });
  return {
    async status() {
      const uploaded = push.getStatus();
      const downloaded = pull.getStatus();
      const halted = ["upgrade", "revoked", "incompatible"].includes(downloaded.state);
      const server: HostStatus["server"] =
        downloaded.state === "revoked"
          ? "revoked"
          : halted
            ? "incompatible"
            : uploaded.server === "revoked" ||
                uploaded.server === "incompatible" ||
                uploaded.server === "blocked"
              ? uploaded.server
              : downloaded.state === "offline"
                ? "offline"
                : uploaded.server;
      return {
        ...uploaded,
        server,
        mode:
          server === "offline" || server === "revoked" || server === "incompatible"
            ? ("offline" as const)
            : live.getMode(),
        cursor: downloaded.cursor,
        head: downloaded.head,
        lastPullAt: downloaded.lastPullAt,
        syncing: downloaded.syncing,
        ...(await readReceiptStatus(database, identity.orgId, identity.deviceId)),
        lastError: halted
          ? {
              code: downloaded.state === "upgrade" ? "UPGRADE_NEEDED" : "PULL_HALTED",
              message:
                downloaded.state === "revoked"
                  ? "Enroll this register again"
                  : "Update the register application",
            }
          : uploaded.lastError,
      };
    },
    start() {
      push.start();
      pull.start();
      live.start();
      void approvers();
      void uploads.trigger();
      void stock.trigger();
    },
    async trigger() {
      await push.trigger();
      await pullAndRefresh();
      await uploads.trigger(true);
      await stock.trigger(true);
    },
    /** Uploads any acknowledged receipt PDFs that are still pending. */
    uploadReceipts: () => uploads.trigger(),
    /** Uploads queued stock counts and receiving once the sale backlog has drained. */
    uploadStock: () => stock.trigger(),
    async stop() {
      await Promise.all([live.stop(), push.stop(), pull.stop(), uploads.stop(), stock.stop()]);
    },
  };
}
