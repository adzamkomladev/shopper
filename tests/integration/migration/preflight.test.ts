// Day 44: the move wizards' pre-flight checks and dry run. Before an owner freezes the shop, the move screen says
// whether the shop looks closed and whether a dry run has sealed and verified the archive the move would carry. A dry
// run seals that archive with nothing frozen, reads it back the way the box will, and estimates the cutover window.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { desc, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { exportPrefix, preflight } from "@shopper/export";
import { cloudAndBox } from "../../support/migration/onprem";

let h: Awaited<ReturnType<typeof cloudAndBox>>;
let lastSale: Date;

beforeAll(async () => {
  h = await cloudAndBox();
  const [sale] = await h.f.db
    .select({ at: schema.sale.occurredAt })
    .from(schema.sale)
    .where(eq(schema.sale.orgId, h.f.ctx.orgId))
    .orderBy(desc(schema.sale.occurredAt))
    .limit(1);
  lastSale = sale!.at;
}, 120_000);
afterAll(async () => h?.close());

const minutes = (n: number) => new Date(lastSale.getTime() + n * 60_000);

test("the shop looks closed only once its last sale is a quarter of an hour old", async () => {
  const open = await preflight(h.f.db, h.f.ctx.orgId, minutes(5));
  expect(open.quiet).toEqual({ ok: false, lastSaleAt: lastSale.toISOString() });
  expect((await preflight(h.f.db, h.f.ctx.orgId, minutes(15))).quiet.ok).toBe(true);
  // No dry run yet.
  expect(open.dryRun).toEqual({ ok: false, exportJobId: null, sealedAt: null, minutes: null });
});

test("a dry run seals and verifies the archive with nothing frozen, and the move screen sees it", async () => {
  expect((await h.member("cashier", "POST", "/migration/dryrun")).status).toBe(403);
  const started = await h.member("owner", "POST", "/migration/dryrun");
  expect(started.status).toBe(202);
  const { exportJobId } = (await started.json()) as { exportJobId: string };
  // Nothing froze: members keep changing the shop while it seals.
  expect((await h.member("owner", "POST", "/categories", { name: "Dry goods" })).status).toBe(201);
  expect(await (await h.member("owner", "GET", `/migration/dryrun/${exportJobId}`)).json()).toEqual(
    {
      status: "running",
    },
  );
  await h.sealed();

  const result = (await (
    await h.member("owner", "GET", `/migration/dryrun/${exportJobId}`)
  ).json()) as Record<string, unknown>;
  expect(result).toMatchObject({ status: "ready", verified: true, message: null });
  expect(result.tables).toBeGreaterThan(10);
  expect(result.rows).toBeGreaterThan(0);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.minutes).toBeGreaterThanOrEqual(1);

  const view = (await (await h.member("owner", "GET", "/migration/onprem")).json()) as {
    move: unknown;
    checks: { dryRun: { ok: boolean; exportJobId: string } };
  };
  expect(view.move).toBeNull();
  expect(view.checks.dryRun).toMatchObject({ ok: true, exportJobId, minutes: result.minutes });
  // A day later the dry run is stale: the shop has changed since.
  const [job] = await h.f.db
    .select()
    .from(schema.exportJob)
    .where(eq(schema.exportJob.id, exportJobId));
  const tomorrow = new Date(job!.completedAt!.getTime() + 25 * 3_600_000);
  expect((await preflight(h.f.db, h.f.ctx.orgId, tomorrow)).dryRun.ok).toBe(false);

  // A damaged part is caught before any move carries it.
  await h.blobs.put(
    h.f.ctx.orgId,
    `${exportPrefix(exportJobId)}/tables/org/0001.ndjson`,
    new TextEncoder().encode("{}\n"),
  );
  expect(
    await (await h.member("owner", "GET", `/migration/dryrun/${exportJobId}`)).json(),
  ).toMatchObject({ status: "ready", verified: false, message: expect.stringContaining("org") });
  expect(
    (await h.member("owner", "GET", "/migration/dryrun/01a1e911-0000-7000-8000-000000000000"))
      .status,
  ).toBe(404);
});
