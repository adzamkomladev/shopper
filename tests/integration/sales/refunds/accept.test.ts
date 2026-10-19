import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog, product, refund, refundLine, stockMovement } from "@shopper/db-pg";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../../support/sales/refunds";
import { memberWithPin } from "../../../support/sync/members";
import { inventorySession } from "../../../support/till/stock";

const scenario: GoldenSale = {
  name: "refund accept",
  lines: [{ product: "standard", quantity: 2_000 }, { product: "up" }],
  tenders: [{ kind: "cash", amount: 300_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

const audits = (id: string) =>
  world.db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, id), eq(auditLog.command, "refund.accept")));

test("an accepted refund writes its rows, a positive return movement and an audit row with the approver", async () => {
  const sale = (await runGolden(world, scenario))!;
  const approverId = await memberWithPin("Refund Manager", "admin", "2468");
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], { approverId });
  const { body } = await postRefund(event, world.session.proof);
  expect(body.accepted).toMatchObject({ id: event.refund.id });
  const [saved] = await world.db.select().from(refund).where(eq(refund.id, event.refund.id));
  expect(saved).toMatchObject({
    originalSaleId: sale.id,
    approverId,
    tenderKind: "card",
    tenderReference: "CARD-REF-1",
    gross: event.refund.totals.gross,
    total: event.refund.total,
  });
  const lines = await world.db.select().from(refundLine).where(eq(refundLine.refundId, saved!.id));
  expect(lines).toMatchObject([{ originalLineId: sale.lines[0]!.id, quantityThousandths: 1_000 }]);
  const moves = await world.db
    .select()
    .from(stockMovement)
    .where(eq(stockMovement.refundId, saved!.id));
  expect(moves).toMatchObject([
    {
      reason: "return",
      quantityThousandths: 1_000,
      productId: sale.lines[0]!.productId,
      refundLineId: lines[0]!.id,
    },
  ]);
  const [audit, ...more] = await audits(saved!.id);
  expect(more).toEqual([]);
  expect(audit).toMatchObject({ approverId, actorId: sale.cashierId });
});

test("a replay returns the saved result and writes no second audit row", async () => {
  const sale = (await runGolden(world, scenario))!;
  const event = refundEvent(world, sale, [{ line: 1, before: 0, after: 1_000 }]);
  const first = await postRefund(event, world.session.proof);
  const again = await postRefund(event, world.session.proof);
  expect(again.body.accepted).toEqual(first.body.accepted);
  expect(await audits(event.refund.id)).toHaveLength(1);
  expect(await world.db.select().from(refund).where(eq(refund.id, event.refund.id))).toHaveLength(
    1,
  );
  const changed = structuredClone(event);
  changed.refund.reason = "Different reason";
  expect((await postRefund(changed, world.session.proof)).body.rejected).toMatchObject({
    code: "CONFLICT",
  });
});

test("a session without refund.request is rejected", async () => {
  const sale = (await runGolden(world, scenario))!;
  const clerk = await inventorySession();
  const event = refundEvent(
    world,
    sale,
    [{ line: 0, before: 0, after: 1_000 }],
    {},
    { userId: clerk.userId, sessionId: clerk.sessionId },
  );
  expect((await postRefund(event, clerk.proof)).body.rejected).toMatchObject({
    code: "INVALID_SESSION",
  });
  expect(await audits(event.refund.id)).toEqual([]);
});

test("an approver without refund.approve is rejected", async () => {
  const sale = (await runGolden(world, scenario))!;
  const approverId = await memberWithPin("Plain Cashier", "cashier", "1111");
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], { approverId });
  expect((await postRefund(event, world.session.proof)).body.rejected).toMatchObject({
    code: "INVALID_SESSION",
  });
});

test("a cash refund pays the difference of rounded cumulative gross and wrong totals are rejected", async () => {
  const sale = (await runGolden(world, scenario))!;
  const full = refundEvent(world, sale, [{ line: 1, before: 0, after: 1_000 }], {
    tender: { kind: "cash" },
  });
  // The "up" product is GHS 1.25 gross; 10p cash rounding pays GHS 1.30.
  expect(full.refund.total).toBe(13_000);
  expect(full.refund.cashRounding).toBe(500);
  const wrong = structuredClone(full);
  wrong.refund.total = 12_500 as never;
  wrong.refund.cashRounding = 500 as never;
  expect((await postRefund(wrong, world.session.proof)).body.rejected).toMatchObject({
    code: "INVALID_TOTALS",
  });
  expect((await postRefund(full, world.session.proof)).body.accepted).toBeDefined();
});

test("a final-sale product is rejected by the server even with an approver", async () => {
  const sale = (await runGolden(world, scenario))!;
  const approverId = await memberWithPin("Final Manager", "admin", "2468");
  const productId = sale.lines[1]!.productId;
  const flag = (finalSale: boolean) =>
    world.db.update(product).set({ finalSale }).where(eq(product.id, productId));
  const event = refundEvent(world, sale, [{ line: 1, before: 0, after: 1_000 }], { approverId });
  await flag(true);
  try {
    expect((await postRefund(event, world.session.proof)).body.rejected).toMatchObject({
      code: "FINAL_SALE",
    });
  } finally {
    await flag(false);
  }
  expect(await world.db.select().from(refund).where(eq(refund.id, event.refund.id))).toEqual([]);
});
