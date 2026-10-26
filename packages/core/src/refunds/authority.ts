import type { CommandContext } from "@shopper/audit";
import type { ShopperTransaction } from "@shopper/db-pg";
import { hasGrant, sessionAuthority } from "../sales/authority";
import { SaleError } from "../sales/error";
import type { UploadPrincipal } from "../sales/types";
import type { RefundSnapshot } from "../schemas/till/refund";

/** The device scope, a live cashier session holding `refund.request`, and a named approver's live `refund.approve` grant. */
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
  if (refund.approverId) {
    if (!(await hasGrant(tx, ctx.orgId, refund.approverId, "refund.approve", occurredAt)))
      throw new SaleError("INVALID_SESSION", "Refund approver lacks refund.approve");
    ctx.approverId = refund.approverId;
  }
  ctx.role = session.roleName;
}
