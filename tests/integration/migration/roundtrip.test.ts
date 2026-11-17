// Day 44's required test. Round trip cloud → box → cloud: every table, blob and audit chain identical; the audit
// chain still verifies. A cloud shop moves onto its box, trades there (a sale and a new product photo), and moves back.
// The cloud held the shop only as an archived departure, so the way back replaces that copy with the box's: every
// table and day agrees with the box at departure, every blob is byte for byte the box's, and the audit chain is the
// cloud's own history, then the box's, then the import, unbroken from the first entry.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { and, asc, eq, max, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { boxBlobs, boxCloudMove } from "@shopper/adapters-box";
import { verifyChain } from "@shopper/audit";
import { generateKey, issueLicence, signedRequest } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import {
  archiveEntries,
  compareReports,
  leavingMove,
  reconciliationReport,
  requestCloudMove,
} from "@shopper/export";
import type { Blobs } from "@shopper/ports";
import { addSale, storeAsset } from "../../support/export/org";
import { CLOUD, cloudAndBox, toBox } from "../../support/migration/onprem";

let h: Awaited<ReturnType<typeof cloudAndBox>>;
let remove: (() => Promise<void>) | undefined;
let boxStorage: Blobs;
let departed: Awaited<ReturnType<typeof chain>>;
let boxAtDeparture: Awaited<ReturnType<typeof reconciliationReport>>;
const orgId = () => h.f.ctx.orgId;
const chain = (db: schema.ShopperDatabase) =>
  db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, orgId()))
    .orderBy(asc(schema.auditLog.chainSeq));

beforeAll(async () => {
  h = await cloudAndBox();
  // This shop first came to the cloud from a box: its finished import is still on record.
  await h.f.db.insert(schema.archiveImport).values({
    orgId: orgId(),
    status: "ready",
    licenceId: v7(),
    manifest: {},
    signature: "an earlier move in",
    completedAt: new Date("2026-11-01T20:00:00Z"),
  });
  // There: the cloud shop moves onto its box.
  const box = await toBox(h);
  remove = box.remove;
  expect(box.report.ok).toBe(true);
  departed = await chain(h.f.db);

  // The box trades: a sale on a new day and a product photo taken on the box.
  boxStorage = (
    await boxBlobs(join(box.dir, "blobs"), {
      baseUrl: "http://127.0.0.1",
      secret: new Uint8Array(32).fill(4),
    })
  ).blobs;
  await addSale(h.b.db, orgId(), {
    on: "2026-11-16",
    receipt: "BR01-T01-009001",
    total: 125_000,
    tenders: [{ kind: "cash", amount: 125_000 }],
  });
  await storeAsset(h.b.db, boxStorage, orgId(), {
    key: "products/box-photo.png",
    purpose: "product_image",
  });

  // And back: the owner presses Move to cloud on the box, licensed by the same issuer.
  const key = await generateKey();
  const identity = {
    key: key.privateKey,
    licence: await issueLicence(h.issuer.privateKey, {
      id: v7(),
      org: orgId(),
      site: "Accra Mall",
      machine: "0".repeat(64),
      key: key.publicKey,
      terminals: 5,
      issuedAt: new Date().toISOString(),
      maintenanceUntil: "2027-11-17",
    }),
  };
  const move = boxCloudMove({
    database: h.b.db,
    blobs: boxStorage,
    cloud: async (url, init) => h.cloud.fetch(await signedRequest(identity, url, init)),
  });
  await requestCloudMove(h.b.db, { ...h.f.ctx, actorId: h.f.userId }, move.launcher, {
    cloudUrl: `${CLOUD}/`,
  });
  await move.launcher.idle?.();
  await h.imported();
  const [moved] = await h.b.db
    .select()
    .from(schema.cloudMove)
    .where(eq(schema.cloudMove.orgId, orgId()));
  expect(moved).toMatchObject({ status: "moved", error: null });
  boxAtDeparture = await reconciliationReport(h.b.db, orgId());
}, 300_000);
afterAll(async () => {
  await h?.close();
  await remove?.();
});

