// Notion Day 19: "Every accepted doc appears in an archive bundle". Accepting a document starts its store-hour's
// bundle; each bundle takes every accepted document of the store not yet archived, so one accepted after its hour's
// bundle ran lands in the next. Every document is archived exactly once and each bundle's digest matches its bytes.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { boxBlobs } from "@shopper/adapters-box";
import {
  createSdc,
  fiscalArchiveId,
  runFiscalArchive,
  submitFiscalDoc,
} from "@shopper/core/fiscal";
import { sha256 } from "@shopper/utils";
import type { Json, WorkflowLauncher } from "@shopper/ports";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { startSdcFake } from "../../../tooling/sdc/server";
import { postgresFixture } from "../../fixtures/postgres";
import { provisionPendingSale } from "../../support/till/pending/sale";
import { seedFiscalDocs } from "../../support/fiscal/docs";

const fake = await startSdcFake();
const sdc = createSdc({ url: fake.url, apiKey: fake.apiKey });
const ctx = provisioningContext();
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
let dir: string;
let blobs: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
let storeId: string;
let baseLocalId: string;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, ctx, { name: "Archive tenant" });
  const [store] = await db
    .insert(schema.store)
    .values({ orgId: ctx.orgId, name: "Archive" })
    .returning();
  storeId = store!.id;
  baseLocalId = (await provisionPendingSale(db, ctx, storeId, ctx.orgId, ctx.appVersion)).localId;
  dir = await mkdtemp(join(tmpdir(), "shopper-fiscal-archive-"));
  blobs = (await boxBlobs(dir, { baseUrl: "http://127.0.0.1", secret: new Uint8Array(32).fill(3) }))
    .blobs;
});
afterAll(async () => {
  await fake.stop();
  await pool?.end();
  await fixture?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const at = (iso: string) => new Date(iso);
const docs = (prefix: string, count: number) =>
  seedFiscalDocs(db, ctx, { baseLocalId, storeId, prefix, count });
/** Accepts a document through the SDC fake, then dates the acceptance: the test plays the clock. */
async function accept(id: string, acceptedAt: string, archive?: WorkflowLauncher) {
  expect(await submitFiscalDoc(db, ctx, sdc, id, archive)).toBe("done");
  await db
    .update(schema.fiscalDoc)
    .set({ acceptedAt: at(acceptedAt) })
    .where(eq(schema.fiscalDoc.id, id));
}
/** Runs a store-hour's workflow with its wait already over. */
const bundle = (hour: string) =>
  runFiscalArchive(
    {
      instanceId: fiscalArchiveId(ctx.orgId, storeId, at(hour)),
      step: (_name, _policy, run) => run(),
      sleepUntil: async () => {},
    },
    { withDatabase: (run) => run(db), blobs, appVersion: ctx.appVersion },
    { orgId: ctx.orgId, storeId, hour },
  );

test("Every accepted doc appears in an archive bundle", async () => {
  const started: { id: string; params: Json }[] = [];
  const launcher: WorkflowLauncher = {
    start: async (id, params) => void started.push({ id, params }),
    send: async () => {},
  };
  const [early, later] = await docs("H10", 2);
  const [next] = await docs("H11", 1);
  const [late] = await docs("LATE", 1);
  await accept(early!, "2026-10-24T10:15:00.000Z", launcher);
  // Accepting starts the bundle of the hour it was accepted in (the real clock's hour here).
  expect(started).toHaveLength(1);
  expect(started[0]!.params).toMatchObject({ orgId: ctx.orgId, storeId });
  expect(started[0]!.id).toBe(
    fiscalArchiveId(ctx.orgId, storeId, at(started[0]!.params!["hour" as never] as string)),
  );

  await bundle("2026-10-24T10:00:00.000Z");
  // Hour 10's bundle missed this one (it was settled as the bundle ran); the next bundle must take it.
  await accept(later!, "2026-10-24T10:40:00.000Z");
  // The late document was still with the SDC when hour 10 was bundled; it is accepted in hour 11.
  await accept(next!, "2026-10-24T11:05:00.000Z");
  await accept(late!, "2026-10-24T11:20:00.000Z");
  await bundle("2026-10-24T11:00:00.000Z");
  await bundle("2026-10-24T12:00:00.000Z");

  const bundles = await db
    .select()
    .from(schema.fiscalArchive)
    .where(eq(schema.fiscalArchive.storeId, storeId));
  expect(
    bundles
      .map((b) => [b.hour.toISOString(), b.docCount])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ).toEqual([
    ["2026-10-24T10:00:00.000Z", 1],
    ["2026-10-24T11:00:00.000Z", 3],
  ]);
  const archived: string[] = [];
  for (const b of bundles) {
    expect(b.key).toBe(`fiscal/${storeId}/2026/10/24/${b.hour.toISOString().slice(11, 13)}.jsonl`);
    const bytes = (await blobs.get(ctx.orgId, b.key))!;
    expect(b.bytes).toBe(bytes.byteLength);
    expect(b.sha256).toBe(await sha256(bytes));
    const lines = new TextDecoder()
      .decode(bytes)
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { id: string; signature: string; qr: string });
    for (const line of lines) expect(line.qr).toContain(line.signature);
    archived.push(...lines.map((line) => line.id));
  }
  const accepted = [early!, later!, next!, late!];
  expect(archived.sort()).toEqual([...accepted].sort());
  const rows = await db
    .select()
    .from(schema.fiscalDoc)
    .where(inArray(schema.fiscalDoc.id, accepted));
  for (const row of rows)
    expect(bundles.find((b) => b.id === row.archiveId)?.docCount).toBeGreaterThan(0);
});
