import { and, eq } from "drizzle-orm";
import { approvalRequest, type ShopperTransaction } from "@shopper/db-pg";
import type { Money } from "@shopper/money";
import { SaleError } from "../sales/error";

/**
 * Uses a remote approval inside the transaction that accepts the refund or discount it approved, and returns the
 * manager who approved it. It must be an approved request of this kind from this register for this sale and amount,
 * not used by another document; anything else rejects the upload.
 */
export async function consumeApproval(
  tx: ShopperTransaction,
  orgId: string,
  use: {
    id: string;
    kind: "refund" | "discount";
    deviceId: string;
    saleId?: string;
    /** The refund or sale using it; a replayed upload of that same document is not a second use. */
    documentId: string;
    amount: Money;
    at: Date;
  },
) {
  const [row] = await tx
    .select()
    .from(approvalRequest)
    .where(and(eq(approvalRequest.orgId, orgId), eq(approvalRequest.id, use.id)))
    .for("update");
  const reason = !row
    ? "is unknown"
    : row.status !== "approved"
      ? `was ${row.status === "pending" ? "not answered" : row.status}`
      : row.consumedAt && row.consumedBy !== use.documentId
        ? "has already been used"
        : row.kind !== use.kind || row.deviceId !== use.deviceId
          ? "was for something else"
          : (use.saleId && row.subject.saleId !== use.saleId) || row.subject.amount !== use.amount
            ? "does not match this sale and amount"
            : undefined;
  if (reason) throw new SaleError("APPROVAL", `The manager's approval ${reason}`);
  await tx
    .update(approvalRequest)
    .set({ consumedAt: row!.consumedAt ?? use.at, consumedBy: use.documentId })
    .where(and(eq(approvalRequest.orgId, orgId), eq(approvalRequest.id, use.id)));
  return row!.decidedBy!;
}
