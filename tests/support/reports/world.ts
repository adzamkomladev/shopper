// A small reporting world on the golden till: two trading days (14 and 15 Oct 2026), a refund, a costed rice
// receipt, a second branch and a second cashier. Sales rung on the golden till go through the real sync path; the
// second branch's sale is a copy of an accepted one, since the golden till belongs to the main branch.
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { touchStoreDay } from "@shopper/core/reports";
import type { SaleSnapshot } from "@shopper/core/schemas";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { expected } from "../../fixtures/sales/golden/expected";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../sales/golden/setup";
import { runGolden } from "../sales/golden/run";
import { postRefund, refundEvent } from "../sales/refunds";
import { addBranch, addDocument, addSupplier } from "../stock/seed";
import { portalMember, portalOwner } from "../api/portal";
import { databases } from "../till/server";

/** What each sale is: its golden scenario and when it was rung up (Accra = UTC). */
export const plan = [
  { name: "cash with change", at: "2026-10-14T09:05:00.000Z" },
  { name: "manual card", at: "2026-10-14T15:20:00.000Z" },
  { name: "cash with change", at: "2026-10-15T08:30:00.000Z" },
  { name: "exact MoMo", at: "2026-10-15T12:10:00.000Z" },
  { name: "three way split", at: "2026-10-15T12:40:00.000Z" },
  { name: "line discount", at: "2026-10-15T17:05:00.000Z" },
] as const;
/** The copy sold at the other branch by the second cashier: the 15 Oct cash line-discount sale again, at 10:00. */
export const copied = { index: 5, at: "2026-10-15T10:00:00.000Z" };

/** A golden figure of a planned sale: gross, net, nhil, getfund, vat, rounding, cash, momo, card, change. */
export const figure = (index: number, field: number) =>
  expected[tradingDay.findIndex((s) => s.name === plan[index]!.name)]![field]!;

export async function reportWorld() {
  const world = await goldenWorld({
    since: "2026-10-14T00:00:00.000Z",
    until: "2026-10-17T00:00:00.000Z",
  });
  const owner = await portalOwner(ids.org, ids.cashier);
  const otherBranch = await addBranch(ids.store);
  const clerk = await portalMember(owner, "cashier");
  const second = (await owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie: clerk } }),
  ))!.userId;
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Report Supplies"),
    on: "2026-10-01",
    at: "07:00",
    lines: [{ productId: products.standard.id, quantity: 100_000, unitCost: 50_000 }],
  });
  const sales: SaleSnapshot[] = [];
  for (const sale of plan)
    sales.push(
      (await runGolden(
        world,
        tradingDay.find((s) => s.name === sale.name)!,
        new Date(sale.at),
      ))!,
    );
  const copy = await cloneSale(sales[copied.index]!.id, {
    branchId: otherBranch,
    cashierId: second,
    at: copied.at,
  });
  const event = refundEvent(world, sales[2]!, [{ line: 0, before: 0, after: 1_000 }]);
  event.refund.deviceTime = "2026-10-15T18:00:00.000Z";
  const refunded = await postRefund(event, world.session.proof);
  if (!refunded.body.accepted) throw new Error("The report world's refund was refused");
  const [refund] = (
    await world.db.execute<{ gross: string; total: string }>(
      sql`SELECT gross::text, total::text FROM refund WHERE id = ${event.refund.id}`,
    )
  ).rows;
  return {
    world,
    owner,
    otherBranch,
    second,
    sales,
    copy,
    refund: { gross: Number(refund!.gross), total: Number(refund!.total) },
  };
}

/**
 * Copies an accepted sale (row, lines and tenders) to another branch, cashier and time, with fresh ids and no
 * receipt number or sequence, and marks that store day stale as acceptance would.
 */
async function cloneSale(saleId: string, to: { branchId: string; cashierId: string; at: string }) {
  const { db } = databases();
  const id = v7();
  await db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO sale (id, org_id, device_id, local_id, store_id, branch_id, cashier_id,
        session_id, app_version, event_version, device_time, occurred_at, payload, content_hash, status, total,
        cash_rounding, paid, change)
      SELECT ${id}, org_id, device_id, ${v7()}, store_id, ${to.branchId}, ${to.cashierId}, session_id, app_version,
        event_version, ${to.at}::timestamptz, ${to.at}::timestamptz, payload, content_hash, status, total,
        cash_rounding, paid, change
      FROM sale WHERE id = ${saleId}`);
    await tx.execute(sql`INSERT INTO sale_line (org_id, sale_id, product_id, price_id, tax_rule_id, payload)
      SELECT org_id, ${id}, product_id, price_id, tax_rule_id, payload FROM sale_line WHERE sale_id = ${saleId}`);
    await tx.execute(sql`INSERT INTO sale_tender (org_id, sale_id, position, kind, amount, reference)
      SELECT org_id, ${id}, position, kind, amount, reference FROM sale_tender WHERE sale_id = ${saleId}`);
    await touchStoreDay(tx, ids.org, ids.store, new Date(to.at));
  });
  return id;
}
