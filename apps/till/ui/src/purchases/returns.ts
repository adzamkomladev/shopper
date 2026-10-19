import { v7 } from "uuid";
import type {
  PurchaseDetails,
  PurchaseLookup,
  PurchasesSnapshot,
  RefundInput,
  RefundOutcome,
} from "../sale/types";
import { request } from "../connection/store";
import { currentDraftRevision } from "../sale/store";
import { refundFailure, refundTarget } from "./refunds";

export const idleLookup: PurchaseLookup = { status: "idle", receipt: "", message: null };

type Dependencies = {
  update: (change: Partial<PurchasesSnapshot>) => void;
  /** Starts a new selection, so any earlier read or lookup that is still in flight is dropped. */
  select: () => number;
  isCurrent: (selection: number) => boolean;
  /** The list is out of date: it is read again when the cashier is back on it. */
  markStale: () => void;
};

/** Finding a sale by receipt number, and the return flow from the detail: preview, record, refresh. */
export function createReturns({ update, select, isCurrent, markStale }: Dependencies) {
  let returning = 0;
  /** One id per return attempt: a retry after a lost reply reuses it, and the next return screen gets a new one. */
  let refundId = v7();

  /** The same sale read again after a refund changed it. */
  async function reread(purchase: PurchaseDetails) {
    const reply =
      purchase.origin === "local"
        ? await request({
            type: "sales.read",
            expectedRevision: currentDraftRevision(),
            saleId: purchase.id,
          })
        : await request({ type: "sales.lookup", receipt: purchase.receiptNumber ?? "" });
    if (reply?.type !== "result") return null;
    if (reply.kind === "purchase") return reply.purchase;
    return reply.kind === "saleLookup" ? reply.purchase : null;
  }

  return {
    stop: () => void (returning += 1),
    lookup: async (receipt: string) => {
      const selection = select();
      update({ lookup: { status: "loading", receipt, message: null }, error: null, reprint: null });
      const reply = await request({ type: "sales.lookup", receipt });
      if (!isCurrent(selection)) return;
      if (reply?.type === "result" && reply.kind === "saleLookup") {
        if (reply.status === "found" && reply.purchase)
          return update({ selected: reply.purchase, returning: null, lookup: idleLookup });
        const status = reply.status === "offline" ? "offline" : "missing";
        return update({ lookup: { status, receipt, message: null } });
      }
      update({ lookup: { status: "failed", receipt, message: refundFailure(reply).message } });
    },
    startReturn: async (purchase: PurchaseDetails) => {
      const attempt = (returning += 1);
      refundId = v7();
      update({ returning: { status: "loading" } });
      const reply = await request({ type: "refund.preview", ...refundTarget(purchase) });
      if (attempt !== returning) return;
      update({
        returning:
          reply?.type === "result" && reply.kind === "refundPreview"
            ? { status: "ready", eligibility: reply.eligibility }
            : { status: "failed", ...refundFailure(reply) },
      });
    },
    endReturn: () => {
      returning += 1;
      update({ returning: null });
    },
    refund: async (purchase: PurchaseDetails, input: RefundInput): Promise<RefundOutcome> => {
      const reply = await request({
        type: "refund.record",
        ...refundTarget(purchase),
        ...input,
        refundId,
      });
      if (reply?.type !== "result" || reply.kind !== "refund")
        return { ok: false, ...refundFailure(reply) };
      markStale();
      returning += 1;
      const fresh = await reread(purchase);
      update({
        selected: fresh,
        returning: null,
        reprint: null,
        error: fresh ? null : "The refund was recorded. Select the receipt again to see it.",
      });
      return { ok: true, total: reply.refund.total };
    },
  };
}
