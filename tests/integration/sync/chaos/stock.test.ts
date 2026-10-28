import { afterEach, expect, test } from "vite-plus/test";
import { and, eq, sum } from "drizzle-orm";
import { stockAlert, stockMovement } from "@shopper/db-pg";
import { api, databases, enrollAnotherTill } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
import { addMovements } from "../../../support/stock/seed";
import { sentMessages } from "../../../support/stock/queue";
import {
  expectConverged,
  sell,
  waitForDrained,
  waitForStatus,
} from "../../../support/till/host/chaos";

type Fixture = Awaited<ReturnType<typeof createHostFixture>>;

let fixtures: Fixture[] = [];
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  for (const fixture of fixtures) await fixture.close();
  await upstream?.close();
  fixtures = [];
  upstream = undefined;
});

test("two registers offline both sell the last unit: both sales stand, on hand goes to -1 and one negative alert goes out", async () => {
  upstream = await startHostUpstream(api);
  const first = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const second = await createHostFixture({
    upstream: upstream.url,
    freshSession: true,
    till: await enrollAnotherTill(),
  });
  fixtures = [first, second];
  const productId = first.config.references.products[0].id;
  const { branchId } = first.config.identity;
  const hosts = await Promise.all(
    fixtures.map(async (fixture) => {
      const host = await fixture.start();
      await waitForStatus(host, (status) => Number(status.receiptsLeft) > 0, 30_000);
      return host;
    }),
  );
  // One unit left on the shelf.
  await addMovements([
    { productId, quantity: 1_000 - (await onHand(productId, branchId)), at: "08:00" },
  ]);
  expect(await onHand(productId, branchId)).toBe(1_000);

  upstream.cut();
  await Promise.all(hosts.map((host) => sell(host, productId)));
  upstream.restore();
  // Both reconnect at once: their sales race for the same stock row.
  await Promise.all(hosts.map((host) => host.request({ type: "retry" }, 60_000)));
  await Promise.all(hosts.map((host) => waitForDrained(host, 60_000)));
  await expectConverged(first, second);

  expect(await onHand(productId, branchId)).toBe(-1_000);
  const open = await databases()
    .db.select()
    .from(stockAlert)
    .where(and(eq(stockAlert.productId, productId), eq(stockAlert.branchId, branchId)));
  expect(open).toMatchObject([{ kind: "negative", onHandThousandths: -1_000, clearedAt: null }]);
  const messages = (await sentMessages()).filter(
    (message) => (message.payload as { alertId?: string }).alertId === open[0]!.id,
  );
  expect(messages).toMatchObject([{ type: "stock.negative" }]);
}, 120_000);

async function onHand(productId: string, branchId: string) {
  const [row] = await databases()
    .db.select({ total: sum(stockMovement.quantityThousandths) })
    .from(stockMovement)
    .where(and(eq(stockMovement.productId, productId), eq(stockMovement.branchId, branchId)));
  return Number(row?.total ?? 0);
}
