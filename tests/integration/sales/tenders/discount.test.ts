import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { add, money } from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import { databases, deviceId, recordSale } from "../../../support/till/server";

test("ingest rejects a discounted line when the historical cashier lacks sale.discount", async () => {
  const created = await recordSale();
  const event = structuredClone(created.event);
  for (const line of event.sale.lines) {
    line.discount = money(1_000);
    line.tax = snapshotLine({ ...line.tax, discount: money(1_000) });
  }
  const totals = { ...event.sale.totals };
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] = money(0);
  for (const line of event.sale.lines)
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] = add(totals[key], line.tax[key]);
  event.sale.totals = totals;
  event.sale.cashRounding = money(0);
  event.sale.total = totals.gross;
  event.sale.tenders[0]!.amount = totals.gross;
  event.sale.paid = totals.gross;
  event.sale.change = money(0);

  const { db, context } = databases();
  const rejected = await acceptSale(
    db,
    {
      orgId: context.orgId,
      deviceId,
      branchId: event.sale.branchId,
      storeId: event.sale.storeId,
    },
    event,
    created.proof,
  ).catch((error: unknown) => error);
  expect(rejected).toMatchObject({ code: "INVALID_SESSION" });
  expect(await db.select().from(sale).where(eq(sale.localId, event.sale.localId))).toEqual([]);
});
