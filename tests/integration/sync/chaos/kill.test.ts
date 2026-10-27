import { afterEach, expect, test } from "vite-plus/test";
import { updateProduct } from "@shopper/core/catalogue";
import { reference } from "@shopper/db-sqlite";
import { api, context, databases } from "../../../support/till/server";
import { head, tillCursor } from "../../../support/till/pull";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  expectConverged,
  sell,
  waitForDrained,
  waitForStatus,
} from "../../../support/till/host/chaos";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await fixture?.close();
  await upstream?.close();
  fixture = upstream = undefined;
});

test("SIGKILL while the server has applied a 200-sale backlog but not replied converges on restart", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  let host = await fixture.start();
  upstream.cut("/sync/push");
  await sell(host, fixture.config.references.products[0].id, 200);
  const gate = upstream.holdNextPush();
  upstream.restore();
  void host.request({ type: "retry" }, 60_000).catch(() => undefined);
  await gate.entered;
  await host.kill();
  gate.release();
  await gate.written;
  expect(await fixture.queued()).toHaveLength(200);

  host = await fixture.start({ ...fixture.config, session: null });
  await waitForDrained(host, 90_000);
  await expectConverged(fixture);
}, 240_000);

test("SIGKILL while a change page is in flight leaves the old references and the next start catches up", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  let host = await fixture.start();
  const productId = fixture.config.references.products[0].id;
  await waitForStatus(host, (status) => status.cursor !== null && status.cursor === status.head);
  const before = await productName(productId);

  const gate = upstream.holdNextPull();
  await updateProduct(
    databases().db,
    { ...context, reason: "Chaos rename" },
    {
      id: productId,
      data: { name: "Renamed during a crash" },
    },
  );
  void host.request({ type: "retry" }, 30_000).catch(() => undefined);
  await gate.entered;
  await host.kill();
  gate.release();
  await gate.written;
  // Nothing from the lost page reached the till: the page and its cursor move together or not at all.
  expect(await productName(productId)).toBe(before);
  expect(await tillCursor(fixture.database)).not.toBe(String(await head()));

  host = await fixture.start({ ...fixture.config, session: null });
  await waitForStatus(host, (status) => status.cursor === String(status.head));
  expect(await productName(productId)).toBe("Renamed during a crash");
  expect(await tillCursor(fixture.database)).toBe(String(await head()));
}, 120_000);

test("ten kills at random moments while selling never lose, double or renumber a sale", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const productId = fixture.config.references.products[0].id;
  const random = seeded(24);
  const confirmed = new Set<string>();
  let attempted = 0;
  for (let round = 0; round < 10; round++) {
    const host = await fixture.start();
    // One sale lands first, so every kill below hits a register that is selling and uploading.
    for (const id of await sell(host, productId)) confirmed.add(id);
    const attempts = Array.from({ length: 4 }, () => sell(host, productId));
    attempted += 5;
    await new Promise((resolve) => setTimeout(resolve, Math.floor(random() * 150)));
    await host.kill();
    for (const result of await Promise.allSettled(attempts))
      if (result.status === "fulfilled") for (const id of result.value) confirmed.add(id);
    const local = await fixture.localSales();
    // A sale whose reply died with the process may or may not have committed; a confirmed one always did.
    const stored = new Set(local.map((row) => row.localId));
    expect([...confirmed].filter((id) => !stored.has(id))).toEqual([]);
    expect(local.length).toBeLessThanOrEqual(attempted);
    expect(
      contiguous(local.map((row) => (row.payload as { receiptNumber: string }).receiptNumber)),
    ).toBe(true);
  }
  expect(confirmed.size).toBeGreaterThanOrEqual(10);
  const host = await fixture.start();
  await waitForDrained(host, 60_000);
  await expectConverged(fixture);
}, 240_000);

async function productName(productId: string) {
  const rows = await fixture!.database.read((tx) => tx.select().from(reference));
  const product = rows.find((row) => row.entity === "product" && row.id === productId);
  return (product?.payload as { name?: string } | undefined)?.name;
}

/**
 * Within each series (normal blocks, and the X overflow a till uses before its first handshake or once its
 * blocks run out) receipt numbers end in counters 1…n with no gap or repeat.
 */
function contiguous(numbers: string[]) {
  const overflow = (value: string) => /-X\d+$/.test(value);
  const series = [numbers.filter(overflow), numbers.filter((value) => !overflow(value))];
  return series.every((values) => {
    const counters = values.map((value) => Number(/(\d+)$/.exec(value)?.[1])).sort((a, b) => a - b);
    return counters.every((counter, index) => counter === index + 1);
  });
}

/** A small deterministic generator, so a failing kill schedule replays the same way. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}
