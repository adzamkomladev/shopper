import { localSale, outbox } from "@shopper/db-sqlite";
import { createPushWorker } from "@shopper/sync";
import {
  api,
  appVersion,
  databases,
  deviceId,
  deviceToken,
  recordSale,
  resetLocalTill,
  syncProtocol,
} from "./server";
import { startUpstream, type ResponseAlter } from "./upstream";

export type PushFixture = Awaited<ReturnType<typeof createPushFixture>>;
export async function createPushFixture(
  options: {
    alterResponse?: ResponseAlter;
    alterHandshake?: ResponseAlter;
    timeoutMs?: number;
    delayMs?: number;
    random?: () => number;
  } = {},
) {
  await resetLocalTill();
  const upstream = await startUpstream(
    async (request) =>
      api.request(new URL(request.url).pathname, {
        method: request.method,
        headers: request.headers,
        body: await request.arrayBuffer(),
      }),
    options,
  );
  const { context, local: localDatabase } = databases();
  let clock = Date.now();
  let worker: ReturnType<typeof createPushWorker> | undefined;
  let sessionId = "";
  let sessionProof = "";
  const close = async () => {
    await worker?.stop();
    await upstream.close();
  };
  return {
    upstream,
    database: localDatabase,
    appVersion,
    deviceId,
    deviceToken,
    get sessionId() {
      return sessionId;
    },
    get sessionProof() {
      return sessionProof;
    },
    get now() {
      return clock;
    },
    get worker() {
      return worker;
    },
    set worker(value: ReturnType<typeof createPushWorker> | undefined) {
      worker = value;
    },
    workerOptions: {
      database: localDatabase,
      config: {
        orgId: context.orgId,
        deviceId,
        appVersion,
        protocol: syncProtocol,
        upstream: upstream.url,
        deviceToken,
      },
      now: () => clock,
      random: options.random ?? (() => 0),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    },
    advanceTime(milliseconds: number) {
      clock += milliseconds;
    },
    async recordSale(options: { lineCount?: number } = {}) {
      const created = await recordSale(options);
      sessionId = created.sessionId;
      sessionProof = created.proof;
      return created;
    },
    async sales() {
      return localDatabase.read((tx) => tx.select().from(localSale));
    },
    async queue() {
      return localDatabase.read((tx) => tx.select().from(outbox));
    },
    close,
  };
}
