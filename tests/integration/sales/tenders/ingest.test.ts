import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import { sale, saleTender, stockMovement } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { databases, deviceId, recordSale } from "../../../support/till/server";

test("acceptance stores reconciled tenders and signed stock movements atomically", async () => {
  const created = await recordSale();
  const snapshot = created.event.sale;
  const { db, context } = databases();
  await acceptSale(
    db,
    {
      orgId: context.orgId,
      deviceId,
      branchId: snapshot.branchId,
      storeId: snapshot.storeId,
    },
    created.event,
    created.proof,
  );
  const tenders = await db.select().from(saleTender).where(eq(saleTender.saleId, snapshot.id));
  const movements = await db
    .select()
    .from(stockMovement)
    .where(eq(stockMovement.saleId, snapshot.id));
  const [saved] = await db.select().from(sale).where(eq(sale.id, snapshot.id));
  expect(tenders).toHaveLength(1);
  expect(tenders[0]).toMatchObject({ kind: "cash", amount: snapshot.totals.gross });
  expect(movements).toHaveLength(snapshot.lines.length);
  expect(movements[0]).toMatchObject({
    reason: "sale",
    quantityThousandths: -snapshot.lines[0]!.tax.quantityThousandths,
  });
  expect(saved).toMatchObject({
    total: snapshot.totals.gross,
    paid: snapshot.totals.gross,
    change: 0,
    receipt: { v: 2, saleId: snapshot.id },
  });
});

test("noncash overpayment is a rejected sale, not a transient service failure", async () => {
  const created = await recordSale();
  const event = structuredClone(created.event);
  event.sale.tenders = [
    { ...event.sale.tenders[0]!, kind: "card", amount: event.sale.paid, approvalCode: "APP123" },
    {
      ...event.sale.tenders[0]!,
      id: v7(),
      kind: "card",
      amount: event.sale.paid,
      approvalCode: "APP456",
    },
  ];
  const { db, context } = databases();
  await expect(
    acceptSale(
      db,
      {
        orgId: context.orgId,
        deviceId,
        branchId: event.sale.branchId,
        storeId: event.sale.storeId,
      },
      event,
      created.proof,
    ),
  ).rejects.toMatchObject({ code: "INVALID_TOTALS" });
  expect(await db.select().from(sale).where(eq(sale.id, event.sale.id))).toEqual([]);
});
