// What the picking suites share: a paid, accepted order ready for the picker, and how its stock, books and fiscal
// documents read back.
//   const h = pickHelpers(f)  with  h.accepted(), h.net(order), h.books(order), h.payloadOf(adjustmentId)
import { acceptStoreOrder, startPicking } from "@shopper/core/orders";
import type { fulfilWorld } from "./fulfil";

export function pickHelpers(f: Awaited<ReturnType<typeof fulfilWorld>>) {
  /** A paid, accepted order with its slot a moment away, ready for the picker. */
  const accepted = async () => {
    const order = await f.paid();
    await f.slotIn(order, 300, 120_000);
    await acceptStoreOrder(f.world.db, f.ctx, f.flows, order.id);
    const [oil, rice] = await f.lines(order);
    await startPicking(f.world.db, f.ctx, { id: order.id });
    return { order, oil: oil!, rice: rice! };
  };
  const net = async (order: { id: string }) => {
    const totals = new Map<string, number>();
    for (const row of await f.movements(order))
      totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantityThousandths);
    return totals;
  };
  /** Every journal entry that belongs to the order, summed account by account. */
  const books = async (order: { id: string }) => {
    const adjustment = await f.adjustment(order);
    const original = (await f.journal("order", order.id))!;
    const extra = adjustment ? await f.journal("order", adjustment.id) : undefined;
    const sum = (entry?: typeof original) => entry?.lines ?? {};
    const total: Record<string, number> = {};
    for (const [account, amount] of [
      ...Object.entries(sum(original)),
      ...Object.entries(sum(extra)),
    ])
      total[account] = (total[account] ?? 0) + amount;
    return { original, extra, total };
  };
  const payloadOf = async (id: string | null | undefined) =>
    (await f.world.db.query.fiscalDoc.findFirst({
      where: (doc, { eq: same }) =>
        same(doc.adjustmentCreditId, id ?? "") || same(doc.adjustmentInvoiceId, id ?? ""),
    }))!.payload as {
      totals: { net: number; total: number };
      originalInvoiceNumber: string | null;
    };

  return { accepted, net, books, payloadOf };
}
