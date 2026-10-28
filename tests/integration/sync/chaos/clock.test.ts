import { afterEach, expect, test } from "vite-plus/test";
import { inArray } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { api, databases } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  expectConverged,
  sell,
  waitForDrained,
  waitForStatus,
} from "../../../support/till/host/chaos";

const hours = (count: number) => count * 3_600_000;

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await fixture?.close();
  await upstream?.close();
  fixture = upstream = undefined;
});

test("a register 3 h fast whose clock is then set back 3 h offline keeps dating sales by server time", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const productId = fixture.config.references.products[0].id;
  let host = await fixture.start(fixture.config, { clockOffsetMs: hours(3) });
  // The handshake measures the skew; the banner reads it from status.
  await waitForStatus(host, (status) => near(Number(status.clockSkewMs), hours(3), 5_000), 30_000);
  const [ahead] = await sell(host, productId);

  // Offline, someone corrects the computer's clock: the wall clock jumps 3 h back, no handshake follows.
  upstream.cut();
  await host.setClock(0);
  const [jumped] = await sell(host, productId);
  await waitForStatus(host, (status) => near(Number(status.clockSkewMs), 0, 5_000));
  // A forward jump could be a night asleep: it is left alone, and undoing it invents no offset.
  await host.setClock(hours(3));
  await host.request({ type: "status" });
  await host.setClock(0);
  expect(
    near(
      Number(
        ((await host.request({ type: "status" })).status as { clockSkewMs: number }).clockSkewMs,
      ),
      0,
      5_000,
    ),
  ).toBe(true);

  // A restart while still offline has no anchor; the offset stored at the jump carries over.
  await host.kill();
  host = await fixture.start(fixture.config, { clockOffsetMs: 0 });
  const [restarted] = await sell(host, productId);

  const ids = [ahead!, jumped!, restarted!];
  const local = await fixture.localSales();
  for (const id of ids) {
    const payload = local.find((row) => row.localId === id)!.payload as {
      deviceTime: string;
      clockOffsetMs: number;
    };
    expect(near(Date.parse(payload.deviceTime) - payload.clockOffsetMs, Date.now(), 60_000)).toBe(
      true,
    );
  }

  upstream.restore();
  await host.request({ type: "retry" }, 30_000);
  await waitForDrained(host, 30_000);
  await expectConverged(fixture);
  const stored = await databases().db.select().from(sale).where(inArray(sale.localId, ids));
  expect(stored).toHaveLength(3);
  for (const row of stored) expect(near(row.occurredAt.valueOf(), Date.now(), 60_000)).toBe(true);
  // The register's own reading is kept as it was: 3 h fast for the first sale, true for the others.
  const first = stored.find((row) => row.localId === ahead)!;
  expect(near(first.deviceTime.valueOf() - first.occurredAt.valueOf(), hours(3), 5_000)).toBe(true);
}, 120_000);

function near(value: number, target: number, tolerance: number) {
  return Number.isFinite(value) && Math.abs(value - target) <= tolerance;
}
