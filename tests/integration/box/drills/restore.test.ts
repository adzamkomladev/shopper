// Notion Day 39 drill: restore last night's backup to a spare box → tills replay their outboxes over it. The box takes
// its nightly dump, trades on for a while (every register drains: the box has acknowledged everything), then dies. A
// spare box is restored from the dump by the support runbook (pg_restore into a fresh database) and answers at the same
// address. The registers never stop selling; the sales the dump missed reach the spare once each, with the receipt
// numbers the customers were given, and no receipt number is issued twice.
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { postgresFixture } from "../../../fixtures/postgres";
import { context, databaseConnectionString, enrollAnotherTill } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { sell, waitForDrained, waitForStatus } from "../../../support/till/host/chaos";
import { drillBox, expectStillSelling } from "../../../support/box/drill";

let box: Awaited<ReturnType<typeof drillBox>>;
let spare: Awaited<ReturnType<typeof postgresFixture>>;
let folder: string;
const fixtures: Array<Awaited<ReturnType<typeof createHostFixture>>> = [];
beforeAll(async () => {
  box = await drillBox();
  spare = await postgresFixture();
  folder = await mkdtemp(join(tmpdir(), "shopper-restore-drill-"));
}, 300_000);
afterAll(async () => {
  await Promise.all(fixtures.map((fixture) => fixture.close()));
  await box?.close();
  await spare?.close();
  await rm(folder, { recursive: true, force: true });
});

test("a spare box restored from last night's dump gets every later sale back from the registers", async () => {
  const first = await createHostFixture({ upstream: box.upstream, freshSession: true });
  const second = await createHostFixture({
    upstream: box.upstream,
    freshSession: true,
    till: await enrollAnotherTill(),
  });
  fixtures.push(first, second);
  const hosts = [await first.start(), await second.start()] as const;
  const product = first.config.references.products[0]!.id;
  await Promise.all(hosts.map((host) => sell(host, product, 10)));
  await Promise.all(hosts.map((host) => waitForDrained(host, 60_000)));

  // Last night's backup, then a day of trade the backup never saw: acknowledged, so gone from every outbox.
  const dump = join(folder, "nightly.dump");
  execFileSync("pg_dump", ["-Fc", "-f", dump, databaseConnectionString()]);
  await Promise.all(hosts.map((host) => sell(host, product, 15)));
  await Promise.all(hosts.map((host) => waitForDrained(host, 60_000)));
  expect(await first.queued()).toEqual([]);
  await box.kill();

  // The runbook: restore into the spare's empty database; the spare answers where the old box did.
  execFileSync("pg_restore", ["--exit-on-error", "--no-owner", "-d", spare.connectionString, dump]);
  await box.restart({ DATABASE_URL: spare.connectionString });
  const pool = new Pool({ connectionString: spare.connectionString });
  const db = drizzle(pool, { schema });
  try {
    for (const [index, host] of hosts.entries())
      await expectStillSelling([first, second][index]!, host);
    for (const host of hosts) void host.request({ type: "retry" }, 30_000).catch(() => undefined);
    const local = async () => [...(await first.localSales()), ...(await second.localSales())];
    const stored = () => db.select().from(schema.sale).where(eq(schema.sale.orgId, context.orgId));
    await expect
      .poll(async () => (await stored()).length, { timeout: 120_000, interval: 250 })
      .toBe((await local()).length);
    await Promise.all(hosts.map((host) => waitForDrained(host, 60_000)));

    // Every sale once, as the customer's receipt says; no receipt number or store sequence twice.
    const rows = await stored();
    const byId = new Map(rows.map((row) => [row.localId, row]));
    for (const row of await local()) {
      expect(byId.get(row.localId)?.contentHash).toBe(row.contentHash);
      expect(byId.get(row.localId)?.receiptNumber).toBe(
        (row.payload as { receiptNumber: string }).receiptNumber,
      );
    }
    expect(new Set(rows.map((row) => row.receiptNumber)).size).toBe(rows.length);
    expect(new Set(rows.map((row) => String(row.storeSequence))).size).toBe(rows.length);

    // Both registers keep pulling from the spare instead of halting on its older history.
    for (const host of hosts) {
      void host.request({ type: "retry" }, 30_000).catch(() => undefined);
      await waitForStatus(
        host,
        (status) => status.head !== null && status.cursor === String(status.head),
        60_000,
      );
    }
    // A register that sells after the restore never gets a receipt block another register already used.
    for (const [index, host] of hosts.entries())
      await expectStillSelling([first, second][index]!, host);
    await Promise.all(hosts.map((host) => waitForDrained(host, 60_000)));
    const after = await stored();
    expect(new Set(after.map((row) => row.receiptNumber)).size).toBe(after.length);
  } finally {
    await pool.end();
  }
}, 600_000);
