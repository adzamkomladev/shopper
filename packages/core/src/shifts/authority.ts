import type { CommandContext } from "@shopper/audit";
import type { ShopperTransaction } from "@shopper/db-pg";
import { hasGrant, sessionAuthority } from "../sales/authority";
import { SaleError } from "../sales/error";
import type { UploadPrincipal } from "../sales/types";
import type { ShiftClosedEvent } from "../schemas/till/shift";

/** The device scope, the closing session's live `shift.write`, and a named approver's live `shift.approve` grant. */
export async function validateShiftAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  principal: UploadPrincipal,
  { orgId, sessionId, report }: ShiftClosedEvent["shift"],
  proofHash: string,
) {
  if (
    orgId !== principal.orgId ||
    report.deviceId !== principal.deviceId ||
    report.branchId !== principal.branchId ||
    report.storeId !== principal.storeId
  )
    throw new SaleError("SCOPE", "Shift is outside the enrolled device scope");
  const session = await sessionAuthority(
    tx,
    ctx,
    principal,
    { sessionId, cashierId: report.closedBy },
    proofHash,
    new Date(report.closedAt),
    "shift.write",
  );
  if (report.approverId) {
    if (!(await hasGrant(tx, ctx.orgId, report.approverId, "shift.approve", new Date(report.closedAt))))
      throw new SaleError("INVALID_SESSION", "Shift approver lacks shift.approve");
    ctx.approverId = report.approverId;
  }
  ctx.role = session.roleName;
}
