// A sale line may carry override { listPrice, reason, approverId } (sale event v4). The server accepts the changed
// unit price only when listPrice is the price row and the cashier session or the approver holds sale.price_override.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { auditLog, sale } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { add, money } from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import { memberWithPin } from "../../../support/sync/members";
import { databases, deviceId, recordSale } from "../../../support/till/server";

type Created = Awaited<ReturnType<typeof recordSale>>;
const reason = "Damaged pack";

/** The recorded sale with its first line repriced to `unitPrice`, every total and tender reconciled. */
function overridden(created: Created, unitPrice: number, override: object | null) {
  const event = structuredClone(created.event);
  const line = event.sale.lines[0]!;
  line.tax = snapshotLine({ ...line.tax, unitPrice: money(unitPrice) });
  if (override) Object.assign(line, { override });
  const totals = { ...event.sale.totals };
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[key] = event.sale.lines.reduce((sum, l) => add(sum, l.tax[key]), money(0));
  }
  event.sale.totals = totals;
  event.sale.cashRounding = money(0);
  event.sale.total = totals.gross;
  event.sale.tenders[0]!.amount = totals.gross;
  event.sale.paid = totals.gross;
  event.sale.change = money(0);
  return event;
}

const accept = (created: Created, event: Created["event"]) => {
  const { db, context } = databases();
  return acceptSale(
    db,
    {
      orgId: context.orgId,
      deviceId,
      branchId: event.sale.branchId,
      storeId: event.sale.storeId,
    },
    event,
    created.proof,
  );
};
const listPrice = (created: Created) => created.event.sale.lines[0]!.tax.unitPrice;

test("an overridden line is accepted when the approver holds sale.price_override, and the audit names them", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Esi Manager", "admin", "2468");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  await accept(created, event);
  const { db } = databases();
  const [audit] = await db.select().from(auditLog).where(eq(auditLog.entityId, event.sale.id));
  expect(audit).toMatchObject({ command: "sale.accept", approverId });
  expect(audit?.actorId).toBe(event.sale.cashierId);
});

test("an overridden line is rejected when the approver lacks the grant", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Kojo Cashier", "cashier", "1111");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  const { db } = databases();
  expect(await db.select().from(sale).where(eq(sale.localId, event.sale.localId))).toEqual([]);
});

test("an override with no approver needs the cashier session to hold the grant", async () => {
  const created = await recordSale();
  const event = overridden(created, 9_000, {
    listPrice: listPrice(created),
    reason,
    approverId: null,
  });
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
});

test("an override must quote the real list price and really change the unit price", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Ama Manager", "admin", "2468");
  const wrongList = overridden(created, 9_000, { listPrice: 11_000, reason, approverId });
  await expect(accept(created, wrongList)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  const unchanged = overridden(created, listPrice(created), {
    listPrice: listPrice(created),
    reason,
    approverId,
  });
  await expect(accept(created, unchanged)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
});

test("a changed price with no override is still rejected", async () => {
  const created = await recordSale();
  await expect(accept(created, overridden(created, 9_000, null))).rejects.toMatchObject({
    code: "INVALID_REFERENCE",
  });
});
