// Notion Day 39 drill: kill the box mid-trade → tills keep selling, catch up after. Two registers push a backlog to the
// sealed box; the box dies without a shutdown (SIGKILL) part way through; both registers keep ringing sales; the box
// comes back on the same database and both registers drain and converge, every sale once with its own receipt number.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { databases, enrollAnotherTill } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { expectConverged, sell, waitForDrained } from "../../../support/till/host/chaos";
import { drillBox, expectStillSelling } from "../../../support/box/drill";

let box: Awaited<ReturnType<typeof drillBox>>;
const fixtures: Array<Awaited<ReturnType<typeof createHostFixture>>> = [];
beforeAll(async () => {
  box = await drillBox();
}, 300_000);
afterAll(async () => {
  await Promise.all(fixtures.map((fixture) => fixture.close()));
  await box?.close();
});

const onBox = async () =>
  (
    await databases()
      .db.select({ id: sale.id })
      .from(sale)
      .where(eq(sale.orgId, databases().context.orgId))
  ).length;

test("the box dies mid-trade: both registers keep selling, and after it restarts every sale lands once", async () => {
  const first = await createHostFixture({ upstream: box.upstream, freshSession: true });
  const second = await createHostFixture({
    upstream: box.upstream,
    freshSession: true,
    till: await enrollAnotherTill(),
  });
  fixtures.push(first, second);
  const hosts = [await first.start(), await second.start()] as const;
  const product = first.config.references.products[0]!.id;
  const selling = hosts.map((host) => sell(host, product, 60));

  await expect.poll(onBox, { timeout: 60_000, interval: 50 }).toBeGreaterThan(5);
  await box.kill();

  // Mid-trade with no box: every register still rings, prints a number and queues the sale.
  await Promise.all(selling);
  for (const [index, host] of hosts.entries())
    for (let round = 0; round < 5; round++) await expectStillSelling([first, second][index]!, host);
  expect((await first.queued()).length + (await second.queued()).length).toBeGreaterThan(0);

  await box.restart();
  for (const host of hosts) void host.request({ type: "retry" }, 30_000).catch(() => undefined);
  await Promise.all(hosts.map((host) => waitForDrained(host, 120_000)));
  await expectConverged(first, second);
  expect(await onBox()).toBe(130);
}, 400_000);
