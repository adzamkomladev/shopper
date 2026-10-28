import { v7 } from "uuid";
import { createReceiptStorage } from "../receipts";
import { readHandshake } from "../connection";
import { createBatch } from "./batch";
import { createPushTransport } from "./http";
import { dueBy, retryDeadline } from "./backoff";
import { readAcknowledgment } from "./acknowledgment";
import { createQueueStorage } from "./storage";
import type { PushOptions, PushStatus } from "./types";

export function createPushWorker(options: PushOptions) {
  const { config } = options;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const queue = createQueueStorage(options);
  const receipts = createReceiptStorage(options);
  const listeners = new Set<() => void>();
  let status: PushStatus = {
    server: "connecting",
    pendingCount: 0,
    blockedCount: 0,
    lastError: null,
    lastSuccessfulPushAt: null,
  };
  let running: Promise<void> | undefined;
  let rerun = false;
  let stopped = false;
  let started = false;
  let negotiated: number | undefined;
  let connectionRetryAt = 0;
  let connectionAttempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const transport = createPushTransport(options);
  const publish = (update: Partial<PushStatus>) => {
    status = { ...status, ...update };
    options.onStatus?.(status);
    for (const listener of listeners) listener();
  };
  const counts = async () => {
    const saved = await queue.read();
    publish({
      pendingCount: saved.rows.filter((row) => !row.blockedReason).length,
      blockedCount: saved.rows.filter((row) => row.blockedReason).length,
    });
    return saved;
  };
  const terminal = (code: number) => {
    if (code !== 401 && code !== 409) return false;
    publish({
      server: code === 401 ? "revoked" : "incompatible",
      lastError: {
        code: code === 401 ? "DEVICE_REVOKED" : "INCOMPATIBLE_PROTOCOL",
        message: code === 401 ? "Enroll this register again" : "Update the register application",
      },
    });
    negotiated = undefined;
    return true;
  };
  const retry = async (
    rows: Awaited<ReturnType<typeof queue.read>>["rows"],
    retryAfter?: string | null,
  ) => {
    await queue.change(
      rows.map((row) => ({
        localId: row.localId,
        attempts: row.attempts + 1,
        nextAttemptAt: retryDeadline(now(), row.attempts, random(), retryAfter),
      })),
    );
  };
  const run = async () => {
    let saved = await counts();
    // A wait scheduled before the wall clock went back would otherwise last hours.
    connectionRetryAt = dueBy(connectionRetryAt, now());
    if (!negotiated) {
      if (
        now() < connectionRetryAt ||
        (saved.rows.some((row) => !row.blockedReason) &&
          saved.rows.every((row) => row.blockedReason || row.nextAttemptAt > now()))
      )
        return;
      let retryAfter: string | null = null;
      try {
        const requestId = v7();
        const { response, raw } = await transport.request("/sync/handshake", {
          requestId,
          appVersion: config.appVersion,
          protocol: config.protocol,
          receiptLastUsed: await receipts.lastUsed(),
        });
        retryAfter = response.headers.get("retry-after");
        if (terminal(response.status)) return;
        if (!response.ok) throw new Error("Handshake unavailable");
        const result = readHandshake(JSON.parse(raw), requestId, config.protocol);
        if (result.receipts) await receipts.save(result.receipts, result.serverTime, now());
        negotiated = result.protocol;
        connectionRetryAt = 0;
        connectionAttempts = 0;
        publish({ server: "online", lastError: null });
      } catch {
        if (stopped) return;
        connectionRetryAt = retryDeadline(now(), connectionAttempts++, random(), retryAfter);
        publish({
          server: "offline",
          lastError: { code: "UPSTREAM_UNAVAILABLE", message: "Reconnect to the server" },
        });
        await retry(
          saved.rows.filter((row) => !row.blockedReason && row.nextAttemptAt <= now()),
          retryAfter,
        );
        return;
      }
    }
    while (!stopped) {
      const batch = createBatch(saved, v7(), negotiated, now(), await receipts.lastUsed());
      if (batch.blocked.length) {
        await queue.change(batch.blocked);
        saved = await counts();
      }
      if (!batch.rows.length) break;
      let retryAfter: string | null = null;
      try {
        const { response, raw } = await transport.request("/sync/push", batch.body);
        if (terminal(response.status)) return;
        retryAfter = response.headers.get("retry-after");
        if (!response.ok) throw new Error("Upload unavailable");
        const result = readAcknowledgment(
          JSON.parse(raw),
          batch.body.requestId,
          batch.rows.map((row) => row.localId),
        );
        if (result.receipts) await receipts.save(result.receipts);
        const safeMessage = (message: string) => {
          for (const secret of [
            config.deviceToken,
            ...batch.body.proofs.map((entry) => entry.proof),
          ])
            message = message.replaceAll(secret, "[redacted]");
          return message;
        };
        await queue.change([
          ...result.accepted.map((entry) => ({
            localId: entry.localId,
            sequence: entry.sequence,
            ...(entry.occurredAt === undefined ? {} : { occurredAt: entry.occurredAt }),
          })),
          ...result.rejected.map((entry) => ({
            localId: entry.localId,
            blockedReason: `${safeMessage(entry.code)}: ${safeMessage(entry.message)}`,
          })),
        ]);
        const acknowledged = new Set(
          [...result.accepted, ...result.rejected].map((entry) => entry.localId),
        );
        const omitted = batch.rows.filter((row) => !acknowledged.has(row.localId));
        if (omitted.length) await retry(omitted);
        publish({ server: "online", lastError: null, lastSuccessfulPushAt: now() });
        options.onAcknowledgment?.();
        saved = await counts();
      } catch {
        if (stopped) return;
        await retry(batch.rows, retryAfter);
        publish({
          server: "offline",
          lastError: { code: "UPLOAD_FAILED", message: "Upload will retry automatically" },
        });
        await counts();
        return;
      }
    }
    saved = await counts();
    const blocked = saved.rows.find((row) => row.blockedReason);
    if (blocked)
      publish({
        server: "blocked",
        lastError: {
          code: "BLOCKED_UPLOAD",
          message: blocked.blockedReason ?? "Review blocked sales",
        },
      });
  };
  const trigger = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (running) {
      rerun = true;
      return running;
    }
    if (timer) clearTimeout(timer);
    running = (async () => {
      do {
        rerun = false;
        await run();
        if (!started || stopped || status.server === "revoked" || status.server === "incompatible")
          continue;
        const saved = await queue.read();
        if (stopped) continue;
        const deadlines = saved.rows
          .filter((row) => !row.blockedReason)
          .map((row) => row.nextAttemptAt);
        if (status.server === "offline" || deadlines.length) {
          const delay = Math.max(
            1,
            connectionRetryAt - now(),
            deadlines.length ? Math.min(...deadlines) - now() : 0,
          );
          clearTimeout(timer);
          timer = setTimeout(() => void trigger(), Math.min(delay, 2_147_483_647));
        }
      } while (rerun && !stopped);
    })()
      .catch(() => {
        publish({
          server: "offline",
          lastError: {
            code: "STORAGE_FAILED",
            message: "Restart the register host to recover the queue",
          },
        });
      })
      .finally(() => {
        running = undefined;
        if (rerun && !stopped) return trigger();
      });
    return running;
  };
  return {
    start() {
      if (!stopped) {
        started = true;
        void trigger();
      }
    },
    trigger,
    async stop() {
      stopped = true;
      clearTimeout(timer);
      transport.abort();
      await running;
    },
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
