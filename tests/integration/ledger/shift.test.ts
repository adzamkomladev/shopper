// A closed shift posts what the sales did not: cash dropped to the safe leaves the drawer, and each tender's counted
// variance (declared − expected) lands in cash over/short against that tender's account. A replayed Z posts nothing.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { goldenWorld } from "../../support/sales/golden/setup";
import { expected, postShift, shiftEvent } from "../../support/sales/shifts";
import { entriesOf } from "../../support/ledger/books";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

test("drops move to the safe and variances post to over/short, once", async () => {
  const event = shiftEvent(world, { cash: expected.cash + 5_000, card: expected.card - 2_000 });
  expect((await postShift(event, world.session.proof)).body.accepted).toBeDefined();
  const [entry, ...more] = await entriesOf("shift", event.shift.report.shiftId);
  expect(more).toEqual([]);
  expect(entry!.lines).toEqual({
    cash_safe: 1_000_000,
    cash_drawer: -1_000_000 + 5_000,
    card_clearing: -2_000,
    over_short: -5_000 + 2_000,
  });
  expect(entry!.posted_on).toBe("2026-10-15");

  expect((await postShift(event, world.session.proof)).body.accepted).toBeDefined();
  expect(await entriesOf("shift", event.shift.report.shiftId)).toHaveLength(1);
});
