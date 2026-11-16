// Day 43: the verification report a cloud → box move ends with. The same report run on both databases agrees when the
// box holds exactly what the cloud held, names the one table (and the one day) that differs when it does not, and never
// reads a secret.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq, sql } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { compareReports, importArchive, reconciliationReport } from "@shopper/export";
import { emptyDatabase, movedArchive } from "../../support/migration/archive";

type Moved = Awaited<ReturnType<typeof movedArchive>>;
let a: Moved;
let b: Awaited<ReturnType<typeof emptyDatabase>>;

beforeAll(async () => {
  a = await movedArchive();
  b = await emptyDatabase();
  await importArchive(b.db, a.context, { manifest: a.manifest, read: a.read, blobs: b.blobs });
});
afterAll(async () => {
  await b?.close();
  await a?.close();
});

// The archive's last audit row: after it, each side audits the move itself.
const auditUpTo = async () =>
  Number(
    (
      await a.f.db.execute<{ n: number }>(
        sql`select max(chain_seq)::int as n from audit_log where org_id = ${a.context.orgId}`,
      )
    ).rows[0]!.n,
  );
const reports = async () => {
  const options = { auditUpTo: await auditUpTo() };
  return compareReports(
    await reconciliationReport(a.f.db, a.context.orgId, options),
    await reconciliationReport(b.db, a.context.orgId, options),
  );
};

test("the box's copy reconciles with the cloud's: every archived table and every trading day", async () => {
  const result = await reports();
  // The manifest lists the tables that hold rows; the report lists every archived table, empty ones too.
  expect(result.tables.filter((row) => row.cloud.rows > 0).map((row) => row.table)).toEqual(
    Object.keys(a.manifest.tables).sort(),
  );
  expect(result.tables.filter((row) => !row.ok)).toEqual([]);
  expect(result.days.length).toBeGreaterThan(0);
  expect(result.days.every((day) => day.ok)).toBe(true);
  expect(result.ok).toBe(true);
  const sales = result.tables.find((row) => row.table === "sale")!;
  expect(sales.cloud).toEqual(sales.box);
  expect(sales.cloud.rows).toBeGreaterThan(0);
  expect(sales.cloud.checksum).toMatch(/^[0-9a-f]{32}$/);
});

test("a secret the archive leaves out never moves the checksum", async () => {
  const before = await reconciliationReport(a.f.db, a.context.orgId);
  // As a move lands it: the hash written into the row as it was, its updated_at untouched.
  await a.f.db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.execute(
      sql`update account set password = 'scrypt$ANOTHER-HASH' where org_id = ${a.context.orgId}`,
    );
  });
  const after = await reconciliationReport(a.f.db, a.context.orgId);
  expect(after.tables.account).toEqual(before.tables.account);
});

test("one changed row names its table, and a changed sale names its day", async () => {
  // A copy damaged behind the database's back: sales cannot be edited, so its guards are off for this one write.
  await b.db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.execute(sql`
      update sale set payload = jsonb_set(payload, '{totals,gross}', to_jsonb((payload->'totals'->>'gross')::bigint + 10000))
      where org_id = ${a.context.orgId}`);
  });
  await b.db
    .update(schema.device)
    .set({ name: "Renamed on the box" })
    .where(eq(schema.device.orgId, a.context.orgId));
  const result = await reports();
  expect(result.ok).toBe(false);
  expect(
    result.tables
      .filter((row) => !row.ok)
      .map((row) => row.table)
      .sort(),
  ).toEqual(["device", "sale"]);
  const day = result.days.find((row) => !row.ok)!;
  expect(BigInt(day.box.gross) - BigInt(day.cloud.gross)).toBe(10000n);
  expect(day.box.tax).toBe(day.cloud.tax);
});
