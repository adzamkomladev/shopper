import type { createHostPayments } from "./payments";
import WebSocket from "ws";
import {
  createLiveWorker,
  createPullWorker,
  createPushWorker,
  createAccountPaymentUploadWorker,
  createCustomerUploadWorker,
  createRefundUploadWorker,
  createShiftUploadWorker,
  createAuditUploadWorker,
  createReceiptUploadWorker,
  createStockUploadWorker,
  refreshApprovers,
  createClockAnchor,
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
  /** After every pull: signatures it brought may need their receipt PDFs rendered again. */
  onPulled?: () => Promise<void>,
  /** A manager's answer to this register's remote approval, pushed through the live socket. */
  onApproval?: (payload: unknown) => Promise<void>,
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
  // Best effort: a failed refresh keeps the previous list and its 7-day clock. Every store nudge asks for
  // one, and a reconnect after a backlog nudges once per accepted sale: one refresh runs at a time and a
  // burst of requests collapses into a single follow-up.
  let refreshing: Promise<void> | undefined;
  let again = false;
  const approvers = (): Promise<void> => {
    if (refreshing) {
      again = true;
      return refreshing;
    }
    refreshing = (async () => {
      try {
        do {
          again = false;
          await refreshApprovers(options).catch(() => false);
        } while (again);
      } finally {
        refreshing = undefined;
      }
    })();
    return refreshing;
  };
  const pullAndRefresh = async () => {
    await pull.trigger();
    await onPulled?.();
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
    onApproval,
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
  const refunds = createRefundUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    onChange: notify,
  });
  const shiftUploads = createShiftUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    onChange: notify,
  });
  const audit = createAuditUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    onChange: notify,
  });
  // The audit chain goes first, so a Z's anchor is already on the server when its shift arrives.
  const shifts = {
    trigger: (force = false) => audit.trigger(force).then(() => shiftUploads.trigger(force)),
    stop: () => Promise.all([audit.stop(), shiftUploads.stop()]),
  };
  const accountPayments = createAccountPaymentUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    onChange: notify,
  });
  const customers = createCustomerUploadWorker({
    ...options,
    config: { ...options.config, protocol: buildInfo.syncProtocol },
    // A payment waits for its customer's upload, so each customer that lands may free one.
    onChange() {
      notify();
      void accountPayments.trigger();
    },
  });
  const clock = createClockAnchor(database, options.config);
  const push = createPushWorker({
    ...options,
    onStatus: notify,
    onClockMeasured: clock.measured,
    onAcknowledgment: () => {
      void pullAndRefresh();
      void uploads.trigger();
      void stock.trigger();
      void refunds.trigger();
      void shifts.trigger();
      void customers.trigger();
      void accountPayments.trigger();
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
      void refunds.trigger();
      void shifts.trigger();
      void customers.trigger();
      void accountPayments.trigger();
    },
    async trigger() {
      await push.trigger();
      await pullAndRefresh();
      await uploads.trigger(true);
      await stock.trigger(true);
      await refunds.trigger(true);
      await shifts.trigger(true);
      await customers.trigger(true);
      await accountPayments.trigger(true);
    },
    /** Corrects the stored clock offset when the wall clock was set back since the last handshake. */
    checkClock: clock.check,
    /** Uploads any acknowledged receipt PDFs that are still pending. */
    uploadReceipts: () => uploads.trigger(),
    /** Uploads queued stock counts and receiving once the sale backlog has drained. */
    uploadStock: () => stock.trigger(),
    /** Uploads refunds recorded here once the sale backlog has drained. */
    uploadRefunds: () => refunds.trigger(),
    /** Uploads closed shifts' Z reports once the sale backlog has drained. */
    uploadShifts: () => shifts.trigger(),
    /** Uploads customers made and edited here once the sale backlog has drained. */
    uploadCustomers: () => customers.trigger(),
    /** Uploads payments taken on accounts at the drawer once the sale backlog has drained. */
    uploadAccountPayments: () => accountPayments.trigger(),
    async stop() {
      await Promise.all([
        live.stop(),
        push.stop(),
        pull.stop(),
        uploads.stop(),
        stock.stop(),
        refunds.stop(),
        shifts.stop(),
        customers.stop(),
        accountPayments.stop(),
      ]);
    },
  };
}
