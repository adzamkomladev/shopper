import { snapshotVersionSchema } from "../schemas/pull/worker";
import type { PullOptions } from "./types";
export type { PullOptions } from "./types";
import { snapshot, type PullStatus } from "../schemas/pull/worker";
export { type PullStatus } from "../schemas/pull/worker";
import * as v from "valibot";

import { and, eq } from "drizzle-orm";
import { tillState } from "@shopper/db-sqlite";
import { retryDeadline } from "../push/backoff";
import { createPushTransport } from "../push/http";

import { applySnapshot } from "./snapshot";
import { skippedSignatures } from "./signatures";
import { decodeReferenceChange, decodeSnapshot } from "@shopper/core/schemas";
import { applyPage, KNOWN_VERSION, page, type Page } from "./apply";

const HALTED = new Set<PullStatus["state"]>(["upgrade", "revoked", "incompatible"]);

export function createPullWorker(options: PullOptions) {
  const { config, database } = options;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const apply = applyPage(options.now);
  const bootstrap = applySnapshot(options.now);
  const transport = createPushTransport(options);
  const listeners = new Set<() => void>();
  let status: PullStatus = {
    state: "idle",
    cursor: null,
    head: null,
    syncing: false,
    lastPullAt: null,
  };
  let running: Promise<void> | undefined;
  let rerun = false;
  let stopped = false;
  let bootstrapped = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = (update: Partial<PullStatus>) => {
    status = { ...status, ...update };
    options.onStatus?.(status);
    for (const listener of listeners) listener();
  };
  const readCursor = async () =>
    (
      await database.read((tx) =>
        tx
          .select({
            cursor: tillState.pullCursor,
            initialized: tillState.pullInitialized,
            referenceVersion: tillState.referenceVersion,
          })
          .from(tillState)
          .where(and(eq(tillState.orgId, config.orgId), eq(tillState.deviceId, config.deviceId))),
      )
    )[0];
  // A row this build cannot decode halts the pull as incompatible, applying nothing and keeping the cursor.
  const decodeOrHalt = <T>(decode: () => T, cursor?: string) => {
    try {
      return decode();
    } catch {
      publish({ state: "incompatible", ...(cursor === undefined ? {} : { cursor }) });
      return undefined;
    }
  };
  const pullOnce = async (cursor: string) => {
    const { response, raw } = await transport.request(
      `/sync/changes?cursor=${cursor}&limit=500&bootstrapped=${bootstrapped}`,
    );
    if (response.status === 401 || response.status === 409) {
      publish({ state: response.status === 401 ? "revoked" : "incompatible" });
      return undefined;
    }
    if (!response.ok) throw new Error("Pull unavailable");
    const body = JSON.parse(raw);
    if (v.is(snapshot, body)) {
      publish({ state: "snapshot", cursor, head: body.head });
      const downloaded = await transport.request("/sync/snapshot");
      if (downloaded.response.status === 401 || downloaded.response.status === 409) {
        publish({ state: downloaded.response.status === 401 ? "revoked" : "incompatible" });
        return undefined;
      }
      if (!downloaded.response.ok) throw new Error("Snapshot unavailable");
      const rawSnapshot = JSON.parse(downloaded.raw);
      if (!v.is(snapshotVersionSchema, rawSnapshot)) {
        publish({ state: "upgrade" });
        return undefined;
      }
      const data = decodeOrHalt(() => decodeSnapshot(rawSnapshot));
      if (!data) return undefined;
      if (data.orgId !== config.orgId || (config.storeId && data.storeId !== config.storeId))
        throw new Error("Snapshot outside device scope");
      const signatures = await skippedSignatures(database, config.orgId, (path, body) =>
        transport.request(path, body),
      );
      await bootstrap(
        database,
        { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion },
        { ...data, referenceVersion: rawSnapshot.v, signatures },
      );
      attempts = 0;
      publish({
        state: "idle",
        cursor: data.cursor,
        head: body.head,
        lastPullAt: now(),
      });
      bootstrapped = true;
      return data.cursor;
    }
    const parsed = v.parse(page, body);
    // Validate the whole page first: an unknown version applies nothing and never skips a row.
    if (parsed.changes.some((change) => change.v > KNOWN_VERSION)) {
      publish({ state: "upgrade", cursor });
      return undefined;
    }
    const changes = decodeOrHalt(() => parsed.changes.map(decodeReferenceChange), cursor);
    if (!changes) return undefined;
    const data = { ...parsed, changes };
    // Products older than v3 lost fields in the upcast (barcodes, final sale), so a page of them lowers the till's
    // reference version and the next run takes a snapshot. v3 products are whole: v4 only added customers.
    const referenceVersion = Math.min(
      KNOWN_VERSION,
      ...parsed.changes
        .filter((c) => c.entity === "product" && c.op === "upsert" && c.v < 3)
        .map((c) => c.v),
    );
    if (!ordered(cursor, data)) {
      publish({ state: "incompatible", cursor });
      return undefined;
    }
    // An empty catch-up poll changes nothing, so it writes no audit row.
    if (data.changes.length || data.cursor !== cursor)
      await apply(
        database,
        { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion },
        { ...data, referenceVersion },
      );
    attempts = 0;
    publish({
      state: "idle",
      cursor: data.cursor,
      head: data.head,
      lastPullAt: now(),
    });
    return data.hasMore ? data.cursor : undefined;
  };
  const run = async () => {
    const saved = await readCursor();
    // A till holding barcode-less (v1) references takes one full snapshot per run before resuming.
    const stale = !!saved && saved.referenceVersion < KNOWN_VERSION;
    bootstrapped = !stale && (saved?.initialized ?? false);
    let cursor: string | undefined = stale ? "0" : (saved?.cursor ?? "0");
    publish({ cursor, syncing: true });
    try {
      while (cursor && !stopped && !HALTED.has(status.state)) cursor = await pullOnce(cursor);
    } catch {
      if (stopped) return;
      publish({ state: "offline" });
      clearTimeout(timer);
      if (options.retry !== false)
        timer = setTimeout(
          () => void trigger(),
          retryDeadline(now(), attempts++, random()) - now(),
        );
    }
  };
  const trigger = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (running) {
      rerun = true;
      return running;
    }
    // A manual or scheduled retry replaces any pending offline retry and clears the offline flag.
    clearTimeout(timer);
    if (status.state === "offline") publish({ state: "idle" });
    running = (async () => {
      do {
        rerun = false;
        await run();
      } while (rerun && !stopped);
    })()
      .catch(() => publish({ state: "offline" }))
      .finally(() => {
        running = undefined;
        publish({ syncing: false });
      });
    return running;
  };
  return {
    start() {
      void trigger();
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

// Rows strictly ascend past the local cursor, and the cursor never moves backwards or past the head.
function ordered(cursor: string, data: Page) {
  let last = BigInt(cursor);
  for (const change of data.changes) {
    if (BigInt(change.seq) <= last) return false;
    last = BigInt(change.seq);
  }
  const next = BigInt(data.cursor);
  if (next < last || next > BigInt(data.head)) return false;
  return data.hasMore ? next > BigInt(cursor) : true;
}
