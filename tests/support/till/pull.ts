// Helpers for the sync pull suites: raw feed writes, pull requests and a restartable till SQLite file.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { openTillDatabase } from "@shopper/adapters-box";
import { mutateManagement } from "@shopper/core/management";
import { reference, type TillDatabase } from "@shopper/db-sqlite";
import { provisioningContext } from "../../../tooling/database/seed";
import { config, ids } from "./sales";
import {
  appVersion,
  context,
  databases,
  deviceId,
  deviceToken,
  devices,
  principal,
  syncProtocol,
} from "./server";
import { syncHeaders } from "./requests";

export const storeId = config.storeId;
type Client = { request(path: string, init?: RequestInit): Promise<Response> };
export type FeedInput = { v?: number; entity?: "product"; entityId?: string; payload?: unknown };

export const pullHeaders = (protocol = syncProtocol) => ({
  ...syncHeaders(),
  "X-Shopper-Protocol": String(protocol),
});

export function pull(
  client: Client,
  query: Record<string, string | number> = {},
  headers: Record<string, string> = pullHeaders(),
) {
  const search = new URLSearchParams(Object.entries(query).map(([k, value]) => [k, String(value)]));
  return client.request(`/sync/changes?${search}`, { headers });
}

export async function head(forStore: string = storeId, orgId: string = context.orgId) {
  const [row] = await databases()
    .db.select({ seq: schema.store.lastSeq })
    .from(schema.store)
    .where(and(eq(schema.store.orgId, orgId), eq(schema.store.id, forStore)));
  return row!.seq;
}

/** Appends feed rows the way recordChanges does (seq from a locked last_seq bump), but with free choice of `v`. */
export async function appendRows(
  rows: FeedInput[],
  forStore: string = storeId,
  orgId: string = context.orgId,
) {
  return databases().db.transaction(async (tx) => {
    const [bumped] = await tx
      .update(schema.store)
      .set({ lastSeq: sql`${schema.store.lastSeq} + ${rows.length}` })
      .where(and(eq(schema.store.orgId, orgId), eq(schema.store.id, forStore)))
      .returning({ head: schema.store.lastSeq });
    const first = bumped!.head - BigInt(rows.length) + 1n;
    await tx.insert(schema.storeChange).values(
      rows.map((row, i) => ({
        orgId,
        storeId: forStore,
        seq: first + BigInt(i),
        entity: row.entity ?? "product",
        entityId: row.entityId ?? v7(),
        op: "upsert" as const,
        v: row.v ?? 1,
        payload: row.payload ?? {},
      })),
    );
    return bumped!.head;
  });
}

/** `count` product rows through SQL generate_series, then the store head moved to match. */
export async function bulkRows(
  count: number,
  forStore: string = storeId,
  orgId: string = context.orgId,
) {
  const { db } = databases();
  const bumped = await db.execute<{ head: string }>(
    sql`UPDATE store SET last_seq = last_seq + ${count} WHERE org_id = ${orgId}::uuid AND id = ${forStore}::uuid RETURNING last_seq::text AS head`,
  );
  const last = BigInt(bumped.rows[0]!.head);
  await db.execute(sql`INSERT INTO store_change (org_id, store_id, seq, entity, entity_id, op, v, payload)
    SELECT ${orgId}::uuid, ${forStore}::uuid, s, 'product', uuidv7(), 'upsert', 2, '{}'::jsonb
    FROM generate_series(${(last - BigInt(count) + 1n).toString()}::bigint, ${last.toString()}::bigint) AS s`);
  return last;
}

/** Moves a store head without feed rows, as pushed sales do. */
export async function consumeSeqs(
  count: number,
  forStore: string = storeId,
  orgId: string = context.orgId,
) {
  await databases().db.execute(
    sql`UPDATE store SET last_seq = last_seq + ${count} WHERE org_id = ${orgId}::uuid AND id = ${forStore}::uuid`,
  );
}

export async function addStore(orgId: string = ids.org) {
  const made = await mutateManagement(
    databases().db,
    { ...provisioningContext(orgId), reason: "Pull test" },
    { kind: "store", action: "create", data: { name: `Pull store ${v7()}` } },
  );
  return made.id;
}

export async function enrollDevice() {
  const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
  const enrolled = await devices.enroll({
    orgId: context.orgId,
    code: challenge.code,
    name: "Spare",
  });
  return {
    ...enrolled,
    headers: {
      ...pullHeaders(),
      authorization: `Bearer ${enrolled.deviceToken}`,
      "X-Shopper-Device": enrolled.deviceId,
    },
    revoke: () => devices.revoke(principal, { deviceId: enrolled.deviceId }),
  };
}

/** A till SQLite file that can be closed and reopened, as a register restart does. */
export async function tillFile() {
  const dir = await mkdtemp(join(tmpdir(), "shopper-pull-"));
  const path = join(dir, "till.sqlite");
  let database: TillDatabase = openTillDatabase(path);
  return {
    get database() {
      return database;
    },
    async restart() {
      await database.close();
      database = openTillDatabase(path);
      return database;
    },
    async close() {
      await database.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** What day-9 slice 3 does at enrollment: start the till at the store head so it pulls only the tail. */
export async function startAtHead(database: TillDatabase) {
  const cursor = String(await head());
  await database.transaction((tx) =>
    tx.run(sql`INSERT INTO till_state (id, org_id, device_id, pull_cursor, reference_version)
      VALUES (${v7()}, ${context.orgId}, ${deviceId}, ${cursor}, 5)
      ON CONFLICT(org_id, device_id) DO UPDATE SET pull_cursor = excluded.pull_cursor,
        reference_version = excluded.reference_version`),
  );
  return cursor;
}

export const tillCursor = async (database: TillDatabase) =>
  (
    await database.read((tx) =>
      tx.all<{ pull_cursor: string }>(
        sql`SELECT pull_cursor FROM till_state WHERE org_id = ${context.orgId} AND device_id = ${deviceId}`,
      ),
    )
  )[0]?.pull_cursor;

export const tillReference = (database: TillDatabase, entity = "product") =>
  database.read((tx) => tx.select().from(reference).where(eq(reference.entity, entity)));

export const tillAuditCommands = async (database: TillDatabase) =>
  (
    await database.read((tx) => tx.all<{ command: string }>(sql`SELECT command FROM till_audit`))
  ).map((row) => row.command);

export function pullOptions(database: TillDatabase, upstream: string, clock: { now: number }) {
  return {
    database,
    config: {
      orgId: context.orgId,
      storeId,
      deviceId,
      appVersion,
      protocol: syncProtocol,
      upstream,
      deviceToken,
    },
    now: () => clock.now,
    random: () => 0,
  };
}
