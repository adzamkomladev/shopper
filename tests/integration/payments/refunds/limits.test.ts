// A MoMo refund goes back only through the sale's MoMo payments, and a late webhook only settles the refund it names.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { findOpenRefund } from "@shopper/core/payments";
import * as schema from "@shopper/db-pg";
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

const paymentOf = async (saleId: string) =>
  (
    await world.db
      .select({ payment: schema.payment })
      .from(schema.saleTender)
      .innerJoin(schema.payment, eq(schema.payment.id, schema.saleTender.paymentId))
      .where(eq(schema.saleTender.saleId, saleId))
  )[0]!.payment;

test("a MoMo refund larger than the sale's MoMo payments is refused, not partly paid", async () => {
  const mixed: GoldenSale = {
    name: "MoMo and cash",
    lines: [{ product: "standard", quantity: 2_000 }],
    tenders: [
      { kind: "momo", amount: 100_000 },
      { kind: "cash", amount: 140_000 },
    ],
  };
  const sale = (await runGolden(world, mixed))!;
  const all = refundEvent(world, sale, [{ line: 0, before: 0, after: 2_000 }], {
    tender: { kind: "momo", reference: "MOMO-OVER" },
  });
  const reply = await postRefund(all, world.session.proof);
  expect(reply.body.rejected).toMatchObject({ code: "REFUND_EXCEEDS_TENDER" });
  expect(
    await world.db.select().from(schema.refund).where(eq(schema.refund.id, all.refund.id)),
  ).toEqual([]);
});

test("a webhook for a refund already settled never lands on another open refund of the same amount", async () => {
  const momo: GoldenSale = {
    name: "MoMo",
    lines: [{ product: "standard", quantity: 2_000 }],
    tenders: [{ kind: "momo", amount: 240_000 }],
  };
  const sale = (await runGolden(world, momo))!;
  const ids: string[] = [];
  for (const [before, after] of [
    [0, 1_000],
    [1_000, 2_000],
  ] as const) {
    const event = refundEvent(world, sale, [{ line: 0, before, after }], {
      tender: { kind: "momo", reference: `MOMO-LATE-${after}` },
    });
    expect((await postRefund(event, world.session.proof)).body.accepted).toBeDefined();
    const [row] = await world.db
      .select()
      .from(schema.paymentRefund)
      .where(eq(schema.paymentRefund.refundId, event.refund.id));
    ids.push(row!.id);
  }
  // The first was settled by its verify; the second is still waiting on Paystack under its own id.
  await world.db
    .update(schema.paymentRefund)
    .set({ status: "processed", providerReference: "RF-FIRST" })
    .where(eq(schema.paymentRefund.id, ids[0]!));
  await world.db
    .update(schema.paymentRefund)
    .set({ providerReference: "RF-SECOND" })
    .where(eq(schema.paymentRefund.id, ids[1]!));
  const reference = (await paymentOf(sale.id)).reference;
  const late = { reference, pesewas: 1_200 };
  expect(await findOpenRefund(world.db, { ...late, providerId: "RF-FIRST" })).toBeUndefined();
  expect(await findOpenRefund(world.db, { ...late, providerId: "RF-OTHER" })).toBeUndefined();
  expect((await findOpenRefund(world.db, { ...late, providerId: "RF-SECOND" }))?.id).toBe(ids[1]);
  // Without an id, the one open refund of that charge and amount is it.
  expect((await findOpenRefund(world.db, late))?.id).toBe(ids[1]);
});
