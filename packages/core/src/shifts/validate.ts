import { add, money, sub, type Money } from "@shopper/money";
import { countedCash } from "../schemas/till/shifts";
import type { ZReport } from "../schemas/till/shift";
import { SaleError } from "../sales/error";

/**
 * The Z must reproduce its own arithmetic exactly: the drawer, each tender, the count and every variance. Its sales
 * and refunds are trusted until the store-day cross-check (Day 20).
 */
export function validateShiftReport(z: ZReport) {
  // The rules of `shiftTotals` (totals.ts), checked from the Z's figures rather than its sales.
  const mismatch = (what: string) => {
    throw new SaleError("SHIFT_MISMATCH", `Shift ${what} does not add up`);
  };
  const sum = (amounts: Money[]) => amounts.reduce(add, money(0));
  const { cash } = z;
  // Signs and reasons first: anything the database would refuse must be a rejection, never a server error.
  const amounts = [cash.float, z.declared.card, z.declared.momo, z.threshold];
  for (const t of z.tenders) amounts.push(t.sales, t.refunds);
  if (amounts.some((amount) => amount < 0)) mismatch("amounts");
  if (
    z.movements.some((m) =>
      m.kind === "drop" ? m.amount <= 0 : m.amount !== 0 || !m.reason?.trim(),
    )
  )
    mismatch("movements");
  const drops = sum(z.movements.filter((m) => m.kind === "drop").map((m) => money(m.amount)));
  if (drops !== cash.drops) mismatch("drops");
  if (
    cash.expected !==
    sub(add(money(cash.float), sub(money(cash.sales), money(cash.refunds))), drops)
  )
    mismatch("expected cash");
  const kinds = z.tenders.map((t) => t.tender);
  if (kinds.join() !== "cash,card,momo") mismatch("tenders");
  for (const t of z.tenders) {
    const net = sub(money(t.sales), money(t.refunds));
    const expected = t.tender === "cash" ? cash.expected : net;
    if (t.expected !== expected) mismatch(`${t.tender} expected`);
  }
  const box = z.tenders[0]!;
  if (box.sales !== cash.sales || box.refunds !== cash.refunds) mismatch("cash tender");
  if (countedCash(z.declared.counts) !== z.declared.cash) mismatch("counted cash");
  if (z.variances.map((v) => v.tender).join() !== kinds.join()) mismatch("variances");
  for (const [index, row] of z.variances.entries()) {
    if (row.expected !== z.tenders[index]!.expected || row.declared !== z.declared[row.tender])
      mismatch(`${row.tender} variance`);
    if (row.variance !== sub(money(row.declared), money(row.expected)))
      mismatch(`${row.tender} variance`);
  }
  const approvalRequired = z.variances.some((row) => Math.abs(row.variance) > z.threshold);
  if (approvalRequired && !z.approverId)
    throw new SaleError("APPROVAL_REQUIRED", "A variance over the threshold needs a manager");
}
