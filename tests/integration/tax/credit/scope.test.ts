// A credit note's number must come from the uploading register's blocks, exactly like a sale's receipt number, so
// one register can never take a number another register will print.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { refund } from "@shopper/db-pg";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../../support/sales/refunds";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

const scenario: GoldenSale = {
  name: "credit note scope",
  lines: [{ product: "standard", quantity: 3_000 }],
  tenders: [{ kind: "cash", amount: 360_000 }],
};

test("a credit-note number of another register is refused; one of the uploading register is kept", async () => {
  // The golden register has no receipt blocks, so it numbers in overflow (X) like its sales.
  const sale = (await runGolden(world, scenario))!;
  const own = sale.receiptNumber!.replace(/[0-9]{6}$/, "000099");
  for (const creditNoteNumber of ["BR9-T9-000001", "BR9-T9-X000001"]) {
    const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }]);
    const forged = { ...event, refund: { ...event.refund, creditNoteNumber } };
    const { body } = await postRefund(forged, world.session.proof);
    expect(body.rejected, creditNoteNumber).toMatchObject({ code: expect.any(String) });
    expect(await world.db.select().from(refund).where(eq(refund.id, event.refund.id))).toEqual([]);
  }
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }]);
  const numbered = { ...event, refund: { ...event.refund, creditNoteNumber: own } };
  expect((await postRefund(numbered, world.session.proof)).body.accepted).toMatchObject({
    id: event.refund.id,
  });
  const [saved] = await world.db.select().from(refund).where(eq(refund.id, event.refund.id));
  expect(saved!.creditNoteNumber).toBe(own);
});
