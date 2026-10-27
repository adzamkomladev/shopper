// Repricing a recorded golden sale for the price-override suites.
import { acceptSale } from "@shopper/core/sales";
import { add, money } from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import { databases, deviceId, recordSale } from "../till/server";

export type Created = Awaited<ReturnType<typeof recordSale>>;
export const reason = "Damaged pack";

/** The recorded sale with its first line repriced to `unitPrice`, every total and tender reconciled. */
export function overridden(
  created: Created,
  unitPrice: number,
  override: object | null,
  extra: Partial<Created["event"]["sale"]["lines"][number]> = {},
  second?: { unitPrice: number; override: object | null },
) {
  const event = structuredClone(created.event);
  for (const [index, edit] of [
    { unitPrice, override, extra },
    { ...second, extra: {} },
  ].entries()) {
    const line = event.sale.lines[index];
    if (!line || edit.unitPrice === undefined) continue;
    line.tax = snapshotLine({ ...line.tax, unitPrice: money(edit.unitPrice) });
    if (edit.override) Object.assign(line, { override: edit.override });
    Object.assign(line, edit.extra);
  }
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

export const accept = (created: Created, event: Created["event"]) => {
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
export const listPrice = (created: Created) => created.event.sale.lines[0]!.tax.unitPrice;
