// Helpers for the till catalogue suites (readiness, lookup, maintenance): a restartable SQLite file,
// v1/v2 reference snapshots and a scripted upstream that speaks the pull protocol without PostgreSQL.
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { openTillDatabase } from "@shopper/adapters-box";
import { buildInfo } from "@shopper/config";
import type { TillDatabase } from "@shopper/db-sqlite";
import { createPullWorker } from "@shopper/sync";
import { ids } from "../../fixtures/sales/golden";

export { ids };
export const appVersion = "0.1.0-test";
export const clockNow = Date.parse("2026-10-14T09:00:00.000Z");

export type ProductRow = {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  baseUnit: "each";
  taxClass: "standard";
  archivedAt: string | null;
  barcodes: { code: string; quantityThousandths: number }[];
};
let counter = 0;
export function product(over: Partial<ProductRow> = {}): ProductRow {
  counter += 1;
  return {
    id: v7(),
    orgId: ids.org,
    sku: `SKU-${counter}`,
    name: `Product ${counter}`,
    baseUnit: "each",
    taxClass: "standard",
    archivedAt: null,
    barcodes: [],
    ...over,
  };
}
export const code = (value: string, quantityThousandths = 1000) => ({
  code: value,
  quantityThousandths,
});

export function snapshotBody(
  products: ProductRow[],
  { orgId = ids.org, cursor = "9", version = 3 } = {},
) {
  const base = { v: version, orgId, storeId: ids.store, cursor };
  if (version === 1)
    return {
      ...base,
      reference: {
        products: products.map(({ barcodes: _barcodes, ...old }) => old),
        prices: [],
        taxRules: [],
      },
    };
  return { ...base, reference: { products, prices: [], taxRules: [], barcodeMappings: [] } };
}
export const upsert = (seq: number, row: ProductRow, version = 3) => ({
  seq: String(seq),
  entity: "product",
  entityId: row.id,
  op: "upsert",
  v: version,
  payload: row,
});
export const remove = (seq: number, id: string) => ({
  seq: String(seq),
  entity: "product",
  entityId: id,
  op: "delete",
  v: 3,
  payload: { id },
});
export const pageBody = (cursor: number, changes: unknown[]) => ({
  changes,
  cursor: String(cursor),
  head: String(cursor),
  hasMore: false,
});

/** Serves cursor 0 as "snapshot needed", then queued pages (or empty polls); `urls` records every request. */
export async function referenceUpstream(snapshot: unknown) {
  const state = { snapshot, pages: [] as unknown[], status: 200, urls: [] as string[] };
  const server = createServer((request, response) => {
    state.urls.push(request.url!);
    const url = new URL(request.url!, "http://upstream.test");
    const cursor = url.searchParams.get("cursor") ?? "0";
    const send = (body: unknown) => {
      response.writeHead(state.status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (state.status !== 200) return send({});
    if (url.pathname === "/sync/snapshot") return send(state.snapshot);
    if (cursor === "0")
      return send({ snapshot: true, head: (state.snapshot as { cursor: string }).cursor });
    send(state.pages.shift() ?? pageBody(Number(cursor), []));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return Object.assign(state, {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
export type ReferenceUpstream = Awaited<ReturnType<typeof referenceUpstream>>;

export const pullWorker = (database: TillDatabase, upstream: string) =>
  createPullWorker({
    database,
    retry: false,
    now: () => clockNow,
    random: () => 0,
    config: {
      orgId: ids.org,
      storeId: ids.store,
      deviceId: ids.device,
      appVersion,
      protocol: buildInfo.syncProtocol,
      upstream,
      deviceToken: "till-token",
    },
  });

/** A till SQLite file that can be closed and reopened, as a register restart does. */
export async function tempTill(key?: string) {
  const dir = await mkdtemp(join(tmpdir(), "shopper-till-catalogue-"));
  const path = join(dir, "till.sqlite");
  let database = openTillDatabase(path, key);
  return {
    path,
    get database() {
      return database;
    },
    async restart() {
      await database.close();
      database = openTillDatabase(path, key);
      return database;
    },
    async close() {
      await database.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

const own = sql`org_id = ${ids.org} AND device_id = ${ids.device}`;
export const tillStateRow = async (database: TillDatabase) =>
  (
    await database.read((tx) =>
      tx.all<{ pull_cursor: string; reference_version: number }>(
        sql`SELECT pull_cursor, reference_version FROM till_state WHERE ${own}`,
      ),
    )
  )[0];
export const setReferenceVersion = (database: TillDatabase, version: number) =>
  database.transaction((tx) =>
    tx.run(sql`UPDATE till_state SET reference_version = ${version} WHERE ${own}`),
  );
export const referenceNames = async (database: TillDatabase, orgId = ids.org) =>
  (
    await database.read((tx) =>
      tx.all<{ payload: string }>(
        sql`SELECT payload FROM reference WHERE org_id = ${orgId} AND entity = 'product'`,
      ),
    )
  )
    .map((row) => (JSON.parse(row.payload) as { name: string }).name)
    .sort();
