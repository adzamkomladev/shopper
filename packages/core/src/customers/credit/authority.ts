import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { cashierSession, type ShopperTransaction } from "@shopper/db-pg";
import { sessionAuthority } from "../../sales/authority";
import type { Authority } from "../types";

/**
 * The register, a live session of the cashier, and `sale.create`. Judged as of now, or as of `occurredAt` for a
 * document the till held back: the session was good when the cashier acted, and a till clock behind the sign-in
 * reads as the sign-in itself.
 */
export async function authorize(
  tx: ShopperTransaction,
  ctx: CommandContext,
  input: Authority,
  occurredAt?: Date,
) {
  let at = new Date();
  if (occurredAt) {
    const [session] = await tx
      .select({ issuedAt: cashierSession.issuedAt })
      .from(cashierSession)
      .where(and(eq(cashierSession.orgId, ctx.orgId), eq(cashierSession.id, input.sessionId)));
    at = new Date(Math.max(occurredAt.valueOf(), session?.issuedAt.valueOf() ?? 0));
  }
  const granted = await sessionAuthority(
    tx,
    ctx,
    input.principal,
    { sessionId: input.sessionId, cashierId: input.cashierId },
    input.proofHash,
    at,
    "sale.create",
    "PERMISSION_DENIED",
  );
  ctx.role = granted.roleName;
}
