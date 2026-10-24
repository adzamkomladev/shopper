import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { product } from "@shopper/db-pg";
import { lookupSale } from "@shopper/core/refunds";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { products } from "../../../fixtures/sales/golden/references";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../../support/sales/refunds";
import { api, renewTillEnrollment } from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";

const scenario: GoldenSale = {
  name: "refund lookup",
  lines: [{ product: "standard", quantity: 3_000 }, { product: "zero" }],
  tenders: [{ kind: "cash", amount: 400_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
let sale: NonNullable<Awaited<ReturnType<typeof runGolden>>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

const find = (receipt: string, headers = syncHeaders()) =>
  api.request(`/sync/sales/lookup?receipt=${encodeURIComponent(receipt)}`, { headers });

test("another register's sale is found by receipt with refunded quantities and final-sale flags", async () => {
  sale = (await runGolden(world, scenario))!;
  await world.db.update(product).set({ finalSale: true }).where(eq(product.id, products.zero.id));
  const refunded = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }]);
  expect((await postRefund(refunded, world.session.proof)).body.accepted).toBeDefined();
  await renewTillEnrollment(); // the lookup now comes from a different register of the same store
  const response = await find(sale.receiptNumber!);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    sale: { id: sale.id, receiptNumber: sale.receiptNumber },
    occurredAt: expect.any(String),
    receipt: { v: 3, saleId: sale.id },
    refunded: { [sale.lines[0]!.id]: 1_000 },
    finalSale: { [products.standard.id]: false, [products.zero.id]: true },
  });
});

test("an unknown receipt is not found, and another store's sale is not visible", async () => {
  expect((await find("BR99-T99-000001")).status).toBe(404);
  const principal = { orgId: world.scope.orgId, deviceId: v7(), branchId: v7(), storeId: v7() };
  expect(await lookupSale(world.db, principal, sale.receiptNumber!)).toBeUndefined();
  expect(
    await lookupSale(
      world.db,
      { ...principal, orgId: v7(), storeId: sale.storeId },
      sale.receiptNumber!,
    ),
  ).toBeUndefined();
});
