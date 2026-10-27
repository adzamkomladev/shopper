import { afterEach, expect, test } from "vite-plus/test";
import { and, eq, inArray } from "drizzle-orm";
import { tillState } from "@shopper/db-sqlite";
import { fiscalDoc, sale } from "@shopper/db-pg";
import { api, databases, enrollAnotherTill } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
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

test("two registers that run out of receipt blocks offline overflow, survive a kill and refill on reconnect", async () => {
  upstream = await startHostUpstream(api);
  const first = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const second = await createHostFixture({
    upstream: upstream.url,
    freshSession: true,
    till: await enrollAnotherTill(),
  });
  fixtures = [first, second];
  const productId = first.config.references.products[0].id;
  const hosts = await Promise.all(fixtures.map(startWithBlocks));

  upstream.cut();
  // Two numbers left in each register's last block, then the network stays down.
  const ends = await Promise.all(fixtures.map(nearlyExhaust));
  const sold = await Promise.all(hosts.map((host) => sell(host, productId, 5)));
  for (const [index, fixture] of fixtures.entries()) {
    const prefix = `${fixture.config.receiptCodes.branchCode}-${fixture.config.receiptCodes.deviceCode}-`;
    expect(await receipts(fixture, sold[index]!)).toEqual([
      `${prefix}${pad(ends[index]! - 1)}`,
      `${prefix}${pad(ends[index]!)}`,
      `${prefix}X000001`,
      `${prefix}X000002`,
      `${prefix}X000003`,
    ]);
  }
  await waitForStatus(hosts[0]!, (status) => status.overflow === true && status.receiptsLeft === 0);

  // The first register dies and comes back with the network still cut: the overflow series continues.
  await hosts[0]!.kill();
  hosts[0] = await first.start();
  const after = await sell(hosts[0], productId, 2);
  const prefix = `${first.config.receiptCodes.branchCode}-${first.config.receiptCodes.deviceCode}-`;
  expect(await receipts(first, after)).toEqual([`${prefix}X000004`, `${prefix}X000005`]);

  upstream.restore();
  await Promise.all(hosts.map((host) => host.request({ type: "retry" }, 60_000)));
  await Promise.all(hosts.map((host) => waitForDrained(host, 60_000)));
  await expectConverged(first, second);

  const { db } = databases();
  const ids = fixtures.map((fixture) => fixture.config.identity.deviceId);
  const stored = await db.select().from(sale).where(inArray(sale.deviceId, ids));
  expect(stored).toHaveLength(12);
  const overflowed = stored.filter((row) => row.receiptNumber?.includes("-X"));
  expect(overflowed).toHaveLength(8);
  expect(
    overflowed.every((row) => (row.payload as { receiptOverflow?: boolean }).receiptOverflow),
  ).toBe(true);
  const docs = await db
    .select({ saleId: fiscalDoc.saleId })
    .from(fiscalDoc)
    .where(
      inArray(
        fiscalDoc.saleId,
        stored.map((row) => row.id),
      ),
    );
  expect(new Set(docs.map((doc) => doc.saleId)).size).toBe(12);

  // The handshake refilled both registers: the next sale is a normal number again.
  for (const [index, host] of hosts.entries()) {
    await waitForStatus(
      host,
      (status) => Number(status.receiptsLeft) > 0 && status.overflow === false,
    );
    const [next] = await sell(host, productId);
    const [number] = await receipts(fixtures[index]!, [next!]);
    expect(number).toMatch(/-\d{6}$/);
  }
}, 180_000);

async function startWithBlocks(fixture: Fixture) {
  const host = await fixture.start();
  await waitForStatus(host, (status) => Number(status.receiptsLeft) > 0, 30_000);
  return host;
}

/** Moves the register's counter to two numbers before the end of its last issued block. */
async function nearlyExhaust(fixture: Fixture) {
  const scope = and(
    eq(tillState.orgId, fixture.config.identity.orgId),
    eq(tillState.deviceId, fixture.config.identity.deviceId),
  );
  return fixture.database.transaction(async (tx) => {
    const [state] = await tx.select().from(tillState).where(scope);
    const end = Math.max(...state!.receiptBlocks.map((block) => block.end));
    await tx
      .update(tillState)
      .set({ receiptLastUsed: end - 2 })
      .where(scope);
    return end;
  });
}

async function receipts(fixture: Fixture, localIds: string[]) {
  const sales = await fixture.localSales();
  return localIds.map(
    (id) =>
      (sales.find((row) => row.localId === id)?.payload as { receiptNumber?: string })
        ?.receiptNumber,
  );
}

const pad = (number: number) => String(number).padStart(6, "0");
