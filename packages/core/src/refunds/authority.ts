import type { CommandContext } from "@shopper/audit";
import type { ShopperTransaction } from "@shopper/db-pg";
import { hasGrant, sessionAuthority } from "../sales/authority";
import { SaleError } from "../sales/error";
import { consumeApproval } from "../approvals/consume";
import type { UploadPrincipal } from "../sales/types";
import type { RefundSnapshot } from "../schemas/till/refund";

/**
 * The device scope, a live cashier session holding `refund.request`, and a named approver's live `refund.approve`
 * grant; a remote approval is used up here, once, and must name that approver.
 */
export async function validateRefundAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  principal: UploadPrincipal,
  refund: RefundSnapshot,
  proofHash: string,
  occurredAt: Date,
) {
  if (
    refund.orgId !== principal.orgId ||
    refund.deviceId !== principal.deviceId ||
    refund.branchId !== principal.branchId ||
    refund.storeId !== principal.storeId
  )
    throw new SaleError("SCOPE", "Refund is outside the enrolled device scope");
  const session = await sessionAuthority(
    tx,
    ctx,
    principal,
    refund,
    proofHash,
    occurredAt,
    "refund.request",
  );
  if (refund.approvalId) {
    const decidedBy = await consumeApproval(tx, ctx.orgId, {
      id: refund.approvalId,
      kind: "refund",
      deviceId: refund.deviceId,
      saleId: refund.originalSaleId,
      documentId: refund.id,
      amount: refund.totals.gross,
      at: occurredAt,
    });
    if (refund.approverId !== decidedBy)
      throw new SaleError("APPROVAL", "The refund names a different manager than approved it");
  }
  if (refund.approverId) {
    if (
      !(await hasGrant(
        tx,
        ctx.orgId,
        refund.approverId,
        "refund.approve",
        occurredAt,
        refund.branchId,
      ))
    )
      throw new SaleError("INVALID_SESSION", "Refund approver lacks refund.approve");
    ctx.approverId = refund.approverId;
  }
  ctx.role = session.roleName;
}
