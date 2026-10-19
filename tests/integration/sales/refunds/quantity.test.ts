import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../../support/sales/refunds";

const scenario: GoldenSale = {
  name: "refund quantity",
  lines: [{ product: "standard", quantity: 3_000 }],
  tenders: [{ kind: "cash", amount: 400_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

test("refunding more than was sold is rejected across partial refunds", async () => {
  const sale = (await runGolden(world, scenario))!;
  const first = refundEvent(world, sale, [{ line: 0, before: 0, after: 2_000 }]);
  expect((await postRefund(first, world.session.proof)).body.accepted).toBeDefined();
  const over = refundEvent(world, sale, [{ line: 0, before: 2_000, after: 3_000 }]);
  over.refund.lines[0]!.tax.quantityThousandths = 1_500;
  expect((await postRefund(over, world.session.proof)).body.rejected).toMatchObject({
    code: "REFUND_EXCEEDS_SALE",
  });
  const rest = refundEvent(world, sale, [{ line: 0, before: 2_000, after: 3_000 }]);
  expect((await postRefund(rest, world.session.proof)).body.accepted).toBeDefined();
});

test("two concurrent refunds of the same line accept only one", async () => {
  const sale = (await runGolden(world, scenario))!;
  const events = [0, 1].map(() => refundEvent(world, sale, [{ line: 0, before: 0, after: 2_000 }]));
  const results = await Promise.all(events.map((e) => postRefund(e, world.session.proof)));
  expect(results.filter((r) => r.body.accepted)).toHaveLength(1);
  expect(results.filter((r) => r.body.rejected)).toMatchObject([
    { body: { rejected: { code: "REFUND_EXCEEDS_SALE" } } },
  ]);
});