test("Round trip cloud → box → cloud: every table, blob and audit chain identical; audit chain verifies", async () => {
  // Tables and days: the cloud's rows are the box's at departure, the import's own audit row aside.
  const [imported] = await h.f.db
    .select({ seq: max(schema.auditLog.chainSeq) })
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, orgId()), eq(schema.auditLog.command, "migration.import")),
    );
  const back = await reconciliationReport(h.f.db, orgId(), { auditUpTo: imported!.seq! - 1 });
  const compared = compareReports(back, {
    ...boxAtDeparture,
    tables: {
      ...boxAtDeparture.tables,
      // The box's own audit rows after its archive (none expected) would show here as a mismatch.
      audit_log: (await reconciliationReport(h.b.db, orgId(), { auditUpTo: imported!.seq! - 1 }))
        .tables.audit_log!,
    },
  });
  expect(compared.tables.filter((row) => !row.ok)).toEqual([]);
  expect(compared.days.filter((row) => !row.ok)).toEqual([]);
  expect(compared.tables.find((row) => row.table === "sale")!.cloud.rows).toBe(
    boxAtDeparture.tables.sale!.rows,
  );
  expect(boxAtDeparture.tables.sale!.rows).toBeGreaterThan(1);

  // Blobs: every file the shop's rows point at is the box's, byte for byte, the box's own photo included.
  const assets = await h.f.db
    .select({ key: schema.asset.key })
    .from(schema.asset)
    .where(eq(schema.asset.orgId, orgId()));
  expect(assets.map((asset) => asset.key)).toContain("products/box-photo.png");
  for (const asset of assets) {
    const there = await boxStorage.get(orgId(), asset.key);
    if (!there) continue; // Receipt PDFs are rebuilt from rows, never archived.
    expect(await h.blobs.get(orgId(), asset.key)).toEqual(there);
  }

  // The audit chain: the cloud's history up to the archive it left with, unchanged, then the box's, and it verifies
  // end to end. What the cloud wrote about the move after sealing (licence, claim, verdict) is anchored by its head.
  const after = await chain(h.f.db);
  const boxChain = await chain(h.b.db);
  const fork = Number(boxChain.find((row) => row.command === "migration.import")!.chainSeq) - 1;
  expect(after.slice(0, fork)).toEqual(departed.slice(0, fork));
  expect(
    [...after].reverse().find((row) => row.command === "migration.import")!.payload,
  ).toMatchObject({
    replaced: { chainSeq: departed.at(-1)!.chainSeq, hash: departed.at(-1)!.hash },
  });
  expect(await verifyChain(after)).toMatchObject({ valid: true, count: after.length });
  // Up to the import, the cloud's chain is the box's entry for entry.
  const upTo = imported!.seq! - 1;
  expect(after.slice(0, upTo)).toEqual(boxChain.slice(0, upTo));

  // The cloud copy is the shop again: no longer frozen, and members can change it.
  expect(await leavingMove(h.f.db, orgId())).toBeUndefined();
  expect((await h.member("owner", "POST", "/categories", { name: "Grains" })).status).toBe(201);
});

test("a cloud org that is not an archived departure is still refused", async () => {
  const [org] = await h.f.db.select().from(schema.org).where(eq(schema.org.id, orgId()));
  expect(org).toBeDefined();
  const key = await generateKey();
  const licence = await issueLicence(h.issuer.privateKey, {
    id: v7(),
    org: orgId(),
    site: "Accra Mall",
    machine: "1".repeat(64),
    key: key.publicKey,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2027-11-17",
  });
  // The very archive the box sent, offered again: genuine, but the cloud's copy is the live shop now.
  const [moved] = await h.b.db
    .select()
    .from(schema.cloudMove)
    .where(eq(schema.cloudMove.orgId, orgId()));
  const entries = await archiveEntries(boxStorage, orgId(), moved!.exportJobId!);
  const text = async (path: string) =>
    new TextDecoder().decode(await entries.find((entry) => entry.path === path)!.read());
  const answer = await h.signed({ key: key.privateKey, licence }, "/migration/imports", {
    manifest: await text("manifest.json"),
    signature: await text("manifest.sig"),
  });
  // The shop trades in the cloud now: nothing may replace it.
  expect(answer.status).toBe(409);
  const opened = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, orgId()));
  expect(opened).toEqual([]);
});

test("history stays append-only outside a replacing import", async () => {
  await expect(
    h.f.db.delete(schema.auditLog).where(eq(schema.auditLog.orgId, orgId())),
  ).rejects.toThrow();
  await expect(
    h.f.db.transaction(async (tx) => {
      // Another org's id: the setting only lets that org's rows go.
      await tx.execute(sql`select set_config('shopper.replace', ${v7()}, true)`);
      await tx.delete(schema.auditLog).where(eq(schema.auditLog.orgId, orgId()));
    }),
  ).rejects.toThrow();
});
