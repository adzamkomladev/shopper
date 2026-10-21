// A trading day for the shift report suites, sold and moved as the extended `clerk` (refunds.ts), plus staff names.
//   sellTenders(db, time, quantityThousandths, [{ kind, amount }]) -> SaleSnapshot (ordinary product, 12 000 a unit)
//   tradeDay(db)  -> four sales, a drop, a no-sale and two refunds on the open shift (figures worked in report.test.ts)
//   addStaff(db, userId, name) -> the till_staff row the report names a cashier from
import { addDraftTender, completeDraftSale, dropCash, recordNoSale } from "@shopper/core/till";
import type { SaleSnapshot } from "@shopper/core/schemas";
import { tillStaff, type TillDatabase } from "@shopper/db-sqlite";
import { config } from "./basket";
import { add, ctx, ids, products, scope } from "./drafts";
import { clerk, refund } from "./refunds";

type Tender = { kind: "cash" | "card"; amount: number };

export async function sellTenders(
  db: TillDatabase,
  time: string,
  quantityThousandths: number,
  tenders: Tender[],
) {
  const at = new Date(time);
  const view = await add(db, 0, { productId: products.ordinary.id, quantityThousandths }, { at });
  let revision = view.draft?.revision ?? 0;
  for (const tender of tenders) {
    const card = tender.kind === "card" ? { approvalCode: "AB1234", last4: "4242" } : {};
    await addDraftTender(db, ctx, { scope, expectedRevision: revision, at, ...tender, ...card });
    revision += 1;
  }
  const event = await completeDraftSale(db, { ...config, now: () => at }, clerk, {
    scope,
    expectedRevision: revision,
    at,
  });
  return event.sale as SaleSnapshot;
}

export const day = "2025-12-20";
export const hour = (time: string) => `${day}T${time}:00.000Z`;
export const move = { drop: hour("11:00"), noSale: hour("11:30") };

/** Sales 09:00-09:45, a GHS 100 drop 11:00, a no-sale 11:30, a cash refund 12:00 and a card refund 12:10. */
export async function tradeDay(db: TillDatabase) {
  // 3 units = 36 000 (GHS 3.60); GHS 5.00 handed over, GHS 1.40 change, no rounding.
  const rice = await sellTenders(db, hour("09:00"), 3_000, [{ kind: "cash", amount: 50_000 }]);
  // 1.05 units = 12 600, rounded up to 13 000 in cash; GHS 2.00 handed over, 7 000 change.
  const rounded = await sellTenders(db, hour("09:15"), 1_050, [{ kind: "cash", amount: 20_000 }]);
  const card = await sellTenders(db, hour("09:30"), 2_000, [{ kind: "card", amount: 24_000 }]);
  const split = await sellTenders(db, hour("09:45"), 1_000, [
    { kind: "card", amount: 2_000 },
    { kind: "cash", amount: 10_000 },
  ]);
  const at = (time: string) => new Date(time);
  await dropCash(db, config, clerk, { at: at(move.drop), amount: 1_000_000, reason: "Safe run" });
  await recordNoSale(db, config, clerk, { at: at(move.noSale), reason: "Change request" });
  // The rounded sale back in full pays out its rounded 13 000; half of the card sale goes back as 6 000.
  await refund(db, rounded, [[0, 1_050]], { at: hour("12:00") });
  await refund(db, card, [[0, 500]], {
    at: hour("12:10"),
    tender: { kind: "card", reference: "CARD-9" },
  });
  return { rice, rounded, card, split };
}

export const addStaff = (db: TillDatabase, userId: string, name: string) =>
  db.transaction((tx) =>
    tx.insert(tillStaff).values({
      orgId: ids.org,
      userId,
      email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
      name,
      verifier: "verifier",
      verifiedAt: "2025-12-01T00:00:00.000Z",
    }),
  );
